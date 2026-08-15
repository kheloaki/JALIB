import { paginationOptsValidator } from "convex/server";
import { v } from "convex/values";

import { mutation, query } from "./_generated/server";
import type { Doc } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { recordAuditForUser } from "./audit";
import { requireAnyPermission, requirePermission } from "./authz";
import { centsToMad, clampPositiveCents, madToCents } from "./money";

const PRODUCT_PLACEHOLDER_IMAGE = "/product-placeholder.svg";

function resolveProductImage(image?: string): string {
  const trimmed = image?.trim() ?? "";
  return trimmed.length > 0 ? trimmed : PRODUCT_PLACEHOLDER_IMAGE;
}

const productView = v.object({
  id: v.id("products"),
  category: v.string(),
  name: v.string(),
  price: v.number(),
  costMad: v.union(v.number(), v.null()),
  stockQty: v.number(),
  stockLabel: v.string(),
  stockLow: v.boolean(),
  image: v.string(),
  imageAlt: v.string(),
  barcode: v.union(v.string(), v.null()),
  soldByWeight: v.boolean(),
  active: v.boolean(),
  brandId: v.union(v.id("brands"), v.null()),
  brandName: v.union(v.string(), v.null()),
  brandLogo: v.union(v.string(), v.null()),
  createdAt: v.number(),
  updatedAt: v.number(),
});

/** Slim POS / IndexedDB row (includes cost for cart margin display). */
const posCatalogSummaryView = v.object({
  id: v.id("products"),
  category: v.string(),
  name: v.string(),
  price: v.number(),
  costMad: v.union(v.number(), v.null()),
  stockQty: v.number(),
  stockLabel: v.string(),
  stockLow: v.boolean(),
  image: v.string(),
  imageAlt: v.string(),
  barcode: v.union(v.string(), v.null()),
  soldByWeight: v.boolean(),
  brandId: v.union(v.id("brands"), v.null()),
  brandName: v.union(v.string(), v.null()),
  brandLogo: v.union(v.string(), v.null()),
  createdAt: v.number(),
  updatedAt: v.number(),
});

const historyEntryView = v.object({
  at: v.string(),
  costMad: v.number(),
});

function stockLabel(stockQty: number, soldByWeight = false): string {
  if (stockQty <= 0) return "STOCK: —";
  if (soldByWeight) {
    const trimmed = stockQty
      .toFixed(3)
      .replace(/(\.\d*?)0+$/, "$1")
      .replace(/\.$/, "");
    return `STOCK: ${trimmed} kg`;
  }
  return `STOCK: ${stockQty}`;
}

function normalizeCategoryLabel(raw: string): string {
  return raw.trim().replace(/\s+/g, " ");
}

function normalizeBarcode(raw: string | undefined): string | undefined {
  // Permissive normalization: keep alphanumeric / symbols (so QR codes with
  // arbitrary payloads round-trip), strip whitespace, uppercase for
  // case-insensitive matching. Pure numeric EAN/UPC codes stay unchanged.
  const normalized = raw?.trim().replace(/\s+/g, "").toUpperCase() ?? "";
  return normalized.length > 0 ? normalized : undefined;
}

function toProductView(
  product: Doc<"products">,
  brand?: Doc<"brands"> | null,
) {
  const activeBrand = brand && brand.active ? brand : null;
  return {
    id: product._id,
    category: product.categoryLabel,
    name: product.name,
    price: centsToMad(product.sellPriceMadCents),
    costMad:
      product.costMadCents === null ? null : centsToMad(product.costMadCents),
    stockQty: product.stockQty,
    stockLabel: stockLabel(product.stockQty, product.soldByWeight === true),
    stockLow: product.stockQty > 0 && product.stockQty <= 10,
    image: product.imageUrl,
    imageAlt: product.imageAlt,
    barcode: product.barcode ?? null,
    soldByWeight: product.soldByWeight === true,
    active: product.active,
    brandId: activeBrand?._id ?? null,
    brandName: activeBrand?.name ?? null,
    brandLogo: activeBrand?.logoUrl ?? null,
    createdAt: product.createdAt,
    updatedAt: product.updatedAt,
  };
}

function toPosCatalogSummary(
  product: Doc<"products">,
  brand?: Doc<"brands"> | null,
) {
  const view = toProductView(product, brand);
  return {
    id: view.id,
    category: view.category,
    name: view.name,
    price: view.price,
    costMad: view.costMad,
    stockQty: view.stockQty,
    stockLabel: view.stockLabel,
    stockLow: view.stockLow,
    image: view.image,
    imageAlt: view.imageAlt,
    barcode: view.barcode,
    soldByWeight: view.soldByWeight,
    brandId: view.brandId,
    brandName: view.brandName,
    brandLogo: view.brandLogo,
    createdAt: view.createdAt,
    updatedAt: view.updatedAt,
  };
}

async function loadBrandMap(
  ctx: QueryCtx | MutationCtx,
  products: Doc<"products">[],
) {
  const brandIds = [
    ...new Set(
      products
        .map((product) => product.brandId)
        .filter((id): id is NonNullable<typeof id> => id != null),
    ),
  ];
  const brandMap = new Map<string, Doc<"brands">>();
  for (const brandId of brandIds) {
    const brand = await ctx.db.get(brandId);
    if (brand) brandMap.set(brandId, brand);
  }
  return brandMap;
}

async function productViewById(
  ctx: QueryCtx | MutationCtx,
  productId: Doc<"products">["_id"],
) {
  const product = await ctx.db.get(productId);
  if (!product) throw new Error("Product not found.");
  const brand = product.brandId ? await ctx.db.get(product.brandId) : null;
  return toProductView(product, brand);
}

