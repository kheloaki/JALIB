import { v } from "convex/values";

import { mutation, query } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { recordAuditForUser } from "./audit";
import {
  hasAnyPermission,
  requireAnyPermission,
  requirePermission,
} from "./authz";
import {
  nextDueDateAfterPlanPayment,
  planRemainingMadCents,
} from "./installmentMath";
import { rejectPendingLedgerUpdateRequests } from "./creditLedgerUpdateRequests";
import {
  computeClientInvoiceSettlementStatusesForClient,
  computeInvoiceGrossTotalCents,
  computeInvoiceReturnedArticlesQty,
  syncClientInvoiceLedgerStatuses,
  syncInvoiceLedgerEntry,
} from "./invoiceCreditAdjustments";
import { centsToMad, madToCents } from "./money";

const ledgerKind = v.union(
  v.literal("payment"),
  v.literal("invoice"),
  v.literal("return"),
);
const ledgerStatus = v.union(
  v.literal("valide"),
  v.literal("impayé"),
  v.literal("solde"),
);
const ledgerSource = v.union(
  v.literal("manual"),
  v.literal("pos"),
  v.literal("plan"),
  v.literal("return"),
  v.literal("migration"),
);

const ledgerEntryView = v.object({
  id: v.id("creditLedgerEntries"),
  clientId: v.id("clients"),
  planId: v.union(v.id("installmentPlans"), v.null()),
  invoiceId: v.union(v.id("invoices"), v.null()),
  kind: ledgerKind,
  date: v.string(),
  time: v.union(v.string(), v.null()),
  createdAt: v.number(),
  ref: v.string(),
  note: v.string(),
  amountMad: v.number(),
  status: ledgerStatus,
  source: ledgerSource,
  invoiceVerified: v.union(v.boolean(), v.null()),
  returnedArticlesQty: v.union(v.number(), v.null()),
});

type LedgerEntryView = {
  id: Id<"creditLedgerEntries">;
  clientId: Id<"clients">;
  planId: Id<"installmentPlans"> | null;
  invoiceId: Id<"invoices"> | null;
  kind: Doc<"creditLedgerEntries">["kind"];
  date: string;
  time: string | null;
  createdAt: number;
  ref: string;
  note: string;
  amountMad: number;
  status: Doc<"creditLedgerEntries">["status"];
  source: Doc<"creditLedgerEntries">["source"];
  invoiceVerified: boolean | null;
  returnedArticlesQty: number | null;
};

/** HH:mm in Morocco local time from a createdAt timestamp. */
function clockHmFromMs(ms: number): string {
  return new Intl.DateTimeFormat("fr-FR", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Africa/Casablanca",
  }).format(new Date(ms));
}

function normalizeClockHm(raw: string | undefined | null): string | null {
  const t = raw?.trim();
  if (!t) return null;
  const match = t.match(/^(\d{1,2}):(\d{2})/);
  if (!match) return t;
  return `${match[1]!.padStart(2, "0")}:${match[2]}`;
}

function toLedgerEntryView(entry: Doc<"creditLedgerEntries">): LedgerEntryView {
  return {
    id: entry._id,
    clientId: entry.clientId,
    planId: entry.planId ?? null,
    invoiceId: entry.invoiceId ?? null,
    kind: entry.source === "return" ? "return" : entry.kind,
    date: entry.date,
    time: clockHmFromMs(entry.createdAt),
    createdAt: entry.createdAt,
    ref: entry.ref,
    note: entry.note,
    amountMad: centsToMad(entry.amountMadCents),
    status: entry.status,
    source: entry.source,
    invoiceVerified: null,
    returnedArticlesQty: null,
  };
}

