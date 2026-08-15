import { v } from "convex/values";

import { mutation } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import type { MutationCtx } from "./_generated/server";
import { requireAnyPermission } from "./authz";
import { rejectPendingLedgerUpdateRequests } from "./creditLedgerUpdateRequests";
import {
  computeInvoiceTotalCents,
  invoiceCreditOutstandingCents,
  invoicePaymentsTotalCents,
  resolveInvoiceStatus,
  syncInvoiceLedgerEntry,
} from "./invoiceCreditAdjustments";
import { centsToMad } from "./money";

const paymentType = v.union(v.literal("cash"), v.literal("credit"));

async function invoiceFullyReturned(
  ctx: MutationCtx,
  invoiceId: Id<"invoices">,
) {
  const invoice = await ctx.db.get(invoiceId);
  if (!invoice) return false;
  if (invoice.status === "returned" && invoice.totalMadCents <= 0) {
    return true;
  }
  const lines = await ctx.db
    .query("invoiceLines")
    .withIndex("by_invoiceId", (q) => q.eq("invoiceId", invoiceId))
    .take(300);
  if (lines.length === 0) return false;
  return lines.every((line) => line.returnedQty >= line.qty);
}

async function cancelRemainingInvoiceForReopen(
  ctx: MutationCtx,
  input: {
    invoiceId: Id<"invoices">;
    userId: Id<"users">;
    note: string;
  },
) {
  const invoice = await ctx.db.get(input.invoiceId);
  if (!invoice) throw new Error("Facture introuvable.");

  if (invoice.status === "returned" && invoice.totalMadCents <= 0) {
    throw new Error("Cet achat est déjà annulé.");
  }

  const invoiceLines = await ctx.db
    .query("invoiceLines")
    .withIndex("by_invoiceId", (q) => q.eq("invoiceId", input.invoiceId))
    .take(300);

  const validated: Array<{
    line: Doc<"invoiceLines">;
    lineIndex: number;
    qtyReturned: number;
  }> = [];

  for (const line of invoiceLines) {
    const remainingQty = line.qty - line.returnedQty;
    if (remainingQty <= 0) continue;
    validated.push({
      line,
      lineIndex: line.lineIndex,
      qtyReturned: remainingQty,
    });
  }

  if (validated.length === 0) {
    throw new Error("Cet achat est déjà entièrement annulé.");
  }

  let refundTotalMadCents = 0;
  for (const item of validated) {
    refundTotalMadCents += item.qtyReturned * item.line.unitPriceMadCents;
  }

  const now = Date.now();
  const createdAtIso = new Date(now).toISOString();
  const returnRef = `RT-${now.toString(36).toUpperCase().slice(-6)}`;

  const returnId = await ctx.db.insert("returns", {
    invoiceId: input.invoiceId,
    createdAtIso,
    reason: "Autre",
    stockDisposition: "Disponible",
    refundTotalMadCents,
    note: input.note,
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

    if (item.line.productId) {
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

  if (invoice.paymentType === "credit") {
    const overpaidMadCents = Math.max(0, paidMadCents - nextTotalMadCents);
    if (overpaidMadCents > 0) {
      await ctx.db.insert("invoicePayments", {
        invoiceId: input.invoiceId,
        date: createdAtIso.slice(0, 10),
        amountMadCents: -overpaidMadCents,
        note: input.note,
        ref: `Retour #${returnRef}`,
        createdAt: now,
      });
      paidMadCents -= overpaidMadCents;
    }

    if (invoice.clientId) {
      const outstandingMadCents = Math.max(
        0,
        await invoiceCreditOutstandingCents(ctx, input.invoiceId),
      );
      const ledgerAdjustmentMadCents = Math.min(
        refundTotalMadCents,
        outstandingMadCents,
      );
      if (ledgerAdjustmentMadCents > 0) {
        await ctx.db.insert("creditLedgerEntries", {
          clientId: invoice.clientId,
          invoiceId: input.invoiceId,
          kind: "return",
          date: createdAtIso.slice(0, 10),
          ref: `Annulation #${returnRef}`,
          note: input.note,
          amountMadCents: ledgerAdjustmentMadCents,
          status: "valide",
          source: "return",
          createdAt: now,
        });
      }
    }

    await syncInvoiceLedgerEntry(ctx, input.invoiceId);
  }

  await ctx.db.patch(input.invoiceId, {
    totalMadCents: nextTotalMadCents,
    status: await resolveInvoiceStatus(
      ctx,
      invoice,
      input.invoiceId,
      nextTotalMadCents,
      paidMadCents,
    ),
    updatedAt: now,
  });

  return {
    refundTotalMad: centsToMad(refundTotalMadCents),
    invoice,
  };
}

export const executeReopenInCaisse = mutation({
  args: {
    ledgerEntryId: v.id("creditLedgerEntries"),
    reason: v.string(),
    payloadJson: v.string(),
    responsibleConfirmed: v.boolean(),
    requestedByUserName: v.string(),
  },
  returns: v.object({
    invoiceId: v.id("invoices"),
    invoiceNumber: v.string(),
    clientId: v.id("clients"),
    payment: paymentType,
  }),
  handler: async (ctx, args) => {
    const { userId } = await requireAnyPermission(ctx, [
      "sales.reopen",
      "sales.cancel",
      "sales.create",
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
    if (!entry.invoiceId) {
      throw new Error("Cette écriture n'est pas liée à une facture.");
    }

    await rejectPendingLedgerUpdateRequests(ctx, args.ledgerEntryId);

    const invoiceDoc = await ctx.db.get(entry.invoiceId);
    if (!invoiceDoc) throw new Error("Facture introuvable.");

    const priorReopen = await ctx.db
      .query("creditLedgerUpdateRequests")
      .withIndex("by_ledgerEntryId", (q) =>
        q.eq("ledgerEntryId", args.ledgerEntryId),
      )
      .filter((q) =>
        q.and(
          q.eq(q.field("status"), "approved"),
          q.eq(q.field("updateType"), "reopen_in_caisse"),
        ),
      )
      .first();

    if (priorReopen && (await invoiceFullyReturned(ctx, entry.invoiceId))) {
      const clientId = invoiceDoc.clientId ?? entry.clientId;
      if (!clientId) {
        throw new Error("Client introuvable pour cet achat.");
      }
      return {
        invoiceId: invoiceDoc._id,
        invoiceNumber: invoiceDoc.number,
        clientId,
        payment: invoiceDoc.paymentType,
      };
    }

    const cancelNote = `Annulation — renvoi à la caisse (${userName})`;
    const { invoice } = await cancelRemainingInvoiceForReopen(ctx, {
      invoiceId: entry.invoiceId,
      userId,
      note: cancelNote,
    });

    const clientId = invoice.clientId ?? entry.clientId;
    if (!clientId) {
      throw new Error("Client introuvable pour cet achat.");
    }

    await ctx.db.insert("creditLedgerUpdateRequests", {
      ledgerEntryId: args.ledgerEntryId,
      clientId: entry.clientId,
      invoiceId: entry.invoiceId,
      updateType: "reopen_in_caisse",
      reason,
      payloadJson: args.payloadJson,
      responsibleConfirmed: true,
      requestedByUserId: userId,
      requestedByUserName: userName,
      status: "approved",
      createdAt: Date.now(),
    });

    return {
      invoiceId: invoice._id,
      invoiceNumber: invoice.number,
      clientId,
      payment: invoice.paymentType,
    };
  },
});