async function ensureCategory(
  ctx: MutationCtx,
  label: string,
  kind: "builtIn" | "custom",
) {
  const normalizedLabel = normalizeCategoryLabel(label);
  if (!normalizedLabel) throw new Error("Category label is required.");
  const existing = await ctx.db
    .query("productCategories")
    .withIndex("by_normalizedLabel", (q) =>
      q.eq("normalizedLabel", normalizedLabel.toLowerCase()),
    )
    .unique();
  if (existing) return existing._id;
  return await ctx.db.insert("productCategories", {
    label: normalizedLabel,
    normalizedLabel: normalizedLabel.toLowerCase(),
    kind,
    createdAt: Date.now(),
  });
}

export const listActive = query({
  args: {},
  returns: v.array(productView),
  handler: async (ctx) => {
    await requireAnyPermission(ctx, [
      "stock.view",
      "stock.edit_products",
      "sales.create",
      "sales.assist_cart",
    ]);
    // Convex return arrays max out at 8192; keep under that.
    // Prefer listSummaries / listPosCatalogPage for new UI.
    const products = await ctx.db
      .query("products")
      .withIndex("by_active", (q) => q.eq("active", true))
      .order("desc")
      .take(8000);
    const brandMap = await loadBrandMap(ctx, products);
    return products.map((product) =>
      toProductView(product, product.brandId ? brandMap.get(product.brandId) : null),
    );
  },
});

/** Active product count for badges (bounded scan — replace with aggregate in Phase 6). */
export const countActive = query({
  args: {
    categoryLabel: v.optional(v.string()),
    maxStockQty: v.optional(v.number()),
  },
  returns: v.number(),
  handler: async (ctx, args) => {
    await requireAnyPermission(ctx, [
      "stock.view",
      "stock.edit_products",
      "sales.create",
      "sales.assist_cart",
    ]);
    const category = args.categoryLabel?.trim() || undefined;
    const maxStock =
      args.maxStockQty != null && Number.isFinite(args.maxStockQty)
        ? Math.max(0, args.maxStockQty)
        : undefined;

    let products;
    if (category) {
      products = await ctx.db
        .query("products")
        .withIndex("by_active_and_categoryLabel", (q) =>
          q.eq("active", true).eq("categoryLabel", category),
        )
        .take(8000);
      if (maxStock !== undefined) {
        return products.filter((p) => p.stockQty <= maxStock).length;
      }
      return products.length;
    }
    if (maxStock !== undefined) {
      products = await ctx.db
        .query("products")
        .withIndex("by_active_and_stockQty", (q) =>
          q.eq("active", true).lte("stockQty", maxStock),
        )
        .take(8000);
      return products.length;
    }
    products = await ctx.db
      .query("products")
      .withIndex("by_active", (q) => q.eq("active", true))
      .take(8000);
    return products.length;
  },
});

/**
 * Paginated product management list (50–100/page).
 * Category + optional max stock filter run in Convex.
 */
export const listSummaries = query({
  args: {
    paginationOpts: paginationOptsValidator,
    categoryLabel: v.optional(v.string()),
    maxStockQty: v.optional(v.number()),
  },
  returns: v.object({
    page: v.array(productView),
    isDone: v.boolean(),
    continueCursor: v.string(),
  }),
  handler: async (ctx, args) => {
    await requireAnyPermission(ctx, [
      "stock.view",
      "stock.edit_products",
      "sales.create",
      "sales.assist_cart",
    ]);
    const numItems = Math.min(Math.max(args.paginationOpts.numItems, 1), 100);
    const category = args.categoryLabel?.trim() || undefined;
    const maxStock =
      args.maxStockQty != null && Number.isFinite(args.maxStockQty)
        ? Math.max(0, args.maxStockQty)
        : undefined;

    let result;
    if (category) {
      result = await ctx.db
        .query("products")
        .withIndex("by_active_and_categoryLabel", (q) =>
          q.eq("active", true).eq("categoryLabel", category),
        )
        .order("desc")
        .paginate({ ...args.paginationOpts, numItems });
    } else if (maxStock !== undefined) {
      result = await ctx.db
        .query("products")
        .withIndex("by_active_and_stockQty", (q) =>
          q.eq("active", true).lte("stockQty", maxStock),
        )
        .order("asc")
        .paginate({ ...args.paginationOpts, numItems });
    } else {
      result = await ctx.db
        .query("products")
        .withIndex("by_active", (q) => q.eq("active", true))
        .order("desc")
        .paginate({ ...args.paginationOpts, numItems });
    }

    let page = result.page;
    if (category && maxStock !== undefined) {
      page = page.filter((product) => product.stockQty <= maxStock);
    }

    const brandMap = await loadBrandMap(ctx, page);
    return {
      page: page.map((product) =>
        toProductView(
          product,
          product.brandId ? brandMap.get(product.brandId) : null,
        ),
      ),
      isDone: result.isDone,
      continueCursor: result.continueCursor,
    };
  },
});

