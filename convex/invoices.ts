import { paginationOptsValidator } from "convex/server";
import { v } from "convex/values";

import { mutation, query } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import type { QueryCtx } from "./_generated/server";
import { recordAuditForUser } from "./audit";
import { requireAnyPermission, requirePermission } from "./authz";
import { deleteInvoiceCascade } from "./deleteCascade";
import {
  buildInvoicePaymentHistory,
  invoiceSettlementAmounts,
  resolveCreditInvoiceDisplayStatus,
} from "./invoiceCreditAdjustments";
import { centsToMad } from "./money";

const paymentType = v.union(v.literal("cash"), v.literal("credit"));
const invoiceStatus = v.union(
  v.literal("paid"),
  v.literal("pending"),
  v.literal("returned"),
);

const invoiceLineView = v.object({
  lineIndex: v.number(),
  nameAr: v.string(),
  qty: v.number(),
  unitPriceMad: v.number(),
  returnedQty: v.optional(v.number()),
  productId: v.optional(v.string()),
  image: v.optional(v.string()),
  imageAlt: v.optional(v.string()),
});

const invoicePaymentHistoryView = v.object({
  id: v.string(),
  date: v.string(),
  amountMad: v.number(),
  note: v.string(),
  ref: v.string(),
});

/** Full invoice for detail / print / PDF — never for list pages. */
const invoiceView = v.object({
  id: v.id("invoices"),
  number: v.string(),
  barcode: v.string(),
  date: v.string(),
  time: v.string(),
  clientId: v.union(v.id("clients"), v.null()),
  clientName: v.string(),
  cashierId: v.string(),
  paymentType,
  totalMad: v.number(),
  paidMad: v.number(),
  remainingMad: v.number(),
  status: invoiceStatus,
  lines: v.array(invoiceLineView),
  paymentHistory: v.array(invoicePaymentHistoryView),
});

/** Lightweight row for invoice tables / aperçu selection. */
const invoiceSummaryView = v.object({
  id: v.id("invoices"),
  number: v.string(),
  barcode: v.string(),
  date: v.string(),
  time: v.string(),
  clientName: v.string(),
  cashierId: v.string(),
  paymentType,
  totalMad: v.number(),
  status: invoiceStatus,
});

async function invoiceLineToView(ctx: QueryCtx, line: Doc<"invoiceLines">) {
  let image: string | undefined;
  let imageAlt: string | undefined;
  if (line.productId) {
    const product = await ctx.db.get(line.productId);
    if (product) {
      image = product.imageUrl;
      imageAlt = product.name;
    }
  }
  return {
    lineIndex: line.lineIndex,
    nameAr: line.productNameSnapshot,
    qty: line.qty,
    unitPriceMad: centsToMad(line.unitPriceMadCents),
    ...(line.returnedQty > 0 ? { returnedQty: line.returnedQty } : {}),
    ...(line.productId ? { productId: line.productId } : {}),
    ...(image ? { image, imageAlt: imageAlt ?? line.productNameSnapshot } : {}),
  };
}

function invoiceToSummary(invoice: Doc<"invoices">) {
  return {
    id: invoice._id,
    number: invoice.number,
    barcode: invoice.barcode,
    date: invoice.date,
    time: invoice.time,
    clientName: invoice.clientNameSnapshot,
    cashierId: invoice.cashierNameSnapshot,
    paymentType: invoice.paymentType,
    totalMad: centsToMad(invoice.totalMadCents),
    status: invoice.status,
  };
}

