import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";

import { internalQuery, mutation } from "./_generated/server";
import { requireAnyPermission } from "./authz";

const SHARE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const EXPORT_PERMISSIONS = ["reports.export", "sales.view"] as const;

function normalizeOrigin(origin: string): string {
  return origin.trim().replace(/\/$/, "");
}

export const generateUploadUrl = mutation({
  args: {},
  returns: v.string(),
  handler: async (ctx) => {
    await requireAnyPermission(ctx, [...EXPORT_PERMISSIONS]);
    return await ctx.storage.generateUploadUrl();
  },
});

export const createShareLink = mutation({
  args: {
    storageId: v.id("_storage"),
    filename: v.string(),
    /** App origin so WhatsApp links use the store domain, not Convex. */
    publicOrigin: v.optional(v.string()),
  },
  returns: v.object({
    url: v.string(),
    token: v.string(),
  }),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated.");
    await requireAnyPermission(ctx, [...EXPORT_PERMISSIONS]);

    const filename = args.filename.trim() || "document.pdf";
    const token = crypto.randomUUID().replace(/-/g, "");
    const now = Date.now();

    await ctx.db.insert("pdfShareLinks", {
      token,
      storageId: args.storageId,
      filename,
      expiresAt: now + SHARE_TTL_MS,
      createdBy: userId,
      createdAt: now,
    });

    const fromClient = args.publicOrigin
      ? normalizeOrigin(args.publicOrigin)
      : "";
    const fromEnv = process.env.APP_ORIGIN
      ? normalizeOrigin(process.env.APP_ORIGIN)
      : "";
    const base = fromClient || fromEnv;
    if (!base) {
      throw new Error(
        "App origin missing. Pass publicOrigin or set APP_ORIGIN.",
      );
    }

    const url = `${base}/share/pdf?token=${token}`;
    return { url, token };
  },
});

export const getLinkByToken = internalQuery({
  args: { token: v.string() },
  returns: v.union(
    v.object({
      storageId: v.id("_storage"),
      filename: v.string(),
      expiresAt: v.number(),
    }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    const link = await ctx.db
      .query("pdfShareLinks")
      .withIndex("by_token", (q) => q.eq("token", args.token))
      .unique();
    if (!link || link.expiresAt < Date.now()) return null;
    return {
      storageId: link.storageId,
      filename: link.filename,
      expiresAt: link.expiresAt,
    };
  },
});
