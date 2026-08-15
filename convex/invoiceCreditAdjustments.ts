import type { Doc, Id } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { centsToMad } from "./money";

const EPS_CENTS = 1;

export type InvoiceLedgerStatus = "impayé" | "solde";

export type InvoicePaymentAllocation = {
  invoiceId: Id<"invoices">;
  ledgerEntryId: Id<"creditLedgerEntries">;
  amountMadCents: number;
  date: string;
  ref: string;
  note: string;
};

type ClientInvoiceSettlement = {
  statusByInvoiceId: Map<Id<"invoices">, InvoiceLedgerStatus>;
  allocations: InvoicePaymentAllocation[];
  outstandingMadCents: number;
};

type InvoiceBalance = {
  invoiceId: Id<"invoices">;
  date: string;
  refSortKey: string;
  creationTime: number;
  remainingCents: number;
};

function ledgerEntryIsPayment(
  entry: Pick<Doc<"creditLedgerEntries">, "kind" | "source">,
) {
  return entry.kind === "payment" && entry.source !== "return";
}

function ledgerEntryIsReturn(
  entry: Pick<Doc<"creditLedgerEntries">, "kind" | "source">,
) {
  return entry.kind === "return" || entry.source === "return";
}

function invoiceNumberSortKey(ref: string): string {
  const match = ref.match(/INV-(\d+)/i);
  return match ? match[1]!.padStart(12, "0") : ref;
}

function compareInvoiceOrder(a: InvoiceBalance, b: InvoiceBalance): number {
  const byDate = a.date.localeCompare(b.date);
  if (byDate !== 0) return byDate;
  const byRef = a.refSortKey.localeCompare(b.refSortKey);
  if (byRef !== 0) return byRef;
  return a.creationTime - b.creationTime;
}

async function loadInvoiceDebtCentsById(
  ctx: QueryCtx | MutationCtx,
  entries: readonly Doc<"creditLedgerEntries">[],
): Promise<Map<Id<"invoices">, number>> {
  const invoiceIds = [
    ...new Set(
      entries
        .filter(
          (
            entry,
          ): entry is Doc<"creditLedgerEntries"> & {
            invoiceId: Id<"invoices">;
          } => entry.kind === "invoice" && entry.invoiceId != null,
        )
        .map((entry) => entry.invoiceId),
    ),
  ];
  const debtByInvoiceId = new Map<Id<"invoices">, number>();
  await Promise.all(
    invoiceIds.map(async (invoiceId) => {
      // Gross factured amount (returns are separate ledger credits).
      debtByInvoiceId.set(
        invoiceId,
        await computeInvoiceGrossTotalCents(ctx, invoiceId),
      );
    }),
  );
  return debtByInvoiceId;
}

