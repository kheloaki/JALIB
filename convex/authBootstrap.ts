import { v } from "convex/values";

import { FIRST_ADMIN_EMAIL } from "../lib/auth/first-admin";
import { internalMutation, query } from "./_generated/server";

/** True when no user exists yet — login page can offer first-admin signup. */
export const needsFirstAdmin = query({
  args: {},
  returns: v.boolean(),
  handler: async (ctx) => {
    const existing = await ctx.db.query("users").take(1);
    return existing.length === 0;
  },
});

/**
 * Wipe the first-admin auth records so the login page can create the
 * password again. Dev bootstrap only.
 */
export const resetFirstAdminSignup = internalMutation({
  args: {},
  returns: v.object({
    usersDeleted: v.number(),
    accountsDeleted: v.number(),
    sessionsDeleted: v.number(),
  }),
  handler: async (ctx) => {
    const siteUrl = process.env.SITE_URL ?? "";
    const isLocal =
      siteUrl.includes("localhost") || siteUrl.includes("127.0.0.1");
    if (!isLocal) {
      throw new Error("resetFirstAdminSignup is disabled outside development.");
    }
    const users = await ctx.db.query("users").take(50);
    const targets = users.filter(
      (user) =>
        !user.email ||
        user.email.trim().toLowerCase() === FIRST_ADMIN_EMAIL,
    );

    let accountsDeleted = 0;
    let sessionsDeleted = 0;

    for (const user of targets) {
      const accounts = await ctx.db
        .query("authAccounts")
        .withIndex("userIdAndProvider", (q) => q.eq("userId", user._id))
        .take(20);
      for (const account of accounts) {
        const codes = await ctx.db
          .query("authVerificationCodes")
          .withIndex("accountId", (q) => q.eq("accountId", account._id))
          .take(50);
        for (const code of codes) {
          await ctx.db.delete(code._id);
        }
        await ctx.db.delete(account._id);
        accountsDeleted += 1;
      }

      const sessions = await ctx.db
        .query("authSessions")
        .withIndex("userId", (q) => q.eq("userId", user._id))
        .take(50);
      for (const session of sessions) {
        const tokens = await ctx.db
          .query("authRefreshTokens")
          .withIndex("sessionId", (q) => q.eq("sessionId", session._id))
          .take(50);
        for (const token of tokens) {
          await ctx.db.delete(token._id);
        }
        await ctx.db.delete(session._id);
        sessionsDeleted += 1;
      }

      const devices = await ctx.db
        .query("trustedDevices")
        .withIndex("by_userId", (q) => q.eq("userId", user._id))
        .take(50);
      for (const device of devices) {
        await ctx.db.delete(device._id);
      }

      const pushes = await ctx.db
        .query("pushSubscriptions")
        .withIndex("by_userId", (q) => q.eq("userId", user._id))
        .take(50);
      for (const push of pushes) {
        await ctx.db.delete(push._id);
      }

      await ctx.db.delete(user._id);
    }

    return {
      usersDeleted: targets.length,
      accountsDeleted,
      sessionsDeleted,
    };
  },
});
