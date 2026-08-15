import { v } from "convex/values";

import type { Doc } from "./_generated/dataModel";
import { mutation, query } from "./_generated/server";
import { recordAuditForUser } from "./audit";
import { requireAnyPermission, requirePermission } from "./authz";

const brandView = v.object({
  id: v.id("brands"),
  name: v.string(),
  logo: v.string(),
  logoAlt: v.string(),
  sortOrder: v.number(),
  active: v.boolean(),
});

function normalizeBrandName(raw: string): string {
  return raw.trim().replace(/\s+/g, " ");
}

function toBrandView(brand: Doc<"brands">) {
  return {
    id: brand._id,
    name: brand.name,
    logo: brand.logoUrl,
    logoAlt: brand.logoAlt,
    sortOrder: brand.sortOrder,
    active: brand.active,
  };
}

export const list = query({
  args: {},
  returns: v.array(brandView),
  handler: async (ctx) => {
    await requireAnyPermission(ctx, ["stock.view", "stock.edit_products"]);
    const rows = await ctx.db.query("brands").collect();
    return rows
      .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name, "fr"))
      .map(toBrandView);
  },
});

export const listActive = query({
  args: {},
  returns: v.array(brandView),
  handler: async (ctx) => {
    await requireAnyPermission(ctx, [
      "stock.view",
      "stock.edit_products",
      "sales.create",
      "sales.assist_cart",
    ]);
    const rows = await ctx.db
      .query("brands")
      .withIndex("by_active_sortOrder", (q) => q.eq("active", true))
      .collect();
    return rows
      .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name, "fr"))
      .map(toBrandView);
  },
});

export const create = mutation({
  args: {
    name: v.string(),
    logo: v.string(),
    logoAlt: v.optional(v.string()),
  },
  returns: brandView,
  handler: async (ctx, args) => {
    const { userId, user } = await requirePermission(ctx, "stock.edit_products");
    const name = normalizeBrandName(args.name);
    if (!name) throw new Error("Brand name is required.");
    if (!args.logo.trim()) throw new Error("Brand logo is required.");

    const normalizedName = name.toLowerCase();
    const existing = await ctx.db
      .query("brands")
      .withIndex("by_normalizedName", (q) => q.eq("normalizedName", normalizedName))
      .first();
    if (existing) throw new Error("Brand already exists.");

    const all = await ctx.db.query("brands").collect();
    const sortOrder =
      all.length === 0 ? 0 : Math.max(...all.map((row) => row.sortOrder)) + 1;
    const now = Date.now();

    const brandId = await ctx.db.insert("brands", {
      name,
      normalizedName,
      logoUrl: args.logo,
      logoAlt: args.logoAlt?.trim() || name,
      sortOrder,
      active: true,
      createdAt: now,
      updatedAt: now,
    });
    const brand = await ctx.db.get(brandId);
    if (!brand) throw new Error("Brand creation failed.");
    await recordAuditForUser(ctx, userId, user, {
      action: "brands.create",
      entityType: "brand",
      entityId: brandId,
      summary: `Marque créée: ${name}`,
      source: "manual",
    });
    return toBrandView(brand);
  },
});

export const update = mutation({
  args: {
    brandId: v.id("brands"),
    name: v.string(),
    logo: v.string(),
    logoAlt: v.optional(v.string()),
    active: v.optional(v.boolean()),
  },
  returns: brandView,
  handler: async (ctx, args) => {
    const { userId, user } = await requirePermission(ctx, "stock.edit_products");
    const brand = await ctx.db.get(args.brandId);
    if (!brand) throw new Error("Brand not found.");

    const name = normalizeBrandName(args.name);
    if (!name) throw new Error("Brand name is required.");
    if (!args.logo.trim()) throw new Error("Brand logo is required.");

    const normalizedName = name.toLowerCase();
    const existing = await ctx.db
      .query("brands")
      .withIndex("by_normalizedName", (q) => q.eq("normalizedName", normalizedName))
      .first();
    if (existing && existing._id !== args.brandId) {
      throw new Error("Brand already exists.");
    }

    await ctx.db.patch(args.brandId, {
      name,
      normalizedName,
      logoUrl: args.logo,
      logoAlt: args.logoAlt?.trim() || name,
      ...(typeof args.active === "boolean" ? { active: args.active } : {}),
      updatedAt: Date.now(),
    });
    const updated = await ctx.db.get(args.brandId);
    if (!updated) throw new Error("Brand not found.");
    await recordAuditForUser(ctx, userId, user, {
      action: "brands.update",
      entityType: "brand",
      entityId: args.brandId,
      summary: `Marque modifiée: ${name}`,
      source: "manual",
    });
    return toBrandView(updated);
  },
});

export const remove = mutation({
  args: { brandId: v.id("brands") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { userId, user } = await requirePermission(ctx, "stock.edit_products");
    const brand = await ctx.db.get(args.brandId);
    if (!brand) throw new Error("Brand not found.");
    await ctx.db.patch(args.brandId, {
      active: false,
      updatedAt: Date.now(),
    });
    await recordAuditForUser(ctx, userId, user, {
      action: "brands.delete",
      entityType: "brand",
      entityId: args.brandId,
      summary: `Marque désactivée: ${brand.name}`,
      source: "manual",
    });
    return null;
  },
});
