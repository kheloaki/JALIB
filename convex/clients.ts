import { paginationOptsValidator } from "convex/server";
import { v } from "convex/values";

import { mutation, query } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { recordAuditForUser } from "./audit";
import { requireAnyPermission, requirePermission } from "./authz";
import { rankClientSearchResults } from "./clientSearch";
import { deleteClientCascade } from "./deleteCascade";
import { centsToMad, madToCents } from "./money";

const clientView = v.object({
  id: v.id("clients"),
  fullName: v.string(),
  phone: v.string(),
  isCashOnly: v.boolean(),
  creditLimitMad: v.union(v.number(), v.null()),
  /** Positive = avoir; negative = dette. */
  initialSoldeMad: v.number(),
});

function toClientView(client: Doc<"clients">) {
  return {
    id: client._id,
    fullName: client.fullName,
    phone: client.phone,
    isCashOnly: client.isCashOnly,
    creditLimitMad:
      client.creditLimitMadCents === null
        ? null
        : centsToMad(client.creditLimitMadCents),
    initialSoldeMad: centsToMad(client.initialSoldeMadCents ?? 0),
  };
}

function normalizeInitialSoldeMad(amountMad: number | undefined): number {
  if (amountMad === undefined || !Number.isFinite(amountMad)) return 0;
  return madToCents(amountMad);
}

function looksLikePhoneQuery(raw: string): boolean {
  const digits = raw.replace(/\D/g, "");
  return digits.length >= 3;
}

/**
 * @deprecated Prefer listSummaries / searchSummaries. Cap kept for transition.
 */
export const list = query({
  args: {},
  returns: v.array(clientView),
  handler: async (ctx) => {
    await requireAnyPermission(ctx, ["clients.view", "clients.manage"]);
    const clients = await ctx.db
      .query("clients")
      .withIndex("by_fullName")
      .take(8000);
    return clients.map(toClientView);
  },
});

/** Paginated client admin list (50–100/page). */
export const listSummaries = query({
  args: {
    paginationOpts: paginationOptsValidator,
  },
  returns: v.object({
    page: v.array(clientView),
    isDone: v.boolean(),
    continueCursor: v.string(),
  }),
  handler: async (ctx, args) => {
    await requireAnyPermission(ctx, [
      "clients.view",
      "clients.manage",
      "credits.view",
      "credits.collect",
      "credits.approve",
    ]);
    const numItems = Math.min(Math.max(args.paginationOpts.numItems, 1), 100);
    const result = await ctx.db
      .query("clients")
      .withIndex("by_fullName")
      .order("asc")
      .paginate({ ...args.paginationOpts, numItems });
    return {
      page: result.page.map(toClientView),
      isDone: result.isDone,
      continueCursor: result.continueCursor,
    };
  },
});

/**
 * Full summary list for admin table sorting (name / type / solde / plafond).
 * Bounded — designed for ~1–2k clients; UI still windows rows after sort.
 */
export const listAllSummaries = query({
  args: { limit: v.optional(v.number()) },
  returns: v.array(clientView),
  handler: async (ctx, args) => {
    await requireAnyPermission(ctx, [
      "clients.view",
      "clients.manage",
      "credits.view",
      "credits.collect",
      "credits.approve",
    ]);
    const limit = Math.min(Math.max(args.limit ?? 8000, 1), 8000);
    const rows = await ctx.db
      .query("clients")
      .withIndex("by_fullName")
      .order("asc")
      .take(limit);
    return rows.map(toClientView);
  },
});