/** Server name search for stock / POS fallback while local catalog syncs. */
export const searchSummaries = query({
  args: {
    query: v.string(),
    limit: v.optional(v.number()),
  },
  returns: v.array(productView),
  handler: async (ctx, args) => {
    await requireAnyPermission(ctx, [
      "stock.view",
      "stock.edit_products",
      "sales.create",
      "sales.assist_cart",
    ]);
    const searchText = args.query.trim();
    if (!searchText) return [];
    const limit = Math.min(Math.max(args.limit ?? 50, 1), 100);
    const products = await ctx.db
      .query("products")
      .withSearchIndex("search_name", (q) =>
        q.search("name", searchText).eq("active", true),
      )
      .take(limit);
    const brandMap = await loadBrandMap(ctx, products);
    return products.map((product) =>
      toProductView(
        product,
        product.brandId ? brandMap.get(product.brandId) : null,
      ),
    );
  },
});

/**
 * Paginated slim POS catalog pages for IndexedDB sync (batches of ~300–500).
 */
export const listPosCatalogPage = query({
  args: {
    paginationOpts: paginationOptsValidator,
  },
  returns: v.object({
    page: v.array(posCatalogSummaryView),
    isDone: v.boolean(),
    continueCursor: v.string(),
  }),
  handler: async (ctx, args) => {
    await requireAnyPermission(ctx, [
      "stock.view",
      "stock.edit_products",
      "sales.create",
      "sales.assist_cart",
    ]);
    const numItems = Math.min(Math.max(args.paginationOpts.numItems, 1), 500);
    const result = await ctx.db
      .query("products")
      .withIndex("by_active_and_updatedAt", (q) => q.eq("active", true))
      .order("asc")
      .paginate({ ...args.paginationOpts, numItems });
    const brandMap = await loadBrandMap(ctx, result.page);
    return {
      page: result.page.map((product) =>
        toPosCatalogSummary(
          product,
          product.brandId ? brandMap.get(product.brandId) : null,
        ),
      ),
      isDone: result.isDone,
      continueCursor: result.continueCursor,
    };
  },
});

/** Incremental POS sync: active products with updatedAt > sinceUpdatedAt. */
export const listPosCatalogSince = query({
  args: {
    sinceUpdatedAt: v.number(),
    paginationOpts: paginationOptsValidator,
  },
  returns: v.object({
    page: v.array(posCatalogSummaryView),
    isDone: v.boolean(),
    continueCursor: v.string(),
  }),
  handler: async (ctx, args) => {
    await requireAnyPermission(ctx, [
      "stock.view",
      "stock.edit_products",
      "sales.create",
      "sales.assist_cart",
    ]);
    const since = Math.max(0, Math.floor(args.sinceUpdatedAt));
    const numItems = Math.min(Math.max(args.paginationOpts.numItems, 1), 500);
    const result = await ctx.db
      .query("products")
      .withIndex("by_active_and_updatedAt", (q) =>
        q.eq("active", true).gt("updatedAt", since),
      )
      .order("asc")
      .paginate({ ...args.paginationOpts, numItems });
    const brandMap = await loadBrandMap(ctx, result.page);
    return {
      page: result.page.map((product) =>
        toPosCatalogSummary(
          product,
          product.brandId ? brandMap.get(product.brandId) : null,
        ),
      ),
      isDone: result.isDone,
      continueCursor: result.continueCursor,
    };
  },
});

/** Bounded low-stock rows for dashboard / alerts — never full catalog. */
export const listLowStock = query({
  args: {
    limit: v.optional(v.number()),
    threshold: v.optional(v.number()),
  },
  returns: v.array(productView),
  handler: async (ctx, args) => {
    await requireAnyPermission(ctx, [
      "stock.view",
      "stock.edit_products",
      "sales.create",
      "sales.assist_cart",
      "alerts.view",
    ]);
    const threshold =
      args.threshold != null && Number.isFinite(args.threshold)
        ? Math.max(0, args.threshold)
        : 10;
    const limit = Math.min(Math.max(args.limit ?? 50, 1), 100);
    const products = await ctx.db
      .query("products")
      .withIndex("by_active_and_stockQty", (q) =>
        q.eq("active", true).lte("stockQty", threshold),
      )
      .order("asc")
      .take(limit);
    return products.map((product) => toProductView(product, null));
  },
});

export const soldQuantities = query({
  args: {},
  returns: v.array(
    v.object({
      productId: v.id("products"),
      qty: v.number(),
    }),
  ),
  handler: async (ctx) => {
    await requireAnyPermission(ctx, [
      "stock.view",
      "stock.edit_products",
      "sales.create",
      "sales.assist_cart",
    ]);
    // Cap the scan — full collect() of invoiceLines was freezing POS after catalog growth.
    const lines = await ctx.db.query("invoiceLines").order("desc").take(4000);
    const totals = new Map<string, number>();
    for (const line of lines) {
      if (!line.productId) continue;
      const key = line.productId;
      totals.set(key, (totals.get(key) ?? 0) + line.qty);
    }
    return Array.from(totals.entries()).map(([productId, qty]) => ({
      productId: productId as Doc<"products">["_id"],
      qty,
    }));
  },
});

export const findByBarcode = query({
  args: {
    barcode: v.string(),
    includeInactive: v.optional(v.boolean()),
  },
  returns: v.union(productView, v.null()),
  handler: async (ctx, args) => {
    await requireAnyPermission(ctx, [
      "stock.view",
      "stock.edit_products",
      "sales.create",
      "sales.assist_cart",
    ]);
    const normalized = normalizeBarcode(args.barcode);
    if (!normalized) return null;
    const product = await ctx.db
      .query("products")
      .withIndex("by_barcode", (q) => q.eq("barcode", normalized))
      .first();
    if (!product) return null;
    if (!args.includeInactive && !product.active) return null;
    const brand = product.brandId ? await ctx.db.get(product.brandId) : null;
    return toProductView(product, brand);
  },
});

