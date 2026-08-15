import { v } from "convex/values";

import { mutation, query } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { recordAuditForUser } from "./audit";
import { requireAnyPermission, requirePermission } from "./authz";
import type { PermissionKey } from "./authz";
import { centsToMad, clampPositiveCents } from "./money";

const MANAGE_KEYS: PermissionKey[] = [
  "procurement.manage",
  "stock.edit_products",
];

type ListCtx = QueryCtx | MutationCtx;

async function requireProcurementManage(ctx: ListCtx) {
  return await requireAnyPermission(ctx, MANAGE_KEYS);
}

const productSnapshotView = v.object({
  id: v.id("products"),
  name: v.string(),
  category: v.string(),
  image: v.string(),
  imageAlt: v.string(),
  barcode: v.union(v.string(), v.null()),
  costMad: v.union(v.number(), v.null()),
  priceMad: v.number(),
  stockQty: v.number(),
});

const listItemView = v.object({
  id: v.id("procurementListItems"),
  productId: v.id("products"),
  quantity: v.number(),
  status: v.union(v.literal("pending"), v.literal("bought")),
  plannedCostMad: v.union(v.number(), v.null()),
  paidCostMad: v.union(v.number(), v.null()),
  boughtAt: v.union(v.string(), v.null()),
  product: productSnapshotView,
});

const procurementListView = v.object({
  id: v.id("procurementLists"),
  status: v.union(
    v.literal("draft"),
    v.literal("active"),
    v.literal("completed"),
  ),
  title: v.union(v.string(), v.null()),
  createdAt: v.string(),
  publishedAt: v.union(v.string(), v.null()),
  completedAt: v.union(v.string(), v.null()),
  items: v.array(listItemView),
  pendingCount: v.number(),
});

const procurementBonSummaryView = v.object({
  id: v.id("procurementLists"),
  number: v.string(),
  title: v.union(v.string(), v.null()),
  status: v.union(v.literal("active"), v.literal("completed")),
  publishedAt: v.string(),
  completedAt: v.union(v.string(), v.null()),
  lineCount: v.number(),
  totalQty: v.number(),
  totalPurchaseMad: v.number(),
  totalSellMad: v.number(),
  pendingCount: v.number(),
  hasMissingCost: v.boolean(),
});

function toIso(ts: number | undefined): string | null {
  if (ts === undefined) return null;
  return new Date(ts).toISOString();
}

function productSnapshot(product: Doc<"products">) {
  return {
    id: product._id,
    name: product.name,
    category: product.categoryLabel,
    image: product.imageUrl,
    imageAlt: product.imageAlt,
    barcode: product.barcode ?? null,
    costMad:
      product.costMadCents === null ? null : centsToMad(product.costMadCents),
    priceMad: centsToMad(product.sellPriceMadCents),
    stockQty: product.stockQty,
  };
}

function sortListItemsByStock<
  T extends {
    status: "pending" | "bought";
    product: { stockQty: number; name: string };
  },
>(items: T[]): T[] {
  return items.sort((a, b) => {
    const stockDiff = Math.max(0, a.product.stockQty) - Math.max(0, b.product.stockQty);
    if (stockDiff !== 0) return stockDiff;
    if (a.status !== b.status) {
      return a.status === "pending" ? -1 : 1;
    }
    return a.product.name.localeCompare(b.product.name, "fr");
  });
}

async function loadListItems(ctx: ListCtx, listId: Id<"procurementLists">) {
  const rows = await ctx.db
    .query("procurementListItems")
    .withIndex("by_listId", (q) => q.eq("listId", listId))
    .collect();
  const items: Array<{
    id: Id<"procurementListItems">;
    productId: Id<"products">;
    quantity: number;
    status: "pending" | "bought";
    plannedCostMad: number | null;
    paidCostMad: number | null;
    boughtAt: string | null;
    product: ReturnType<typeof productSnapshot>;
  }> = [];
  for (const row of rows) {
    const product = await ctx.db.get(row.productId);
    if (!product || !product.active) continue;
    const plannedCostMadCents =
      row.plannedCostMadCents ?? (await latestPurchaseCostCents(ctx, row.productId));
    items.push({
      id: row._id,
      productId: row.productId,
      quantity: row.quantity,
      status: row.status,
      plannedCostMad:
        plannedCostMadCents === null ? null : centsToMad(plannedCostMadCents),
      paidCostMad:
        row.paidCostMadCents === undefined
          ? null
          : centsToMad(row.paidCostMadCents),
      boughtAt: toIso(row.boughtAt),
      product: productSnapshot(product),
    });
  }
  return sortListItemsByStock(items);
}

