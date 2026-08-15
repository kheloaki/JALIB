import { v } from "convex/values";

import { internalQuery } from "./_generated/server";

/**
 * DEV-only baseline: table sizes for performance work on enhance-data.
 * Run: `npx convex run perfBaseline:tableCounts` (never use --prod).
 */
export const tableCounts = internalQuery({
  args: {},
  returns: v.object({
    products: v.number(),
    productsActive: v.number(),
    clients: v.number(),
    invoices: v.number(),
    invoiceLines: v.number(),
    creditLedgerEntries: v.number(),
    installmentPlans: v.number(),
    sampledAt: v.number(),
  }),
  handler: async (ctx) => {
    const [
      products,
      productsActive,
      clients,
      invoices,
      invoiceLines,
      creditLedgerEntries,
      installmentPlans,
    ] = await Promise.all([
      ctx.db.query("products").take(9000),
      ctx.db
        .query("products")
        .withIndex("by_active", (q) => q.eq("active", true))
        .take(9000),
      ctx.db.query("clients").take(9000),
      ctx.db.query("invoices").take(9000),
      ctx.db.query("invoiceLines").take(9000),
      ctx.db.query("creditLedgerEntries").take(9000),
      ctx.db.query("installmentPlans").take(9000),
    ]);

    return {
      products: products.length,
      productsActive: productsActive.length,
      clients: clients.length,
      invoices: invoices.length,
      invoiceLines: invoiceLines.length,
      creditLedgerEntries: creditLedgerEntries.length,
      installmentPlans: installmentPlans.length,
      sampledAt: Date.now(),
    };
  },
});