/** Public kiosk / phone price check — no auth, no cost or stock. */
const publicPriceView = v.object({
  name: v.string(),
  price: v.number(),
  image: v.string(),
  imageAlt: v.string(),
  barcode: v.union(v.string(), v.null()),
  soldByWeight: v.boolean(),
  brandName: v.union(v.string(), v.null()),
});

export const publicPriceByBarcode = query({
  args: { barcode: v.string() },
  returns: v.union(publicPriceView, v.null()),
  handler: async (ctx, args) => {
    const normalized = normalizeBarcode(args.barcode);
    if (!normalized) return null;
    const product = await ctx.db
      .query("products")
      .withIndex("by_barcode", (q) => q.eq("barcode", normalized))
      .first();
    if (!product || !product.active) return null;
    const brand = product.brandId ? await ctx.db.get(product.brandId) : null;
    const activeBrand = brand && brand.active ? brand : null;
    return {
      name: product.name,
      price: centsToMad(product.sellPriceMadCents),
      image: resolveProductImage(product.imageUrl),
      imageAlt: product.imageAlt,
      barcode: product.barcode ?? null,
      soldByWeight: product.soldByWeight === true,
      brandName: activeBrand?.name ?? null,
    };
  },
});

export const listCategories = query({
  args: {},
  returns: v.array(v.string()),
  handler: async (ctx) => {
    await requireAnyPermission(ctx, [
      "stock.view",
      "stock.edit_products",
      "sales.create",
      "sales.assist_cart",
    ]);
    const categories = await ctx.db.query("productCategories").take(200);
    return categories
      .map((category) => category.label)
      .sort((a, b) => a.localeCompare(b, "fr"));
  },
});

export const createCategory = mutation({
  args: { label: v.string() },
  returns: v.string(),
  handler: async (ctx, args) => {
    const { userId, user } = await requirePermission(ctx, "stock.edit_products");
    await ensureCategory(ctx, args.label, "custom");
    const label = normalizeCategoryLabel(args.label);
    await recordAuditForUser(ctx, userId, user, {
      action: "categories.create",
      entityType: "category",
      summary: `Catégorie créée: ${label}`,
      payload: { label },
      source: "manual",
    });
    return label;
  },
});

const categoryRowView = v.object({
  id: v.id("productCategories"),
  label: v.string(),
  kind: v.union(v.literal("builtIn"), v.literal("custom")),
  productCount: v.number(),
});

export const listCategoryRows = query({
  args: {},
  returns: v.array(categoryRowView),
  handler: async (ctx) => {
    await requirePermission(ctx, "stock.edit_products");
    const categories = await ctx.db.query("productCategories").take(200);
    const rows = await Promise.all(
      categories.map(async (category) => {
        const products = await ctx.db
          .query("products")
          .withIndex("by_categoryLabel", (q) =>
            q.eq("categoryLabel", category.label),
          )
          .take(8000);
        return {
          id: category._id,
          label: category.label,
          kind: category.kind,
          productCount: products.filter((product) => product.active).length,
        };
      }),
    );
    return rows.sort((a, b) => a.label.localeCompare(b.label, "fr"));
  },
});

export const updateCategory = mutation({
  args: {
    categoryId: v.id("productCategories"),
    label: v.string(),
  },
  returns: v.string(),
  handler: async (ctx, args) => {
    const { userId, user } = await requirePermission(ctx, "stock.edit_products");
    const category = await ctx.db.get(args.categoryId);
    if (!category) throw new Error("Category not found.");

    const newLabel = normalizeCategoryLabel(args.label);
    if (!newLabel) throw new Error("Category label is required.");

    const duplicate = await ctx.db
      .query("productCategories")
      .withIndex("by_normalizedLabel", (q) =>
        q.eq("normalizedLabel", newLabel.toLowerCase()),
      )
      .unique();
    if (duplicate && duplicate._id !== args.categoryId) {
      throw new Error("Category already exists.");
    }

    const oldLabel = category.label;
    if (oldLabel !== newLabel) {
      await ctx.db.patch(args.categoryId, {
        label: newLabel,
        normalizedLabel: newLabel.toLowerCase(),
      });

      const products = await ctx.db
        .query("products")
        .withIndex("by_categoryLabel", (q) => q.eq("categoryLabel", oldLabel))
        .collect();
      const now = Date.now();
      for (const product of products) {
        await ctx.db.patch(product._id, {
          categoryLabel: newLabel,
          updatedAt: now,
        });
      }
    }

    await recordAuditForUser(ctx, userId, user, {
      action: "categories.update",
      entityType: "category",
      entityId: args.categoryId,
      summary: `Catégorie modifiée: ${oldLabel} → ${newLabel}`,
      payload: { oldLabel, newLabel },
      source: "manual",
    });
    return newLabel;
  },
});

export const removeCategory = mutation({
  args: { categoryId: v.id("productCategories") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { userId, user } = await requirePermission(ctx, "stock.edit_products");
    const category = await ctx.db.get(args.categoryId);
    if (!category) throw new Error("Category not found.");

    const products = await ctx.db
      .query("products")
      .withIndex("by_categoryLabel", (q) => q.eq("categoryLabel", category.label))
      .take(1);
    if (products.length > 0) {
      throw new Error(
        "Cannot delete a category that still has products. Reassign or remove those products first.",
      );
    }

    await ctx.db.delete(args.categoryId);
    await recordAuditForUser(ctx, userId, user, {
      action: "categories.delete",
      entityType: "category",
      entityId: args.categoryId,
      summary: `Catégorie supprimée: ${category.label}`,
      source: "manual",
    });
    return null;
  },
});

