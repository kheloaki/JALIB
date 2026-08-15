import { v } from "convex/values";

import { internalMutation, mutation, query } from "./_generated/server";
import { requireAnyPermission, requirePermission } from "./authz";
import { deleteClientCascade, deleteInvoiceCascade } from "./deleteCascade";
import { DEFAULT_PRODUCT_CATEGORIES, DEFAULT_PRODUCTS } from "./defaultCatalog";

export const status = query({
  args: {},
  returns: v.object({
    clients: v.number(),
    products: v.number(),
    invoices: v.number(),
  }),
  handler: async (ctx) => {
    await requireAnyPermission(ctx, [
      "stock.view",
      "sales.view",
      "admin.manage_roles",
    ]);
    const [clients, products, invoices] = await Promise.all([
      ctx.db.query("clients").take(1000),
      ctx.db.query("products").take(1000),
      ctx.db.query("invoices").take(1000),
    ]);
    return {
      clients: clients.length,
      products: products.length,
      invoices: invoices.length,
    };
  },
});

export const ensureDefaultCatalog = mutation({
  args: {},
  returns: v.object({
    categoriesInserted: v.number(),
    productsInserted: v.number(),
  }),
  handler: async (ctx) => {
    await requirePermission(ctx, "stock.edit_products");
    const now = Date.now();
    let categoriesInserted = 0;
    let productsInserted = 0;

    for (const label of DEFAULT_PRODUCT_CATEGORIES) {
      const normalizedLabel = label.toLowerCase();
      const existing = await ctx.db
        .query("productCategories")
        .withIndex("by_normalizedLabel", (q) =>
          q.eq("normalizedLabel", normalizedLabel),
        )
        .unique();
      if (existing) continue;
      await ctx.db.insert("productCategories", {
        label,
        normalizedLabel,
        kind: "builtIn",
        createdAt: now,
      });
      categoriesInserted += 1;
    }

    for (const product of DEFAULT_PRODUCTS) {
      const existing = await ctx.db
        .query("products")
        .withIndex("by_legacyId", (q) => q.eq("legacyId", product.legacyId))
        .unique();
      if (existing) continue;
      const productId = await ctx.db.insert("products", {
        legacyId: product.legacyId,
        name: product.name,
        categoryLabel: product.categoryLabel,
        ...("barcode" in product && product.barcode
          ? { barcode: product.barcode }
          : {}),
        sellPriceMadCents: product.sellPriceMadCents,
        costMadCents: product.costMadCents,
        stockQty: product.stockQty,
        stockLow: product.stockQty > 0 && product.stockQty <= 10,
        imageUrl: product.imageUrl,
        imageAlt: product.imageAlt,
        active: true,
        createdAt: now,
        updatedAt: now,
      });
      await ctx.db.insert("productPriceHistory", {
        productId,
        kind: "purchase",
        amountMadCents: product.costMadCents,
        recordedAt: now,
        source: "seed",
      });
      productsInserted += 1;
    }

    return { categoriesInserted, productsInserted };
  },
});

/**
 * One-shot cleanup (CLI/internal): invoices, clients, procurement, payments.
 * Keeps users, roles, products, settings, brands.
 */
export const clearOperationalData = internalMutation({
  args: {},
  returns: v.object({
    invoicesDeleted: v.number(),
    clientsDeleted: v.number(),
    procurementListsDeleted: v.number(),
    procurementItemsDeleted: v.number(),
    paymentsDeleted: v.number(),
    ledgerDeleted: v.number(),
    plansDeleted: v.number(),
    returnsDeleted: v.number(),
    draftsDeleted: v.number(),
  }),
  handler: async (ctx) => {
    let invoicesDeleted = 0;
    const invoices = await ctx.db.query("invoices").take(5000);
    for (const invoice of invoices) {
      await deleteInvoiceCascade(ctx, invoice._id);
      invoicesDeleted += 1;
    }

    let clientsDeleted = 0;
    const clients = await ctx.db.query("clients").take(5000);
    for (const client of clients) {
      await deleteClientCascade(ctx, client._id);
      clientsDeleted += 1;
    }

    let procurementItemsDeleted = 0;
    const procurementItems = await ctx.db
      .query("procurementListItems")
      .take(5000);
    for (const item of procurementItems) {
      await ctx.db.delete(item._id);
      procurementItemsDeleted += 1;
    }

    let procurementListsDeleted = 0;
    const procurementLists = await ctx.db
      .query("procurementLists")
      .take(2000);
    for (const list of procurementLists) {
      await ctx.db.delete(list._id);
      procurementListsDeleted += 1;
    }

    let paymentsDeleted = 0;
    const payments = await ctx.db.query("invoicePayments").take(5000);
    for (const payment of payments) {
      await ctx.db.delete(payment._id);
      paymentsDeleted += 1;
    }

    let ledgerDeleted = 0;
    const ledger = await ctx.db.query("creditLedgerEntries").take(5000);
    for (const entry of ledger) {
      const requests = await ctx.db
        .query("creditLedgerUpdateRequests")
        .withIndex("by_ledgerEntryId", (q) => q.eq("ledgerEntryId", entry._id))
        .take(50);
      for (const request of requests) {
        await ctx.db.delete(request._id);
      }
      await ctx.db.delete(entry._id);
      ledgerDeleted += 1;
    }

    let plansDeleted = 0;
    const plans = await ctx.db.query("installmentPlans").take(2000);
    for (const plan of plans) {
      await ctx.db.delete(plan._id);
      plansDeleted += 1;
    }

    let returnsDeleted = 0;
    const returns = await ctx.db.query("returns").take(2000);
    for (const ret of returns) {
      const lines = await ctx.db
        .query("returnLines")
        .withIndex("by_returnId", (q) => q.eq("returnId", ret._id))
        .take(200);
      for (const line of lines) {
        await ctx.db.delete(line._id);
      }
      await ctx.db.delete(ret._id);
      returnsDeleted += 1;
    }

    let draftsDeleted = 0;
    const drafts = await ctx.db.query("posCartDrafts").take(2000);
    for (const draft of drafts) {
      await ctx.db.delete(draft._id);
      draftsDeleted += 1;
    }

    return {
      invoicesDeleted,
      clientsDeleted,
      procurementListsDeleted,
      procurementItemsDeleted,
      paymentsDeleted,
      ledgerDeleted,
      plansDeleted,
      returnsDeleted,
      draftsDeleted,
    };
  },
});
