"use client";

import { useCallback, useEffect, useState } from "react";
import { useLocale } from "next-intl";
import { useMutation, useQuery } from "convex/react";

import { useToast } from "@/components/ui/toaster";
import { api } from "@/convex/_generated/api";
import { canAccessAlerts } from "@/lib/auth/permissions";
import { getVapidPublicKey } from "@/lib/pwa/constants";
import {
  hasActivePushSubscription,
  subscribeToPushNotifications,
  unsubscribeFromPushNotifications,
} from "@/lib/pwa/push-subscription";

type EnablePushOptions = {
  silent?: boolean;
};

export function usePushNotifications(canUseAlerts: boolean) {
  const locale = useLocale();
  const isAr = locale === "ar";
  const tr = useCallback(
    (fr: string, ar: string) => (isAr ? ar : fr),
    [isAr],
  );
  const toast = useToast();
  const savedSubscription = useQuery(api.pushSubscriptions.getMine);
  const saveSubscription = useMutation(api.pushSubscriptions.save);
  const removeSubscription = useMutation(api.pushSubscriptions.removeMine);

  const vapidConfigured = getVapidPublicKey() != null;
  const [pushEnabled, setPushEnabled] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void hasActivePushSubscription().then(setPushEnabled);
  }, [savedSubscription]);

  const enablePush = useCallback(
    async (options?: EnablePushOptions) => {
      if (!canUseAlerts || !vapidConfigured) return false;
      setBusy(true);
      try {
        const payload = await subscribeToPushNotifications();
        await saveSubscription({
          endpoint: payload.endpoint,
          p256dh: payload.p256dh,
          auth: payload.auth,
          ...(payload.expirationTime != null
            ? { expirationTime: payload.expirationTime }
            : {}),
          locale: locale === "ar" ? "ar" : "fr",
        });
        setPushEnabled(true);
        if (!options?.silent) {
          toast.success(
            tr("Notifications activées", "تم تفعيل الإشعارات"),
            tr(
              "Vous recevrez les alertes importantes sur cet appareil.",
              "ستتلقى التنبيهات المهمة على هذا الجهاز.",
            ),
          );
        }
        return true;
      } catch (error) {
        if (!options?.silent) {
          toast.error(
            tr("Activation impossible", "تعذر التفعيل"),
            error instanceof Error
              ? error.message
              : tr("Réessayez.", "أعد المحاولة."),
          );
        }
        return false;
      } finally {
        setBusy(false);
      }
    },
    [canUseAlerts, locale, saveSubscription, toast, tr, vapidConfigured],
  );

  const disablePush = useCallback(async () => {
    setBusy(true);
    try {
      await unsubscribeFromPushNotifications();
      await removeSubscription({});
      setPushEnabled(false);
      toast.success(
        tr("Notifications désactivées", "تم إيقاف الإشعارات"),
        tr(
          "Vous ne recevrez plus d'alertes push.",
          "لن تتلقى تنبيهات push بعد الآن.",
        ),
      );
    } catch (error) {
      toast.error(
        tr("Erreur", "خطأ"),
        error instanceof Error ? error.message : tr("Réessayez.", "أعد المحاولة."),
      );
    } finally {
      setBusy(false);
    }
  }, [removeSubscription, toast, tr]);

  return {
    busy,
    pushEnabled,
    savedSubscription,
    vapidConfigured,
    enablePush,
    disablePush,
  };
}