async function enrichLedgerEntryViews(
  ctx: QueryCtx | MutationCtx,
  views: LedgerEntryView[],
): Promise<LedgerEntryView[]> {
  const invoiceIds = [
    ...new Set(
      views
        .map((view) => view.invoiceId)
        .filter((id): id is Id<"invoices"> => id !== null),
    ),
  ];
  const verifiedByInvoiceId = new Map<Id<"invoices">, boolean>();
  const timeByInvoiceId = new Map<Id<"invoices">, string>();
  await Promise.all(
    invoiceIds.map(async (invoiceId) => {
      const invoice = await ctx.db.get(invoiceId);
      verifiedByInvoiceId.set(invoiceId, invoice?.verifiedAt != null);
      const invoiceTime = normalizeClockHm(invoice?.time);
      if (invoiceTime) timeByInvoiceId.set(invoiceId, invoiceTime);
    }),
  );

  const clientIds = [...new Set(views.map((view) => view.clientId))];
  const settlementByClient = new Map<
    Id<"clients">,
    Map<Id<"invoices">, "impayé" | "solde">
  >();
  const invoiceGrossById = new Map<Id<"invoices">, number>();
  const returnedArticlesById = new Map<Id<"invoices">, number>();
  await Promise.all(
    clientIds.map(async (clientId) => {
      const entries = await ctx.db
        .query("creditLedgerEntries")
        .withIndex("by_clientId_date", (q) => q.eq("clientId", clientId))
        .collect();
      settlementByClient.set(
        clientId,
        await computeClientInvoiceSettlementStatusesForClient(ctx, entries),
      );
    }),
  );
  await Promise.all(
    [...new Set(
      views
        .filter(
          (view): view is LedgerEntryView & { invoiceId: Id<"invoices"> } =>
            view.kind === "invoice" && view.invoiceId !== null,
        )
        .map((view) => view.invoiceId),
    )].map(async (invoiceId) => {
      const [grossCents, returnedQty] = await Promise.all([
        computeInvoiceGrossTotalCents(ctx, invoiceId),
        computeInvoiceReturnedArticlesQty(ctx, invoiceId),
      ]);
      invoiceGrossById.set(invoiceId, centsToMad(grossCents));
      returnedArticlesById.set(invoiceId, returnedQty);
    }),
  );

  return views.map((view) => {
    let status = view.status;
    let amountMad = view.amountMad;
    let returnedArticlesQty: number | null = null;
    let time = view.time;
    if (view.invoiceId) {
      const invoiceTime = timeByInvoiceId.get(view.invoiceId);
      if (invoiceTime) time = invoiceTime;
    }
    if (view.kind === "invoice" && view.invoiceId) {
      status =
        settlementByClient.get(view.clientId)?.get(view.invoiceId) ??
        view.status;
      amountMad = invoiceGrossById.get(view.invoiceId) ?? view.amountMad;
      returnedArticlesQty = returnedArticlesById.get(view.invoiceId) ?? 0;
    }
    return {
      ...view,
      time,
      amountMad,
      invoiceVerified: view.invoiceId
        ? (verifiedByInvoiceId.get(view.invoiceId) ?? false)
        : null,
      status,
      returnedArticlesQty,
    };
  });
}

async function requireCreditReadPermission(ctx: QueryCtx | MutationCtx) {
  await requireAnyPermission(ctx, [
    "credits.view",
    "credits.collect",
    "credits.approve",
  ]);
}

async function planEntries(
  ctx: QueryCtx | MutationCtx,
  planId: Id<"installmentPlans">,
) {
  return await ctx.db
    .query("creditLedgerEntries")
    .withIndex("by_planId_date", (q) => q.eq("planId", planId))
    .collect();
}

async function updateLinkedPlanAfterPayment(
  ctx: MutationCtx,
  plan: Doc<"installmentPlans">,
  paymentDate: string,
) {
  const entries = await planEntries(ctx, plan._id);
  const remainingMadCents = planRemainingMadCents(plan, entries);
  const status = remainingMadCents <= 0 ? "completed" : "active";
  const now = Date.now();
  await ctx.db.patch(plan._id, {
    status,
    nextDueDate:
      status === "completed"
        ? paymentDate
        : nextDueDateAfterPlanPayment(plan, entries),
    updatedAt: now,
  });
  if (status === "completed" && plan.invoiceId) {
    await ctx.db.patch(plan.invoiceId, {
      status: "paid",
      updatedAt: now,
    });
  }
}

