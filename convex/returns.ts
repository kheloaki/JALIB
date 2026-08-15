import { v } from "convex/values";

import { mutation, query } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { recordAuditForUser } from "./audit";
import { requireAnyPermission, requirePermission } from "./authz";
import { rejectPendingLedgerUpdateRequests } from "./creditLedgerUpdateRequests";
import {
  computeInvoiceGrossTotalCents,
  computeInvoiceTotalCents,
  invoicePaymentsTotalCents,
  resolveInvoiceStatus,
  syncClientInvoiceLedgerStatuses,
  syncInvoiceCreditLedgerAmount,
  syncInvoiceLedgerEntry,
} from "./invoiceCreditAdjustments";
import { centsToMad } from "./money";

const returnReason = v.union(
  v.literal("Endommagé"),
  v.literal("Mauvais article"),
  v.literal("Choix du client"),
  v.literal("Autre"),
);
const stockDisposition = v.union(
  v.literal("Invendable"),
  v.literal("Disponible"),
);
const returnLineInput = v.object({
  lineIndex: v.number(),
  qtyReturned: v.number(),
});
const returnLineView = v.object({
  invoiceLineId: v.union(v.id("invoiceLines"), v.null()),
  lineIndex: v.number(),
  qtyReturned: v.number(),
});
const returnView = v.object({
  id: v.id("returns"),
  invoiceId: v.id("invoices"),
  invoiceNumber: v.string(),
  clientName: v.string(),
  createdAtIso: v.string(),
  reason: returnReason,
  stockDisposition,
  refundTotalMad: v.number(),
  note: v.union(v.string(), v.null()),
  lines: v.array(returnLineView),
});
const returnListPermissions = [
  "returns.view",
  "returns.process",
  "sales.view",
  "sales.cancel",
] as const;

type ReturnView = {
  id: Id<"returns">;
  invoiceId: Id<"invoices">;
  invoiceNumber: string;
  clientName: string;
  createdAtIso: string;
  reason: Doc<"returns">["reason"];
  stockDisposition: Doc<"returns">["stockDisposition"];
  refundTotalMad: number;
  note: string | null;
  lines: Array<{
    invoiceLineId: Id<"invoiceLines"> | null;
    lineIndex: number;
    qtyReturned: number;
  }>;
};

async function returnToView(
  ctx: QueryCtx | MutationCtx,
  returnRecord: Doc<"returns">,
): Promise<ReturnView> {
  const invoice = await ctx.db.get(returnRecord.invoiceId);
  const lines = await ctx.db
    .query("returnLines")
    .withIndex("by_returnId", (q) => q.eq("returnId", returnRecord._id))
    .take(200);

  return {
    id: returnRecord._id,
    invoiceId: returnRecord.invoiceId,
    invoiceNumber: invoice?.number ?? returnRecord.invoiceId,
    clientName: invoice?.clientNameSnapshot ?? "",
    createdAtIso: returnRecord.createdAtIso,
    reason: returnRecord.reason,
    stockDisposition: returnRecord.stockDisposition,
    refundTotalMad: centsToMad(returnRecord.refundTotalMadCents),
    note: returnRecord.note ?? null,
    lines: lines
      .sort((a, b) => a.lineIndex - b.lineIndex)
      .map((line) => ({
        invoiceLineId: line.invoiceLineId ?? null,
        lineIndex: line.lineIndex,
        qtyReturned: line.qtyReturned,
      })),
  };
}

type ReturnLineInput = { lineIndex: number; qtyReturned: number };