async function toListView(ctx: ListCtx, list: Doc<"procurementLists">) {
  const items = await loadListItems(ctx, list._id);
  return {
    id: list._id,
    status: list.status,
    title: list.title ?? null,
    createdAt: new Date(list.createdAt).toISOString(),
    publishedAt: toIso(list.publishedAt),
    completedAt: toIso(list.completedAt),
    items,
    pendingCount: items.filter((item) => item.status === "pending").length,
  };
}

function bonNumber(list: Doc<"procurementLists">): string {
  const published = list.publishedAt ?? list.createdAt;
  const date = new Date(published).toISOString().slice(0, 10).replace(/-/g, "");
  const suffix = list._id.slice(-4).toUpperCase();
  return `LA-${date}-${suffix}`;
}

function summarizeItemsForBon(
  items: Awaited<ReturnType<typeof loadListItems>>,
) {
  let totalQty = 0;
  let totalPurchaseMad = 0;
  let totalSellMad = 0;
  let pendingCount = 0;
  let hasMissingCost = false;

  for (const item of items) {
    totalQty += item.quantity;
    if (item.status === "pending") pendingCount += 1;
    const unitCost =
      item.status === "bought" && item.paidCostMad != null
        ? item.paidCostMad
        : item.product.costMad;
    if (unitCost != null && unitCost > 0) {
      totalPurchaseMad += unitCost * item.quantity;
    } else {
      hasMissingCost = true;
    }
    totalSellMad += item.product.priceMad * item.quantity;
  }

  return {
    lineCount: items.length,
    totalQty,
    totalPurchaseMad: Math.round(totalPurchaseMad * 100) / 100,
    totalSellMad: Math.round(totalSellMad * 100) / 100,
    pendingCount,
    hasMissingCost,
  };
}

async function toBonSummary(ctx: ListCtx, list: Doc<"procurementLists">) {
  if (list.status === "draft" || list.publishedAt === undefined) {
    return null;
  }
  const items = await loadListItems(ctx, list._id);
  const totals = summarizeItemsForBon(items);
  return {
    id: list._id,
    number: bonNumber(list),
    title: list.title ?? null,
    status: list.status as "active" | "completed",
    publishedAt: new Date(list.publishedAt).toISOString(),
    completedAt: toIso(list.completedAt),
    ...totals,
  };
}

async function findDraftList(ctx: ListCtx) {
  return await ctx.db
    .query("procurementLists")
    .withIndex("by_status", (q) => q.eq("status", "draft"))
    .first();
}

async function findActiveList(ctx: ListCtx) {
  return await ctx.db
    .query("procurementLists")
    .withIndex("by_status", (q) => q.eq("status", "active"))
    .first();
}

async function ensureDraftList(ctx: MutationCtx, userId: Id<"users">) {
  const existing = await findDraftList(ctx);
  if (existing) return existing;
  const now = Date.now();
  const listId = await ctx.db.insert("procurementLists", {
    status: "draft",
    createdByUserId: userId,
    createdAt: now,
  });
  const list = await ctx.db.get(listId);
  if (!list) throw new Error("Failed to create procurement list.");
  return list;
}

async function latestPurchaseCostCents(
  ctx: ListCtx,
  productId: Id<"products">,
) {
  const latest = await ctx.db
    .query("productPriceHistory")
    .withIndex("by_productId_kind_recordedAt", (q) =>
      q.eq("productId", productId).eq("kind", "purchase"),
    )
    .order("desc")
    .first();
  return latest?.amountMadCents ?? null;
}

async function defaultPlannedCostCents(
  ctx: ListCtx,
  product: Doc<"products">,
) {
  return (await latestPurchaseCostCents(ctx, product._id)) ?? product.costMadCents;
}

export const getActiveList = query({
  args: {},
  returns: v.union(procurementListView, v.null()),
  handler: async (ctx) => {
    await requireAnyPermission(ctx, ["procurement.view", "stock.view"]);
    const list = await findActiveList(ctx);
    if (!list) return null;
    return await toListView(ctx, list);
  },
});

export const getDraftList = query({
  args: {},
  returns: v.union(procurementListView, v.null()),
  handler: async (ctx) => {
    await requireProcurementManage(ctx);
    const list = await findDraftList(ctx);
    if (!list) return null;
    return await toListView(ctx, list);
  },
});

export const listBons = query({
  args: {},
  returns: v.array(procurementBonSummaryView),
  handler: async (ctx) => {
    await requireAnyPermission(ctx, ["procurement.view", "stock.view"]);
    const active = await ctx.db
      .query("procurementLists")
      .withIndex("by_status", (q) => q.eq("status", "active"))
      .collect();
    const completed = await ctx.db
      .query("procurementLists")
      .withIndex("by_status", (q) => q.eq("status", "completed"))
      .collect();
    const rows = [...active, ...completed].sort(
      (a, b) => (b.publishedAt ?? 0) - (a.publishedAt ?? 0),
    );
    const bons = [];
    for (const list of rows) {
      const summary = await toBonSummary(ctx, list);
      if (summary) bons.push(summary);
    }
    return bons;
  },
});

