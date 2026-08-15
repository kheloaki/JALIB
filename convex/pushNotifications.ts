"use node";

import webpush from "web-push";
import { v } from "convex/values";

import { internal } from "./_generated/api";
import { internalAction } from "./_generated/server";

function getVapidKeys() {
  const publicKey = process.env.VAPID_PUBLIC_KEY?.trim();
  const privateKey = process.env.VAPID_PRIVATE_KEY?.trim();
  if (!publicKey || !privateKey) {
    throw new Error(
      "VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY must be set in Convex environment.",
    );
  }
  return { publicKey, privateKey };
}

function configureWebPush() {
  const { publicKey, privateKey } = getVapidKeys();
  webpush.setVapidDetails(
    "mailto:support@jamaamarket.local",
    publicKey,
    privateKey,
  );
}

type PushPayload = {
  title: string;
  body: string;
  url: string;
  tag?: string;
};

async function sendPush(
  subscription: {
    endpoint: string;
    p256dh: string;
    auth: string;
  },
  payload: PushPayload,
) {
  configureWebPush();
  await webpush.sendNotification(
    {
      endpoint: subscription.endpoint,
      keys: {
        p256dh: subscription.p256dh,
        auth: subscription.auth,
      },
    },
    JSON.stringify(payload),
  );
}

export const sendTestPush = internalAction({
  args: {
    endpoint: v.string(),
    p256dh: v.string(),
    auth: v.string(),
    locale: v.optional(v.union(v.literal("fr"), v.literal("ar"))),
  },
  returns: v.null(),
  handler: async (_ctx, args) => {
    const isAr = args.locale === "ar";
    await sendPush(
      {
        endpoint: args.endpoint,
        p256dh: args.p256dh,
        auth: args.auth,
      },
      {
        title: isAr ? "جامع ماركت" : "Jamaa Market",
        body: isAr
          ? "تم تفعيل الإشعارات بنجاح."
          : "Notifications activées avec succès.",
        url: isAr ? "/ar/alertes" : "/fr/alertes",
        tag: "jamaa-test",
      },
    );
    return null;
  },
});

export const sendAlertDigest = internalAction({
  args: {
    alertCount: v.number(),
    criticalCount: v.number(),
    subscriptions: v.array(
      v.object({
        id: v.id("pushSubscriptions"),
        endpoint: v.string(),
        p256dh: v.string(),
        auth: v.string(),
        locale: v.optional(v.union(v.literal("fr"), v.literal("ar"))),
        lastAlertCount: v.optional(v.number()),
      }),
    ),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    if (args.alertCount <= 0) return null;

    for (const sub of args.subscriptions) {
      if (sub.lastAlertCount === args.alertCount) continue;

      const isAr = sub.locale === "ar";
      try {
        await sendPush(sub, {
          title: isAr ? "تنبيهات جامع ماركت" : "Alertes Jamaa Market",
          body: isAr
            ? args.criticalCount > 0
              ? `${args.alertCount} تنبيه (${args.criticalCount} عاجل)`
              : `${args.alertCount} تنبيه نشط`
            : args.criticalCount > 0
              ? `${args.alertCount} alerte${args.alertCount > 1 ? "s" : ""} (${args.criticalCount} urgent${args.criticalCount > 1 ? "s" : ""})`
              : `${args.alertCount} alerte${args.alertCount > 1 ? "s" : ""} active${args.alertCount > 1 ? "s" : ""}`,
          url: isAr ? "/ar/alertes" : "/fr/alertes",
          tag: "jamaa-alert-digest",
        });
        await ctx.runMutation(internal.pushSubscriptions.patchLastAlertCount, {
          subscriptionId: sub.id,
          lastAlertCount: args.alertCount,
        });
      } catch (error) {
        const statusCode =
          error && typeof error === "object" && "statusCode" in error
            ? Number((error as { statusCode: number }).statusCode)
            : 0;
        if (statusCode === 404 || statusCode === 410) {
          await ctx.runMutation(internal.pushSubscriptions.deleteById, {
            subscriptionId: sub.id,
          });
        }
      }
    }
    return null;
  },
});

export const sendCreditLimitExceeded = internalAction({
  args: {
    clientId: v.id("clients"),
    clientName: v.string(),
    outstandingMadCents: v.number(),
    creditLimitMadCents: v.number(),
    invoiceNumber: v.string(),
    saleMadCents: v.number(),
    cashierName: v.string(),
    subscriptions: v.array(
      v.object({
        id: v.id("pushSubscriptions"),
        endpoint: v.string(),
        p256dh: v.string(),
        auth: v.string(),
        locale: v.optional(v.union(v.literal("fr"), v.literal("ar"))),
      }),
    ),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const outstandingMad = Math.round(args.outstandingMadCents) / 100;
    const limitMad = Math.round(args.creditLimitMadCents) / 100;
    const saleMad = Math.round(args.saleMadCents) / 100;

    for (const sub of args.subscriptions) {
      const isAr = sub.locale === "ar";
      try {
        await sendPush(sub, {
          title: isAr ? "تجاوز سقف الائتمان" : "Plafond crédit dépassé",
          body: isAr
            ? `${args.clientName}: ${outstandingMad.toFixed(2)} / ${limitMad.toFixed(2)} درهم — ${args.invoiceNumber}`
            : `${args.clientName}: ${outstandingMad.toFixed(2)} / ${limitMad.toFixed(2)} MAD — ${args.invoiceNumber} (+${saleMad.toFixed(2)} MAD, ${args.cashierName})`,
          url: isAr ? "/ar/credits" : "/fr/credits",
          tag: `credit-limit-${args.clientId}-${args.invoiceNumber}`,
        });
      } catch (error) {
        const statusCode =
          error && typeof error === "object" && "statusCode" in error
            ? Number((error as { statusCode: number }).statusCode)
            : 0;
        if (statusCode === 404 || statusCode === 410) {
          await ctx.runMutation(internal.pushSubscriptions.deleteById, {
            subscriptionId: sub.id,
          });
        }
      }
    }
    return null;
  },
});
