import { v } from "convex/values";

import { query } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import type { MutationCtx } from "./_generated/server";
import { requirePermission } from "./authz";

const auditEventView = v.object({
  id: v.id("auditEvents"),
  createdAt: v.number(),
  actorUserId: v.union(v.id("users"), v.null()),
  actorUserName: v.string(),
  action: v.string(),
  entityType: v.string(),
  entityId: v.union(v.string(), v.null()),
  summary: v.string(),
  payloadJson: v.union(v.string(), v.null()),
  source: v.union(v.string(), v.null()),
});

export type AuditEventInput = {
  actorUserId?: Id<"users"> | null;
  actorUserName: string;
  action: string;
  entityType: string;
  entityId?: string | null;
  summary: string;
  payload?: unknown;
  source?: string | null;
  createdAt?: number;
};

function toView(doc: Doc<"auditEvents">) {
  return {
    id: doc._id,
    createdAt: doc.createdAt,
    actorUserId: doc.actorUserId ?? null,
    actorUserName: doc.actorUserName,
    action: doc.action,
    entityType: doc.entityType,
    entityId: doc.entityId ?? null,
    summary: doc.summary,
    payloadJson: doc.payloadJson ?? null,
    source: doc.source ?? null,
  };
}

function actorDisplayName(user: {
  name?: string | null;
  email?: string | null;
}): string {
  const name = user.name?.trim();
  if (name) return name;
  const email = user.email?.trim();
  if (email) return email;
  return "Utilisateur";
}

/** Best-effort audit write — never breaks the parent mutation. */
export async function recordAuditEvent(
  ctx: MutationCtx,
  input: AuditEventInput,
): Promise<void> {
  try {
    let payloadJson: string | undefined;
    if (input.payload !== undefined) {
      try {
        payloadJson = JSON.stringify(input.payload);
      } catch {
        payloadJson = undefined;
      }
      if (payloadJson && payloadJson.length > 80_000) {
        payloadJson = JSON.stringify({
          truncated: true,
          preview: payloadJson.slice(0, 4_000),
        });
      }
    }

    await ctx.db.insert("auditEvents", {
      createdAt: input.createdAt ?? Date.now(),
      actorUserId: input.actorUserId ?? undefined,
      actorUserName: input.actorUserName.trim() || "Utilisateur",
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId ?? undefined,
      summary: input.summary.trim() || input.action,
      payloadJson,
      source: input.source ?? undefined,
    });
  } catch (error) {
    console.error("audit.recordAuditEvent failed", error);
  }
}

export async function recordAuditForUser(
  ctx: MutationCtx,
  userId: Id<"users">,
  user: { name?: string | null; email?: string | null },
  input: Omit<AuditEventInput, "actorUserId" | "actorUserName">,
): Promise<void> {
  await recordAuditEvent(ctx, {
    ...input,
    actorUserId: userId,
    actorUserName: actorDisplayName(user),
  });
}

function startOfDayMs(isoDate: string): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) return null;
  const ms = Date.parse(`${isoDate}T00:00:00.000Z`);
  return Number.isFinite(ms) ? ms : null;
}

function endOfDayMs(isoDate: string): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) return null;
  const ms = Date.parse(`${isoDate}T23:59:59.999Z`);
  return Number.isFinite(ms) ? ms : null;
}

export const list = query({
  args: {
    limit: v.optional(v.number()),
    dateFrom: v.optional(v.string()),
    dateTo: v.optional(v.string()),
    entityType: v.optional(v.string()),
    action: v.optional(v.string()),
    search: v.optional(v.string()),
  },
  returns: v.array(auditEventView),
  handler: async (ctx, args) => {
    await requirePermission(ctx, "admin.view_audit");
    const limit = Math.min(Math.max(args.limit ?? 200, 1), 500);
    const fromMs = args.dateFrom ? startOfDayMs(args.dateFrom) : null;
    const toMs = args.dateTo ? endOfDayMs(args.dateTo) : null;
    const entityType = args.entityType?.trim() || null;
    const action = args.action?.trim() || null;
    const search = args.search?.trim().toLowerCase() || null;

    // Fetch a wider window when filtering, then trim to limit.
    const fetchLimit = search || entityType || action || fromMs || toMs
      ? Math.min(limit * 5, 2000)
      : limit;

    const rows = await ctx.db
      .query("auditEvents")
      .withIndex("by_createdAt")
      .order("desc")
      .take(fetchLimit);

    const filtered = rows.filter((row) => {
      if (fromMs != null && row.createdAt < fromMs) return false;
      if (toMs != null && row.createdAt > toMs) return false;
      if (entityType && row.entityType !== entityType) return false;
      if (action && row.action !== action) return false;
      if (search) {
        const hay = [
          row.summary,
          row.actorUserName,
          row.action,
          row.entityType,
          row.entityId ?? "",
          row.source ?? "",
        ]
          .join(" ")
          .toLowerCase();
        if (!hay.includes(search)) return false;
      }
      return true;
    });

    return filtered.slice(0, limit).map(toView);
  },
});

export const listEntityTypes = query({
  args: {},
  returns: v.array(v.string()),
  handler: async (ctx) => {
    await requirePermission(ctx, "admin.view_audit");
    const rows = await ctx.db
      .query("auditEvents")
      .withIndex("by_createdAt")
      .order("desc")
      .take(1000);
    const set = new Set<string>();
    for (const row of rows) set.add(row.entityType);
    return [...set].sort((a, b) => a.localeCompare(b, "fr"));
  },
});
