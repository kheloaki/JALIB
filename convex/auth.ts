import { convexAuth } from "@convex-dev/auth/server";
import { Password } from "@convex-dev/auth/providers/Password";

import { passwordResetEmail } from "./authPasswordResetEmail";
import { ensureDefaultRbac } from "./authz";
import { assertPasswordRequirements } from "./passwordPolicy";
import type { MutationCtx } from "./_generated/server";
import { isFirstAdminEmail } from "../lib/auth/first-admin";

export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  providers: [
    Password({
      profile(params) {
        const email = String(params.email ?? "").trim().toLowerCase();
        if (!email || !email.includes("@")) {
          throw new Error("A valid email is required.");
        }
        if (String(params.flow ?? "") === "signUp" && !isFirstAdminEmail(email)) {
          throw new Error("Self sign-up is disabled.");
        }
        const rawName = String(params.name ?? "").trim();
        const fallbackName = email
          .split("@")[0]!
          .split(/[._-]+/)
          .filter(Boolean)
          .map((part) => part[0]!.toUpperCase() + part.slice(1))
          .join(" ");
        return {
          email,
          name: rawName || fallbackName || email,
        };
      },
      validatePasswordRequirements: assertPasswordRequirements,
      reset: passwordResetEmail,
    }),
  ],
  callbacks: {
    async afterUserCreatedOrUpdated(ctx, args) {
      if (args.existingUserId !== null) return;
      const email = String(args.profile.email ?? "").trim().toLowerCase();
      if (!isFirstAdminEmail(email)) return;

      const existing = await ctx.db.query("users").take(2);
      if (existing.length > 1) {
        throw new Error("Self sign-up is disabled.");
      }

      const { adminRoleId } = await ensureDefaultRbac(ctx as MutationCtx);
      await ctx.db.patch(args.userId, {
        email,
        roleId: adminRoleId,
        updatedAt: Date.now(),
      });
    },
  },
});