async function invoiceToView(ctx: QueryCtx, invoice: Doc<"invoices">) {
  const lines = await ctx.db
    .query("invoiceLines")
    .withIndex("by_invoiceId", (q) => q.eq("invoiceId", invoice._id))
    .take(200);
  const paymentHistory = await buildInvoicePaymentHistory(ctx, invoice);
  const { paidMad, remainingMad } = await invoiceSettlementAmounts(ctx, invoice);

  if (
    invoice.paymentType === "cash" &&
    invoice.status === "paid" &&
    paymentHistory.length === 0
  ) {
    paymentHistory.push({
      id: `${invoice._id}:cash`,
      date: invoice.date,
      amountMad: centsToMad(invoice.totalMadCents),
      note: "Paiement espèces",
      ref: invoice.number,
    });
  }

  const status = await resolveCreditInvoiceDisplayStatus(ctx, invoice);

  return {
    id: invoice._id,
    number: invoice.number,
    barcode: invoice.barcode,
    date: invoice.date,
    time: invoice.time,
    clientId: invoice.clientId ?? null,
    clientName: invoice.clientNameSnapshot,
    cashierId: invoice.cashierNameSnapshot,
    paymentType: invoice.paymentType,
    totalMad: centsToMad(invoice.totalMadCents),
    paidMad,
    remainingMad,
    status,
    lines: await Promise.all(
      lines
        .sort((a, b) => a.lineIndex - b.lineIndex)
        .map((line) => invoiceLineToView(ctx, line)),
    ),
    paymentHistory,
  };
}

/** Normalize optional date / dateFrom / dateTo into an inclusive ISO range. */
function normalizeInvoiceDateRange(args: {
  date?: string;
  dateFrom?: string;
  dateTo?: string;
}): { from?: string; to?: string } {
  let from = args.dateFrom?.trim() || undefined;
  let to = args.dateTo?.trim() || undefined;
  const exact = args.date?.trim() || undefined;
  if (exact && !from && !to) {
    from = exact;
    to = exact;
  }
  if (from && to && from > to) {
    return { from: to, to: from };
  }
  return { from, to };
}

/**
 * Matching invoice count for list badges (bounded — Phase 6 aggregate later).
 */
export const countMatching = query({
  args: {
    date: v.optional(v.string()),
    dateFrom: v.optional(v.string()),
    dateTo: v.optional(v.string()),
    clientId: v.optional(v.id("clients")),
    paymentType: v.optional(paymentType),
    status: v.optional(invoiceStatus),
  },
  returns: v.number(),
  handler: async (ctx, args) => {
    await requirePermission(ctx, "sales.view");
    const { from, to } = normalizeInvoiceDateRange(args);
    const clientId = args.clientId;
    const pay = args.paymentType;
    const status = args.status;

    let rows;
    if (clientId) {
      rows = await ctx.db
        .query("invoices")
        .withIndex("by_clientId_date", (q) => {
          const base = q.eq("clientId", clientId);
          if (from && to) return base.gte("date", from).lte("date", to);
          if (from) return base.gte("date", from);
          if (to) return base.lte("date", to);
          return base;
        })
        .take(8000);
      if (pay) rows = rows.filter((row) => row.paymentType === pay);
      if (status) rows = rows.filter((row) => row.status === status);
    } else if (pay) {
      rows = await ctx.db
        .query("invoices")
        .withIndex("by_paymentType_date", (q) => {
          const base = q.eq("paymentType", pay);
          if (from && to) return base.gte("date", from).lte("date", to);
          if (from) return base.gte("date", from);
          if (to) return base.lte("date", to);
          return base;
        })
        .take(8000);
    } else if (status) {
      rows = await ctx.db
        .query("invoices")
        .withIndex("by_status_date", (q) => {
          const base = q.eq("status", status);
          if (from && to) return base.gte("date", from).lte("date", to);
          if (from) return base.gte("date", from);
          if (to) return base.lte("date", to);
          return base;
        })
        .take(8000);
    } else if (from || to) {
      rows = await ctx.db
        .query("invoices")
        .withIndex("by_date", (q) => {
          if (from && to) return q.gte("date", from).lte("date", to);
          if (from) return q.gte("date", from);
          return q.lte("date", to!);
        })
        .take(8000);
    } else {
      rows = await ctx.db.query("invoices").withIndex("by_date").take(8000);
    }
    return rows.length;
  },
});

