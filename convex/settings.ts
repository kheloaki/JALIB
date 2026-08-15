import { v } from "convex/values";

import { mutation, query } from "./_generated/server";
import { recordAuditForUser } from "./audit";
import { requireAuthenticatedUser, requirePermission } from "./authz";

const settingsKey = "app:parameters";

const appSettingsValue = v.object({
  businessName: v.string(),
  storePhone: v.string(),
  storeAddress: v.string(),
  taxIce: v.string(),
  taxIf: v.string(),
  taxRc: v.string(),
  defaultLocale: v.union(v.literal("fr"), v.literal("ar")),
  documentLocale: v.union(v.literal("fr"), v.literal("ar")),
  lowStockThreshold: v.number(),
  enableWhatsappAlerts: v.boolean(),
  receiptFooter: v.string(),
});

type AppSettings = {
  businessName: string;
  storePhone: string;
  storeAddress: string;
  taxIce: string;
  taxIf: string;
  taxRc: string;
  defaultLocale: "fr" | "ar";
  documentLocale: "fr" | "ar";
  lowStockThreshold: number;
  enableWhatsappAlerts: boolean;
  receiptFooter: string;
};

const DEFAULT_APP_SETTINGS: AppSettings = {
  businessName: "Jamaa Market",
  storePhone: "",
  storeAddress: "",
  taxIce: "",
  taxIf: "",
  taxRc: "",
  defaultLocale: "fr",
  documentLocale: "fr",
  lowStockThreshold: 10,
  enableWhatsappAlerts: true,
  receiptFooter: "Merci pour votre confiance.",
};

function coerceAppSettings(raw: unknown): AppSettings {
  if (!raw || typeof raw !== "object") return DEFAULT_APP_SETTINGS;
  const candidate = raw as Partial<AppSettings>;
  return {
    businessName:
      typeof candidate.businessName === "string"
        ? candidate.businessName
        : DEFAULT_APP_SETTINGS.businessName,
    storePhone:
      typeof candidate.storePhone === "string"
        ? candidate.storePhone
        : DEFAULT_APP_SETTINGS.storePhone,
    storeAddress:
      typeof candidate.storeAddress === "string"
        ? candidate.storeAddress
        : DEFAULT_APP_SETTINGS.storeAddress,
    taxIce:
      typeof candidate.taxIce === "string"
        ? candidate.taxIce
        : DEFAULT_APP_SETTINGS.taxIce,
    taxIf:
      typeof candidate.taxIf === "string"
        ? candidate.taxIf
        : DEFAULT_APP_SETTINGS.taxIf,
    taxRc:
      typeof candidate.taxRc === "string"
        ? candidate.taxRc
        : DEFAULT_APP_SETTINGS.taxRc,
    defaultLocale:
      candidate.defaultLocale === "ar" || candidate.defaultLocale === "fr"
        ? candidate.defaultLocale
        : DEFAULT_APP_SETTINGS.defaultLocale,
    documentLocale:
      candidate.documentLocale === "ar" || candidate.documentLocale === "fr"
        ? candidate.documentLocale
        : candidate.defaultLocale === "ar" || candidate.defaultLocale === "fr"
          ? candidate.defaultLocale
          : DEFAULT_APP_SETTINGS.documentLocale,
    lowStockThreshold:
      typeof candidate.lowStockThreshold === "number" &&
      Number.isFinite(candidate.lowStockThreshold)
        ? Math.max(0, Math.round(candidate.lowStockThreshold))
        : DEFAULT_APP_SETTINGS.lowStockThreshold,
    enableWhatsappAlerts:
      typeof candidate.enableWhatsappAlerts === "boolean"
        ? candidate.enableWhatsappAlerts
        : DEFAULT_APP_SETTINGS.enableWhatsappAlerts,
    receiptFooter:
      typeof candidate.receiptFooter === "string"
        ? candidate.receiptFooter
        : DEFAULT_APP_SETTINGS.receiptFooter,
  };
}

export const getAppSettings = query({
  args: {},
  returns: appSettingsValue,
  handler: async (ctx) => {
    await requireAuthenticatedUser(ctx);
    const doc = await ctx.db
      .query("settings")
      .withIndex("by_key", (q) => q.eq("key", settingsKey))
      .first();
    return coerceAppSettings(doc?.value);
  },
});

export const updateAppSettings = mutation({
  args: appSettingsValue,
  returns: appSettingsValue,
  handler: async (ctx, args) => {
    const { userId, user } = await requirePermission(ctx, "admin.manage_settings");
    const next: AppSettings = {
      businessName: args.businessName.trim() || DEFAULT_APP_SETTINGS.businessName,
      storePhone: args.storePhone.trim(),
      storeAddress: args.storeAddress.trim(),
      taxIce: args.taxIce.trim(),
      taxIf: args.taxIf.trim(),
      taxRc: args.taxRc.trim(),
      defaultLocale: args.defaultLocale,
      documentLocale: args.documentLocale,
      lowStockThreshold: Math.max(0, Math.round(args.lowStockThreshold)),
      enableWhatsappAlerts: args.enableWhatsappAlerts,
      receiptFooter: args.receiptFooter.trim(),
    };

    const existing = await ctx.db
      .query("settings")
      .withIndex("by_key", (q) => q.eq("key", settingsKey))
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        value: { ...next, updatedByUserId: userId },
        updatedAt: Date.now(),
      });
    } else {
      await ctx.db.insert("settings", {
        key: settingsKey,
        value: { ...next, updatedByUserId: userId },
        updatedAt: Date.now(),
      });
    }

    await recordAuditForUser(ctx, userId, user, {
      action: "settings.updateAppSettings",
      entityType: "settings",
      entityId: settingsKey,
      summary: "Paramètres mis à jour",
      payload: {
        businessName: next.businessName,
        defaultLocale: next.defaultLocale,
        lowStockThreshold: next.lowStockThreshold,
      },
      source: "settings",
    });

    return next;
  },
});