function runClientInvoiceSettlement(
  entries: readonly Doc<"creditLedgerEntries">[],
  invoiceDebtCentsById?: Map<Id<"invoices">, number>,
): ClientInvoiceSettlement {
  const sorted = [...entries].sort((a, b) => {
    const byDate = a.date.localeCompare(b.date);
    if (byDate !== 0) return byDate;
    return a._creationTime - b._creationTime;
  });

  const invoicesById = new Map<Id<"invoices">, InvoiceBalance>();
  for (const entry of sorted) {
    if (entry.kind === "invoice" && entry.invoiceId) {
      const remainingCents =
        invoiceDebtCentsById?.get(entry.invoiceId) ?? entry.amountMadCents;
      invoicesById.set(entry.invoiceId, {
        invoiceId: entry.invoiceId,
        date: entry.date,
        refSortKey: invoiceNumberSortKey(entry.ref),
        creationTime: entry._creationTime,
        remainingCents,
      });
    }
  }

  const invoiceOrder = () => [...invoicesById.values()].sort(compareInvoiceOrder);
  const allocations: InvoicePaymentAllocation[] = [];

  function recordAllocation(
    invoiceId: Id<"invoices">,
    entry: Doc<"creditLedgerEntries">,
    amountMadCents: number,
  ) {
    if (amountMadCents <= EPS_CENTS) return;
    allocations.push({
      invoiceId,
      ledgerEntryId: entry._id,
      amountMadCents,
      date: entry.date,
      ref: entry.ref,
      note: entry.note,
    });
  }

  function applyCredit(
    entry: Doc<"creditLedgerEntries">,
    cents: number,
    targetInvoiceId?: Id<"invoices">,
  ) {
    let left = cents;

    if (targetInvoiceId) {
      const invoice = invoicesById.get(targetInvoiceId);
      if (invoice && invoice.remainingCents > EPS_CENTS) {
        const applied = Math.min(left, invoice.remainingCents);
        recordAllocation(targetInvoiceId, entry, applied);
        invoice.remainingCents -= applied;
        left -= applied;
      }
      return;
    }

    for (const invoice of invoiceOrder()) {
      if (left <= EPS_CENTS) break;
      if (invoice.remainingCents <= EPS_CENTS) continue;
      const applied = Math.min(left, invoice.remainingCents);
      recordAllocation(invoice.invoiceId, entry, applied);
      invoice.remainingCents -= applied;
      left -= applied;
    }
  }

  for (const entry of sorted) {
    if (entry.kind === "invoice") continue;
    if (ledgerEntryIsPayment(entry) || ledgerEntryIsReturn(entry)) {
      applyCredit(entry, entry.amountMadCents, entry.invoiceId ?? undefined);
    }
  }

  const statusByInvoiceId = new Map<Id<"invoices">, InvoiceLedgerStatus>();
  let outstandingMadCents = 0;
  for (const invoice of invoicesById.values()) {
    statusByInvoiceId.set(
      invoice.invoiceId,
      invoice.remainingCents <= EPS_CENTS ? "solde" : "impayé",
    );
    if (invoice.remainingCents > EPS_CENTS) {
      outstandingMadCents += invoice.remainingCents;
    }
  }

  return { statusByInvoiceId, allocations, outstandingMadCents };
}

async function runClientInvoiceSettlementResolved(
  ctx: QueryCtx | MutationCtx,
  entries: readonly Doc<"creditLedgerEntries">[],
): Promise<ClientInvoiceSettlement> {
  const invoiceDebtCentsById = await loadInvoiceDebtCentsById(ctx, entries);
  return runClientInvoiceSettlement(entries, invoiceDebtCentsById);
}

export async function computeClientInvoiceSettlementStatusesForClient(
  ctx: QueryCtx | MutationCtx,
  entries: readonly Doc<"creditLedgerEntries">[],
): Promise<Map<Id<"invoices">, InvoiceLedgerStatus>> {
  return (await runClientInvoiceSettlementResolved(ctx, entries))
    .statusByInvoiceId;
}

export async function computeClientOutstandingMadCents(
  ctx: QueryCtx | MutationCtx,
  clientId: Id<"clients">,
): Promise<number> {
  const entries = await ctx.db
    .query("creditLedgerEntries")
    .withIndex("by_clientId_date", (q) => q.eq("clientId", clientId))
    .collect();
  const { outstandingMadCents } = await runClientInvoiceSettlementResolved(
    ctx,
    entries,
  );
  return outstandingMadCents;
}

export function computeClientInvoiceSettlementStatuses(
  entries: readonly Doc<"creditLedgerEntries">[],
): Map<Id<"invoices">, InvoiceLedgerStatus> {
  return runClientInvoiceSettlement(entries).statusByInvoiceId;
}

export function computeClientInvoicePaymentAllocations(
  entries: readonly Doc<"creditLedgerEntries">[],
): InvoicePaymentAllocation[] {
  return runClientInvoiceSettlement(entries).allocations;
}

