import { v } from "convex/values";

import { mutation, query } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import type { QueryCtx } from "./_generated/server";
import { requireAnyPermission, requirePermission, hasAnyPermission } from "./authz";
import { centsToMad, madToCents } from "./money";
import { normalizeCheckoutQty } from "./posQty";

const paymentType = v.union(v.literal("cash"), v.literal("credit"));

const draftLineInput = v.object({
  productId: v.optional(v.id("products")),
  name: v.string(),
  unitPriceMad: v.number(),
  qty: v.number(),
  image: v.optional(v.string()),
  imageAlt: v.optional(v.string()),
  soldByWeight: v.optional(v.boolean()),
});

const draftLineView = v.object({
  productId: v.union(v.id("products"), v.null()),
  name: v.string(),
  unitPriceMad: v.number(),
  qty: v.number(),
  image: v.union(v.string(), v.null()),
  imageAlt: v.union(v.string(), v.null()),
  soldByWeight: v.boolean(),
});

const draftView = v.object({
  id: v.id("posCartDrafts"),
  label: v.string(),
  payment: paymentType,
  clientId: v.union(v.id("clients"), v.null()),
  clientNameSnapshot: v.union(v.string(), v.null()),
  lines: v.array(draftLineView),
  totalMad: v.number(),
  itemCount: v.number(),
  createdByUserName: v.union(v.string(), v.null()),
  parkedByAssist: v.boolean(),
  createdAt: v.string(),
  updatedAt: v.string(),
});

const restoredDraftView = v.object({
  label: v.string(),
  payment: paymentType,
  clientId: v.union(v.id("clients"), v.null()),
  clientNameSnapshot: v.union(v.string(), v.null()),
  lines: v.array(draftLineView),
  totalMad: v.number(),
  itemCount: v.number(),
});

function normalizeLines(
  lines: Array<{
    productId?: Id<"products">;
    name: string;
    unitPriceMad: number;
    qty: number;
    image?: string;
    imageAlt?: string;
    soldByWeight?: boolean;
  }>,
  soldByWeightByProduct: Map<Id<"products">, boolean>,
) {
  if (lines.length === 0) throw new Error("Cart is empty.");
  const normalized = lines.map((line) => {
    const soldByWeight =
      line.soldByWeight === true ||
      (line.productId
        ? soldByWeightByProduct.get(line.productId) === true
        : false);
    const qty = normalizeCheckoutQty(line.qty, soldByWeight);
    const unitPriceMadCents = madToCents(line.unitPriceMad);
    if (unitPriceMadCents <= 0) {
      throw new Error(`Invalid unit price for ${line.name}.`);
    }
    return {
      ...(line.productId ? { productId: line.productId } : {}),
      name: line.name.trim() || "Article",
      unitPriceMadCents,
      qty,
      ...(line.image ? { image: line.image } : {}),
      ...(line.imageAlt ? { imageAlt: line.imageAlt } : {}),
      ...(soldByWeight ? { soldByWeight: true } : {}),
    };
  });
  const totalMadCents = normalized.reduce(
    (sum, line) => sum + Math.round(line.unitPriceMadCents * line.qty),
    0,
  );
  const itemCount = normalized.reduce((sum, line) => sum + line.qty, 0);
  return { normalized, totalMadCents, itemCount };
}

function userDisplayName(user: {
  name?: string;
  email?: string;
} | null) {
  return user?.name?.trim() || user?.email?.trim() || null;
}

async function resolveCreatedByUserName(
  ctx: QueryCtx,
  draft: Doc<"posCartDrafts">,
) {
  const snapshot = draft.createdByUserName?.trim();
  if (snapshot) return snapshot;
  const creator = await ctx.db.get(draft.createdByUserId);
  return userDisplayName(creator);
}

function isAssistDraft(draft: Doc<"posCartDrafts">) {
  if (draft.parkedByAssist === true) return true;
  if (draft.parkedByAssist === false) return false;
  return (
    draft.label.startsWith("En attente caissier") ||
    draft.label.startsWith("بانتظار الصندوق")
  );
}

function assistParkLabel(
  clientNameSnapshot: string | undefined,
  createdByUserName: string | null,
) {
  if (clientNameSnapshot?.trim()) return clientNameSnapshot.trim();
  return createdByUserName ?? "Aide caissier";
}

function formatAssistDraftDisplayLabel(
  draft: Doc<"posCartDrafts">,
  createdByUserName: string | null,
) {
  const clientName = draft.clientNameSnapshot?.trim();
  if (clientName) return clientName;

  for (const prefix of ["En attente caissier · ", "بانتظار الصندوق · "]) {
    if (draft.label.startsWith(prefix)) {
      const name = draft.label.slice(prefix.length).trim();
      if (name) return name;
    }
  }

  if (
    draft.label === "En attente caissier" ||
    draft.label === "بانتظار الصندوق"
  ) {
    return createdByUserName ?? draft.label;
  }

  return draft.label;
}

