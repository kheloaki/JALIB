import { v } from "convex/values";

import { mutation, query } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { recordAuditForUser } from "./audit";
import {
  hasAnyPermission,
  requireAnyPermission,
  requirePermission,
} from "./authz";
import { generateInvoiceBarcode } from "./barcode";
import { nextInvoiceSequence } from "./invoiceNumbers";
import {
  addMonthsIso,
  nextOpenScheduleDueDate,
  planRemainingMadCents,
} from "./installmentMath";
import { centsToMad, madToCents } from "./money";

const installmentPlanStatus = v.union(
  v.literal("active"),
  v.literal("completed"),
  v.literal("draft"),
  v.literal("cancelled"),
);
const scheduleRuleArg = v.union(
  v.object({ kind: v.literal("manual") }),
  v.object({
    kind: v.literal("recurring"),
    expectedPaymentMad: v.number(),
    intervalMonths: v.number(),
    dueDayOfMonth: v.number(),
  }),
);
const scheduleRuleView = scheduleRuleArg;
const scheduleSlotArg = v.object({
  dueDate: v.string(),
  expectedMad: v.number(),
});

const installmentPlanView = v.object({
  id: v.id("installmentPlans"),
  clientId: v.id("clients"),
  title: v.string(),
  totalMad: v.number(),
  monthlyMad: v.number(),
  startDate: v.string(),
  nextDueDate: v.string(),
  status: installmentPlanStatus,
  invoiceEntryId: v.union(v.id("creditLedgerEntries"), v.null()),
  invoiceId: v.union(v.id("invoices"), v.null()),
  scheduleRule: v.union(scheduleRuleView, v.null()),
  scheduleSlots: v.union(v.array(scheduleSlotArg), v.null()),
});

type ScheduleRuleArg =
  | { kind: "manual" }
  | {
      kind: "recurring";
      expectedPaymentMad: number;
      intervalMonths: number;
      dueDayOfMonth: number;
    };

type ScheduleSlotArg = {
  dueDate: string;
  expectedMad: number;
};

type InstallmentPlanView = {
  id: Id<"installmentPlans">;
  clientId: Id<"clients">;
  title: string;
  totalMad: number;
  monthlyMad: number;
  startDate: string;
  nextDueDate: string;
  status: Doc<"installmentPlans">["status"];
  invoiceEntryId: Id<"creditLedgerEntries"> | null;
  invoiceId: Id<"invoices"> | null;
  scheduleRule: ScheduleRuleArg | null;
  scheduleSlots: ScheduleSlotArg[] | null;
};

function ruleToDoc(rule: ScheduleRuleArg | null | undefined) {
  if (!rule) return undefined;
  if (rule.kind === "manual") return rule;
  return {
    kind: "recurring" as const,
    expectedPaymentMadCents: madToCents(rule.expectedPaymentMad),
    intervalMonths: Math.max(1, Math.floor(rule.intervalMonths)),
    dueDayOfMonth: Math.min(31, Math.max(1, Math.floor(rule.dueDayOfMonth))),
  };
}

function ruleToView(
  rule: Doc<"installmentPlans">["scheduleRule"],
): ScheduleRuleArg | null {
  if (!rule) return null;
  if (rule.kind === "manual") return rule;
  return {
    kind: "recurring",
    expectedPaymentMad: centsToMad(rule.expectedPaymentMadCents),
    intervalMonths: rule.intervalMonths,
    dueDayOfMonth: rule.dueDayOfMonth,
  };
}

function slotsToDoc(slots: ScheduleSlotArg[] | null | undefined) {
  if (!slots?.length) return undefined;
  return slots.map((slot) => ({
    dueDate: slot.dueDate,
    expectedMadCents: madToCents(slot.expectedMad),
  }));
}

function slotsToView(
  slots: Doc<"installmentPlans">["scheduleSlots"],
): ScheduleSlotArg[] | null {
  if (!slots?.length) return null;
  return slots.map((slot) => ({
    dueDate: slot.dueDate,
    expectedMad: centsToMad(slot.expectedMadCents),
  }));
}

function toInstallmentPlanView(
  plan: Doc<"installmentPlans">,
): InstallmentPlanView {
  return {
    id: plan._id,
    clientId: plan.clientId,
    title: plan.title,
    totalMad: centsToMad(plan.totalMadCents),
    monthlyMad: centsToMad(plan.monthlyMadCents),
    startDate: plan.startDate,
    nextDueDate: plan.nextDueDate,
    status: plan.status,
    invoiceEntryId: plan.invoiceEntryId ?? null,
    invoiceId: plan.invoiceId ?? null,
    scheduleRule: ruleToView(plan.scheduleRule),
    scheduleSlots: slotsToView(plan.scheduleSlots),
  };
}

async function requireCreditReadPermission(ctx: QueryCtx | MutationCtx) {
  await requireAnyPermission(ctx, [
    "credits.view",
    "credits.collect",
    "credits.approve",
  ]);
}

async function planEntries(
  ctx: QueryCtx | MutationCtx,
  planId: Id<"installmentPlans">,
) {
  return await ctx.db
    .query("creditLedgerEntries")
    .withIndex("by_planId_date", (q) => q.eq("planId", planId))
    .collect();
}