export async function persistLedgerPaymentAllocations(
  ctx: MutationCtx,
  clientId: Id<"clients">,
) {
  const entries = await ctx.db
    .query("creditLedgerEntries")
    .withIndex("by_clientId_date", (q) => q.eq("clientId", clientId))
    .collect();
  const { allocations } = await runClientInvoiceSettlementResolved(ctx, entries);
  const now = Date.now();
  const touchedInvoiceIds = new Set<Id<"invoices">>();

  for (const allocation of allocations) {
    const existingForInvoice = await ctx.db
      .query("invoicePayments")
      .withIndex("by_invoiceId_date", (q) =>
        q.eq("invoiceId", allocation.invoiceId),
      )
      .filter((q) => q.eq(q.field("ledgerEntryId"), allocation.ledgerEntryId))
      .first();

    if (existingForInvoice) {
      if (existingForInvoice.amountMadCents !== allocation.amountMadCents) {
        await ctx.db.patch(existingForInvoice._id, {
          amountMadCents: allocation.amountMadCents,
          date: allocation.date,
          note: allocation.note,
          ref: allocation.ref,
        });
        touchedInvoiceIds.add(allocation.invoiceId);
      }
      continue;
    }

    await ctx.db.insert("invoicePayments", {
      invoiceId: allocation.invoiceId,
      ledgerEntryId: allocation.ledgerEntryId,
      date: allocation.date,
      amountMadCents: allocation.amountMadCents,
      note: allocation.note,
      ref: allocation.ref,
      createdAt: now,
    });
    touchedInvoiceIds.add(allocation.invoiceId);
  }

  await Promise.all(
    [...touchedInvoiceIds].map(async (invoiceId) => {
      const invoice = await ctx.db.get(invoiceId);
      if (!invoice || invoice.paymentType !== "credit") return;
      if (invoice.status === "returned") return;
      const paidMadCents = await invoicePaymentsTotalCents(ctx, invoiceId);
      const nextStatus =
        paidMadCents >= invoice.totalMadCents ? "paid" : "pending";
      if (invoice.status === nextStatus) return;
      await ctx.db.patch(invoiceId, { status: nextStatus, updatedAt: now });
    }),
  );
}

export async function resolveInvoiceLedgerStatus(
  ctx: QueryCtx | MutationCtx,
  invoiceId: Id<"invoices">,
): Promise<InvoiceLedgerStatus> {
  const invoiceEntry = await ctx.db
    .query("creditLedgerEntries")
    .withIndex("by_invoiceId", (q) => q.eq("invoiceId", invoiceId))
    .filter((q) => q.eq(q.field("kind"), "invoice"))
    .first();
  if (!invoiceEntry) return "impayé";

  const clientEntries = await ctx.db
    .query("creditLedgerEntries")
    .withIndex("by_clientId_date", (q) =>
      q.eq("clientId", invoiceEntry.clientId),
    )
    .collect();

  const { statusByInvoiceId } = await runClientInvoiceSettlementResolved(
    ctx,
    clientEntries,
  );
  return statusByInvoiceId.get(invoiceId) ?? "impayé";
}

async function syncClientCreditLedgerAmounts(
  ctx: MutationCtx,
  entries: readonly Doc<"creditLedgerEntries">[],
) {
  const invoiceIds = [
    ...new Set(
      entries
        .filter(
          (
            entry,
          ): entry is Doc<"creditLedgerEntries"> & {
            invoiceId: Id<"invoices">;
          } => entry.kind === "invoice" && entry.invoiceId != null,
        )
        .map((entry) => entry.invoiceId),
    ),
  ];
  await Promise.all(
    invoiceIds.map((invoiceId) => syncInvoiceCreditLedgerAmount(ctx, invoiceId)),
  );
}

