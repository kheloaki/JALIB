import { v } from "convex/values";

import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { internalMutation, type MutationCtx } from "./_generated/server";

const ADMIN_NOTIFY_PERMISSIONS = [
  "admin.manage_settings",
  "admin.manage_roles",
  "alerts.manage",
] as const;

async function userReceivesAdminCreditAlerts(
  ctx: MutationCtx,
  userId: Id<"users">,
) {
  const user = await ctx.db.get(userId);
  if (!user?.roleId) return false;
  const role = await ctx.db.get(user.roleId);
  if (role?.legacyId === "role:admin") return true;

  for (const permissionKey of ADMIN_NOTIFY_PERMISSIONS) {
    const permission = await ctx.db
      .query("permissions")
      .withIndex("by_key", (q) => q.eq("key", permissionKey))
      .first();
    if (!permission) continue;
    const link = await ctx.db
      .query("rolePermissions")
      .withIndex("by_roleId_permissionId", (q) =>
        q.eq("roleId", user.roleId!).eq("permissionId", permission._id),
      )
      .unique();
    if (link?.enabled) return true;
  }
  return false;
}

async function listAdminPushSubscriptions(ctx: MutationCtx) {
  const subscriptions = await ctx.db.query("pushSubscriptions").take(500);
  const rows = [];
  for (const sub of subscriptions) {
    if (await userReceivesAdminCreditAlerts(ctx, sub.userId)) {
      rows.push(sub);
    }
  }
  return rows;
}

export const notifyCreditLimitExceeded = internalMutation({
  args: {
    clientId: v.id("clients"),
    clientName: v.string(),
    outstandingMadCents: v.number(),
    creditLimitMadCents: v.number(),
    invoiceNumber: v.string(),
    saleMadCents: v.number(),
    cashierName: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const subscriptions = await listAdminPushSubscriptions(ctx);
    if (subscriptions.length === 0) return null;

    await ctx.scheduler.runAfter(
      0,
      internal.pushNotifications.sendCreditLimitExceeded,
      {
        clientId: args.clientId,
        clientName: args.clientName,
        outstandingMadCents: args.outstandingMadCents,
        creditLimitMadCents: args.creditLimitMadCents,
        invoiceNumber: args.invoiceNumber,
        saleMadCents: args.saleMadCents,
        cashierName: args.cashierName,
        subscriptions: subscriptions.map((row) => ({
          id: row._id,
          endpoint: row.endpoint,
          p256dh: row.p256dh,
          auth: row.auth,
          locale: row.locale,
        })),
      },
    );
    return null;
  },
});

export const runAlertPushDigest = internalMutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    const subscriptions = await ctx.db.query("pushSubscriptions").take(500);
    if (subscriptions.length === 0) return null;

    let critical = 0;
    let total = 0;

    const settingsDoc = await ctx.db
      .query("settings")
      .withIndex("by_key", (q) => q.eq("key", "app:parameters"))
      .first();
    const settingsValue = settingsDoc?.value as { lowStockThreshold?: number } | undefined;
    const lowStockThreshold =
      typeof settingsValue?.lowStockThreshold === "number"
        ? settingsValue.lowStockThreshold
        : 10;
    const clients = await ctx.db.query("clients").take(500);

    for (const client of clients) {
      if (client.isCashOnly) continue;
      if (client.creditLimitMadCents == null || client.creditLimitMadCents <= 0) {
        continue;
      }
      const entries = await ctx.db
        .query("creditLedgerEntries")
        .withIndex("by_clientId_date", (q) => q.eq("clientId", client._id))
        .collect();

      let invoicedCents = 0;
      let creditCents = 0;
      for (const entry of entries) {
        if (entry.kind === "invoice") invoicedCents += entry.amountMadCents;
        else if (entry.kind === "return" || entry.source === "return") {
          creditCents += entry.amountMadCents;
        } else if (entry.kind === "payment") creditCents += entry.amountMadCents;
      }
      const balanceCents =
        invoicedCents - creditCents - (client.initialSoldeMadCents ?? 0);
      if (balanceCents <= 0) continue;

      const ratio = balanceCents / client.creditLimitMadCents;
      if (ratio >= 1) {
        critical += 1;
        total += 1;
      } else if (ratio >= 0.9) {
        total += 1;
      }
    }

    const products = await ctx.db.query("products").take(1000);
    for (const product of products) {
      if (product.stockLow || product.stockQty <= lowStockThreshold) {
        total += 1;
      }
    }

    if (total <= 0) return null;

    await ctx.scheduler.runAfter(0, internal.pushNotifications.sendAlertDigest, {
      alertCount: total,
      criticalCount: critical,
      subscriptions: subscriptions.map((row) => ({
        id: row._id,
        endpoint: row.endpoint,
        p256dh: row.p256dh,
        auth: row.auth,
        locale: row.locale,
        lastAlertCount: row.lastAlertCount,
      })),
    });
    return null;
  },
});
