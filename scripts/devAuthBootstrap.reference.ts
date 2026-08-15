import { v } from "convex/values";
import {
  createAccount,
  modifyAccountCredentials,
} from "@convex-dev/auth/server";

import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { internalAction } from "./_generated/server";
import { assertPasswordRequirements } from "./passwordPolicy";

/**
 * Create or reset a password login for an existing users row (e.g. after backup restore).
 * Run: `npx convex run devAuthBootstrap:bootstrapPasswordForEmail '{"email":"…","password":"…"}'`
 */
export const bootstrapPasswordForEmail = internalAction({
  args: {
    email: v.string(),
    password: v.string(),
  },
  returns: v.object({
    userId: v.id("users"),
    created: v.boolean(),
  }),
  handler: async (
    ctx,
    args,
  ): Promise<{ userId: Id<"users">; created: boolean }> => {
    const email = args.email.trim().toLowerCase();
    assertPasswordRequirements(args.password);

    const linked = await ctx.runMutation(
      internal.passwords.markEmailVerifiedForLinking,
      { email },
    );
    if (!linked) {
      throw new Error(`User not found for email: ${email}`);
    }

    const existingEmail = await ctx.runQuery(
      internal.passwords.getPasswordAccountEmail,
      { userId: linked.userId },
    );
    if (existingEmail) {
      await modifyAccountCredentials(ctx, {
        provider: "password",
        account: { id: existingEmail, secret: args.password },
      });
      return { userId: linked.userId, created: false };
    }

    const created = await createAccount(ctx, {
      provider: "password",
      account: { id: email, secret: args.password },
      profile: {
        email,
        name: linked.name ?? email.split("@")[0]!,
      },
      shouldLinkViaEmail: true,
    });

    if (created.user._id !== linked.userId) {
      throw new Error(
        `Password account linked to unexpected user (expected ${linked.userId}, got ${created.user._id}).`,
      );
    }

    return { userId: linked.userId, created: true };
  },
});