export const listLedgerByClient = query({
  args: { clientId: v.id("clients") },
  returns: v.array(ledgerEntryView),
  handler: async (ctx, args) => {
    await requireCreditReadPermission(ctx);
    // Full client history — truncated shop-wide feeds are not a substitute.
    const entries = await ctx.db
      .query("creditLedgerEntries")
      .withIndex("by_clientId_date", (q) => q.eq("clientId", args.clientId))
      .order("desc")
      .collect();
    const views = entries.map(toLedgerEntryView);
    return enrichLedgerEntryViews(ctx, views).then((enriched) =>
      enriched.sort((a, b) => b.date.localeCompare(a.date)),
    );
  },
});

export const listAllLedger = query({
  args: { limit: v.optional(v.number()) },
  returns: v.array(ledgerEntryView),
  handler: async (ctx, args) => {
    await requireCreditReadPermission(ctx);
    const limit = Math.min(Math.max(args.limit ?? 500, 1), 1000);
    const entries = await ctx.db
      .query("creditLedgerEntries")
      .withIndex("by_date")
      .order("desc")
      .take(limit);
    const views = entries.map(toLedgerEntryView);
    return enrichLedgerEntryViews(ctx, views).then((enriched) =>
      enriched.sort((a, b) => b.date.localeCompare(a.date)),
    );
  },
});

const clientLedgerStatView = v.object({
  clientId: v.id("clients"),
  totalInvoicedMad: v.number(),
  totalPaidMad: v.number(),
  totalReturnedMad: v.number(),
  lastPaymentDate: v.union(v.string(), v.null()),
  lastPaymentAmountMad: v.union(v.number(), v.null()),
});

/**
 * Per-client ledger totals over the full table.
 * Use this for Crédits soldes — listAllLedger is intentionally truncated.
 */
export const listClientLedgerStats = query({
  args: {},
  returns: v.array(clientLedgerStatView),
  handler: async (ctx) => {
    await requireCreditReadPermission(ctx);
    const entries = await ctx.db.query("creditLedgerEntries").collect();

    type Acc = {
      totalInvoicedMadCents: number;
      totalPaidMadCents: number;
      totalReturnedMadCents: number;
      lastPaymentDate: string | null;
      lastPaymentAmountMadCents: number | null;
    };
    const byClient = new Map<Id<"clients">, Acc>();

    for (const entry of entries) {
      let acc = byClient.get(entry.clientId);
      if (!acc) {
        acc = {
          totalInvoicedMadCents: 0,
          totalPaidMadCents: 0,
          totalReturnedMadCents: 0,
          lastPaymentDate: null,
          lastPaymentAmountMadCents: null,
        };
        byClient.set(entry.clientId, acc);
      }

      const isReturn = entry.kind === "return" || entry.source === "return";
      if (isReturn) {
        acc.totalReturnedMadCents += entry.amountMadCents;
      } else if (entry.kind === "invoice") {
        acc.totalInvoicedMadCents += entry.amountMadCents;
      } else if (entry.kind === "payment") {
        acc.totalPaidMadCents += entry.amountMadCents;
        if (
          acc.lastPaymentDate === null ||
          entry.date > acc.lastPaymentDate
        ) {
          acc.lastPaymentDate = entry.date;
          acc.lastPaymentAmountMadCents = entry.amountMadCents;
        }
      }
    }

    return [...byClient.entries()].map(([clientId, acc]) => ({
      clientId,
      totalInvoicedMad: centsToMad(acc.totalInvoicedMadCents),
      totalPaidMad: centsToMad(acc.totalPaidMadCents),
      totalReturnedMad: centsToMad(acc.totalReturnedMadCents),
      lastPaymentDate: acc.lastPaymentDate,
      lastPaymentAmountMad:
        acc.lastPaymentAmountMadCents != null
          ? centsToMad(acc.lastPaymentAmountMadCents)
          : null,
    }));
  },
});