export const create = mutation({
  args: {
    name: v.string(),
    category: v.string(),
    priceMad: v.number(),
    costMad: v.optional(v.number()),
    stockQty: v.number(),
    image: v.optional(v.string()),
    imageAlt: v.string(),
    barcode: v.optional(v.string()),
    soldByWeight: v.optional(v.boolean()),
    brandId: v.optional(v.id("brands")),
  },
  returns: productView,
  handler: async (ctx, args) => {
    const { userId, user } = await requirePermission(ctx, "stock.edit_products");
    const now = Date.now();
    const name = args.name.trim();
    const category = normalizeCategoryLabel(args.category);
    if (!name) throw new Error("Product name is required.");
    if (!category) throw new Error("Product category is required.");
    const barcode = normalizeBarcode(args.barcode);
    if (barcode) {
      const existing = await ctx.db
        .query("products")
        .withIndex("by_barcode", (q) => q.eq("barcode", barcode))
        .first();
      if (existing) {
        if (!existing.active) {
          throw new Error(
            "Barcode already exists on an inactive product. Reactivate it from Stock.",
          );
        }
        throw new Error("Barcode already exists.");
      }
    }
    if (args.brandId) {
      const brand = await ctx.db.get(args.brandId);
      if (!brand || !brand.active) throw new Error("Brand not found.");
    }
    await ensureCategory(ctx, category, "custom");
    const costMadCents =
      typeof args.costMad === "number" && args.costMad > 0
        ? madToCents(args.costMad)
        : null;
    const productId = await ctx.db.insert("products", {
      name,
      categoryLabel: category,
      ...(args.brandId ? { brandId: args.brandId } : {}),
      ...(barcode ? { barcode } : {}),
      sellPriceMadCents: clampPositiveCents(args.priceMad),
      costMadCents,
      stockQty: Math.max(0, Math.floor(args.stockQty)),
      stockLow: args.stockQty > 0 && args.stockQty <= 10,
      imageUrl: resolveProductImage(args.image),
      imageAlt: args.imageAlt.trim() || name,
      active: true,
      ...(args.soldByWeight ? { soldByWeight: true } : {}),
      createdAt: now,
      updatedAt: now,
    });
    if (costMadCents !== null) {
      await ctx.db.insert("productPriceHistory", {
        productId,
        kind: "purchase",
        amountMadCents: costMadCents,
        recordedAt: now,
        recordedByUserId: userId,
        source: "create",
      });
    }
    const product = await ctx.db.get(productId);
    if (!product) throw new Error("Product creation failed.");
    const brand = product.brandId ? await ctx.db.get(product.brandId) : null;
    await recordAuditForUser(ctx, userId, user, {
      action: "products.create",
      entityType: "product",
      entityId: productId,
      summary: `Produit créé: ${name}`,
      payload: { name, category, priceMad: args.priceMad, stockQty: args.stockQty },
      source: "manual",
    });
    return toProductView(product, brand);
  },
});

export const updateCost = mutation({
  args: { productId: v.id("products"), costMad: v.number() },
  returns: productView,
  handler: async (ctx, args) => {
    const { userId, user } = await requirePermission(ctx, "stock.edit_products");
    const now = Date.now();
    const costMadCents = clampPositiveCents(args.costMad);
    await ctx.db.patch(args.productId, {
      costMadCents,
      updatedAt: now,
    });
    await ctx.db.insert("productPriceHistory", {
      productId: args.productId,
      kind: "purchase",
      amountMadCents: costMadCents,
      recordedAt: now,
      recordedByUserId: userId,
      source: "manual",
    });
    const product = await ctx.db.get(args.productId);
    if (!product) throw new Error("Product not found.");
    await recordAuditForUser(ctx, userId, user, {
      action: "products.update_cost",
      entityType: "product",
      entityId: args.productId,
      summary: `Coût modifié: ${product.name}`,
      payload: { costMad: args.costMad },
      source: "manual",
    });
    return productViewById(ctx, args.productId);
  },
});

export const updateSellPrice = mutation({
  args: { productId: v.id("products"), priceMad: v.number() },
  returns: productView,
  handler: async (ctx, args) => {
    const { userId, user } = await requirePermission(ctx, "stock.edit_products");
    const now = Date.now();
    const sellPriceMadCents = clampPositiveCents(args.priceMad);
    await ctx.db.patch(args.productId, {
      sellPriceMadCents,
      updatedAt: now,
    });
    await ctx.db.insert("productPriceHistory", {
      productId: args.productId,
      kind: "sell",
      amountMadCents: sellPriceMadCents,
      recordedAt: now,
      recordedByUserId: userId,
      source: "manual",
    });
    const product = await ctx.db.get(args.productId);
    if (!product) throw new Error("Product not found.");
    await recordAuditForUser(ctx, userId, user, {
      action: "products.update_price",
      entityType: "product",
      entityId: args.productId,
      summary: `Prix modifié: ${product.name}`,
      payload: { priceMad: args.priceMad },
      source: "manual",
    });
    return productViewById(ctx, args.productId);
  },
});

