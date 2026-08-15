import { v } from "convex/values";

import { mutation } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { internal } from "./_generated/api";
import { recordAuditForUser } from "./audit";
import { hasAnyPermission, requireAnyPermission, requirePermission } from "./authz";
import { generateInvoiceBarcode } from "./barcode";
import { computeClientOutstandingMadCents } from "./invoiceCreditAdjustments";
import { nextInvoiceSequence } from "./invoiceNumbers";
import { centsToMad, madToCents } from "./money";
import { normalizeCheckoutQty } from "./posQty";

const paymentType = v.union(v.literal("cash"), v.literal("credit"));
const checkoutLine = v.object({
  productId: v.optional(v.id("products")),
  name: v.string(),
  unitPriceMad: v.number(),
  qty: v.number(),
});

export const checkout = mutation({
  args: {
    clientId: v.optional(v.id("clients")),
    clientName: v.string(),
    paymentType,
    totalMad: v.number(),
    lines: v.array(checkoutLine),
    cashierName: v.optional(v.string()),
  },
  returns: v.object({
    id: v.id("invoices"),
    number: v.string(),
    barcode: v.string(),
    date: v.string(),
    time: v.string(),
    clientName: v.string(),
    paymentType,
    totalMad: v.number(),
    status: v.union(v.literal("paid"), v.literal("pending")),
  }),
  handler: async (ctx, args) => {
    const { userId, user } = await requirePermission(ctx, "sales.create");
    if (args.lines.length === 0) throw new Error("Cart is empty.");
    if (args.paymentType === "credit") {
      await requireAnyPermission(ctx, ["sales.credit", "credits.approve"]);
      if (!args.clientId) {
        throw new Error("Credit checkout requires a client.");
      }
    }
    const normalizedLines: Array<{
      productId?: Id<"products">;
      name: string;
      qty: number;
      unitPriceMadCents: number;
      soldByWeight: boolean;
      catalogPriceMadCents: number | null;
    }> = [];
    for (const line of args.lines) {
      const product = line.productId
        ? await ctx.db.get(line.productId)
        : null;
      if (line.productId && !product) {
        throw new Error(`Product not found: ${line.productId}`);
      }
      const soldByWeight = product?.soldByWeight === true;
      const qty = normalizeCheckoutQty(line.qty, soldByWeight);
      let unitPriceMadCents = madToCents(line.unitPriceMad);
      // Prefer catalog price when the cart sent 0 (stale IDB / missing import price).
      if (
        product &&
        unitPriceMadCents <= 0 &&
        product.sellPriceMadCents > 0
      ) {
        unitPriceMadCents = product.sellPriceMadCents;
      }
      if (unitPriceMadCents <= 0) {
        throw new Error(
          `Prix manquant pour « ${line.name.trim() || product?.name || "article"} ». Définissez le prix de vente dans le panier (ou en stock) avant l'encaissement.`,
        );
      }
      normalizedLines.push({
        ...(product ? { productId: product._id } : {}),
        name: line.name.trim() || product?.name || "Divers",
        qty,
        unitPriceMadCents,
        soldByWeight,
        catalogPriceMadCents: product ? product.sellPriceMadCents : null,
      });
    }
    const totalMadCents = normalizedLines.reduce(
      (sum, line) => sum + Math.round(line.unitPriceMadCents * line.qty),
      0,
    );

    let priceEdited = false;
    for (const line of normalizedLines) {
      // Misc / unlisted lines and missing catalog price: no edit_price gate.
      if (line.catalogPriceMadCents == null || line.catalogPriceMadCents <= 0) {
        continue;
      }
      if (line.unitPriceMadCents !== line.catalogPriceMadCents) {
        priceEdited = true;
        break;
      }
    }
    if (priceEdited) {
      const canEditPrice = await hasAnyPermission(ctx, ["sales.edit_price"]);
      if (!canEditPrice) {
        throw new Error("Permission required to override unit prices at checkout.");
      }
    }

    const now = new Date();
    const createdAt = now.getTime();
    const date = now.toISOString().slice(0, 10);
    const time = now.toLocaleTimeString("fr-FR", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
    const sequence = await nextInvoiceSequence(ctx);
    const number = `INV-${sequence}`;
    const barcode = generateInvoiceBarcode(sequence - 1000);
    const status: "paid" | "pending" =
      args.paymentType === "cash" ? "paid" : "pending";
    const cashierNameSnapshot =
      user.name ?? args.cashierName?.trim() ?? "Caisse POS";
    let clientNameSnapshot = args.clientName.trim();

    if (args.clientId) {
      const client = await ctx.db.get(args.clientId);
      if (!client) throw new Error("Client not found.");
      clientNameSnapshot = client.fullName;
    }

    const invoiceId = await ctx.db.insert("invoices", {
      number,
      barcode,
      date,
      time,
      ...(args.clientId ? { clientId: args.clientId } : {}),
      clientNameSnapshot,
      paymentType: args.paymentType,
      status,
      totalMadCents,
      cashierId: userId,
      cashierNameSnapshot,
      createdAt,
      updatedAt: createdAt,
    });

    for (let index = 0; index < normalizedLines.length; index += 1) {
      const line = normalizedLines[index]!;
      await ctx.db.insert("invoiceLines", {
        invoiceId,
        ...(line.productId ? { productId: line.productId } : {}),
        productNameSnapshot: line.name,
        lineIndex: index,
        qty: line.qty,
        unitPriceMadCents: line.unitPriceMadCents,
        returnedQty: 0,
      });
      if (!line.productId) continue;
      const product = await ctx.db.get(line.productId);
      if (!product) continue;
      const nextStockQty = Math.max(
        0,
        Math.round((product.stockQty - line.qty) * 1000) / 1000,
      );
      await ctx.db.patch(line.productId, {
        stockQty: nextStockQty,
        stockLow: nextStockQty > 0 && nextStockQty <= 10,
        updatedAt: createdAt,
      });
    }

    if (args.paymentType === "credit") {
      const clientId = args.clientId as Id<"clients">;
      const client = await ctx.db.get(clientId);
      if (!client) throw new Error("Client not found.");

      await ctx.db.insert("creditLedgerEntries", {
        clientId,
        invoiceId,
        kind: "invoice",
        date,
        ref: `Facture ${number}`,
        note: `Achat POS (${args.lines.reduce((sum, line) => sum + line.qty, 0)} article(s))`,
        amountMadCents: totalMadCents,
        status: "impayé",
        source: "pos",
        createdAt,
      });

      if (
        !client.isCashOnly &&
        client.creditLimitMadCents != null &&
        client.creditLimitMadCents > 0
      ) {
        const outstandingMadCents = await computeClientOutstandingMadCents(
          ctx,
          clientId,
        );
        const effectiveOutstandingMadCents = Math.max(
          0,
          outstandingMadCents - (client.initialSoldeMadCents ?? 0),
        );
        if (effectiveOutstandingMadCents > client.creditLimitMadCents) {
          await ctx.scheduler.runAfter(
            0,
            internal.pushAlertDigest.notifyCreditLimitExceeded,
            {
              clientId,
              clientName: client.fullName,
              outstandingMadCents: effectiveOutstandingMadCents,
              creditLimitMadCents: client.creditLimitMadCents,
              invoiceNumber: number,
              saleMadCents: totalMadCents,
              cashierName: cashierNameSnapshot,
            },
          );
        }
      }
    }

    await recordAuditForUser(ctx, userId, user, {
      action: "pos.checkout",
      entityType: "invoice",
      entityId: invoiceId,
      summary: `Vente POS: ${number}`,
      payload: {
        number,
        clientName: clientNameSnapshot,
        paymentType: args.paymentType,
        totalMad: centsToMad(totalMadCents),
        lineCount: normalizedLines.length,
      },
      source: "pos",
    });

    return {
      id: invoiceId,
      number,
      barcode,
      date,
      time,
      clientName: clientNameSnapshot,
      paymentType: args.paymentType,
      totalMad: centsToMad(totalMadCents),
      status,
    };
  },
});
