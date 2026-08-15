"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { useAuthActions } from "@convex-dev/auth/react";
import { useLocale } from "next-intl";
import { RefreshCw, Smartphone } from "lucide-react";
import QRCode from "qrcode";

import { Button } from "@/components/ui/button";
import { api } from "@/convex/_generated/api";
import {
  formatDeviceQrPayload,
  getDeviceLabel,
  getOrCreateDeviceId,
} from "@/lib/auth/device-id";

export function DeviceApprovalGate() {
  const locale = useLocale();
  const isAr = locale === "ar";
  const tr = (fr: string, ar: string) => (isAr ? ar : fr);
  const { signOut } = useAuthActions();

  const deviceId = useMemo(() => getOrCreateDeviceId(), []);
  const label = useMemo(() => getDeviceLabel(), []);

  const status = useQuery(
    api.devices.getMyDeviceStatus,
    deviceId ? { deviceId } : "skip",
  );
  const registerOrRefresh = useMutation(
    api.devices.registerOrRefreshPendingDevice,
  );

  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [localToken, setLocalToken] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<number | null>(null);
  const [registerAttempted, setRegisterAttempted] = useState(false);

  const refreshChallenge = useCallback(async () => {
    if (!deviceId) return;
    setBusy(true);
    try {
      const result = await registerOrRefresh({ deviceId, label });
      setLocalToken(result.challengeToken);
      setExpiresAt(result.challengeExpiresAt);
    } catch {
      // Keep previous QR if refresh fails.
    } finally {
      setBusy(false);
      setRegisterAttempted(true);
    }
  }, [deviceId, label, registerOrRefresh]);

  useEffect(() => {
    if (!deviceId || status === undefined) return;
    if (status.status === "approved") return;

    const needsRegister =
      status.status === "none" ||
      status.status === "revoked" ||
      status.status === "expired" ||
      (status.status === "pending" && !status.challengeToken);

    if (needsRegister && !registerAttempted && !busy) {
      void refreshChallenge();
      return;
    }

    if (status.status === "pending" && status.challengeToken) {
      setLocalToken(status.challengeToken);
      setExpiresAt(status.challengeExpiresAt);
    }
  }, [busy, deviceId, refreshChallenge, registerAttempted, status]);

  const tokenForQr = localToken ?? status?.challengeToken ?? null;

  useEffect(() => {
    if (!tokenForQr) {
      setQrDataUrl(null);
      return;
    }
    let cancelled = false;
    void QRCode.toDataURL(formatDeviceQrPayload(tokenForQr), {
      width: 280,
      margin: 2,
      errorCorrectionLevel: "M",
    }).then((url) => {
      if (!cancelled) setQrDataUrl(url);
    });
    return () => {
      cancelled = true;
    };
  }, [tokenForQr]);

  const expiresLabel =
    expiresAt != null
      ? new Date(expiresAt).toLocaleTimeString(isAr ? "ar-MA" : "fr-FR", {
          hour: "2-digit",
          minute: "2-digit",
        })
      : null;

  return (
    <div className="bg-surface text-on-surface fixed inset-0 z-[100] flex items-center justify-center overflow-auto px-4 py-10">
      <div className="border-outline-variant/40 bg-surface-container-lowest w-full max-w-md rounded-2xl border p-6 shadow-sm sm:p-8">
        <div className="bg-primary/10 text-primary mx-auto mb-5 flex size-12 items-center justify-center rounded-xl">
          <Smartphone className="size-6 stroke-[1.75]" aria-hidden />
        </div>
        <h1 className="text-center text-xl font-black tracking-tight">
          {tr("Appareil non autorisé", "جهاز غير مصرح")}
        </h1>
        <p className="text-on-surface-variant mt-2 text-center text-sm leading-relaxed">
          {tr(
            "Demandez à un administrateur de scanner ce QR pour autoriser cet appareil à se connecter.",
            "اطلب من المسؤول مسح رمز QR هذا للسماح لهذا الجهاز بتسجيل الدخول.",
          )}
        </p>

        <div className="mt-6 flex flex-col items-center gap-3">
          {qrDataUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- dynamic QR data URL
            <img
              src={qrDataUrl}
              alt={tr("QR d'autorisation appareil", "رمز QR لتفويض الجهاز")}
              className="size-[220px] rounded-xl bg-white p-2"
            />
          ) : (
            <div className="bg-surface-container text-on-surface-variant flex size-[220px] items-center justify-center rounded-xl text-sm">
              {tr("Préparation du QR…", "جارٍ تجهيز الرمز…")}
            </div>
          )}
          {expiresLabel ? (
            <p className="text-outline text-xs">
              {tr("Expire à", "ينتهي في")} {expiresLabel}
            </p>
          ) : null}
        </div>

        <div className="mt-6 flex flex-col gap-2">
          <Button
            type="button"
            variant="outline"
            className="rounded-xl font-bold"
            disabled={busy}
            onClick={() => {
              setRegisterAttempted(false);
              void refreshChallenge();
            }}
          >
            <RefreshCw className="size-4 stroke-[1.75]" aria-hidden />
            {tr("Actualiser le QR", "تحديث رمز QR")}
          </Button>
          <Button
            type="button"
            variant="ghost"
            className="rounded-xl font-bold"
            onClick={() => void signOut()}
          >
            {tr("Se déconnecter", "تسجيل الخروج")}
          </Button>
        </div>
      </div>
    </div>
  );
}
