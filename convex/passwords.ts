import { v } from "convex/values";
import {
  createAccount,
  getAuthUserId,
  modifyAccountCredentials,
  retrieveAccount,
} from "@convex-dev/auth/server";

import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import {
  action,
  internalMutation,
  internalQuery,
} from "./_generated/server";
import { requireAnyPermission, requirePermission } from "./authz";
import { assertPasswordRequirements } from "./passwordPolicy";

export const getPasswordAccountEmail = internalQuery({
  args: { userId: v.id("users") },
  returns: v.union(v.string(), v.null()),
  handler: async (ctx, args) => {
    const account = await ctx.db
      .query("authAccounts")
      .withIndex("userIdAndProvider", (q) =>
        q.eq("userId", args.userId).eq("provider", "password"),
      )
      .unique();
    return account?.providerAccountId ?? null;
  },
});

export const assertAdminForPasswordReset = internalMutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    await requirePermission(ctx, "admin.manage_roles");
    return null;
  },
});

export const changeOwnPassword = action({
  args: {
    currentPassword: v.string(),
    newPassword: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated.");
    }

    assertPasswordRequirements(args.newPassword);

    const email = await ctx.runQuery(internal.passwords.getPasswordAccountEmail, {
      userId,
    });
    if (!email) {
      throw new Error("No password login found for this account.");
    }

    const retrieved = await retrieveAccount(ctx, {
      provider: "password",
      account: { id: email, secret: args.currentPassword },
    });
    if (retrieved === null) {
      throw new Error("Current password is incorrect.");
    }
    if (retrieved.user._id !== userId) {
      throw new Error("Invalid account.");
    }

    await modifyAccountCredentials(ctx, {
      provider: "password",
      account: { id: email, secret: args.newPassword },
    });
    return null;
  },
});

export const adminResetUserPassword = action({
  args: {
    userId: v.id("users"),
    newPassword: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.runMutation(internal.passwords.assertAdminForPasswordReset, {});

    assertPasswordRequirements(args.newPassword);

    const email = await ctx.runQuery(internal.passwords.getPasswordAccountEmail, {
      userId: args.userId,
    });
    if (!email) {
      throw new Error("This user has no password login.");
    }

    await modifyAccountCredentials(ctx, {
      provider: "password",
      account: { id: email, secret: args.newPassword },
    });
    return null;
  },
});

export const assertCanCreateUsers = internalMutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    await requireAnyPermission(ctx, [
      "admin.create_users",
      "admin.manage_roles",
    ]);
    return null;
  },
});

export const assignRoleToNewUser = internalMutation({
  args: {
    userId: v.id("users"),
    roleId: v.id("roles"),
    name: v.string(),
    email: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireAnyPermission(ctx, [
      "admin.create_users",
      "admin.manage_roles",
    ]);
    const role = await ctx.db.get(args.roleId);
    if (!role) throw new Error("Role not found.");
    const user = await ctx.db.get(args.userId);
    if (!user) throw new Error("User not found.");
    await ctx.db.patch(args.userId, {
      name: args.name,
      email: args.email,
      roleId: args.roleId,
      updatedAt: Date.now(),
    });
    return null;
  },
});

export const adminCreateUser = action({
  args: {
    name: v.string(),
    email: v.string(),
    password: v.string(),
    roleId: v.id("roles"),
  },
  returns: v.object({ userId: v.id("users") }),
  handler: async (ctx, args) => {
    await ctx.runMutation(internal.passwords.assertCanCreateUsers, {});

    const name = args.name.trim();
    const email = args.email.trim().toLowerCase();
    if (!name) throw new Error("Name is required.");
    if (!email || !email.includes("@")) {
      throw new Error("A valid email is required.");
    }
    assertPasswordRequirements(args.password);

    const existing = await ctx.runQuery(
      internal.passwords.findUserIdByEmail,
      { email },
    );
    if (existing) {
      throw new Error("An account with this email already exists.");
    }

    let created: { user: { _id: Id<"users"> } };
    try {
      created = await createAccount(ctx, {
        provider: "password",
        account: { id: email, secret: args.password },
        profile: {
          email,
          name,
        },
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message.toLowerCase() : "";
      if (
        message.includes("already") ||
        message.includes("exist") ||
        message.includes("account")
      ) {
        throw new Error("An account with this email already exists.");
      }
      throw error;
    }

    await ctx.runMutation(internal.passwords.assignRoleToNewUser, {
      userId: created.user._id,
      roleId: args.roleId,
      name,
      email,
    });

    return { userId: created.user._id };
  },
});

export const findUserIdByEmail = internalQuery({
  args: { email: v.string() },
  returns: v.union(v.id("users"), v.null()),
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("email", (q) => q.eq("email", args.email))
      .unique();
    return user?._id ?? null;
  },
});

/** Mark email verified so createAccount can link to an existing restored user. */
export const markEmailVerifiedForLinking = internalMutation({
  args: { email: v.string() },
  returns: v.union(
    v.object({
      userId: v.id("users"),
      name: v.union(v.string(), v.null()),
    }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    const email = args.email.trim().toLowerCase();
    const user = await ctx.db
      .query("users")
      .withIndex("email", (q) => q.eq("email", email))
      .unique();
    if (!user) return null;
    await ctx.db.patch(user._id, {
      email,
      emailVerificationTime: user.emailVerificationTime ?? Date.now(),
      updatedAt: Date.now(),
    });
    return { userId: user._id, name: user.name ?? null };
  },
});
