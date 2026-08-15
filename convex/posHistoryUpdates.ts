import { v } from "convex/values";

import { mutation } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import type { MutationCtx } from "./_generated/server";
import { hasAnyPermission, requireAnyPermission } from "./authz";
import { rejectPendingLedgerUpdateRequests } from "./creditLedgerUpdateRequests";
import {
  computeInvoiceTotalCents,
  invoicePaymentsTotalCents,
  resolveInvoiceStatus,
  syncInvoiceCreditLedgerAmount,
  syncInvoiceLedgerEntry,
} from "./invoiceCreditAdjustments";
import { madToCents } from "./money";

const linePriceInput = v.object({
  lineIndex: v.number(),
  newUnitPriceMad: v.number(),
});

const posHistoryResult = v.object({
  invoiceId: v.id("invoices"),
  invoiceNumber: v.string(),
  previousTotalMad: v.number(),
  newTotalMad: v.number(),
  differenceMad: v.number(),
});

type PosHistoryResult = {
  invoiceId: Id<"invoices">;
  invoiceNumber: string;
  previousTotalMad: number;
  newTotalMad: number;
  differenceMad: number;
};

async function recalculateInvoiceAndAdjustCredit(
  ctx: MutationCtx,
  invoiceId: Id<"invoices">,
  note: string,
): Promise<{ previousTotalMadCents: number; newTotalMadCents: number }> {
  const invoice = await ctx.db.get(invoiceId);
  if (!invoice) throw new Error("Facture introuvable.");

  const previousTotalMadCents = invoice.totalMadCents;
  const newTotalMadCents = await computeInvoiceTotalCents(ctx, invoiceId);
  const deltaMadCents = newTotalMadCents - previousTotalMadCents;
  const now = Date.now();
  const date = new Date(now).toISOString().slice(0, 10);
  let paidMadCents = await invoicePaymentsTotalCents(ctx, invoiceId);

  if (invoice.paymentType === "credit" && invoice.clientId && deltaMadCents !== 0) {
    if (deltaMadCents > 0) {
      const invoiceEntry = await ctx.db
        .query("creditLedgerEntries")
        .withIndex("by_invoiceId", (q) => q.eq("invoiceId", invoiceId))
        .filter((q) => q.eq(q.field("kind"), "invoice"))
        .first();
      if (invoiceEntry) {
        await ctx.db.patch(invoiceEntry._id, {
          amountMadCents: invoiceEntry.amountMadCents + deltaMadCents,
        });
      }
    } else {
      await syncInvoiceCreditLedgerAmount(ctx, invoiceId);
      const refundMadCents = -deltaMadCents;
      if (refundMadCents > 0) {
        await ctx.db.insert("creditLedgerEntries", {
          clientId: invoice.clientId,
          invoiceId,
          kind: "return",
          date,
          ref: `Ajustement #AJ-${now.toString(36).toUpperCase().slice(-6)}`,
          note: note || `Ajustement ${invoice.number}`,
          amountMadCents: refundMadCents,
          status: "valide",
          source: "return",
          createdAt: now,
        });
      }

      const overpaidMadCents = Math.max(0, paidMadCents - newTotalMadCents);
      if (overpaidMadCents > 0) {
        await ctx.db.insert("invoicePayments", {
          invoiceId,
          date,
          amountMadCents: -overpaidMadCents,
          note: note || "Ajustement prix validé",
          ref: `Ajustement #AJ-${now.toString(36).toUpperCase().slice(-6)}`,
          createdAt: now,
        });
        paidMadCents -= overpaidMadCents;
      }
    }

    await syncInvoiceLedgerEntry(ctx, invoiceId);
  }

  await ctx.db.patch(invoiceId, {
    totalMadCents: newTotalMadCents,
    status: await resolveInvoiceStatus(
      ctx,
      invoice,
      invoiceId,
      newTotalMadCents,
      paidMadCents,
    ),
    updatedAt: now,
  });

  return { previousTotalMadCents, newTotalMadCents };
}