export const getListById = query({
  args: { listId: v.id("procurementLists") },
  returns: v.union(procurementListView, v.null()),
  handler: async (ctx, args) => {
    await requireAnyPermission(ctx, ["procurement.view", "stock.view"]);
    const list = await ctx.db.get(args.listId);
    if (!list || list.status === "draft") return null;
    return await toListView(ctx, list);
  },
});

export const addItem = mutation({
  args: {
    productId: v.id("products"),
    quantity: v.number(),
    listId: v.optional(v.id("procurementLists")),
  },
  returns: procurementListView,
  handler: async (ctx, args) => {
    const { userId } = await requireProcurementManage(ctx);
    const qty = Math.floor(args.quantity);
    if (!Number.isFinite(qty) || qty < 1) {
      throw new Error("Quantity must be at least 1.");
    }
    const product = await ctx.db.get(args.productId);
    if (!product || !product.active) throw new Error("Product not found.");

    const list = args.listId
      ? await ctx.db.get(args.listId)
      : await ensureDraftList(ctx, userId);
    if (!list) throw new Error("List not found.");
    if (list.status !== "draft" && list.status !== "active") {
      throw new Error("Only draft or active lists can be edited.");
    }

    const existing = await ctx.db
      .query("procurementListItems")
      .withIndex("by_listId_productId", (q) =>
        q.eq("listId", list._id).eq("productId", args.productId),
      )
      .unique();

    if (existing) {
      if (existing.status !== "pending") {
        throw new Error("This product was already purchased on this list.");
      }
      await ctx.db.patch(existing._id, {
        quantity: existing.quantity + qty,
      });
    } else {
      const plannedCostMadCents = await defaultPlannedCostCents(ctx, product);
      await ctx.db.insert("procurementListItems", {
        listId: list._id,
        productId: args.productId,
        quantity: qty,
        status: "pending",
        ...(plannedCostMadCents !== null ? { plannedCostMadCents } : {}),
      });
    }

    const updated = await ctx.db.get(list._id);
    if (!updated) throw new Error("List not found.");
    return await toListView(ctx, updated);
  },
});

export const updateItemPlannedCost = mutation({
  args: {
    itemId: v.id("procurementListItems"),
    plannedCostMad: v.number(),
  },
  returns: procurementListView,
  handler: async (ctx, args) => {
    const item = await ctx.db.get(args.itemId);
    if (!item) throw new Error("Item not found.");
    if (item.status !== "pending") {
      throw new Error("Cannot change price for purchased items.");
    }
    const list = await ctx.db.get(item.listId);
    if (!list) throw new Error("List not found.");
    if (list.status === "draft") {
      await requireProcurementManage(ctx);
    } else if (list.status === "active") {
      await requireAnyPermission(ctx, [
        "procurement.manage",
        "procurement.fulfill",
        "stock.edit_products",
      ]);
    } else {
      throw new Error("List cannot be edited.");
    }

    const plannedCostMad = args.plannedCostMad;
    if (!Number.isFinite(plannedCostMad) || plannedCostMad < 0) {
      throw new Error("Planned price must be 0 or greater.");
    }

    await ctx.db.patch(args.itemId, {
      plannedCostMadCents:
        plannedCostMad > 0 ? clampPositiveCents(plannedCostMad) : undefined,
    });
    const updated = await ctx.db.get(list._id);
    if (!updated) throw new Error("List not found.");
    return await toListView(ctx, updated);
  },
});

export const removeItem = mutation({
  args: { itemId: v.id("procurementListItems") },
  returns: procurementListView,
  handler: async (ctx, args) => {
    const item = await ctx.db.get(args.itemId);
    if (!item) throw new Error("Item not found.");
    if (item.status !== "pending") {
      throw new Error("Cannot remove purchased items.");
    }
    const list = await ctx.db.get(item.listId);
    if (!list) throw new Error("List not found.");

    if (list.status === "draft") {
      await requireProcurementManage(ctx);
    } else if (list.status === "active") {
      await requireProcurementManage(ctx);
    } else {
      throw new Error("List cannot be edited.");
    }

    await ctx.db.delete(args.itemId);
    const updated = await ctx.db.get(list._id);
    if (!updated) throw new Error("List not found.");
    return await toListView(ctx, updated);
  },
});