function validateScheduleAgainstRemaining(
  slots: ScheduleSlotArg[] | null | undefined,
  remainingMadCents: number,
) {
  if (!slots?.length) return;
  const totalScheduledCents = slots.reduce(
    (sum, slot) => sum + madToCents(slot.expectedMad),
    0,
  );
  if (totalScheduledCents < remainingMadCents) {
    throw new Error("Schedule total must cover the remaining plan amount.");
  }
}

export const listByClient = query({
  args: { clientId: v.id("clients") },
  returns: v.array(installmentPlanView),
  handler: async (ctx, args) => {
    await requireCreditReadPermission(ctx);
    const plans = await ctx.db
      .query("installmentPlans")
      .withIndex("by_clientId_status", (q) => q.eq("clientId", args.clientId))
      .order("desc")
      .take(200);
    return plans
      .map(toInstallmentPlanView)
      .sort((a, b) => b.startDate.localeCompare(a.startDate));
  },
});

export const listAll = query({
  args: { limit: v.optional(v.number()) },
  returns: v.array(installmentPlanView),
  handler: async (ctx, args) => {
    await requireCreditReadPermission(ctx);
    const limit = Math.min(Math.max(args.limit ?? 500, 1), 1000);
    const plans = await ctx.db
      .query("installmentPlans")
      .withIndex("by_status_and_nextDueDate", (q) => q.eq("status", "active"))
      .order("asc")
      .take(limit);
    return plans
      .map(toInstallmentPlanView)
      .sort((a, b) => b.startDate.localeCompare(a.startDate));
  },
});

export const listAllVisible = query({
  args: { limit: v.optional(v.number()) },
  returns: v.array(installmentPlanView),
  handler: async (ctx, args) => {
    const canReadCredits = await hasAnyPermission(ctx, [
      "credits.view",
      "credits.collect",
      "credits.approve",
    ]);
    if (!canReadCredits) return [];
    const limit = Math.min(Math.max(args.limit ?? 500, 1), 1000);
    // Alerts / overdue feeds only need active plans, ordered by due date.
    const plans = await ctx.db
      .query("installmentPlans")
      .withIndex("by_status_and_nextDueDate", (q) => q.eq("status", "active"))
      .order("asc")
      .take(limit);
    return plans.map(toInstallmentPlanView);
  },
});

export const create = mutation({
  args: {
    clientId: v.id("clients"),
    title: v.string(),
    totalMad: v.number(),
    upfrontMad: v.number(),
    startDate: v.string(),
    scheduleRule: v.union(scheduleRuleArg, v.null()),
    scheduleSlots: v.union(v.array(scheduleSlotArg), v.null()),
  },
  returns: installmentPlanView,
  handler: async (ctx, args) => {
    const { userId, user } = await requirePermission(ctx, "credits.approve");
    const client = await ctx.db.get(args.clientId);
    if (!client) throw new Error("Client not found.");

    const totalMadCents = madToCents(args.totalMad);
    const upfrontMadCents = madToCents(args.upfrontMad);
    if (totalMadCents <= 0) throw new Error("Plan total must be positive.");
    if (upfrontMadCents < 0) throw new Error("Upfront amount cannot be negative.");
    if (upfrontMadCents > totalMadCents) {
      throw new Error("Upfront amount cannot exceed plan total.");
    }

    const title = args.title.trim() || "Plan de paiement";
    const remainingMadCents = totalMadCents - upfrontMadCents;
    const completed = remainingMadCents <= 0;
    validateScheduleAgainstRemaining(args.scheduleSlots, remainingMadCents);

    const scheduleSlots = completed ? undefined : slotsToDoc(args.scheduleSlots);
    const scheduleRule =
      !completed && scheduleSlots?.length ? ruleToDoc(args.scheduleRule) : undefined;
    const now = Date.now();
    const firstDueDate =
      completed ? args.startDate : scheduleSlots?.[0]?.dueDate ?? addMonthsIso(args.startDate, 1);
    const sequence = await nextInvoiceSequence(ctx);
    const invoiceNumber = `INV-${sequence}`;
    const invoiceDate = new Date(`${args.startDate}T12:00:00`);
    const invoiceTime = invoiceDate.toLocaleTimeString("fr-FR", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });

    const invoiceId = await ctx.db.insert("invoices", {
      number: invoiceNumber,
      barcode: generateInvoiceBarcode(sequence - 1000),
      date: args.startDate,
      time: invoiceTime,
      clientId: args.clientId,
      clientNameSnapshot: client.fullName,
      paymentType: "credit",
      status: completed ? "paid" : "pending",
      totalMadCents,
      cashierId: userId,
      cashierNameSnapshot: user.name ?? user.email ?? "Crédits",
      createdAt: now,
      updatedAt: now,
    });

    await ctx.db.insert("invoiceLines", {
      invoiceId,
      productNameSnapshot: title,
      lineIndex: 0,
      qty: 1,
      unitPriceMadCents: totalMadCents,
      returnedQty: 0,
    });

    const planId = await ctx.db.insert("installmentPlans", {
      clientId: args.clientId,
      invoiceId,
      title,
      totalMadCents,
      monthlyMadCents: scheduleSlots?.[0]?.expectedMadCents ?? 0,
      startDate: args.startDate,
      nextDueDate: firstDueDate,
      status: completed ? "completed" : "active",
      ...(scheduleRule ? { scheduleRule } : {}),
      ...(scheduleSlots?.length ? { scheduleSlots } : {}),
      createdAt: now,
      updatedAt: now,
    });

    const invoiceEntryId = await ctx.db.insert("creditLedgerEntries", {
      clientId: args.clientId,
      planId,
      invoiceId,
      kind: "invoice",
      date: args.startDate,
      ref: `Facture ${invoiceNumber}`,
      note: title,
      amountMadCents: totalMadCents,
      status: completed ? "solde" : "impayé",
      source: "plan",
      createdAt: now,
    });

    if (upfrontMadCents > 0) {
      const upfrontRef = `Acompte #AC-${now.toString(36).toUpperCase().slice(-6)}`;
      const upfrontLedgerId = await ctx.db.insert("creditLedgerEntries", {
        clientId: args.clientId,
        planId,
        invoiceId,
        kind: "payment",
        date: args.startDate,
        ref: upfrontRef,
        note: "Acompte initial",
        amountMadCents: upfrontMadCents,
        status: "valide",
        source: "plan",
        createdAt: now,
      });
      await ctx.db.insert("invoicePayments", {
        invoiceId,
        ledgerEntryId: upfrontLedgerId,
        date: args.startDate,
        amountMadCents: upfrontMadCents,
        note: "Acompte initial",
        ref: upfrontRef,
        createdAt: now,
      });
    }

    await ctx.db.patch(planId, {
      invoiceEntryId,
      updatedAt: now,
    });
    const plan = await ctx.db.get(planId);
    if (!plan) throw new Error("Installment plan creation failed.");
    await recordAuditForUser(ctx, userId, user, {
      action: "installmentPlans.create",
      entityType: "plan",
      entityId: planId,
      summary: `Plan créé: ${title}`,
      payload: {
        clientId: args.clientId,
        invoiceId,
        totalMad: args.totalMad,
        upfrontMad: args.upfrontMad,
        startDate: args.startDate,
      },
      source: "manual",
    });
    return toInstallmentPlanView(plan);
  },
});