export async function syncClientInvoiceLedgerStatuses(
  ctx: MutationCtx,
  clientId: Id<"clients">,
) {
  const entries = await ctx.db
    .query("creditLedgerEntries")
    .withIndex("by_clientId_date", (q) => q.eq("clientId", clientId))
    .collect();
  await syncClientCreditLedgerAmounts(ctx, entries);
  const { statusByInvoiceId } = await runClientInvoiceSettlementResolved(
    ctx,
    entries,
  );
  await Promise.all(
    entries.map(async (entry) => {
      if (entry.kind !== "invoice" || !entry.invoiceId) return;
      const next = statusByInvoiceId.get(entry.invoiceId) ?? "impayé";
      if (entry.status !== next) {
        await ctx.db.patch(entry._id, { status: next });
      }
    }),
  );
  await persistLedgerPaymentAllocations(ctx, clientId);
}

export async function invoicePaymentsTotalCents(
  ctx: QueryCtx | MutationCtx,
  invoiceId: Id<"invoices">,
) {
  const payments = await ctx.db
    .query("invoicePayments")
    .withIndex("by_invoiceId_date", (q) => q.eq("invoiceId", invoiceId))
    .take(200);
  return payments.reduce((sum, payment) => sum + payment.amountMadCents, 0);
}

export async function invoiceCreditOutstandingCents(
  ctx: QueryCtx | MutationCtx,
  invoiceId: Id<"invoices">,
) {
  const entries = await ctx.db
    .query("creditLedgerEntries")
    .withIndex("by_invoiceId", (q) => q.eq("invoiceId", invoiceId))
    .take(300);
  return entries.reduce((sum, entry) => {
    if (entry.kind === "invoice") return sum + entry.amountMadCents;
    // Payments and returns reduce what is owed on this invoice.
    return sum - entry.amountMadCents;
  }, 0);
}

export async function syncInvoiceCreditLedgerAmount(
  ctx: MutationCtx,
  invoiceId: Id<"invoices">,
) {
  const invoiceEntry = await ctx.db
    .query("creditLedgerEntries")
    .withIndex("by_invoiceId", (q) => q.eq("invoiceId", invoiceId))
    .filter((q) => q.eq(q.field("kind"), "invoice"))
    .first();
  if (!invoiceEntry) return;

  // Keep ledger invoice at the original factured total; returns are
  // separate credit lines and must not shrink this amount.
  const grossMadCents = await computeInvoiceGrossTotalCents(ctx, invoiceId);
  if (invoiceEntry.amountMadCents === grossMadCents) return;

  await ctx.db.patch(invoiceEntry._id, {
    amountMadCents: grossMadCents,
  });
}

/** Remaining after returns (net merchandise value). */
export async function computeInvoiceTotalCents(
  ctx: QueryCtx | MutationCtx,
  invoiceId: Id<"invoices">,
): Promise<number> {
  const lines = await ctx.db
    .query("invoiceLines")
    .withIndex("by_invoiceId", (q) => q.eq("invoiceId", invoiceId))
    .take(300);
  return lines.reduce((sum, line) => {
    const remainingQty = Math.max(0, line.qty - line.returnedQty);
    return sum + Math.round(remainingQty * line.unitPriceMadCents);
  }, 0);
}

/** Original factured total (qty sold × price, ignoring returns). */
export async function computeInvoiceGrossTotalCents(
  ctx: QueryCtx | MutationCtx,
  invoiceId: Id<"invoices">,
): Promise<number> {
  const lines = await ctx.db
    .query("invoiceLines")
    .withIndex("by_invoiceId", (q) => q.eq("invoiceId", invoiceId))
    .take(300);
  return lines.reduce(
    (sum, line) => sum + Math.round(line.qty * line.unitPriceMadCents),
    0,
  );
}

export async function computeInvoiceReturnedArticlesQty(
  ctx: QueryCtx | MutationCtx,
  invoiceId: Id<"invoices">,
): Promise<number> {
  const lines = await ctx.db
    .query("invoiceLines")
    .withIndex("by_invoiceId", (q) => q.eq("invoiceId", invoiceId))
    .take(300);
  return lines.reduce((sum, line) => sum + Math.max(0, line.returnedQty), 0);
}