/** Server search by name and/or phone (min 2 chars). */
export const searchSummaries = query({
  args: {
    query: v.string(),
    limit: v.optional(v.number()),
  },
  returns: v.array(clientView),
  handler: async (ctx, args) => {
    await requireAnyPermission(ctx, [
      "clients.view",
      "clients.manage",
      "credits.view",
      "credits.collect",
      "credits.approve",
      "sales.view",
      "sales.create",
      "sales.assist_cart",
    ]);
    const searchText = args.query.trim();
    if (searchText.length < 2) return [];
    const limit = Math.min(Math.max(args.limit ?? 40, 1), 80);
    const candidateLimit = Math.min(limit * 3, 120);

    const merged = new Map<string, Doc<"clients">>();
    const nameQueries = new Set<string>([searchText]);
    for (const token of searchText.split(/\s+/)) {
      const t = token.trim();
      if (t.length >= 2) nameQueries.add(t);
    }

    for (const nameQuery of nameQueries) {
      const byName = await ctx.db
        .query("clients")
        .withSearchIndex("search_fullName", (q) =>
          q.search("fullName", nameQuery),
        )
        .take(candidateLimit);
      for (const client of byName) merged.set(client._id, client);
    }

    if (looksLikePhoneQuery(searchText)) {
      const byPhone = await ctx.db
        .query("clients")
        .withSearchIndex("search_phone", (q) => q.search("phone", searchText))
        .take(candidateLimit);
      for (const client of byPhone) merged.set(client._id, client);
    }

    const ranked = rankClientSearchResults(
      [...merged.values()],
      searchText,
      limit,
    );
    return ranked.map(toClientView);
  },
});

/** Recently updated clients for POS empty-state suggestions. */
export const listRecent = query({
  args: { limit: v.optional(v.number()) },
  returns: v.array(clientView),
  handler: async (ctx, args) => {
    await requireAnyPermission(ctx, [
      "clients.view",
      "clients.manage",
      "sales.view",
      "sales.create",
      "sales.assist_cart",
    ]);
    const limit = Math.min(Math.max(args.limit ?? 30, 1), 50);
    const clients = await ctx.db
      .query("clients")
      .withIndex("by_updatedAt")
      .order("desc")
      .take(limit);
    return clients.map(toClientView);
  },
});

export const countAll = query({
  args: {},
  returns: v.number(),
  handler: async (ctx) => {
    await requireAnyPermission(ctx, [
      "clients.view",
      "clients.manage",
      "credits.view",
      "credits.collect",
      "credits.approve",
    ]);
    const clients = await ctx.db
      .query("clients")
      .withIndex("by_fullName")
      .take(8000);
    return clients.length;
  },
});

/**
 * Clients with opening dette (initialSolde < 0) for the Crédits list.
 * Bounded scan — fine at ~1–2k clients; replace with an index if this grows.
 */
export const listWithOpeningDebt = query({
  args: { limit: v.optional(v.number()) },
  returns: v.array(clientView),
  handler: async (ctx, args) => {
    await requireAnyPermission(ctx, [
      "clients.view",
      "clients.manage",
      "credits.view",
      "credits.collect",
      "credits.approve",
    ]);
    const limit = Math.min(Math.max(args.limit ?? 2000, 1), 4000);
    const rows = await ctx.db
      .query("clients")
      .withIndex("by_fullName")
      .take(limit);
    return rows
      .filter((client) => (client.initialSoldeMadCents ?? 0) < 0)
      .map(toClientView)
      .sort((a, b) => a.initialSoldeMad - b.initialSoldeMad);
  },
});

/** Point lookups for alerts / invoice WhatsApp — never full table. */
export const getMany = query({
  args: { clientIds: v.array(v.id("clients")) },
  returns: v.array(clientView),
  handler: async (ctx, args) => {
    await requireAnyPermission(ctx, [
      "clients.view",
      "clients.manage",
      "alerts.view",
      "sales.view",
      "sales.create",
      "sales.assist_cart",
      "credits.view",
      "credits.collect",
      "credits.approve",
    ]);
    const unique = [...new Set(args.clientIds)].slice(0, 500);
    const out: ReturnType<typeof toClientView>[] = [];
    for (const id of unique) {
      const client = await ctx.db.get(id);
      if (client) out.push(toClientView(client));
    }
    return out;
  },
});

export const findByFullName = query({
  args: { fullName: v.string() },
  returns: v.union(clientView, v.null()),
  handler: async (ctx, args) => {
    await requireAnyPermission(ctx, [
      "clients.view",
      "clients.manage",
      "sales.view",
    ]);
    const fullName = args.fullName.trim();
    if (!fullName) return null;
    const client = await ctx.db
      .query("clients")
      .withIndex("by_fullName", (q) => q.eq("fullName", fullName))
      .first();
    return client ? toClientView(client) : null;
  },
});