async function processInvoiceReturn(
  ctx: MutationCtx,
  input: {
    invoiceId: Id<"invoices">;
    userId: Id<"users">;
    reason: Doc<"returns">["reason"];
    stockDisposition: Doc<"returns">["stockDisposition"];
    lines: ReturnLineInput[];
    note?: string;
  },
): Promise<ReturnView> {
  const invoice = await ctx.db.get(input.invoiceId);
  if (!invoice) throw new Error("Invoice not found.");
  if (input.lines.length === 0) throw new Error("Return lines are required.");

  const invoiceLines = await ctx.db
    .query("invoiceLines")
    .withIndex("by_invoiceId", (q) => q.eq("invoiceId", input.invoiceId))
    .take(300);
  const lineByIndex = new Map(invoiceLines.map((line) => [line.lineIndex, line]));
  const qtyByLineIndex = new Map<number, number>();
  for (const line of input.lines) {
    const lineIndex = Math.floor(line.lineIndex);
    const qtyReturned = Math.floor(line.qtyReturned);
    if (qtyReturned <= 0) continue;
    qtyByLineIndex.set(
      lineIndex,
      (qtyByLineIndex.get(lineIndex) ?? 0) + qtyReturned,
    );
  }
  const normalizedLines = [...qtyByLineIndex.entries()].map(
    ([lineIndex, qtyReturned]) => ({ lineIndex, qtyReturned }),
  );
  if (normalizedLines.length === 0) {
    throw new Error("At least one returned quantity is required.");
  }

  let refundTotalMadCents = 0;
  const validated: Array<{
    line: Doc<"invoiceLines">;
    lineIndex: number;
    qtyReturned: number;
  }> = [];

  for (const item of normalizedLines) {
    const line = lineByIndex.get(item.lineIndex);
    if (!line) throw new Error(`Invoice line not found: ${item.lineIndex}`);
    const remainingQty = line.qty - line.returnedQty;
    if (remainingQty <= 0) {
      throw new Error(`Invoice line ${item.lineIndex + 1} is already returned.`);
    }
    const qtyReturned = Math.min(item.qtyReturned, remainingQty);
    refundTotalMadCents += qtyReturned * line.unitPriceMadCents;
    validated.push({ line, lineIndex: item.lineIndex, qtyReturned });
  }

  const now = Date.now();
  const createdAtIso = new Date(now).toISOString();
  const note = input.note?.trim();
  const returnId = await ctx.db.insert("returns", {
    invoiceId: input.invoiceId,
    createdAtIso,
    reason: input.reason,
    stockDisposition: input.stockDisposition,
    refundTotalMadCents,
    ...(note ? { note } : {}),
    createdByUserId: input.userId,
  });

  for (const item of validated) {
    await ctx.db.insert("returnLines", {
      returnId,
      invoiceLineId: item.line._id,
      lineIndex: item.lineIndex,
      qtyReturned: item.qtyReturned,
    });
    await ctx.db.patch(item.line._id, {
      returnedQty: item.line.returnedQty + item.qtyReturned,
    });

    if (input.stockDisposition === "Disponible" && item.line.productId) {
      const product = await ctx.db.get(item.line.productId);
      if (product) {
        const stockQty = product.stockQty + item.qtyReturned;
        await ctx.db.patch(product._id, {
          stockQty,
          stockLow: stockQty > 0 && stockQty <= 10,
          updatedAt: now,
        });
      }
    }
  }

  const nextTotalMadCents = await computeInvoiceTotalCents(ctx, input.invoiceId);
  let paidMadCents = await invoicePaymentsTotalCents(ctx, input.invoiceId);
  const grossMadCents = await computeInvoiceGrossTotalCents(ctx, input.invoiceId);

  if (invoice.paymentType === "credit") {
    // Restore / keep ledger invoice at the original factured amount.
    await syncInvoiceCreditLedgerAmount(ctx, input.invoiceId);

    if (invoice.clientId && refundTotalMadCents > 0) {
      await ctx.db.insert("creditLedgerEntries", {
        clientId: invoice.clientId,
        invoiceId: input.invoiceId,
        kind: "return",
        date: createdAtIso.slice(0, 10),
        ref: `Retour #RT-${now.toString(36).toUpperCase().slice(-6)}`,
        note: note || `Retour ${invoice.number}`,
        amountMadCents: refundTotalMadCents,
        status: "valide",
        source: "return",
        createdAt: now,
      });
      await syncClientInvoiceLedgerStatuses(ctx, invoice.clientId);
    }

    await syncInvoiceLedgerEntry(ctx, input.invoiceId);
  }

  await ctx.db.patch(input.invoiceId, {
    // Keep (or restore) the original factured total; returns adjust via
    // a separate credit ledger line, not by shrinking the invoice amount.
    totalMadCents: grossMadCents,
    status: await resolveInvoiceStatus(
      ctx,
      invoice,
      input.invoiceId,
      nextTotalMadCents,
      paidMadCents,
    ),
    updatedAt: now,
  });

  const returnRecord = await ctx.db.get(returnId);
  if (!returnRecord) throw new Error("Return creation failed.");
  return await returnToView(ctx, returnRecord);
}

const returnItemView = v.object({
  returnId: v.id("returns"),
  invoiceId: v.id("invoices"),
  invoiceNumber: v.string(),
  clientName: v.string(),
  productName: v.string(),
  qtyReturned: v.number(),
  unitPriceMad: v.number(),
  lineRefundMad: v.number(),
  reason: returnReason,
  stockDisposition,
  createdAtIso: v.string(),
  note: v.union(v.string(), v.null()),
});