export const updateBarcode = mutation({
  args: {
    productId: v.id("products"),
    barcode: v.union(v.string(), v.null()),
  },
  returns: productView,
  handler: async (ctx, args) => {
    const { userId, user } = await requirePermission(ctx, "stock.edit_products");
    const product = await ctx.db.get(args.productId);
    if (!product) throw new Error("Product not found.");

    const barcode =
      args.barcode === null || args.barcode.trim() === ""
        ? null
        : (normalizeBarcode(args.barcode) ?? null);
    if (barcode) {
      const existing = await ctx.db
        .query("products")
        .withIndex("by_barcode", (q) => q.eq("barcode", barcode))
        .first();
      if (existing && existing._id !== args.productId) {
        throw new Error("Barcode already exists.");
      }
    }

    await ctx.db.patch(args.productId, {
      ...(barcode ? { barcode } : { barcode: undefined }),
      updatedAt: Date.now(),
    });
    await recordAuditForUser(ctx, userId, user, {
      action: "products.update_barcode",
      entityType: "product",
      entityId: args.productId,
      summary: `Code-barres modifié: ${product.name}`,
      payload: { barcode },
      source: "manual",
    });
    return productViewById(ctx, args.productId);
  },
});

export const updateImage = mutation({
  args: {
    productId: v.id("products"),
    image: v.union(v.string(), v.null()),
    imageAlt: v.optional(v.string()),
  },
  returns: productView,
  handler: async (ctx, args) => {
    const { userId, user } = await requirePermission(ctx, "stock.edit_products");
    const product = await ctx.db.get(args.productId);
    if (!product) throw new Error("Product not found.");

    const imageUrl = resolveProductImage(args.image ?? undefined);
    const imageAlt =
      args.imageAlt?.trim() || product.imageAlt || product.name;

    await ctx.db.patch(args.productId, {
      imageUrl,
      imageAlt,
      updatedAt: Date.now(),
    });
    await recordAuditForUser(ctx, userId, user, {
      action: "products.update_image",
      entityType: "product",
      entityId: args.productId,
      summary: `Photo modifiée: ${product.name}`,
      source: "manual",
    });
    return productViewById(ctx, args.productId);
  },
});

export const update = mutation({
  args: {
    productId: v.id("products"),
    name: v.string(),
    category: v.string(),
    priceMad: v.number(),
    costMad: v.optional(v.number()),
    image: v.optional(v.string()),
    imageAlt: v.string(),
    barcode: v.optional(v.string()),
    soldByWeight: v.optional(v.boolean()),
    brandId: v.optional(v.union(v.id("brands"), v.null())),
  },
  returns: productView,
  handler: async (ctx, args) => {
    const { userId, user } = await requirePermission(ctx, "stock.edit_products");
    const product = await ctx.db.get(args.productId);
    if (!product) throw new Error("Product not found.");

    const now = Date.now();
    const name = args.name.trim();
    const category = normalizeCategoryLabel(args.category);
    if (!name) throw new Error("Product name is required.");
    if (!category) throw new Error("Product category is required.");

    const barcode = normalizeBarcode(args.barcode);
    if (barcode) {
      const existing = await ctx.db
        .query("products")
        .withIndex("by_barcode", (q) => q.eq("barcode", barcode))
        .first();
      if (existing && existing._id !== args.productId) {
        throw new Error("Barcode already exists.");
      }
    }

    if (args.brandId) {
      const brand = await ctx.db.get(args.brandId);
      if (!brand || !brand.active) throw new Error("Brand not found.");
    }

    const sellPriceMadCents = clampPositiveCents(args.priceMad);
    const costMadCents =
      typeof args.costMad === "number" && args.costMad > 0
        ? clampPositiveCents(args.costMad)
        : null;

    await ensureCategory(ctx, category, "custom");

    const prevCost = product.costMadCents;
    await ctx.db.patch(args.productId, {
      name,
      categoryLabel: category,
      ...(barcode ? { barcode } : { barcode: undefined }),
      ...(args.brandId !== undefined
        ? args.brandId
          ? { brandId: args.brandId }
          : { brandId: undefined }
        : {}),
      sellPriceMadCents,
      costMadCents,
      imageUrl: resolveProductImage(args.image),
      imageAlt: args.imageAlt.trim() || name,
      soldByWeight: args.soldByWeight === true ? true : undefined,
      updatedAt: now,
    });

    if (Math.abs(sellPriceMadCents - product.sellPriceMadCents) >= 1) {
      await ctx.db.insert("productPriceHistory", {
        productId: args.productId,
        kind: "sell",
        amountMadCents: sellPriceMadCents,
        recordedAt: now,
        recordedByUserId: userId,
        source: "manual",
      });
    }

    if (
      costMadCents !== null &&
      (prevCost === null || Math.abs(costMadCents - prevCost) >= 1)
    ) {
      await ctx.db.insert("productPriceHistory", {
        productId: args.productId,
        kind: "purchase",
        amountMadCents: costMadCents,
        recordedAt: now,
        recordedByUserId: userId,
        source: "manual",
      });
    }

    const updated = await ctx.db.get(args.productId);
    if (!updated) throw new Error("Product not found.");
    await recordAuditForUser(ctx, userId, user, {
      action: "products.update",
      entityType: "product",
      entityId: args.productId,
      summary: `Produit modifié: ${name}`,
      payload: { name, category, priceMad: args.priceMad, costMad: args.costMad },
      source: "manual",
    });
    return productViewById(ctx, args.productId);
  },
});

/** Soft-delete: hide from catalog/POS. Admin only. */
export const remove = mutation({
  args: { productId: v.id("products") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { userId, user } = await requirePermission(
      ctx,
      "stock.delete_products",
    );
    const product = await ctx.db.get(args.productId);
    if (!product) throw new Error("Product not found.");
    if (!product.active) return null;
    await ctx.db.patch(args.productId, {
      active: false,
      updatedAt: Date.now(),
    });
    await recordAuditForUser(ctx, userId, user, {
      action: "products.delete",
      entityType: "product",
      entityId: args.productId,
      summary: `Produit désactivé: ${product.name}`,
      source: "manual",
    });
    return null;
  },
});

