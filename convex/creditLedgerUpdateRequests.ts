import { v } from "convex/values";

import type { Id } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { query } from "./_generated/server";
import { requireAnyPermission } from "./authz";

const updateType = v.union(
  v.literal("return"),
  v.literal("replacement"),
  v.literal("price_change"),
  v.literal("reopen_in_caisse"),
);

const pendingRequestView = v.object({
  id: v.id("creditLedgerUpdateRequests"),
  updateType,
  reason: v.string(),
  requestedByUserName: v.string(),
  createdAt: v.number(),
});

export async function rejectPendingLedgerUpdateRequests(
  ctx: MutationCtx,
  ledgerEntryId: Id<"creditLedgerEntries">,
) {
  const pending = await ctx.db
    .query("creditLedgerUpdateRequests")
    .withIndex("by_ledgerEntryId", (q) => q.eq("ledgerEntryId", ledgerEntryId))
    .filter((q) => q.eq(q.field("status"), "pending"))
    .collect();
  for (const request of pending) {
    await ctx.db.patch(request._id, { status: "rejected" });
  }
}

export const pendingForLedgerEntry = query({
  args: { ledgerEntryId: v.id("creditLedgerEntries") },
  returns: v.union(v.null(), pendingRequestView),
  handler: async (ctx, args) => {
    await requireAnyPermission(ctx, [
      "sales.create",
      "credits.collect",
      "credits.approve",
    ]);
    const pending = await ctx.db
      .query("creditLedgerUpdateRequests")
      .withIndex("by_ledgerEntryId", (q) =>
        q.eq("ledgerEntryId", args.ledgerEntryId),
      )
      .filter((q) => q.eq(q.field("status"), "pending"))
      .first();
    if (!pending) return null;
    return {
      id: pending._id,
      updateType: pending.updateType,
      reason: pending.reason,
      requestedByUserName: pending.requestedByUserName,
      createdAt: pending.createdAt,
    };
  },
});
