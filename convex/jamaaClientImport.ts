import { v } from "convex/values";

import { internalMutation } from "./_generated/server";
import { madToCents } from "./money";

const clientRow = v.object({
  /** Stable id from import, e.g. `jamaa-client:12` */
  legacyId: v.string(),
  fullName: v.string(),
  phone: v.string(),
  /** Same sign as UI solde: negative = dette, positive = avoir. */
  initialSoldeMad: v.number(),
  isCashOnly: v.optional(v.boolean()),
  creditLimitMad: v.optional(v.union(v.number(), v.null())),
});

/**
 * Upserts Jamaa legacy clients by `legacyId`.
 * Solde from export is stored as `initialSoldeMadCents`.
 */
export const importBatch = internalMutation({
  args: {
    clients: v.array(clientRow),
  },
  returns: v.object({
    processed: v.number(),
    inserted: v.number(),
    updated: v.number(),
    skipped: v.number(),
  }),
  handler: async (ctx, args) => {
    const now = Date.now();
    let inserted = 0;
    let updated = 0;
    let skipped = 0;

    for (const row of args.clients) {
      const legacyId = row.legacyId.trim();
      const fullName = row.fullName.trim().replace(/\s+/g, " ");
      const phone = row.phone.trim().replace(/\s+/g, " ");
      if (!legacyId || !fullName || !phone) {
        skipped += 1;
        continue;
      }

      const isCashOnly = row.isCashOnly === true;
      const creditLimitMadCents =
        isCashOnly || row.creditLimitMad === null || row.creditLimitMad === undefined
          ? null
          : madToCents(Math.max(0, row.creditLimitMad));
      const initialSoldeMadCents = madToCents(
        Number.isFinite(row.initialSoldeMad) ? row.initialSoldeMad : 0,
      );

      const existing = await ctx.db
        .query("clients")
        .withIndex("by_legacyId", (q) => q.eq("legacyId", legacyId))
        .unique();

      if (existing) {
        const same =
          existing.fullName === fullName &&
          existing.phone === phone &&
          existing.isCashOnly === isCashOnly &&
          (existing.creditLimitMadCents ?? null) === creditLimitMadCents &&
          (existing.initialSoldeMadCents ?? 0) === initialSoldeMadCents;
        if (same) {
          skipped += 1;
          continue;
        }
        await ctx.db.patch(existing._id, {
          fullName,
          phone,
          isCashOnly,
          creditLimitMadCents,
          initialSoldeMadCents,
          updatedAt: now,
        });
        updated += 1;
        continue;
      }

      await ctx.db.insert("clients", {
        legacyId,
        fullName,
        phone,
        isCashOnly,
        creditLimitMadCents,
        initialSoldeMadCents,
        createdAt: now,
        updatedAt: now,
      });
      inserted += 1;
    }

    return {
      processed: args.clients.length,
      inserted,
      updated,
      skipped,
    };
  },
});