export const updateItemQuantity = mutation({
  args: {
    itemId: v.id("procurementListItems"),
    quantity: v.number(),
  },
  returns: procurementListView,
  handler: async (ctx, args) => {
    const qty = Math.floor(args.quantity);
    if (!Number.isFinite(qty) || qty < 1) {
      throw new Error("Quantity must be at least 1.");
    }
    const item = await ctx.db.get(args.itemId);
    if (!item) throw new Error("Item not found.");
    if (item.status !== "pending") {
      throw new Error("Cannot change quantity for purchased items.");
    }
    const list = await ctx.db.get(item.listId);
    if (!list) throw new Error("List not found.");

    if (list.status === "draft") {
      await requireProcurementManage(ctx);
    } else if (list.status === "active") {
      await requireAnyPermission(ctx, [
        "procurement.manage",
        "procurement.fulfill",
        "stock.edit_products",
      ]);
    } else {
      throw new Error("List cannot be edited.");
    }

    await ctx.db.patch(args.itemId, { quantity: qty });
    const updated = await ctx.db.get(list._id);
    if (!updated) throw new Error("List not found.");
    return await toListView(ctx, updated);
  },
});

export const publishList = mutation({
  args: {
    title: v.optional(v.string()),
  },
  returns: procurementListView,
  handler: async (ctx, args) => {
    const { userId, user } = await requireProcurementManage(ctx);
    const list = await ensureDraftList(ctx, userId);
    const items = await loadListItems(ctx, list._id);
    if (items.length === 0) {
      throw new Error("Add at least one product before publishing.");
    }

    const priorActive = await findActiveList(ctx);
    if (priorActive) {
      const now = Date.now();
      await ctx.db.patch(priorActive._id, {
        status: "completed",
        completedAt: now,
      });
    }

    const now = Date.now();
    const title = args.title?.trim();
    await ctx.db.patch(list._id, {
      status: "active",
      publishedAt: now,
      ...(title ? { title } : {}),
    });

    const updated = await ctx.db.get(list._id);
    if (!updated) throw new Error("List not found.");
    await recordAuditForUser(ctx, userId, user, {
      action: "procurement.publishList",
      entityType: "procurement",
      entityId: list._id,
      summary: title ? `Bon d'achat publié: ${title}` : "Bon d'achat publié",
      payload: { itemCount: items.length, title: title ?? null },
      source: "manual",
    });
    return await toListView(ctx, updated);
  },
});

export const fulfillItem = mutation({
  args: {
    itemId: v.id("procurementListItems"),
    paidCostMad: v.number(),
  },
  returns: procurementListView,
  handler: async (ctx, args) => {
    const { userId, user } = await requirePermission(ctx, "procurement.fulfill");
    const item = await ctx.db.get(args.itemId);
    if (!item) throw new Error("Item not found.");
    if (item.status !== "pending") throw new Error("Item already purchased.");

    const list = await ctx.db.get(item.listId);
    if (!list || list.status !== "active") {
      throw new Error("List is not active.");
    }

    const paidCostMad = args.paidCostMad;
    if (!Number.isFinite(paidCostMad) || paidCostMad <= 0) {
      throw new Error("Paid price must be greater than 0.");
    }

    const product = await ctx.db.get(item.productId);
    if (!product) throw new Error("Product not found.");

    const now = Date.now();
    const paidCostMadCents = clampPositiveCents(paidCostMad);
    const newStockQty = product.stockQty + item.quantity;
    const stockLow = newStockQty > 0 && newStockQty <= 10;

    await ctx.db.patch(item._id, {
      status: "bought",
      paidCostMadCents,
      boughtAt: now,
      boughtByUserId: userId,
    });

    await ctx.db.patch(product._id, {
      costMadCents: paidCostMadCents,
      stockQty: newStockQty,
      stockLow,
      updatedAt: now,
    });

    await ctx.db.insert("productPriceHistory", {
      productId: product._id,
      kind: "purchase",
      amountMadCents: paidCostMadCents,
      recordedAt: now,
      recordedByUserId: userId,
      source: "procurement",
      quantity: item.quantity,
    });

    const updated = await ctx.db.get(list._id);
    if (!updated) throw new Error("List not found.");
    await recordAuditForUser(ctx, userId, user, {
      action: "procurement.fulfillItem",
      entityType: "procurement",
      entityId: list._id,
      summary: `Réception stock: ${product.name}`,
      payload: {
        itemId: item._id,
        productId: product._id,
        quantity: item.quantity,
        paidCostMad,
      },
      source: "manual",
    });
    return await toListView(ctx, updated);
  },
});

export const completeList = mutation({
  args: { listId: v.id("procurementLists") },
  returns: procurementListView,
  handler: async (ctx, args) => {
    await requireProcurementManage(ctx);
    const list = await ctx.db.get(args.listId);
    if (!list) throw new Error("List not found.");
    if (list.status !== "active") {
      throw new Error("Only active lists can be completed.");
    }
    const now = Date.now();
    await ctx.db.patch(list._id, {
      status: "completed",
      completedAt: now,
    });
    const updated = await ctx.db.get(list._id);
    if (!updated) throw new Error("List not found.");
    return await toListView(ctx, updated);
  },
});