const returnableInvoiceView = v.object({
  id: v.id("invoices"),
  number: v.string(),
  date: v.string(),
  time: v.string(),
  clientName: v.string(),
  paymentType: v.union(v.literal("cash"), v.literal("credit")),
  totalMad: v.number(),
  returnableLinesCount: v.number(),
  returnableProductNames: v.array(v.string()),
});

type ReturnableInvoiceSummaryRow = {
  id: Id<"invoices">;
  number: string;
  date: string;
  time: string;
  clientName: string;
  paymentType: Doc<"invoices">["paymentType"];
  totalMad: number;
  returnableLinesCount: number;
  returnableProductNames: string[];
};

async function buildReturnableInvoiceSummary(
  ctx: QueryCtx,
  invoice: Doc<"invoices">,
): Promise<ReturnableInvoiceSummaryRow | null> {
  if (invoice.status === "returned") return null;
  const lines = await ctx.db
    .query("invoiceLines")
    .withIndex("by_invoiceId", (q) => q.eq("invoiceId", invoice._id))
    .take(200);
  const returnableLines = lines.filter((line) => line.qty - line.returnedQty > 0);
  if (returnableLines.length === 0) return null;
  return {
    id: invoice._id,
    number: invoice.number,
    date: invoice.date,
    time: invoice.time,
    clientName: invoice.clientNameSnapshot,
    paymentType: invoice.paymentType,
    totalMad: centsToMad(invoice.totalMadCents),
    returnableLinesCount: returnableLines.length,
    returnableProductNames: returnableLines
      .map((line) => line.productNameSnapshot)
      .slice(0, 5),
  };
}

function matchesReturnableInvoiceSearch(
  invoice: ReturnableInvoiceSummaryRow,
  search: string,
): boolean {
  const q = search.trim().toLowerCase();
  if (!q) return true;
  const hay = [
    invoice.number,
    invoice.clientName,
    invoice.date,
    invoice.time,
    ...invoice.returnableProductNames,
  ]
    .join(" ")
    .toLowerCase();
  return hay.includes(q);
}