export async function resolveInvoiceStatus(
  ctx: MutationCtx,
  invoice: Doc<"invoices">,
  invoiceId: Id<"invoices">,
  nextTotalMadCents: number,
  paidMadCents: number,
): Promise<Doc<"invoices">["status"]> {
  if (nextTotalMadCents <= 0) return "returned";
  if (invoice.paymentType === "cash") return "paid";
  if (invoice.paymentType === "credit") {
    const outstandingMadCents = Math.max(
      0,
      await invoiceCreditOutstandingCents(ctx, invoiceId),
    );
    if (outstandingMadCents > 0) return "pending";
  }
  return paidMadCents >= nextTotalMadCents ? "paid" : "pending";
}

export async function syncInvoiceLedgerEntry(
  ctx: MutationCtx,
  invoiceId: Id<"invoices">,
) {
  const invoiceEntry = await ctx.db
    .query("creditLedgerEntries")
    .withIndex("by_invoiceId", (q) => q.eq("invoiceId", invoiceId))
    .filter((q) => q.eq(q.field("kind"), "invoice"))
    .first();
  if (!invoiceEntry) return;

  const clientEntries = await ctx.db
    .query("creditLedgerEntries")
    .withIndex("by_clientId_date", (q) =>
      q.eq("clientId", invoiceEntry.clientId),
    )
    .collect();
  const { statusByInvoiceId } = await runClientInvoiceSettlementResolved(
    ctx,
    clientEntries,
  );
  const nextStatus = statusByInvoiceId.get(invoiceId) ?? "impayé";
  if (invoiceEntry.status === nextStatus) return;

  await ctx.db.patch(invoiceEntry._id, { status: nextStatus });
}

async function creditLedgerPaymentHistoryForInvoice(
  ctx: QueryCtx,
  invoice: Doc<"invoices">,
): Promise<InvoicePaymentHistoryItemView[]> {
  if (invoice.paymentType !== "credit") return [];

  let clientId = invoice.clientId;
  if (!clientId) {
    const invoiceEntry = await ctx.db
      .query("creditLedgerEntries")
      .withIndex("by_invoiceId", (q) => q.eq("invoiceId", invoice._id))
      .filter((q) => q.eq(q.field("kind"), "invoice"))
      .first();
    clientId = invoiceEntry?.clientId;
  }
  if (!clientId) return [];

  // Only movements explicitly linked to this invoice (return, plan,
  // paiement ciblé). Do NOT invent history from FIFO allocation of
  // global client versements — those belong on the client ledger.
  const entries = await ctx.db
    .query("creditLedgerEntries")
    .withIndex("by_invoiceId", (q) => q.eq("invoiceId", invoice._id))
    .take(300);

  const history: InvoicePaymentHistoryItemView[] = [];
  for (const entry of entries) {
    if (entry.kind === "invoice") continue;
    history.push({
      id: entry._id,
      date: entry.date,
      amountMad: centsToMad(entry.amountMadCents),
      note: entry.note,
      ref: entry.ref,
    });
  }
  return history;
}

type InvoicePaymentHistoryItemView = {
  id: string;
  date: string;
  amountMad: number;
  note: string;
  ref: string;
};