export const listAllLedgerVisible = query({
  args: { limit: v.optional(v.number()) },
  returns: v.array(ledgerEntryView),
  handler: async (ctx, args) => {
    const canReadCredits = await hasAnyPermission(ctx, [
      "credits.view",
      "credits.collect",
      "credits.approve",
    ]);
    if (!canReadCredits) return [];
    const limit = Math.min(Math.max(args.limit ?? 500, 1), 1000);
    const entries = await ctx.db
      .query("creditLedgerEntries")
      .withIndex("by_date")
      .order("desc")
      .take(limit);
    const views = entries.map(toLedgerEntryView);
    return enrichLedgerEntryViews(ctx, views).then((enriched) =>
      enriched.sort((a, b) => b.date.localeCompare(a.date)),
    );
  },
});

export const recordPayment = mutation({
  args: {
    clientId: v.id("clients"),
    planId: v.optional(v.id("installmentPlans")),
    amountMad: v.number(),
    date: v.string(),
    note: v.optional(v.string()),
  },
  returns: ledgerEntryView,
  handler: async (ctx, args) => {
    const { userId, user } = await requirePermission(ctx, "credits.collect");
    const client = await ctx.db.get(args.clientId);
    if (!client) throw new Error("Client not found.");

    const amountMadCents = madToCents(args.amountMad);
    if (amountMadCents <= 0) throw new Error("Payment amount must be positive.");

    const now = Date.now();
    const note = args.note?.trim() || "Versement";

    let linkedPlan: Doc<"installmentPlans"> | null = null;
    let planPortionCents = 0;
    let avoirPortionCents = amountMadCents;

    if (args.planId) {
      linkedPlan = await ctx.db.get(args.planId);
      if (!linkedPlan) throw new Error("Installment plan not found.");
      if (linkedPlan.clientId !== args.clientId) {
        throw new Error("Installment plan belongs to a different client.");
      }
      if (linkedPlan.status !== "active") {
        throw new Error("Only active installment plans can receive payments.");
      }
      const entries = await planEntries(ctx, linkedPlan._id);
      const remainingMadCents = planRemainingMadCents(linkedPlan, entries);
      if (remainingMadCents <= 0) {
        throw new Error("Installment plan is already paid.");
      }
      // Overpayment is allowed: plan gets up to remaining, excess becomes client avoir.
      planPortionCents = Math.min(amountMadCents, remainingMadCents);
      avoirPortionCents = amountMadCents - planPortionCents;
    }

    async function insertPayment(input: {
      amountMadCents: number;
      plan: Doc<"installmentPlans"> | null;
      noteOverride?: string;
      refCode: string;
    }) {
      const withPlan = input.plan != null;
      const refPrefix = withPlan ? "Mensualité" : "Paiement";
      const entryId = await ctx.db.insert("creditLedgerEntries", {
        clientId: args.clientId,
        ...(withPlan ? { planId: input.plan!._id } : {}),
        ...(withPlan && input.plan!.invoiceId
          ? { invoiceId: input.plan!.invoiceId }
          : {}),
        kind: "payment",
        date: args.date,
        ref: `${refPrefix} #${withPlan ? "MN" : "PY"}-${input.refCode}`,
        note: input.noteOverride ?? (withPlan ? input.plan!.title : note),
        amountMadCents: input.amountMadCents,
        status: "valide",
        source: withPlan ? "plan" : "manual",
        createdAt: now,
      });

      if (withPlan && input.plan!.invoiceId) {
        await ctx.db.insert("invoicePayments", {
          invoiceId: input.plan!.invoiceId,
          ledgerEntryId: entryId,
          date: args.date,
          amountMadCents: input.amountMadCents,
          note: input.noteOverride ?? input.plan!.title,
          ref: `${refPrefix} #MN-${input.refCode}`,
          createdAt: now,
        });
      }

      return entryId;
    }

    const primaryRef = now.toString(36).toUpperCase().slice(-6);
    let primaryEntryId: Id<"creditLedgerEntries">;

    if (linkedPlan && planPortionCents > 0) {
      primaryEntryId = await insertPayment({
        amountMadCents: planPortionCents,
        plan: linkedPlan,
        noteOverride: note || linkedPlan.title,
        refCode: primaryRef,
      });
      await updateLinkedPlanAfterPayment(ctx, linkedPlan, args.date);
      if (linkedPlan.invoiceId) {
        await syncInvoiceLedgerEntry(ctx, linkedPlan.invoiceId);
      }
    } else {
      primaryEntryId = await insertPayment({
        amountMadCents: amountMadCents,
        plan: null,
        noteOverride: note,
        refCode: primaryRef,
      });
      avoirPortionCents = 0;
    }

    if (avoirPortionCents > 0) {
      await insertPayment({
        amountMadCents: avoirPortionCents,
        plan: null,
        noteOverride:
          note.trim() ||
          "Avoir client (paiement supérieur au dû)",
        refCode: (now + 1).toString(36).toUpperCase().slice(-6),
      });
    }

    await syncClientInvoiceLedgerStatuses(ctx, args.clientId);

    const entry = await ctx.db.get(primaryEntryId);
    if (!entry) throw new Error("Payment creation failed.");
    const view = toLedgerEntryView(entry);
    await recordAuditForUser(ctx, userId, user, {
      action: "credits.recordPayment",
      entityType: "payment",
      entityId: primaryEntryId,
      summary: `Paiement enregistré: ${centsToMad(amountMadCents)} MAD`,
      payload: {
        clientId: args.clientId,
        planId: args.planId ?? null,
        amountMad: centsToMad(amountMadCents),
        date: args.date,
        note,
      },
      source: "manual",
    });
    return (await enrichLedgerEntryViews(ctx, [view]))[0]!;
  },
});

