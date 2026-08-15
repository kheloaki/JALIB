import type { Id } from "./_generated/dataModel";
import type { MutationCtx } from "./_generated/server";

/**
 * Fully remove an invoice and related rows (lines, payments, ledger, plans, returns).
 */
export async function deleteInvoiceCascade(
  ctx: MutationCtx,
  invoiceId: Id<"invoices">,
) {
  const lines = await ctx.db
    .query("invoiceLines")
    .withIndex("by_invoiceId", (q) => q.eq("invoiceId", invoiceId))
    .take(500);
  for (const line of lines) {
    await ctx.db.delete(line._id);
  }

  const payments = await ctx.db
    .query("invoicePayments")
    .withIndex("by_invoiceId_date", (q) => q.eq("invoiceId", invoiceId))
    .take(500);
  for (const payment of payments) {
    await ctx.db.delete(payment._id);
  }

  const ledgerEntries = await ctx.db
    .query("creditLedgerEntries")
    .withIndex("by_invoiceId", (q) => q.eq("invoiceId", invoiceId))
    .take(500);
  for (const entry of ledgerEntries) {
    const requests = await ctx.db
      .query("creditLedgerUpdateRequests")
      .withIndex("by_ledgerEntryId", (q) => q.eq("ledgerEntryId", entry._id))
      .take(50);
    for (const request of requests) {
      await ctx.db.delete(request._id);
    }
    await ctx.db.delete(entry._id);
  }

  const plans = await ctx.db.query("installmentPlans").take(500);
  for (const plan of plans) {
    if (plan.invoiceId !== invoiceId) continue;
    const planLedger = await ctx.db
      .query("creditLedgerEntries")
      .withIndex("by_planId_date", (q) => q.eq("planId", plan._id))
      .take(500);
    for (const entry of planLedger) {
      const requests = await ctx.db
        .query("creditLedgerUpdateRequests")
        .withIndex("by_ledgerEntryId", (q) => q.eq("ledgerEntryId", entry._id))
        .take(50);
      for (const request of requests) {
        await ctx.db.delete(request._id);
      }
      await ctx.db.delete(entry._id);
    }
    await ctx.db.delete(plan._id);
  }

  const returns = await ctx.db
    .query("returns")
    .withIndex("by_invoiceId", (q) => q.eq("invoiceId", invoiceId))
    .take(100);
  for (const ret of returns) {
    const returnLines = await ctx.db
      .query("returnLines")
      .withIndex("by_returnId", (q) => q.eq("returnId", ret._id))
      .take(200);
    for (const line of returnLines) {
      await ctx.db.delete(line._id);
    }
    await ctx.db.delete(ret._id);
  }

  await ctx.db.delete(invoiceId);
}

export async function deleteClientCascade(
  ctx: MutationCtx,
  clientId: Id<"clients">,
) {
  const invoices = await ctx.db
    .query("invoices")
    .withIndex("by_clientId_date", (q) => q.eq("clientId", clientId))
    .take(1000);
  for (const invoice of invoices) {
    await deleteInvoiceCascade(ctx, invoice._id);
  }

  const ledger = await ctx.db
    .query("creditLedgerEntries")
    .withIndex("by_clientId_date", (q) => q.eq("clientId", clientId))
    .take(1000);
  for (const entry of ledger) {
    const requests = await ctx.db
      .query("creditLedgerUpdateRequests")
      .withIndex("by_ledgerEntryId", (q) => q.eq("ledgerEntryId", entry._id))
      .take(50);
    for (const request of requests) {
      await ctx.db.delete(request._id);
    }
    await ctx.db.delete(entry._id);
  }

  const plans = await ctx.db
    .query("installmentPlans")
    .withIndex("by_clientId_status", (q) => q.eq("clientId", clientId))
    .take(200);
  for (const plan of plans) {
    await ctx.db.delete(plan._id);
  }

  const alerts = await ctx.db
    .query("alerts")
    .withIndex("by_clientId", (q) => q.eq("clientId", clientId))
    .take(200);
  for (const alert of alerts) {
    await ctx.db.delete(alert._id);
  }

  await ctx.db.delete(clientId);
}