async function validatePosHistoryRequest(
  ctx: MutationCtx,
  args: {
    ledgerEntryId: Id<"creditLedgerEntries">;
    reason: string;
    responsibleConfirmed: boolean;
    requestedByUserName: string;
  },
) {
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

  const invoice = await ctx.db.get(entry.invoiceId);
  if (!invoice) throw new Error("Facture introuvable.");

  return { entry, invoice, summary, userName };
}

async function recordApprovedUpdate(
  ctx: MutationCtx,
  input: {
    ledgerEntryId: Id<"creditLedgerEntries">;
    clientId: Id<"clients">;
    invoiceId: Id<"invoices">;
    updateType: "replacement" | "price_change";
    reason: string;
    payloadJson: string;
    userId: Id<"users">;
    userName: string;
  },
) {
  await ctx.db.insert("creditLedgerUpdateRequests", {
    ledgerEntryId: input.ledgerEntryId,
    clientId: input.clientId,
    invoiceId: input.invoiceId,
    updateType: input.updateType,
    reason: input.reason,
    payloadJson: input.payloadJson,
    responsibleConfirmed: true,
    requestedByUserId: input.userId,
    requestedByUserName: input.userName,
    status: "approved",
    createdAt: Date.now(),
  });
}

function toResult(
  invoice: Doc<"invoices">,
  previousTotalMadCents: number,
  newTotalMadCents: number,
): PosHistoryResult {
  return {
    invoiceId: invoice._id,
    invoiceNumber: invoice.number,
    previousTotalMad: previousTotalMadCents / 100,
    newTotalMad: newTotalMadCents / 100,
    differenceMad: (newTotalMadCents - previousTotalMadCents) / 100,
  };
}

export const executeReplacementFromPosHistory = mutation({
  args: {
    ledgerEntryId: v.id("creditLedgerEntries"),
    purchasedLineIndex: v.number(),
    replacementProductId: v.id("products"),
    replacementUnitPriceMad: v.number(),
    reason: v.string(),
    payloadJson: v.string(),
    responsibleConfirmed: v.boolean(),
    requestedByUserName: v.string(),
  },
  returns: posHistoryResult,
  handler: async (ctx, args) => {
    const { userId } = await requireAnyPermission(ctx, [
      "returns.process",
      "sales.cancel",
      "sales.create",
    ]);
    const { entry, invoice, summary, userName } = await validatePosHistoryRequest(
      ctx,
      args,
    );

    const invoiceLines = await ctx.db
      .query("invoiceLines")
      .withIndex("by_invoiceId", (q) => q.eq("invoiceId", entry.invoiceId!))
      .take(300);
    const line = invoiceLines.find((row) => row.lineIndex === args.purchasedLineIndex);
    if (!line) throw new Error("Ligne de facture introuvable.");

    const qtyRemaining = line.qty - line.returnedQty;
    if (qtyRemaining <= 0) {
      throw new Error("Cet article est déjà entièrement retourné.");
    }

    const newProduct = await ctx.db.get(args.replacementProductId);
    if (!newProduct) throw new Error("Produit de remplacement introuvable.");

    const newUnitPriceMadCents = madToCents(args.replacementUnitPriceMad);
    if (newUnitPriceMadCents <= 0) {
      throw new Error("Le prix du produit de remplacement doit être supérieur à 0.");
    }

    const now = Date.now();

    if (line.productId) {
      const oldProduct = await ctx.db.get(line.productId);
      if (oldProduct) {
        const stockQty = oldProduct.stockQty + qtyRemaining;
        await ctx.db.patch(oldProduct._id, {
          stockQty,
          stockLow: stockQty > 0 && stockQty <= 10,
          updatedAt: now,
        });
      }
    }

    const nextStockQty = Math.max(0, newProduct.stockQty - qtyRemaining);
    await ctx.db.patch(newProduct._id, {
      stockQty: nextStockQty,
      stockLow: nextStockQty > 0 && nextStockQty <= 10,
      updatedAt: now,
    });

    await ctx.db.patch(line._id, {
      productId: args.replacementProductId,
      productNameSnapshot: newProduct.name,
      unitPriceMadCents: newUnitPriceMadCents,
    });

    const { previousTotalMadCents, newTotalMadCents } =
      await recalculateInvoiceAndAdjustCredit(
        ctx,
        entry.invoiceId!,
        `${summary} (${userName})`,
      );

    await recordApprovedUpdate(ctx, {
      ledgerEntryId: args.ledgerEntryId,
      clientId: entry.clientId,
      invoiceId: entry.invoiceId!,
      updateType: "replacement",
      reason: summary,
      payloadJson: args.payloadJson,
      userId,
      userName,
    });

    const updatedInvoice = await ctx.db.get(entry.invoiceId!);
    if (!updatedInvoice) throw new Error("Facture introuvable.");
    return toResult(updatedInvoice, previousTotalMadCents, newTotalMadCents);
  },
});

