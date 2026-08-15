import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";

import { mutation } from "./_generated/server";

const MAX_AVATAR_DATA_URL_CHARS = 500_000;

function normalizeAvatarImage(image: string | null | undefined): string | undefined {
  if (image === null || image === undefined) return undefined;
  const trimmed = image.trim();
  if (trimmed.length === 0) return undefined;
  if (trimmed.startsWith("data:image/")) {
    if (trimmed.length > MAX_AVATAR_DATA_URL_CHARS) {
      throw new Error("Image too large. Try a smaller photo.");
    }
    return trimmed;
  }
  if (
    trimmed.startsWith("http://") ||
    trimmed.startsWith("https://") ||
    trimmed.startsWith("/")
  ) {
    return trimmed;
  }
  throw new Error("Invalid image format.");
}

export const updateOwnAvatar = mutation({
  args: {
    image: v.union(v.string(), v.null()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated.");

    await ctx.db.patch(userId, {
      image: normalizeAvatarImage(args.image),
      updatedAt: Date.now(),
    });
    return null;
  },
});