export const addStock = mutation({
  args: {
    productId: v.id("products"),
    quantity: v.number(),
    costMad: v.optional(v.number()),
    sellPriceMad: v.optional(v.number()),
  },
  returns: productView,
  handler: async (ctx, args) => {
    const { userId, user } = await requireAnyPermission(ctx, [
      "stock.replenish",
      "stock.adjust",
      "stock.edit_products",
    ]);
    const product = await ctx.db.get(args.productId);
    if (!product) throw new Error("Product not found.");

    const qty = Math.floor(args.quantity);
    if (qty <= 0) throw new Error("Quantity must be at least 1.");

    const now = Date.now();
    const newStockQty = product.stockQty + qty;
    const stockLow = newStockQty > 0 && newStockQty <= 10;

    const patch: {
      stockQty: number;
      stockLow: boolean;
      updatedAt: number;
      costMadCents?: number;
      sellPriceMadCents?: number;
    } = {
      stockQty: newStockQty,
      stockLow,
      updatedAt: now,
    };

    if (typeof args.costMad === "number" && args.costMad > 0) {
      const costMadCents = clampPositiveCents(args.costMad);
      patch.costMadCents = costMadCents;
    }

    if (typeof args.sellPriceMad === "number" && args.sellPriceMad > 0) {
      const sellPriceMadCents = clampPositiveCents(args.sellPriceMad);
      if (Math.abs(sellPriceMadCents - product.sellPriceMadCents) >= 1) {
        patch.sellPriceMadCents = sellPriceMadCents;
      }
    }

    const historyCostCents =
      typeof args.costMad === "number" && args.costMad > 0
        ? clampPositiveCents(args.costMad)
        : product.costMadCents ?? 0;

    await ctx.db.insert("productPriceHistory", {
      productId: args.productId,
      kind: "purchase",
      amountMadCents: historyCostCents,
      recordedAt: now,
      recordedByUserId: userId,
      source: "stock_in",
      quantity: qty,
    });

    if (
      typeof args.sellPriceMad === "number" &&
      args.sellPriceMad > 0 &&
      patch.sellPriceMadCents !== undefined
    ) {
      await ctx.db.insert("productPriceHistory", {
        productId: args.productId,
        kind: "sell",
        amountMadCents: patch.sellPriceMadCents,
        recordedAt: now,
        recordedByUserId: userId,
        source: "stock_in",
      });
    }

    await ctx.db.patch(args.productId, patch);
    await recordAuditForUser(ctx, userId, user, {
      action: "products.add_stock",
      entityType: "product",
      entityId: args.productId,
      summary: `Stock +${qty}: ${product.name}`,
      payload: {
        quantity: qty,
        costMad: args.costMad,
        sellPriceMad: args.sellPriceMad,
        newStockQty,
      },
      source: "manual",
    });
    return productViewById(ctx, args.productId);
  },
});

export const setStockQty = mutation({
  args: {
    productId: v.id("products"),
    stockQty: v.number(),
  },
  returns: productView,
  handler: async (ctx, args) => {
    const { userId, user } = await requireAnyPermission(ctx, [
      "stock.adjust",
      "stock.replenish",
      "stock.edit_products",
    ]);
    const product = await ctx.db.get(args.productId);
    if (!product) throw new Error("Product not found.");

    const stockQty = Math.max(0, Math.floor(args.stockQty));
    if (stockQty === product.stockQty) {
      return productViewById(ctx, args.productId);
    }

    const stockLow = stockQty > 0 && stockQty <= 10;
    await ctx.db.patch(args.productId, {
      stockQty,
      stockLow,
      updatedAt: Date.now(),
    });
    await recordAuditForUser(ctx, userId, user, {
      action: "products.set_stock",
      entityType: "product",
      entityId: args.productId,
      summary: `Stock ${product.stockQty} → ${stockQty}: ${product.name}`,
      payload: {
        previousStockQty: product.stockQty,
        stockQty,
      },
      source: "manual",
    });
    return productViewById(ctx, args.productId);
  },
});

export const listPurchaseHistory = query({
  args: { productId: v.id("products") },
  returns: v.array(historyEntryView),
  handler: async (ctx, args) => {
    await requireAnyPermission(ctx, [
      "stock.view",
      "stock.edit_products",
      "stock.replenish",
      "procurement.view",
    ]);
    const entries = await ctx.db
      .query("productPriceHistory")
      .withIndex("by_productId_kind_recordedAt", (q) =>
        q.eq("productId", args.productId).eq("kind", "purchase"),
      )
      .order("desc")
      .take(100);
    return entries.map((entry) => ({
      at: new Date(entry.recordedAt).toISOString(),
      costMad: centsToMad(entry.amountMadCents),
    }));
  },
});

const purchasePriceSummaryView = v.object({
  lastCostMad: v.union(v.number(), v.null()),
  lastAt: v.union(v.string(), v.null()),
  minCostMad: v.union(v.number(), v.null()),
  recent: v.array(historyEntryView),
});