export async function invoiceSettlementAmounts(
  ctx: QueryCtx,
  invoice: Doc<"invoices">,
): Promise<{ paidMad: number; remainingMad: number }> {
  const totalMad = centsToMad(invoice.totalMadCents);

  if (invoice.paymentType !== "credit" || !invoice.clientId) {
    const history = await buildInvoicePaymentHistory(ctx, invoice);
    const paidMad =
      Math.round(history.reduce((sum, item) => sum + item.amountMad, 0) * 100) /
      100;
    return {
      paidMad,
      remainingMad: Math.max(0, Math.round((totalMad - paidMad) * 100) / 100),
    };
  }

  const entries = await ctx.db
    .query("creditLedgerEntries")
    .withIndex("by_clientId_date", (q) => q.eq("clientId", invoice.clientId!))
    .collect();
  const settlement = await runClientInvoiceSettlementResolved(ctx, entries);
  if (settlement.statusByInvoiceId.get(invoice._id) === "solde") {
    return { paidMad: totalMad, remainingMad: 0 };
  }

  const gross = await computeInvoiceGrossTotalCents(ctx, invoice._id);
  const allocated = settlement.allocations
    .filter((a) => a.invoiceId === invoice._id)
    .reduce((sum, a) => sum + a.amountMadCents, 0);
  const remainingMadCents = Math.max(0, gross - allocated);
  const remainingMad = centsToMad(remainingMadCents);
  const paidMad = Math.max(
    0,
    Math.round((totalMad - remainingMad) * 100) / 100,
  );
  return { paidMad, remainingMad };
}

export async function buildInvoicePaymentHistory(
  ctx: QueryCtx,
  invoice: Doc<"invoices">,
): Promise<InvoicePaymentHistoryItemView[]> {
  if (invoice.paymentType === "credit") {
    const linkedHistory = await creditLedgerPaymentHistoryForInvoice(
      ctx,
      invoice,
    );
    const directPayments = await ctx.db
      .query("invoicePayments")
      .withIndex("by_invoiceId_date", (q) => q.eq("invoiceId", invoice._id))
      .order("desc")
      .take(100);
    const paymentHistory: InvoicePaymentHistoryItemView[] = [...linkedHistory];
    for (const payment of directPayments) {
      if (payment.ledgerEntryId) continue;
      paymentHistory.push({
        id: payment._id,
        date: payment.date,
        amountMad: centsToMad(payment.amountMadCents),
        note: payment.note,
        ref: payment.ref,
      });
    }
    paymentHistory.sort((a, b) => b.date.localeCompare(a.date));
    return paymentHistory;
  }

  const payments = await ctx.db
    .query("invoicePayments")
    .withIndex("by_invoiceId_date", (q) => q.eq("invoiceId", invoice._id))
    .order("desc")
    .take(100);

  const paymentHistory: InvoicePaymentHistoryItemView[] = payments.map(
    (payment) => ({
      id: payment._id,
      date: payment.date,
      amountMad: centsToMad(payment.amountMadCents),
      note: payment.note,
      ref: payment.ref,
    }),
  );

  paymentHistory.sort((a, b) => b.date.localeCompare(a.date));
  return paymentHistory;
}

export async function resolveCreditInvoiceDisplayStatus(
  ctx: QueryCtx,
  invoice: Doc<"invoices">,
): Promise<Doc<"invoices">["status"]> {
  if (invoice.paymentType !== "credit") return invoice.status;
  if (invoice.status === "returned") return "returned";
  if (!invoice.clientId) return invoice.status;

  const entries = await ctx.db
    .query("creditLedgerEntries")
    .withIndex("by_clientId_date", (q) => q.eq("clientId", invoice.clientId!))
    .collect();
  const settlement = await runClientInvoiceSettlementResolved(ctx, entries);
  const ledgerStatus = settlement.statusByInvoiceId.get(invoice._id);
  if (ledgerStatus === "solde") return "paid";
  if (ledgerStatus === "impayé") return "pending";
  return invoice.status;
}

export async function resolveInvoiceDisplayStatus(
  _ctx: QueryCtx,
  invoice: Doc<"invoices">,
  paymentHistory: InvoicePaymentHistoryItemView[],
): Promise<Doc<"invoices">["status"]> {
  if (invoice.status === "returned") return "returned";
  if (invoice.paymentType === "cash") return invoice.status;

  const paidMadCents = Math.round(
    paymentHistory.reduce((sum, item) => sum + item.amountMad, 0) * 100,
  );
  if (paidMadCents >= invoice.totalMadCents) return "paid";
  return "pending";
}