/**
 * Paginated lightweight invoice rows. Prefer this over `listRecent`.
 * Filters run in Convex (date range / paymentType / status).
 */
export const listSummaries = query({
  args: {
    paginationOpts: paginationOptsValidator,
    date: v.optional(v.string()),
    dateFrom: v.optional(v.string()),
    dateTo: v.optional(v.string()),
    clientId: v.optional(v.id("clients")),
    paymentType: v.optional(paymentType),
    status: v.optional(invoiceStatus),
  },
  returns: v.object({
    page: v.array(invoiceSummaryView),
    isDone: v.boolean(),
    continueCursor: v.string(),
  }),
  handler: async (ctx, args) => {
    await requirePermission(ctx, "sales.view");
    const numItems = Math.min(Math.max(args.paginationOpts.numItems, 1), 50);
    const { from, to } = normalizeInvoiceDateRange(args);
    const clientId = args.clientId;
    const pay = args.paymentType;
    const status = args.status;

    let result;
    if (clientId) {
      // Client is the primary filter (bulk export / relevé). Type/status filtered after.
      result = await ctx.db
        .query("invoices")
        .withIndex("by_clientId_date", (q) => {
          const base = q.eq("clientId", clientId);
          if (from && to) return base.gte("date", from).lte("date", to);
          if (from) return base.gte("date", from);
          if (to) return base.lte("date", to);
          return base;
        })
        .order("desc")
        .paginate({ ...args.paginationOpts, numItems });
    } else if (pay) {
      result = await ctx.db
        .query("invoices")
        .withIndex("by_paymentType_date", (q) => {
          const base = q.eq("paymentType", pay);
          if (from && to) return base.gte("date", from).lte("date", to);
          if (from) return base.gte("date", from);
          if (to) return base.lte("date", to);
          return base;
        })
        .order("desc")
        .paginate({ ...args.paginationOpts, numItems });
    } else if (status) {
      result = await ctx.db
        .query("invoices")
        .withIndex("by_status_date", (q) => {
          const base = q.eq("status", status);
          if (from && to) return base.gte("date", from).lte("date", to);
          if (from) return base.gte("date", from);
          if (to) return base.lte("date", to);
          return base;
        })
        .order("desc")
        .paginate({ ...args.paginationOpts, numItems });
    } else if (from || to) {
      result = await ctx.db
        .query("invoices")
        .withIndex("by_date", (q) => {
          if (from && to) return q.gte("date", from).lte("date", to);
          if (from) return q.gte("date", from);
          return q.lte("date", to!);
        })
        .order("desc")
        .paginate({ ...args.paginationOpts, numItems });
    } else {
      result = await ctx.db
        .query("invoices")
        .withIndex("by_date")
        .order("desc")
        .paginate({ ...args.paginationOpts, numItems });
    }

    let page = result.page;
    if (clientId && pay) {
      page = page.filter((row) => row.paymentType === pay);
    }
    if (clientId && status) {
      page = page.filter((row) => row.status === status);
    }

    return {
      page: page.map(invoiceToSummary),
      isDone: result.isDone,
      continueCursor: result.continueCursor,
    };
  },
});

/**
 * @deprecated Prefer `listSummaries` + `getWithLines`. Kept for transition;
 * still hydrates full lines (expensive). Cap lowered to 50.
 */
export const listRecent = query({
  args: { limit: v.optional(v.number()) },
  returns: v.array(invoiceView),
  handler: async (ctx, args) => {
    await requirePermission(ctx, "sales.view");
    const limit = Math.min(Math.max(args.limit ?? 50, 1), 50);
    const invoices = await ctx.db
      .query("invoices")
      .withIndex("by_date")
      .order("desc")
      .take(limit);
    return await Promise.all(
      invoices.map((invoice) => invoiceToView(ctx, invoice)),
    );
  },
});

