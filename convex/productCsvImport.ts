import { v } from "convex/values";

import { internalMutation, mutation } from "./_generated/server";
import type { MutationCtx } from "./_generated/server";
import { requirePermission } from "./authz";
import { DEFAULT_PRODUCTS } from "./defaultCatalog";
import { MATJAR_CSV_PRODUCTS, MATJAR_CSV_PRODUCT_COUNT } from "./matjarCsvCatalog";

const FALLBACK_IMAGE_URL = DEFAULT_PRODUCTS[0]!.imageUrl;
const DEFAULT_CATEGORY = "Alimentation";
const PLACEHOLDER_PRICE_CENTS = 100;

function normalizeBarcode(raw: string): string | undefined {
  const normalized = raw.trim().replace(/\s+/g, "").toUpperCase();
  return normalized.length > 0 ? normalized : undefined;
}

function resolveImageUrl(imageUrl: string | undefined): string {
  const trimmed = imageUrl?.trim() ?? "";
  return trimmed.startsWith("http") ? trimmed : FALLBACK_IMAGE_URL;
}

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

export const importMatjarCsvBatch = internalMutation({
  args: {
    offset: v.number(),
    limit: v.optional(v.number()),
  },
  returns: v.object({
    offset: v.number(),
    processed: v.number(),
    inserted: v.number(),
    skippedExisting: v.number(),
    total: v.number(),
    done: v.boolean(),
    nextOffset: v.union(v.number(), v.null()),
  }),
  handler: async (ctx, args) => {
    const offset = Math.max(0, Math.floor(args.offset));
    const limit = Math.min(Math.max(1, Math.floor(args.limit ?? 100)), 200);
    const slice = MATJAR_CSV_PRODUCTS.slice(offset, offset + limit);
    const now = Date.now();

    await ensureCategory(ctx, DEFAULT_CATEGORY);

    let inserted = 0;
    let skippedExisting = 0;

    for (const row of slice) {
      const barcode = normalizeBarcode(row.barcode);
      if (!barcode) continue;

      const existing = await ctx.db
        .query("products")
        .withIndex("by_barcode", (q) => q.eq("barcode", barcode))
        .first();
      if (existing) {
        skippedExisting += 1;
        continue;
      }

      const imageUrl = resolveImageUrl(row.imageUrl);

      await ctx.db.insert("products", {
        legacyId: `matjar-csv:${barcode}`,
        name: row.name,
        categoryLabel: DEFAULT_CATEGORY,
        barcode,
        sellPriceMadCents: PLACEHOLDER_PRICE_CENTS,
        costMadCents: null,
        stockQty: 0,
        stockLow: false,
        imageUrl,
        imageAlt: row.name,
        active: true,
        createdAt: now,
        updatedAt: now,
      });
      inserted += 1;
    }

    const nextOffset = offset + slice.length;
    const done = nextOffset >= MATJAR_CSV_PRODUCT_COUNT;

    return {
      offset,
      processed: slice.length,
      inserted,
      skippedExisting,
      total: MATJAR_CSV_PRODUCT_COUNT,
      done,
      nextOffset: done ? null : nextOffset,
    };
  },
});

/** Patch imageUrl on products already imported from the CSV catalog. */
export const syncMatjarCsvImagesBatch = internalMutation({
  args: {
    offset: v.number(),
    limit: v.optional(v.number()),
  },
  returns: v.object({
    offset: v.number(),
    processed: v.number(),
    updated: v.number(),
    missing: v.number(),
    unchanged: v.number(),
    total: v.number(),
    done: v.boolean(),
    nextOffset: v.union(v.number(), v.null()),
  }),
  handler: async (ctx, args) => {
    const offset = Math.max(0, Math.floor(args.offset));
    const limit = Math.min(Math.max(1, Math.floor(args.limit ?? 100)), 200);
    const slice = MATJAR_CSV_PRODUCTS.slice(offset, offset + limit);
    const now = Date.now();

    let updated = 0;
    let missing = 0;
    let unchanged = 0;

    for (const row of slice) {
      const barcode = normalizeBarcode(row.barcode);
      if (!barcode) continue;

      const imageUrl = resolveImageUrl(row.imageUrl);
      const product = await ctx.db
        .query("products")
        .withIndex("by_barcode", (q) => q.eq("barcode", barcode))
        .first();

      if (!product) {
        missing += 1;
        continue;
      }

      if (product.imageUrl === imageUrl) {
        unchanged += 1;
        continue;
      }

      await ctx.db.patch(product._id, {
        imageUrl,
        imageAlt: row.name,
        updatedAt: now,
      });
      updated += 1;
    }

    const nextOffset = offset + slice.length;
    const done = nextOffset >= MATJAR_CSV_PRODUCT_COUNT;

    return {
      offset,
      processed: slice.length,
      updated,
      missing,
      unchanged,
      total: MATJAR_CSV_PRODUCT_COUNT,
      done,
      nextOffset: done ? null : nextOffset,
    };
  },
});

export const matjarCsvImportStatus = mutation({
  args: {},
  returns: v.object({
    catalogCount: v.number(),
    fallbackImageUrl: v.string(),
    defaultCategory: v.string(),
    placeholderPriceMad: v.number(),
  }),
  handler: async (ctx) => {
    await requirePermission(ctx, "stock.edit_products");
    return {
      catalogCount: MATJAR_CSV_PRODUCT_COUNT,
      fallbackImageUrl: FALLBACK_IMAGE_URL,
      defaultCategory: DEFAULT_CATEGORY,
      placeholderPriceMad: PLACEHOLDER_PRICE_CENTS / 100,
    };
  },
});
