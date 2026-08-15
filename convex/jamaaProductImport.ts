import { v } from "convex/values";

import { internalMutation } from "./_generated/server";
import type { MutationCtx } from "./_generated/server";
import { madToCents } from "./money";

const PRODUCT_PLACEHOLDER_IMAGE = "/product-placeholder.svg";
const DEFAULT_CATEGORY = "Alimentation";

const productRow = v.object({
  legacyArticleId: v.string(),
  name: v.string(),
  barcode: v.string(),
  sellPriceMad: v.number(),
  costPriceMad: v.number(),
  stockQty: v.number(),
});

async function ensureCategory(ctx: MutationCtx, label: string) {
  const normalizedLabel = label.trim().replace(/\s+/g, " ");
  const existing = await ctx.db
    .query("productCategories")
    .withIndex("by_normalizedLabel", (q) =>
      q.eq("normalizedLabel", normalizedLabel.toLowerCase()),
    )
    .unique();
  if (existing) return;
  await ctx.db.insert("productCategories", {
    label: normalizedLabel,
    normalizedLabel: normalizedLabel.toLowerCase(),
    kind: "custom",
    createdAt: Date.now(),
  });
}

function normalizeBarcode(raw: string): string | undefined {
  const normalized = raw.trim().replace(/\s+/g, "").toUpperCase();
  return normalized.length > 0 ? normalized : undefined;
}

/**
 * Deletes catalog products + price history in batches (CLI / internal).
 * Safe after operational wipe (no invoice lines referencing products).
 */
export const clearCatalogBatch = internalMutation({
  args: {
    limit: v.optional(v.number()),
  },
  returns: v.object({
    productsDeleted: v.number(),
    priceHistoryDeleted: v.number(),
    done: v.boolean(),
  }),
  handler: async (ctx, args) => {
    const limit = Math.min(Math.max(1, Math.floor(args.limit ?? 100)), 200);
    const products = await ctx.db.query("products").take(limit);
    let productsDeleted = 0;
    let priceHistoryDeleted = 0;

    for (const product of products) {
      const history = await ctx.db
        .query("productPriceHistory")
        .withIndex("by_productId_recordedAt", (q) =>
          q.eq("productId", product._id),
        )
        .take(50);
      for (const entry of history) {
        await ctx.db.delete(entry._id);
        priceHistoryDeleted += 1;
      }
      await ctx.db.delete(product._id);
      productsDeleted += 1;
    }

    return {
      productsDeleted,
      priceHistoryDeleted,
      done: products.length < limit,
    };
  },
});

/**
 * Upserts a batch of Jamaa legacy products by legacyId `jamaa:{articleId}`.
 * Also matches existing rows by barcode when present.
 */
export const importBatch = internalMutation({
  args: {
    products: v.array(productRow),
    categoryLabel: v.optional(v.string()),
  },
  returns: v.object({
    processed: v.number(),
    inserted: v.number(),
    updated: v.number(),
    skipped: v.number(),
  }),
  handler: async (ctx, args) => {
    const categoryLabel = (args.categoryLabel ?? DEFAULT_CATEGORY).trim();
    await ensureCategory(ctx, categoryLabel);
    const now = Date.now();

    let inserted = 0;
    let updated = 0;
    let skipped = 0;

    for (const row of args.products) {
      const name = row.name.trim().replace(/\s+/g, " ");
      const barcode = normalizeBarcode(row.barcode);
      const legacyId = `jamaa:${row.legacyArticleId.trim()}`;
      if (!name || !barcode || !row.legacyArticleId.trim()) {
        skipped += 1;
        continue;
      }

      const sellPriceMadCents = Math.max(0, madToCents(row.sellPriceMad));
      const costMadCents =
        row.costPriceMad > 0 ? madToCents(row.costPriceMad) : null;
      const stockQty = Number.isFinite(row.stockQty)
        ? Math.max(0, row.stockQty)
        : 0;
      const stockLow = stockQty > 0 && stockQty <= 10;

      const byLegacy = await ctx.db
        .query("products")
        .withIndex("by_legacyId", (q) => q.eq("legacyId", legacyId))
        .unique();

      let existing = byLegacy;
      if (!existing) {
        existing = await ctx.db
          .query("products")
          .withIndex("by_barcode", (q) => q.eq("barcode", barcode))
          .first();
      }

      if (existing) {
        await ctx.db.patch(existing._id, {
          legacyId,
          name,
          categoryLabel,
          barcode,
          sellPriceMadCents,
          costMadCents,
          stockQty,
          stockLow,
          active: true,
          updatedAt: now,
        });
        updated += 1;
        continue;
      }

      const productId = await ctx.db.insert("products", {
        legacyId,
        name,
        categoryLabel,
        barcode,
        sellPriceMadCents,
        costMadCents,
        stockQty,
        stockLow,
        imageUrl: PRODUCT_PLACEHOLDER_IMAGE,
        imageAlt: name,
        active: true,
        createdAt: now,
        updatedAt: now,
      });

      if (costMadCents !== null) {
        await ctx.db.insert("productPriceHistory", {
          productId,
          kind: "purchase",
          amountMadCents: costMadCents,
          recordedAt: now,
          source: "migration",
        });
      }
      await ctx.db.insert("productPriceHistory", {
        productId,
        kind: "sell",
        amountMadCents: sellPriceMadCents,
        recordedAt: now,
        source: "migration",
      });

      inserted += 1;
    }

    return {
      processed: args.products.length,
      inserted,
      updated,
      skipped,
    };
  },
});
