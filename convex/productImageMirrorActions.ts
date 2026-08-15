import { v } from "convex/values";

import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { internalAction } from "./_generated/server";

type MirrorProduct = {
  productId: Id<"products">;
  imageUrl: string;
  name: string;
};

type MirrorBatchResult = {
  attempted: number;
  mirrored: number;
  failed: number;
  pending: number;
  errors: string[];
};

export const mirrorProductImagesBatch = internalAction({
  args: { limit: v.optional(v.number()) },
  returns: v.object({
    attempted: v.number(),
    mirrored: v.number(),
    failed: v.number(),
    pending: v.number(),
    errors: v.array(v.string()),
  }),
  handler: async (ctx, args) => {
    const limit = Math.min(Math.max(1, Math.floor(args.limit ?? 20)), 50);
    const batch: MirrorProduct[] = await ctx.runQuery(
      internal.productImageMirror.listForMirror,
      { limit },
    );

    let mirrored = 0;
    let failed = 0;
    const errors: string[] = [];

    for (const product of batch) {
      try {
        const response = await fetch(product.imageUrl, {
          headers: {
            "User-Agent": "MatjarProductImporter/1.0",
            Accept: "image/*",
          },
        });
        if (!response.ok) {
          failed += 1;
          if (errors.length < 5) {
            errors.push(
              `${product.name}: HTTP ${response.status} for ${product.imageUrl}`,
            );
          }
          continue;
        }

        const contentType = response.headers.get("content-type") ?? "image/jpeg";
        if (!contentType.startsWith("image/")) {
          failed += 1;
          if (errors.length < 5) {
            errors.push(`${product.name}: not an image (${contentType})`);
          }
          continue;
        }

        const bytes = await response.arrayBuffer();
        if (bytes.byteLength < 64) {
          failed += 1;
          if (errors.length < 5) {
            errors.push(`${product.name}: empty image`);
          }
          continue;
        }

        const storageId = await ctx.storage.store(
          new Blob([bytes], { type: contentType }),
        );
        const imageUrl = await ctx.storage.getUrl(storageId);
        if (!imageUrl) {
          failed += 1;
          if (errors.length < 5) {
            errors.push(`${product.name}: storage URL missing`);
          }
          continue;
        }

        await ctx.runMutation(internal.productImageMirror.patchProductImage, {
          productId: product.productId,
          imageUrl,
          imageStorageId: storageId,
        });
        mirrored += 1;
      } catch (error) {
        failed += 1;
        if (errors.length < 5) {
          const message =
            error instanceof Error ? error.message : "Unknown mirror error";
          errors.push(`${product.name}: ${message}`);
        }
      }
    }

    const { pending }: { pending: number; totalActive: number } =
      await ctx.runQuery(internal.productImageMirror.countPendingMirror, {});

    const result: MirrorBatchResult = {
      attempted: batch.length,
      mirrored,
      failed,
      pending,
      errors,
    };
    return result;
  },
});