export const getWithLines = query({
  args: { invoiceId: v.string() },
  returns: v.union(invoiceView, v.null()),
  handler: async (ctx, args) => {
    await requirePermission(ctx, "sales.view");
    const normalizedId = ctx.db.normalizeId("invoices", args.invoiceId);
    let invoice: Doc<"invoices"> | null = null;
    if (normalizedId) {
      invoice = await ctx.db.get(normalizedId as Id<"invoices">);
    }
    if (!invoice) {
      invoice = await ctx.db
        .query("invoices")
        .withIndex("by_number", (q) => q.eq("number", args.invoiceId))
        .first();
    }
    if (!invoice) return null;
    return await invoiceToView(ctx, invoice);
  },
});

export const findByBarcode = query({
  args: { barcode: v.string() },
  returns: v.union(invoiceSummaryView, v.null()),
  handler: async (ctx, args) => {
    await requirePermission(ctx, "sales.view");
    const barcode = args.barcode.trim().replace(/\s+/g, "").toUpperCase();
    if (!barcode) return null;
    const invoice = await ctx.db
      .query("invoices")
      .withIndex("by_barcode", (q) => q.eq("barcode", barcode))
      .first();
    if (!invoice) {
      // Also try raw (legacy barcodes may not be uppercased).
      const raw = await ctx.db
        .query("invoices")
        .withIndex("by_barcode", (q) => q.eq("barcode", args.barcode.trim()))
        .first();
      return raw ? invoiceToSummary(raw) : null;
    }
    return invoiceToSummary(invoice);
  },
});

export const findByNumber = query({
  args: { number: v.string() },
  returns: v.union(invoiceSummaryView, v.null()),
  handler: async (ctx, args) => {
    await requirePermission(ctx, "sales.view");
    const number = args.number.trim();
    if (!number) return null;
    const invoice = await ctx.db
      .query("invoices")
      .withIndex("by_number", (q) => q.eq("number", number))
      .first();
    return invoice ? invoiceToSummary(invoice) : null;
  },
});

export const remove = mutation({
  args: { invoiceId: v.id("invoices") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { userId, user } = await requirePermission(ctx, "sales.delete");
    const invoice = await ctx.db.get(args.invoiceId);
    if (!invoice) throw new Error("Invoice not found.");
    await deleteInvoiceCascade(ctx, args.invoiceId);
    await recordAuditForUser(ctx, userId, user, {
      action: "invoices.remove",
      entityType: "invoice",
      entityId: args.invoiceId,
      summary: `Facture supprimée: ${invoice.number}`,
      payload: {
        number: invoice.number,
        clientName: invoice.clientNameSnapshot,
        totalMad: centsToMad(invoice.totalMadCents),
      },
      source: "manual",
    });
    return null;
  },
});

/** Delete several invoices (Factures bulk action). Max 50 per call. */
export const removeMany = mutation({
  args: { invoiceIds: v.array(v.id("invoices")) },
  returns: v.object({
    deleted: v.number(),
    missing: v.number(),
  }),
  handler: async (ctx, args) => {
    const { userId, user } = await requirePermission(ctx, "sales.delete");
    const unique = [...new Set(args.invoiceIds)].slice(0, 50);
    let deleted = 0;
    let missing = 0;
    const deletedNumbers: string[] = [];
    for (const invoiceId of unique) {
      const invoice = await ctx.db.get(invoiceId);
      if (!invoice) {
        missing += 1;
        continue;
      }
      deletedNumbers.push(invoice.number);
      await deleteInvoiceCascade(ctx, invoiceId);
      deleted += 1;
    }
    if (deleted > 0) {
      await recordAuditForUser(ctx, userId, user, {
        action: "invoices.removeMany",
        entityType: "invoice",
        entityId: unique[0] ?? null,
        summary: `${deleted} facture(s) supprimée(s)`,
        payload: { deleted, missing, numbers: deletedNumbers },
        source: "manual",
      });
    }
    return { deleted, missing };
  },
});

