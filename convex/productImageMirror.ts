import { v } from "convex/values";

import {
  internalMutation,
  internalQuery,
} from "./_generated/server";

const OPEN_FOOD_FACTS_HOST = "images.openfoodfacts.org";

export const listForMirror = internalQuery({
  args: { limit: v.number() },
  returns: v.array(
    v.object({
      productId: v.id("products"),
      imageUrl: v.string(),
      name: v.string(),
    }),
  ),
  handler: async (ctx, args) => {
    const limit = Math.min(Math.max(1, Math.floor(args.limit)), 50);
    const products = await ctx.db
      .query("products")
      .withIndex("by_active", (q) => q.eq("active", true))
      .collect();

    const pending = products.filter(
      (product) =>
        product.imageUrl.includes(OPEN_FOOD_FACTS_HOST) &&
        !product.imageStorageId,
    );

    return pending.slice(0, limit).map((product) => ({
      productId: product._id,
      imageUrl: product.imageUrl,
      name: product.name,
    }));
  },
});

export const countPendingMirror = internalQuery({
  args: {},
  returns: v.object({
    pending: v.number(),
    totalActive: v.number(),
  }),
  handler: async (ctx) => {
    const products = await ctx.db
      .query("products")
      .withIndex("by_active", (q) => q.eq("active", true))
      .collect();
    const pending = products.filter(
      (product) =>
        product.imageUrl.includes(OPEN_FOOD_FACTS_HOST) &&
        !product.imageStorageId,
    ).length;
    return { pending, totalActive: products.length };
  },
});

export const patchProductImage = internalMutation({
  args: {
    productId: v.id("products"),
    imageUrl: v.string(),
    imageStorageId: v.id("_storage"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.db.patch(args.productId, {
      imageUrl: args.imageUrl,
      imageStorageId: args.imageStorageId,
      updatedAt: Date.now(),
    });
    return null;
  },
});