export const searchReturnableInvoices = query({
  args: {
    search: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  returns: v.array(returnableInvoiceView),
  handler: async (ctx, args) => {
    await requireAnyPermission(ctx, [...returnListPermissions]);
    const limit = Math.min(Math.max(args.limit ?? 50, 1), 100);
    const search = args.search?.trim() ?? "";

    const invoices = await ctx.db
      .query("invoices")
      .withIndex("by_date")
      .order("desc")
      .take(search ? 400 : 120);

    const result: ReturnableInvoiceSummaryRow[] = [];
    for (const invoice of invoices) {
      const summary = await buildReturnableInvoiceSummary(ctx, invoice);
      if (!summary) continue;
      if (!matchesReturnableInvoiceSearch(summary, search)) continue;
      result.push(summary);
      if (result.length >= limit) break;
    }

    return result;
  },
});

export const listReturnItems = query({
  args: { limit: v.optional(v.number()) },
  returns: v.array(returnItemView),
  handler: async (ctx, args) => {
    await requireAnyPermission(ctx, [...returnListPermissions]);
    const limit = Math.min(Math.max(args.limit ?? 200, 1), 500);
    const returns = await ctx.db
      .query("returns")
      .withIndex("by_createdAtIso")
      .order("desc")
      .take(limit);

    const rows: Array<{
      returnId: Id<"returns">;
      invoiceId: Id<"invoices">;
      invoiceNumber: string;
      clientName: string;
      productName: string;
      qtyReturned: number;
      unitPriceMad: number;
      lineRefundMad: number;
      reason: Doc<"returns">["reason"];
      stockDisposition: Doc<"returns">["stockDisposition"];
      createdAtIso: string;
      note: string | null;
    }> = [];

    for (const returnRecord of returns) {
      const invoice = await ctx.db.get(returnRecord.invoiceId);
      const returnLines = await ctx.db
        .query("returnLines")
        .withIndex("by_returnId", (q) => q.eq("returnId", returnRecord._id))
        .take(200);
      const invoiceLines = await ctx.db
        .query("invoiceLines")
        .withIndex("by_invoiceId", (q) =>
          q.eq("invoiceId", returnRecord.invoiceId),
        )
        .take(200);
      const lineByIndex = new Map(
        invoiceLines.map((invoiceLine) => [invoiceLine.lineIndex, invoiceLine]),
      );
      const lineById = new Map(
        invoiceLines.map((invoiceLine) => [invoiceLine._id, invoiceLine]),
      );

      for (const line of returnLines) {
        const invoiceLine =
          (line.invoiceLineId ? lineById.get(line.invoiceLineId) : undefined) ??
          lineByIndex.get(line.lineIndex);
        const productName =
          invoiceLine?.productNameSnapshot ?? fallbackProductLabel(line.lineIndex);
        const unitPriceMadCents = invoiceLine?.unitPriceMadCents ?? 0;
        const lineRefundMadCents = line.qtyReturned * unitPriceMadCents;
        rows.push({
          returnId: returnRecord._id,
          invoiceId: returnRecord.invoiceId,
          invoiceNumber: invoice?.number ?? returnRecord.invoiceId,
          clientName: invoice?.clientNameSnapshot ?? "",
          productName,
          qtyReturned: line.qtyReturned,
          unitPriceMad: centsToMad(unitPriceMadCents),
          lineRefundMad: centsToMad(lineRefundMadCents),
          reason: returnRecord.reason,
          stockDisposition: returnRecord.stockDisposition,
          createdAtIso: returnRecord.createdAtIso,
          note: returnRecord.note ?? null,
        });
      }
    }

    return rows;
  },
});

function fallbackProductLabel(lineIndex: number) {
  return `Ligne ${lineIndex + 1}`;
}

export const listReturnableInvoicesByClient = query({
  args: { clientId: v.id("clients") },
  returns: v.array(returnableInvoiceView),
  handler: async (ctx, args) => {
    await requireAnyPermission(ctx, [...returnListPermissions]);
    const invoices = await ctx.db
      .query("invoices")
      .withIndex("by_clientId_date", (q) => q.eq("clientId", args.clientId))
      .order("desc")
      .take(200);

    const result: ReturnableInvoiceSummaryRow[] = [];

    for (const invoice of invoices) {
      const summary = await buildReturnableInvoiceSummary(ctx, invoice);
      if (summary) result.push(summary);
    }

    return result;
  },
});

export const listRecent = query({
  args: { limit: v.optional(v.number()) },
  returns: v.array(returnView),
  handler: async (ctx, args) => {
    await requireAnyPermission(ctx, [...returnListPermissions]);
    const limit = Math.min(Math.max(args.limit ?? 50, 1), 200);
    const returns = await ctx.db
      .query("returns")
      .withIndex("by_createdAtIso")
      .order("desc")
      .take(limit);
    return await Promise.all(returns.map((record) => returnToView(ctx, record)));
  },
});

export const listByInvoice = query({
  args: { invoiceId: v.id("invoices") },
  returns: v.array(returnView),
  handler: async (ctx, args) => {
    await requireAnyPermission(ctx, [...returnListPermissions]);
    const returns = await ctx.db
      .query("returns")
      .withIndex("by_invoiceId", (q) => q.eq("invoiceId", args.invoiceId))
      .order("desc")
      .take(100);
    return await Promise.all(returns.map((record) => returnToView(ctx, record)));
  },
});

const returnDetailLineView = v.object({
  lineIndex: v.number(),
  qtyReturned: v.number(),
  productName: v.string(),
  unitPriceMad: v.number(),
  lineRefundMad: v.number(),
});

const returnDetailView = v.object({
  id: v.id("returns"),
  invoiceId: v.id("invoices"),
  invoiceNumber: v.string(),
  clientId: v.union(v.id("clients"), v.null()),
  clientName: v.string(),
  createdAtIso: v.string(),
  reason: returnReason,
  stockDisposition,
  refundTotalMad: v.number(),
  note: v.union(v.string(), v.null()),
  lines: v.array(returnDetailLineView),
});

async function returnToDetailView(
  ctx: QueryCtx | MutationCtx,
  returnRecord: Doc<"returns">,
) {
  const invoice = await ctx.db.get(returnRecord.invoiceId);
  const returnLines = await ctx.db
    .query("returnLines")
    .withIndex("by_returnId", (q) => q.eq("returnId", returnRecord._id))
    .take(200);
  const invoiceLines = await ctx.db
    .query("invoiceLines")
    .withIndex("by_invoiceId", (q) => q.eq("invoiceId", returnRecord.invoiceId))
    .take(200);
  const lineByIndex = new Map(
    invoiceLines.map((invoiceLine) => [invoiceLine.lineIndex, invoiceLine]),
  );
  const lineById = new Map(
    invoiceLines.map((invoiceLine) => [invoiceLine._id, invoiceLine]),
  );

  const lines = returnLines
    .sort((a, b) => a.lineIndex - b.lineIndex)
    .map((line) => {
      const invoiceLine =
        (line.invoiceLineId ? lineById.get(line.invoiceLineId) : undefined) ??
        lineByIndex.get(line.lineIndex);
      const unitPriceMadCents = invoiceLine?.unitPriceMadCents ?? 0;
      const lineRefundMadCents = line.qtyReturned * unitPriceMadCents;
      return {
        lineIndex: line.lineIndex,
        qtyReturned: line.qtyReturned,
        productName:
          invoiceLine?.productNameSnapshot ?? fallbackProductLabel(line.lineIndex),
        unitPriceMad: centsToMad(unitPriceMadCents),
        lineRefundMad: centsToMad(lineRefundMadCents),
      };
    });

  return {
    id: returnRecord._id,
    invoiceId: returnRecord.invoiceId,
    invoiceNumber: invoice?.number ?? returnRecord.invoiceId,
    clientId: invoice?.clientId ?? null,
    clientName: invoice?.clientNameSnapshot ?? "",
    createdAtIso: returnRecord.createdAtIso,
    reason: returnRecord.reason,
    stockDisposition: returnRecord.stockDisposition,
    refundTotalMad: centsToMad(returnRecord.refundTotalMadCents),
    note: returnRecord.note ?? null,
    lines,
  };
}

export const getById = query({
  args: { returnId: v.string() },
  returns: v.union(returnDetailView, v.null()),
  handler: async (ctx, args) => {
    await requireAnyPermission(ctx, [...returnListPermissions]);
    const returnId = ctx.db.normalizeId("returns", args.returnId);
    if (!returnId) return null;
    const returnRecord = await ctx.db.get(returnId as Id<"returns">);
    if (!returnRecord) return null;
    return await returnToDetailView(ctx, returnRecord);
  },
});

export const create = mutation({
  args: {
    invoiceId: v.id("invoices"),
    reason: returnReason,
    stockDisposition,
    lines: v.array(returnLineInput),
    note: v.optional(v.string()),
  },
  returns: returnView,
  handler: async (ctx, args) => {
    const { userId, user } = await requireAnyPermission(ctx, [
      "returns.process",
      "sales.cancel",
    ]);
    const result = await processInvoiceReturn(ctx, {
      invoiceId: args.invoiceId,
      userId,
      reason: args.reason,
      stockDisposition: args.stockDisposition,
      lines: args.lines,
      note: args.note,
    });
    await recordAuditForUser(ctx, userId, user, {
      action: "returns.create",
      entityType: "return",
      entityId: result.id,
      summary: `Retour créé: ${result.invoiceNumber}`,
      payload: {
        invoiceId: args.invoiceId,
        reason: args.reason,
        refundTotalMad: result.refundTotalMad,
        lineCount: result.lines.length,
      },
      source: "manual",
    });
    return result;
  },
});

export const executeFromPosHistory = mutation({
  args: {
    ledgerEntryId: v.id("creditLedgerEntries"),
    lines: v.array(returnLineInput),
    reason: v.string(),
    returnMotif: returnReason,
    stockDisposition,
    payloadJson: v.string(),
    responsibleConfirmed: v.boolean(),
    requestedByUserName: v.string(),
  },
  returns: returnView,
  handler: async (ctx, args) => {
    const { userId } = await requireAnyPermission(ctx, [
      "returns.process",
      "sales.cancel",
      "sales.create",
    ]);
    if (!args.responsibleConfirmed) {
      throw new Error("Confirmation de responsabilité requise.");
    }
    const summary = args.reason.trim();
    if (summary.length < 3) {
      throw new Error("Le motif est requis.");
    }
    const userName = args.requestedByUserName.trim();
    if (!userName) {
      throw new Error("Nom du responsable requis.");
    }

    const entry = await ctx.db.get(args.ledgerEntryId);
    if (!entry) throw new Error("Écriture introuvable.");
    if (!entry.invoiceId) {
      throw new Error("Cette écriture n'est pas liée à une facture.");
    }

    await rejectPendingLedgerUpdateRequests(ctx, args.ledgerEntryId);

    const result = await processInvoiceReturn(ctx, {
      invoiceId: entry.invoiceId,
      userId,
      reason: args.returnMotif,
      stockDisposition: args.stockDisposition,
      lines: args.lines,
      note: `${summary} (${userName})`,
    });

    await ctx.db.insert("creditLedgerUpdateRequests", {
      ledgerEntryId: args.ledgerEntryId,
      clientId: entry.clientId,
      invoiceId: entry.invoiceId,
      updateType: "return",
      reason: summary,
      payloadJson: args.payloadJson,
      responsibleConfirmed: true,
      requestedByUserId: userId,
      requestedByUserName: userName,
      status: "approved",
      createdAt: Date.now(),
    });

    return result;
  },
});