export const requestLedgerUpdate = mutation({
  args: {
    ledgerEntryId: v.id("creditLedgerEntries"),
    updateType: v.union(
      v.literal("return"),
      v.literal("replacement"),
      v.literal("price_change"),
      v.literal("reopen_in_caisse"),
    ),
    reason: v.string(),
    payloadJson: v.string(),
    responsibleConfirmed: v.boolean(),
    requestedByUserName: v.string(),
  },
  returns: v.id("creditLedgerUpdateRequests"),
  handler: async (ctx, args) => {
    const { userId } = await requireAnyPermission(ctx, [
      "sales.create",
      "credits.collect",
      "credits.approve",
    ]);
    if (!args.responsibleConfirmed) {
      throw new Error("Confirmation de responsabilité requise.");
    }
    const reason = args.reason.trim();
    if (reason.length < 3) {
      throw new Error("Le motif est requis.");
    }
    const userName = args.requestedByUserName.trim();
    if (!userName) {
      throw new Error("Nom du responsable requis.");
    }

    const entry = await ctx.db.get(args.ledgerEntryId);
    if (!entry) throw new Error("Écriture introuvable.");

    await rejectPendingLedgerUpdateRequests(ctx, args.ledgerEntryId);

    return await ctx.db.insert("creditLedgerUpdateRequests", {
      ledgerEntryId: args.ledgerEntryId,
      clientId: entry.clientId,
      ...(entry.invoiceId ? { invoiceId: entry.invoiceId } : {}),
      updateType: args.updateType,
      reason,
      payloadJson: args.payloadJson,
      responsibleConfirmed: true,
      requestedByUserId: userId,
      requestedByUserName: userName,
      status: "pending",
      createdAt: Date.now(),
    });
  },
});
