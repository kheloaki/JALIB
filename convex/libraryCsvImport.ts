import { v } from "convex/values";

import { DEFAULT_CATALOG_CATEGORY } from "../lib/catalog/categories";
import { internalMutation } from "./_generated/server";
import type { MutationCtx } from "./_generated/server";
import { madToCents } from "./money";

const PRODUCT_PLACEHOLDER_IMAGE = "/product-placeholder.svg";

const productRow = v.object({
  legacyId: v.string(),
  name: v.string(),
  categoryLabel: v.string(),
  sellPriceMad: v.number(),
  costPriceMad: v.number(),
  soldByWeight: v.boolean(),
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

export const importBatch = internalMutation({
  args: {
    products: v.array(productRow),
  },
  returns: v.object({
    processed: v.number(),
    inserted: v.number(),
    updated: v.number(),
    skipped: v.number(),
  }),
  handler: async (ctx, args) => {
    const now = Date.now();
    const ensured = new Set<string>();
    let inserted = 0;
    let updated = 0;
    let skipped = 0;

    for (const row of args.products) {
      const name = row.name.trim().replace(/\s+/g, " ");
      const legacyId = row.legacyId.trim();
      const categoryLabel = (
        row.categoryLabel.trim() || DEFAULT_CATALOG_CATEGORY
      ).replace(/\s+/g, " ");
      if (!name || !legacyId) {
        skipped += 1;
        continue;
      }

      if (!ensured.has(categoryLabel.toLowerCase())) {
        await ensureCategory(ctx, categoryLabel);
        ensured.add(categoryLabel.toLowerCase());
      }

      const sellPriceMadCents = Math.max(0, madToCents(row.sellPriceMad));
      const costMadCents =
        row.costPriceMad > 0 ? madToCents(row.costPriceMad) : null;

      const existing = await ctx.db
        .query("products")
        .withIndex("by_legacyId", (q) => q.eq("legacyId", legacyId))
        .unique();

      if (existing) {
        await ctx.db.patch(existing._id, {
          name,
          categoryLabel,
          sellPriceMadCents,
          costMadCents,
          ...(row.soldByWeight ? { soldByWeight: true } : {}),
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
        sellPriceMadCents,
        costMadCents,
        stockQty: 0,
        stockLow: false,
        imageUrl: PRODUCT_PLACEHOLDER_IMAGE,
        imageAlt: name,
        active: true,
        ...(row.soldByWeight ? { soldByWeight: true } : {}),
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

/**
 * Sets barcodes on existing catalog rows. Never writes stock quantities.
 */
export const applyBarcodesBatch = internalMutation({
  args: {
    items: v.array(
      v.object({
        legacyId: v.string(),
        barcode: v.string(),
      }),
    ),
  },
  returns: v.object({
    processed: v.number(),
    updated: v.number(),
    unchanged: v.number(),
    missing: v.number(),
    conflicts: v.number(),
    skipped: v.number(),
  }),
  handler: async (ctx, args) => {
    const now = Date.now();
    let updated = 0;
    let unchanged = 0;
    let missing = 0;
    let conflicts = 0;
    let skipped = 0;

    for (const row of args.items) {
      const legacyId = row.legacyId.trim();
      const barcode = normalizeBarcode(row.barcode);
      if (!legacyId || !barcode) {
        skipped += 1;
        continue;
      }

      const product = await ctx.db
        .query("products")
        .withIndex("by_legacyId", (q) => q.eq("legacyId", legacyId))
        .unique();
      if (!product) {
        missing += 1;
        continue;
      }
      if (product.barcode === barcode) {
        unchanged += 1;
        continue;
      }

      const taken = await ctx.db
        .query("products")
        .withIndex("by_barcode", (q) => q.eq("barcode", barcode))
        .first();
      if (taken && taken._id !== product._id) {
        conflicts += 1;
        continue;
      }

      await ctx.db.patch(product._id, {
        barcode,
        updatedAt: now,
      });
      updated += 1;
    }

    return {
      processed: args.items.length,
      updated,
      unchanged,
      missing,
      conflicts,
      skipped,
    };
  },
});