export const get = query({
  args: { clientId: v.string() },
  returns: v.union(clientView, v.null()),
  handler: async (ctx, args) => {
    await requireAnyPermission(ctx, [
      "clients.view",
      "clients.manage",
      "sales.view",
      "sales.create",
      "sales.assist_cart",
    ]);
    // Stale localStorage / drafts may hold IDs from other tables (e.g. authVerifiers).
    const clientId = ctx.db.normalizeId("clients", args.clientId);
    if (!clientId) return null;
    const client = await ctx.db.get(clientId);
    return client ? toClientView(client) : null;
  },
});

export const create = mutation({
  args: {
    fullName: v.string(),
    phone: v.string(),
    isCashOnly: v.boolean(),
    creditLimitMad: v.union(v.number(), v.null()),
    initialSoldeMad: v.optional(v.number()),
  },
  returns: clientView,
  handler: async (ctx, args) => {
    const { userId, user } = await requirePermission(ctx, "clients.manage");
    const now = Date.now();
    const fullName = args.fullName.trim();
    const phone = args.phone.trim();
    if (!fullName) throw new Error("Client name is required.");
    if (!phone) throw new Error("Client phone is required.");
    const id = await ctx.db.insert("clients", {
      fullName,
      phone,
      isCashOnly: args.isCashOnly,
      creditLimitMadCents:
        args.isCashOnly || args.creditLimitMad === null
          ? null
          : madToCents(Math.max(0, args.creditLimitMad)),
      initialSoldeMadCents: normalizeInitialSoldeMad(args.initialSoldeMad),
      createdAt: now,
      updatedAt: now,
    });
    const client = await ctx.db.get(id);
    if (!client) throw new Error("Client creation failed.");
    await recordAuditForUser(ctx, userId, user, {
      action: "clients.create",
      entityType: "client",
      entityId: id,
      summary: `Client créé: ${fullName}`,
      payload: {
        fullName,
        phone,
        isCashOnly: args.isCashOnly,
        creditLimitMad: args.creditLimitMad,
      },
      source: "manual",
    });
    return toClientView(client);
  },
});

export const update = mutation({
  args: {
    clientId: v.id("clients"),
    fullName: v.string(),
    phone: v.string(),
    isCashOnly: v.boolean(),
    creditLimitMad: v.union(v.number(), v.null()),
    initialSoldeMad: v.optional(v.number()),
  },
  returns: clientView,
  handler: async (ctx, args) => {
    const { userId, user } = await requirePermission(ctx, "clients.manage");
    const fullName = args.fullName.trim();
    const phone = args.phone.trim();
    if (!fullName) throw new Error("Client name is required.");
    if (!phone) throw new Error("Client phone is required.");
    await ctx.db.patch(args.clientId, {
      fullName,
      phone,
      isCashOnly: args.isCashOnly,
      creditLimitMadCents:
        args.isCashOnly || args.creditLimitMad === null
          ? null
          : madToCents(Math.max(0, args.creditLimitMad)),
      initialSoldeMadCents: normalizeInitialSoldeMad(args.initialSoldeMad),
      updatedAt: Date.now(),
    });
    const client = await ctx.db.get(args.clientId);
    if (!client) throw new Error("Client not found.");
    await recordAuditForUser(ctx, userId, user, {
      action: "clients.update",
      entityType: "client",
      entityId: args.clientId,
      summary: `Client modifié: ${fullName}`,
      payload: {
        fullName,
        phone,
        isCashOnly: args.isCashOnly,
        creditLimitMad: args.creditLimitMad,
      },
      source: "manual",
    });
    return toClientView(client);
  },
});

export const remove = mutation({
  args: { clientId: v.id("clients") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { userId, user } = await requirePermission(ctx, "clients.delete");
    const client = await ctx.db.get(args.clientId);
    if (!client) throw new Error("Client not found.");
    await deleteClientCascade(ctx, args.clientId);
    await recordAuditForUser(ctx, userId, user, {
      action: "clients.delete",
      entityType: "client",
      entityId: args.clientId,
      summary: `Client supprimé: ${client.fullName}`,
      payload: { fullName: client.fullName, phone: client.phone },
      source: "manual",
    });
    return null;
  },
});