const statementMovementView = v.object({
  id: v.string(),
  date: v.string(),
  amountMad: v.number(),
  note: v.string(),
  ref: v.string(),
  kind: v.union(v.literal("payment"), v.literal("return")),
});

/**
 * Client statement context for bulk relevé PDFs:
 * - debt-positive opening (= −UI solde + prior ledger net before `fromDate`)
 * - client ledger versements / retours in [fromDate, toDate] (including
 *   global Paiement #PY / “Versement” rows that are not linked to an invoice)
 */
export const clientStatementContext = query({
  args: {
    clientId: v.id("clients"),
    /** Inclusive start YYYY-MM-DD (usually earliest selected facture). */
    fromDate: v.string(),
    /** Inclusive end YYYY-MM-DD (usually latest selected facture). */
    toDate: v.optional(v.string()),
  },
  returns: v.object({
    initialSoldeMad: v.number(),
    priorNetDebtMad: v.number(),
    openingBalanceMad: v.number(),
    movements: v.array(statementMovementView),
  }),
  handler: async (ctx, args) => {
    await requireAnyPermission(ctx, [
      "sales.view",
      "clients.view",
      "clients.manage",
      "credits.view",
      "credits.collect",
    ]);
    const client = await ctx.db.get(args.clientId);
    if (!client) throw new Error("Client not found.");

    const fromDate = args.fromDate.trim();
    const toDate = args.toDate?.trim() || undefined;
    if (!fromDate) throw new Error("fromDate is required.");

    const initialSoldeMad = centsToMad(client.initialSoldeMadCents ?? 0);
    let priorNetDebtMad = 0;
    const movements: Array<{
      id: string;
      date: string;
      amountMad: number;
      note: string;
      ref: string;
      kind: "payment" | "return";
    }> = [];

    // Prior activity (opening): bounded index range, not only the first 500 rows.
    const priorEntries = await ctx.db
      .query("creditLedgerEntries")
      .withIndex("by_clientId_date", (q) =>
        q.eq("clientId", args.clientId).lt("date", fromDate),
      )
      .take(2000);
    for (const entry of priorEntries) {
      const amount = centsToMad(entry.amountMadCents);
      if (entry.kind === "invoice") priorNetDebtMad += amount;
      else priorNetDebtMad -= amount;
    }

    // Period versements / retours (inclusive). Separate query so recent
    // Paiement #PY rows are not dropped when the client has a long history.
    const periodEntries = toDate
      ? await ctx.db
          .query("creditLedgerEntries")
          .withIndex("by_clientId_date", (q) =>
            q
              .eq("clientId", args.clientId)
              .gte("date", fromDate)
              .lte("date", toDate),
          )
          .take(2000)
      : await ctx.db
          .query("creditLedgerEntries")
          .withIndex("by_clientId_date", (q) =>
            q.eq("clientId", args.clientId).gte("date", fromDate),
          )
          .take(2000);

    for (const entry of periodEntries) {
      if (entry.kind === "invoice") continue;
      const isReturn =
        entry.kind === "return" || entry.source === "return";
      movements.push({
        id: entry._id,
        date: entry.date,
        amountMad: centsToMad(entry.amountMadCents),
        note: entry.note,
        ref: entry.ref,
        kind: isReturn ? "return" : "payment",
      });
    }

    priorNetDebtMad = Math.round(priorNetDebtMad * 100) / 100;
    movements.sort((a, b) => {
      const byDate = a.date.localeCompare(b.date);
      if (byDate !== 0) return byDate;
      return a.id.localeCompare(b.id);
    });

    // UI solde: +avoir / −dette → statement opening is debt-positive.
    const openingBalanceMad =
      Math.round((-initialSoldeMad + priorNetDebtMad) * 100) / 100;

    return {
      initialSoldeMad,
      priorNetDebtMad,
      openingBalanceMad,
      movements,
    };
  },
});