async function toDraftView(ctx: QueryCtx, draft: Doc<"posCartDrafts">) {
  const createdByUserName = await resolveCreatedByUserName(ctx, draft);
  const parkedByAssist = isAssistDraft(draft);
  return {
    id: draft._id,
    label: parkedByAssist
      ? formatAssistDraftDisplayLabel(draft, createdByUserName)
      : draft.label,
    payment: draft.payment,
    clientId: draft.clientId ?? null,
    clientNameSnapshot: draft.clientNameSnapshot ?? null,
    lines: draft.lines.map((line) => ({
      productId: line.productId ?? null,
      name: line.name,
      unitPriceMad: centsToMad(line.unitPriceMadCents),
      qty: line.qty,
      image: line.image ?? null,
      imageAlt: line.imageAlt ?? null,
      soldByWeight: line.soldByWeight === true,
    })),
    totalMad: centsToMad(draft.totalMadCents),
    itemCount: draft.itemCount,
    createdByUserName,
    parkedByAssist,
    createdAt: new Date(draft.createdAt).toISOString(),
    updatedAt: new Date(draft.updatedAt).toISOString(),
  };
}

function toRestoredView(draft: Doc<"posCartDrafts">) {
  return {
    label: draft.label,
    payment: draft.payment,
    clientId: draft.clientId ?? null,
    clientNameSnapshot: draft.clientNameSnapshot ?? null,
    lines: draft.lines.map((line) => ({
      productId: line.productId ?? null,
      name: line.name,
      unitPriceMad: centsToMad(line.unitPriceMadCents),
      qty: line.qty,
      image: line.image ?? null,
      imageAlt: line.imageAlt ?? null,
      soldByWeight: line.soldByWeight === true,
    })),
    totalMad: centsToMad(draft.totalMadCents),
    itemCount: draft.itemCount,
  };
}

export const list = query({
  args: {},
  returns: v.array(draftView),
  handler: async (ctx) => {
    await requirePermission(ctx, "sales.view");
    const rows = await ctx.db
      .query("posCartDrafts")
      .withIndex("by_updatedAt")
      .order("desc")
      .collect();
    return Promise.all(rows.map((draft) => toDraftView(ctx, draft)));
  },
});

export const park = mutation({
  args: {
    label: v.optional(v.string()),
    payment: paymentType,
    clientId: v.optional(v.id("clients")),
    clientNameSnapshot: v.optional(v.string()),
    lines: v.array(draftLineInput),
  },
  returns: draftView,
  handler: async (ctx, args) => {
    const { userId } = await requireAnyPermission(ctx, [
      "sales.park_cart",
      "sales.create",
    ]);
    const soldByWeightByProduct = new Map<Id<"products">, boolean>();
    for (const line of args.lines) {
      if (!line.productId) continue;
      const product = await ctx.db.get(line.productId);
      soldByWeightByProduct.set(
        line.productId,
        line.soldByWeight === true || product?.soldByWeight === true,
      );
    }
    const { normalized, totalMadCents, itemCount } = normalizeLines(
      args.lines,
      soldByWeightByProduct,
    );

    let clientNameSnapshot = args.clientNameSnapshot?.trim() || undefined;
    if (args.clientId) {
      const client = await ctx.db.get(args.clientId);
      if (!client) throw new Error("Client not found.");
      clientNameSnapshot = client.fullName;
    }

    const creator = await ctx.db.get(userId);
    const createdByUserName = userDisplayName(creator);
    const parkedByAssist = !(await hasAnyPermission(ctx, ["sales.create"]));

    const label = parkedByAssist
      ? assistParkLabel(clientNameSnapshot, createdByUserName)
      : args.label?.trim() ||
        clientNameSnapshot ||
        `${normalized[0]?.name ?? "Panier"} · ${itemCount} art.`;

    const now = Date.now();
    const id = await ctx.db.insert("posCartDrafts", {
      createdByUserId: userId,
      ...(createdByUserName ? { createdByUserName } : {}),
      parkedByAssist,
      label,
      payment: args.payment,
      ...(args.clientId ? { clientId: args.clientId } : {}),
      ...(clientNameSnapshot ? { clientNameSnapshot } : {}),
      lines: normalized,
      totalMadCents,
      itemCount,
      createdAt: now,
      updatedAt: now,
    });
    const draft = await ctx.db.get(id);
    if (!draft) throw new Error("Failed to save cart draft.");
    return await toDraftView(ctx, draft);
  },
});

export const restore = mutation({
  args: { draftId: v.id("posCartDrafts") },
  returns: restoredDraftView,
  handler: async (ctx, args) => {
    await requirePermission(ctx, "sales.create");
    const draft = await ctx.db.get(args.draftId);
    if (!draft) throw new Error("Draft not found.");
    const payload = toRestoredView(draft);
    await ctx.db.delete(args.draftId);
    return payload;
  },
});

export const remove = mutation({
  args: { draftId: v.id("posCartDrafts") },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requirePermission(ctx, "sales.create");
    const draft = await ctx.db.get(args.draftId);
    if (!draft) throw new Error("Draft not found.");
    await ctx.db.delete(args.draftId);
    return null;
  },
});
