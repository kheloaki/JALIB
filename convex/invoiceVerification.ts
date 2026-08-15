import { v } from "convex/values";

import { mutation, query } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { requirePermission } from "./authz";
import {
  resolveCreditInvoiceDisplayStatus,
} from "./invoiceCreditAdjustments";
import { centsToMad } from "./money";

const invoiceStatus = v.union(
  v.literal("paid"),
  v.literal("pending"),
  v.literal("returned"),
);

const verificationMethod = v.union(
  v.literal("barcode_scan"),
  v.literal("manual"),
);

export const creditInvoiceVerificationView = v.object({
  id: v.id("invoices"),
  number: v.string(),
  barcode: v.string(),
  date: v.string(),
  time: v.string(),
  clientName: v.string(),
  clientId: v.optional(v.id("clients")),
  totalMad: v.number(),
  status: invoiceStatus,
  verifiedAt: v.optional(v.number()),
  verifiedByUserName: v.optional(v.string()),
  verificationMethod: v.optional(verificationMethod),
});

function normalizeBarcode(raw: string): string {
  return raw.replace(/\D/g, "");
}

function isVerified(invoice: Doc<"invoices">): boolean {
  return invoice.verifiedAt != null;
}

async function invoiceToVerificationView(
  ctx: QueryCtx,
  invoice: Doc<"invoices">,
) {
  const status = await resolveCreditInvoiceDisplayStatus(ctx, invoice);
  return {
    id: invoice._id,
    number: invoice.number,
    barcode: invoice.barcode,
    date: invoice.date,
    time: invoice.time,
    clientName: invoice.clientNameSnapshot,
    ...(invoice.clientId ? { clientId: invoice.clientId } : {}),
    totalMad: centsToMad(invoice.totalMadCents),
    status,
    ...(invoice.verifiedAt != null ? { verifiedAt: invoice.verifiedAt } : {}),
    ...(invoice.verifiedByUserNameSnapshot
      ? { verifiedByUserName: invoice.verifiedByUserNameSnapshot }
      : {}),
    ...(invoice.verificationMethod
      ? { verificationMethod: invoice.verificationMethod }
      : {}),
  };
}

async function markInvoiceVerified(
  ctx: MutationCtx,
  invoiceId: Id<"invoices">,
  method: "barcode_scan" | "manual",
) {
  const { userId, user } = await requirePermission(ctx, "credits.verify");
  const invoice = await ctx.db.get(invoiceId);
  if (!invoice) throw new Error("Facture introuvable.");
  if (invoice.paymentType !== "credit") {
    throw new Error("Seules les factures crédit peuvent être vérifiées.");
  }

  if (isVerified(invoice)) {
    return {
      alreadyVerified: true as const,
      invoice: await invoiceToVerificationView(ctx, invoice),
    };
  }

  const now = Date.now();
  await ctx.db.patch(invoiceId, {
    verifiedAt: now,
    verifiedByUserId: userId,
    verifiedByUserNameSnapshot: user.name ?? user.email ?? "User",
    verificationMethod: method,
    updatedAt: now,
  });

  const updated = await ctx.db.get(invoiceId);
  if (!updated) throw new Error("Facture introuvable.");
  return {
    alreadyVerified: false as const,
    invoice: await invoiceToVerificationView(ctx, updated),
  };
}

export const listUnverifiedCreditInvoices = query({
  args: { limit: v.optional(v.number()) },
  returns: v.array(creditInvoiceVerificationView),
  handler: async (ctx, args) => {
    await requirePermission(ctx, "credits.verify");
    const limit = Math.min(Math.max(args.limit ?? 100, 1), 300);
    const invoices = await ctx.db
      .query("invoices")
      .withIndex("by_paymentType_date", (q) => q.eq("paymentType", "credit"))
      .order("desc")
      .take(limit * 3);

    const unverified = invoices
      .filter((invoice) => !isVerified(invoice))
      .slice(0, limit);
    return Promise.all(
      unverified.map((invoice) => invoiceToVerificationView(ctx, invoice)),
    );
  },
});

export const getCreditInvoiceByBarcode = query({
  args: { barcode: v.string() },
  returns: v.union(creditInvoiceVerificationView, v.null()),
  handler: async (ctx, args) => {
    await requirePermission(ctx, "credits.verify");
    const normalized = normalizeBarcode(args.barcode.trim());
    if (!normalized) return null;

    const invoice = await ctx.db
      .query("invoices")
      .withIndex("by_barcode", (q) => q.eq("barcode", normalized))
      .unique();

    if (!invoice) return null;
    if (invoice.paymentType !== "credit") return null;
    return await invoiceToVerificationView(ctx, invoice);
  },
});

export const verifyInvoice = mutation({
  args: {
    invoiceId: v.id("invoices"),
    method: v.optional(verificationMethod),
  },
  returns: v.object({
    alreadyVerified: v.boolean(),
    invoice: creditInvoiceVerificationView,
  }),
  handler: async (ctx, args) => {
    return await markInvoiceVerified(
      ctx,
      args.invoiceId,
      args.method ?? "manual",
    );
  },
});

/** Verify several credit invoices (Credits bulk action). Max 50 per call. */
export const verifyMany = mutation({
  args: {
    invoiceIds: v.array(v.id("invoices")),
    method: v.optional(verificationMethod),
  },
  returns: v.object({
    verified: v.number(),
    alreadyVerified: v.number(),
    failed: v.number(),
  }),
  handler: async (ctx, args) => {
    const method = args.method ?? "manual";
    const unique = [...new Set(args.invoiceIds)].slice(0, 50);
    let verified = 0;
    let alreadyVerified = 0;
    let failed = 0;
    for (const invoiceId of unique) {
      try {
        const result = await markInvoiceVerified(ctx, invoiceId, method);
        if (result.alreadyVerified) alreadyVerified += 1;
        else verified += 1;
      } catch {
        failed += 1;
      }
    }
    return { verified, alreadyVerified, failed };
  },
});

export const verifyInvoiceByBarcode = mutation({
  args: {
    barcode: v.string(),
  },
  returns: v.object({
    alreadyVerified: v.boolean(),
    invoice: creditInvoiceVerificationView,
  }),
  handler: async (ctx, args) => {
    const normalized = normalizeBarcode(args.barcode.trim());
    if (!normalized) throw new Error("Code-barres invalide.");

    const invoice = await ctx.db
      .query("invoices")
      .withIndex("by_barcode", (q) => q.eq("barcode", normalized))
      .unique();

    if (!invoice) throw new Error("Facture introuvable pour ce code-barres.");
    if (invoice.paymentType !== "credit") {
      throw new Error("Cette facture n'est pas une vente crédit.");
    }

    return await markInvoiceVerified(ctx, invoice._id, "barcode_scan");
  },
});