export const executePriceChangeFromPosHistory = mutation({
  args: {
    ledgerEntryId: v.id("creditLedgerEntries"),
    linePrices: v.array(linePriceInput),
    reason: v.string(),
    payloadJson: v.string(),
    responsibleConfirmed: v.boolean(),
    requestedByUserName: v.string(),
  },
  returns: posHistoryResult,
  handler: async (ctx, args) => {
    const { userId } = await requireAnyPermission(ctx, [
      "sales.edit_price",
      "sales.cancel",
      "returns.process",
    ]);
    const canEditPrice = await hasAnyPermission(ctx, ["sales.edit_price"]);
    if (!canEditPrice) {
      throw new Error("Permission requise pour modifier les prix.");
    }

    const { entry, invoice, summary, userName } = await validatePosHistoryRequest(
      ctx,
      args,
    );
    if (args.linePrices.length === 0) {
      throw new Error("Aucun prix modifié.");
    }

    const invoiceLines = await ctx.db
      .query("invoiceLines")
      .withIndex("by_invoiceId", (q) => q.eq("invoiceId", entry.invoiceId!))
      .take(300);
    const lineByIndex = new Map(invoiceLines.map((row) => [row.lineIndex, row]));

    for (const change of args.linePrices) {
      const line = lineByIndex.get(Math.floor(change.lineIndex));
      if (!line) {
        throw new Error(`Ligne de facture introuvable: ${change.lineIndex}`);
      }
      const remainingQty = line.qty - line.returnedQty;
      if (remainingQty <= 0) continue;

      const newUnitPriceMadCents = madToCents(change.newUnitPriceMad);
      if (newUnitPriceMadCents <= 0) {
        throw new Error("Chaque prix unitaire doit être supérieur à 0.");
      }
      if (newUnitPriceMadCents === line.unitPriceMadCents) continue;

      await ctx.db.patch(line._id, {
        unitPriceMadCents: newUnitPriceMadCents,
      });
    }

    const { previousTotalMadCents, newTotalMadCents } =
      await recalculateInvoiceAndAdjustCredit(
        ctx,
        entry.invoiceId!,
        `${summary} (${userName})`,
      );

    if (previousTotalMadCents === newTotalMadCents) {
      throw new Error("Aucun changement de prix appliqué.");
    }

    await recordApprovedUpdate(ctx, {
      ledgerEntryId: args.ledgerEntryId,
      clientId: entry.clientId,
      invoiceId: entry.invoiceId!,
      updateType: "price_change",
      reason: summary,
      payloadJson: args.payloadJson,
      userId,
      userName,
    });

    const updatedInvoice = await ctx.db.get(entry.invoiceId!);
    if (!updatedInvoice) throw new Error("Facture introuvable.");
    return toResult(updatedInvoice, previousTotalMadCents, newTotalMadCents);
  },
});