export const purchasePriceSummary = query({
  args: { productId: v.id("products") },
  returns: purchasePriceSummaryView,
  handler: async (ctx, args) => {
    await requireAnyPermission(ctx, [
      "stock.view",
      "stock.edit_products",
      "stock.replenish",
      "procurement.view",
    ]);
    const product = await ctx.db.get(args.productId);
    if (!product) throw new Error("Product not found.");

    const entries = await ctx.db
      .query("productPriceHistory")
      .withIndex("by_productId_kind_recordedAt", (q) =>
        q.eq("productId", args.productId).eq("kind", "purchase"),
      )
      .order("desc")
      .take(100);

    const recent = entries.slice(0, 5).map((entry) => ({
      at: new Date(entry.recordedAt).toISOString(),
      costMad: centsToMad(entry.amountMadCents),
    }));

    const costsMad = entries.map((e) => centsToMad(e.amountMadCents));
    if (product.costMadCents !== null) {
      costsMad.push(centsToMad(product.costMadCents));
    }

    const minCostMad =
      costsMad.length > 0 ? Math.min(...costsMad) : null;

    const last = entries[0];
    return {
      lastCostMad: last ? centsToMad(last.amountMadCents) : null,
      lastAt: last ? new Date(last.recordedAt).toISOString() : null,
      minCostMad,
      recent,
    };
  },
});

const stockInLineArgs = v.object({
  productId: v.id("products"),
  quantity: v.number(),
  costMad: v.optional(v.number()),
  sellPriceMad: v.optional(v.number()),
});

const stockInHistoryEntryView = v.object({
  id: v.id("productPriceHistory"),
  at: v.string(),
  productId: v.id("products"),
  productName: v.string(),
  productImage: v.string(),
  quantity: v.union(v.number(), v.null()),
  costMad: v.number(),
  lineTotalMad: v.union(v.number(), v.null()),
  source: v.union(v.string(), v.null()),
});

export const addStockLines = mutation({
  args: {
    lines: v.array(stockInLineArgs),
  },
  returns: v.object({ updatedCount: v.number() }),
  handler: async (ctx, args) => {
    const { userId } = await requireAnyPermission(ctx, [
      "stock.replenish",
      "stock.adjust",
      "stock.edit_products",
    ]);
    if (args.lines.length === 0) {
      throw new Error("At least one line is required.");
    }

    const now = Date.now();
    let updatedCount = 0;

    for (const line of args.lines) {
      const product = await ctx.db.get(line.productId);
      if (!product) throw new Error("Product not found.");

      const qty = Math.floor(line.quantity);
      if (qty <= 0) throw new Error("Quantity must be at least 1.");

      const newStockQty = product.stockQty + qty;
      const stockLow = newStockQty > 0 && newStockQty <= 10;

      const patch: {
        stockQty: number;
        stockLow: boolean;
        updatedAt: number;
        costMadCents?: number;
        sellPriceMadCents?: number;
      } = {
        stockQty: newStockQty,
        stockLow,
        updatedAt: now,
      };

      if (typeof line.costMad === "number" && line.costMad > 0) {
        patch.costMadCents = clampPositiveCents(line.costMad);
      }

      if (typeof line.sellPriceMad === "number" && line.sellPriceMad > 0) {
        const sellPriceMadCents = clampPositiveCents(line.sellPriceMad);
        if (Math.abs(sellPriceMadCents - product.sellPriceMadCents) >= 1) {
          patch.sellPriceMadCents = sellPriceMadCents;
        }
      }

      const historyCostCents =
        typeof line.costMad === "number" && line.costMad > 0
          ? clampPositiveCents(line.costMad)
          : product.costMadCents ?? 0;

      await ctx.db.insert("productPriceHistory", {
        productId: line.productId,
        kind: "purchase",
        amountMadCents: historyCostCents,
        recordedAt: now,
        recordedByUserId: userId,
        source: "stock_in",
        quantity: qty,
      });

      if (patch.sellPriceMadCents !== undefined) {
        await ctx.db.insert("productPriceHistory", {
          productId: line.productId,
          kind: "sell",
          amountMadCents: patch.sellPriceMadCents,
          recordedAt: now,
          recordedByUserId: userId,
          source: "stock_in",
        });
      }

      await ctx.db.patch(line.productId, patch);
      updatedCount += 1;
    }

    return { updatedCount };
  },
});

export const listStockInHistory = query({
  args: { limit: v.optional(v.number()) },
  returns: v.array(stockInHistoryEntryView),
  handler: async (ctx, args) => {
    await requireAnyPermission(ctx, [
      "stock.view",
      "stock.edit_products",
      "stock.replenish",
      "procurement.view",
    ]);

    const take = Math.min(Math.max(args.limit ?? 80, 1), 200);
    const entries = await ctx.db
      .query("productPriceHistory")
      .withIndex("by_kind_recordedAt", (q) => q.eq("kind", "purchase"))
      .order("desc")
      .take(take * 3);

    const stockSources = new Set(["stock_in", "procurement"]);
    const filtered = entries
      .filter((entry) => stockSources.has(entry.source ?? ""))
      .slice(0, take);

    const productCache = new Map<string, Doc<"products"> | null>();
    const results = [];

    for (const entry of filtered) {
      let product = productCache.get(entry.productId);
      if (product === undefined) {
        product = await ctx.db.get(entry.productId);
        productCache.set(entry.productId, product);
      }
      if (!product) continue;

      const costMad = centsToMad(entry.amountMadCents);
      const quantity =
        typeof entry.quantity === "number" ? entry.quantity : null;
      results.push({
        id: entry._id,
        at: new Date(entry.recordedAt).toISOString(),
        productId: entry.productId,
        productName: product.name,
        productImage: product.imageUrl,
        quantity,
        costMad,
        lineTotalMad:
          quantity != null && quantity > 0 ? costMad * quantity : null,
        source: entry.source ?? null,
      });
    }

    return results;
  },
});
