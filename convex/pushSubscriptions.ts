import { v } from "convex/values";

import { internal } from "./_generated/api";
import { internalMutation, mutation, query } from "./_generated/server";
import { requireAuthenticatedUser, requirePermission } from "./authz";

export const getMine = query({
  args: {},
  returns: v.union(
    v.object({
      id: v.id("pushSubscriptions"),
      endpoint: v.string(),
    }),
    v.null(),
  ),
  handler: async (ctx) => {
    const { userId } = await requireAuthenticatedUser(ctx);
    const row = await ctx.db
      .query("pushSubscriptions")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .first();
    if (!row) return null;
    return { id: row._id, endpoint: row.endpoint };
  },
});

export const save = mutation({
  args: {
    endpoint: v.string(),
    expirationTime: v.optional(v.number()),
    p256dh: v.string(),
    auth: v.string(),
    locale: v.optional(v.union(v.literal("fr"), v.literal("ar"))),
  },
  returns: v.id("pushSubscriptions"),
  handler: async (ctx, args) => {
    await requirePermission(ctx, "alerts.view");
    const { userId } = await requireAuthenticatedUser(ctx);
    const now = Date.now();

    const existingByEndpoint = await ctx.db
      .query("pushSubscriptions")
      .withIndex("by_endpoint", (q) => q.eq("endpoint", args.endpoint))
      .first();

    if (existingByEndpoint) {
      if (existingByEndpoint.userId !== userId) {
        await ctx.db.delete(existingByEndpoint._id);
      } else {
        await ctx.db.patch(existingByEndpoint._id, {
          expirationTime: args.expirationTime,
          p256dh: args.p256dh,
          auth: args.auth,
          locale: args.locale,
          updatedAt: now,
        });
        await ctx.scheduler.runAfter(0, internal.pushNotifications.sendTestPush, {
          endpoint: args.endpoint,
          p256dh: args.p256dh,
          auth: args.auth,
          locale: args.locale,
        });
        return existingByEndpoint._id;
      }
    }

    const existingForUser = await ctx.db
      .query("pushSubscriptions")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .first();
    const subscriptionId = existingForUser
      ? (await ctx.db.patch(existingForUser._id, {
          endpoint: args.endpoint,
          expirationTime: args.expirationTime,
          p256dh: args.p256dh,
          auth: args.auth,
          locale: args.locale,
          updatedAt: now,
        }),
        existingForUser._id)
      : await ctx.db.insert("pushSubscriptions", {
          userId,
          endpoint: args.endpoint,
          expirationTime: args.expirationTime,
          p256dh: args.p256dh,
          auth: args.auth,
          locale: args.locale,
          createdAt: now,
          updatedAt: now,
        });

    await ctx.scheduler.runAfter(0, internal.pushNotifications.sendTestPush, {
      endpoint: args.endpoint,
      p256dh: args.p256dh,
      auth: args.auth,
      locale: args.locale,
    });

    return subscriptionId;
  },
});

export const removeMine = mutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    const { userId } = await requireAuthenticatedUser(ctx);
    const rows = await ctx.db
      .query("pushSubscriptions")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .collect();
    await Promise.all(rows.map((row) => ctx.db.delete(row._id)));
    return null;
  },
});

export const patchLastAlertCount = internalMutation({
  args: {
    subscriptionId: v.id("pushSubscriptions"),
    lastAlertCount: v.number(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.db.patch(args.subscriptionId, {
      lastAlertCount: args.lastAlertCount,
      updatedAt: Date.now(),
    });
    return null;
  },
});

export const deleteById = internalMutation({
  args: { subscriptionId: v.id("pushSubscriptions") },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.db.delete(args.subscriptionId);
    return null;
  },
});