export const updateScheduleRule = mutation({
  args: {
    planId: v.id("installmentPlans"),
    rule: v.union(scheduleRuleArg, v.null()),
    slots: v.union(v.array(scheduleSlotArg), v.null()),
  },
  returns: installmentPlanView,
  handler: async (ctx, args) => {
    const { userId, user } = await requirePermission(ctx, "credits.approve");
    const plan = await ctx.db.get(args.planId);
    if (!plan) throw new Error("Installment plan not found.");
    if (plan.status !== "active" && args.rule) {
      throw new Error("Only active installment plans can use a schedule.");
    }

    const entries = await planEntries(ctx, plan._id);
    const remainingMadCents = planRemainingMadCents(plan, entries);
    validateScheduleAgainstRemaining(args.slots, remainingMadCents);

    const scheduleSlots = slotsToDoc(args.slots);
    const scheduleRule = scheduleSlots?.length ? ruleToDoc(args.rule) : undefined;
    const nextDueDate =
      scheduleSlots?.length && plan.status === "active"
        ? nextOpenScheduleDueDate(plan._id, scheduleSlots, entries) ??
          scheduleSlots[scheduleSlots.length - 1]!.dueDate
        : plan.nextDueDate;

    await ctx.db.patch(plan._id, {
      scheduleRule,
      scheduleSlots,
      nextDueDate,
      updatedAt: Date.now(),
    });
    const updated = await ctx.db.get(plan._id);
    if (!updated) throw new Error("Installment plan not found.");
    await recordAuditForUser(ctx, userId, user, {
      action: "installmentPlans.updateScheduleRule",
      entityType: "plan",
      entityId: plan._id,
      summary: `Échéancier modifié: ${plan.title}`,
      payload: {
        slotCount: scheduleSlots?.length ?? 0,
        nextDueDate,
      },
      source: "manual",
    });
    return toInstallmentPlanView(updated);
  },
});

export const setStatus = mutation({
  args: {
    planId: v.id("installmentPlans"),
    status: installmentPlanStatus,
  },
  returns: installmentPlanView,
  handler: async (ctx, args) => {
    await requirePermission(ctx, "credits.approve");
    const plan = await ctx.db.get(args.planId);
    if (!plan) throw new Error("Installment plan not found.");
    if (args.status === "draft" && plan.status !== "completed") {
      throw new Error("Only completed plans can be archived.");
    }
    if (args.status === "active" && plan.status === "draft") {
      throw new Error("Archived paid plans should be restored as completed.");
    }

    await ctx.db.patch(plan._id, {
      status: args.status,
      updatedAt: Date.now(),
    });
    const updated = await ctx.db.get(plan._id);
    if (!updated) throw new Error("Installment plan not found.");
    return toInstallmentPlanView(updated);
  },
});
