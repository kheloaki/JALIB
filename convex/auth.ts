import { convexAuth } from "@convex-dev/auth/server";
import { Password } from "@convex-dev/auth/providers/Password";

import { passwordResetEmail } from "./authPasswordResetEmail";
import { assertPasswordRequirements } from "./passwordPolicy";

export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  providers: [
    Password({
      profile(params) {
        if (String(params.flow ?? "") === "signUp") {
          throw new Error("Self sign-up is disabled.");
        }
        const email = String(params.email ?? "").trim().toLowerCase();
        if (!email || !email.includes("@")) {
          throw new Error("A valid email is required.");
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
});
