"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { useLocale } from "next-intl";
import { ScanBarcode, ShieldCheck, Trash2 } from "lucide-react";

import { BarcodeScanDialog } from "@/components/products/barcode-scan-dialog";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toaster";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import {
  getDeviceLabel,
  getOrCreateDeviceId,
  parseDeviceQrPayload,
} from "@/lib/auth/device-id";
import { statusPillClass } from "@/lib/ui/status-pill";
import { cn } from "@/lib/utils";

type DeviceStatus = "pending" | "approved" | "revoked";

function statusLabel(status: DeviceStatus, isAr: boolean) {
  if (status === "approved") return isAr ? "معتمد" : "Approuvé";
  if (status === "pending") return isAr ? "في الانتظار" : "En attente";
  return isAr ? "ملغى" : "Révoqué";
}

function statusTone(status: DeviceStatus) {
  if (status === "approved") return "bg-emerald-100 text-emerald-900";
  if (status === "pending") return "bg-amber-100 text-amber-900";
  return "bg-slate-200 text-slate-700";
}

function formatSeenAt(ms: number) {
  return new Date(ms).toLocaleString("fr-FR", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export function DevicesAdminPanel() {
  const locale = useLocale();
  const isAr = locale === "ar";
  const tr = (fr: string, ar: string) => (isAr ? ar : fr);
  const toast = useToast();
  const devices = useQuery(api.devices.listTrustedDevices);
  const approve = useMutation(api.devices.approveDeviceByToken);
  const revoke = useMutation(api.devices.revokeDevice);
  const [scanOpen, setScanOpen] = useState(false);
  const [busyId, setBusyId] = useState<Id<"trustedDevices"> | null>(null);

  const adminDeviceId = useMemo(() => getOrCreateDeviceId(), []);

  async function handleScan(raw: string) {
    setScanOpen(false);
    const token = parseDeviceQrPayload(raw);
    if (!token) {
      toast.error(tr("QR invalide", "رمز غير صالح"));
      return;
    }
    try {
      const result = await approve({
        token,
        adminDeviceId,
      });
      toast.success(
        tr("Appareil approuvé", "تم اعتماد الجهاز"),
        result.userName
          ? tr(
              `${result.userName}${result.label ? ` · ${result.label}` : ""}`,
              `${result.userName}${result.label ? ` · ${result.label}` : ""}`,
            )
          : undefined,
      );
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "APPROVE_FAILED";
      if (message.includes("ADMIN_DEVICE_NOT_APPROVED")) {
        toast.error(
          tr(
            "Votre appareil admin n'est pas encore autorisé",
            "جهاز المسؤول غير مصرح بعد",
          ),
        );
        return;
      }
      if (message.includes("TOKEN_EXPIRED")) {
        toast.error(
          tr("QR expiré — demandez un nouveau", "انتهت صلاحية الرمز — اطلب رمزًا جديدًا"),
        );
        return;
      }
      toast.error(
        tr("Impossible d'approuver cet appareil", "تعذر اعتماد هذا الجهاز"),
      );
    }
  }

  async function handleRevoke(deviceRecordId: Id<"trustedDevices">) {
    const confirmed = window.confirm(
      tr(
        "Révoquer cet appareil ? L'utilisateur devra obtenir une nouvelle approbation.",
        "إلغاء هذا الجهاز؟ سيحتاج المستخدم إلى موافقة جديدة.",
      ),
    );
    if (!confirmed) return;
    setBusyId(deviceRecordId);
    try {
      await revoke({ deviceRecordId, adminDeviceId });
      toast.success(tr("Appareil révoqué", "تم إلغاء الجهاز"));
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "REVOKE_FAILED";
      if (message.includes("LAST_ADMIN_DEVICE")) {
        toast.error(
          tr(
            "Impossible de révoquer le dernier appareil administrateur",
            "لا يمكن إلغاء آخر جهاز مسؤول",
          ),
        );
        return;
      }
      if (message.includes("ADMIN_DEVICE_NOT_APPROVED")) {
        toast.error(
          tr(
            "Votre appareil admin n'est pas encore autorisé",
            "جهاز المسؤول غير مصرح بعد",
          ),
        );
        return;
      }
      toast.error(tr("Échec de la révocation", "فشل الإلغاء"));
    } finally {
      setBusyId(null);
    }
  }

  const sorted = devices ?? [];
  const thisDeviceLabel = getDeviceLabel();

  return (
    <main className="w-full flex-1 overflow-auto px-4 py-6 sm:px-8">
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
        <section className="border-outline-variant/30 bg-surface-container-lowest rounded-2xl border p-5 sm:p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h2 className="text-lg font-black tracking-tight">
                {tr("Appareils de connexion", "أجهزة تسجيل الدخول")}
              </h2>
              <p className="text-on-surface-variant mt-1 text-sm leading-relaxed">
                {tr(
                  "Scannez le QR affiché sur un nouvel appareil pour l'autoriser. Vous pouvez révoquer l'accès à tout moment.",
                  "امسح رمز QR المعروض على جهاز جديد للسماح له. يمكنك إلغاء الوصول في أي وقت.",
                )}
              </p>
              <p className="text-outline mt-2 text-xs">
                {tr("Cet appareil", "هذا الجهاز")}: {thisDeviceLabel}
              </p>
            </div>
            <Button
              type="button"
              className="rounded-xl font-bold"
              onClick={() => setScanOpen(true)}
            >
              <ScanBarcode className="size-4 stroke-[1.75]" aria-hidden />
              {tr("Scanner un QR", "مسح رمز QR")}
            </Button>
          </div>
        </section>

        <section className="border-outline-variant/30 bg-surface-container-lowest overflow-hidden rounded-2xl border">
          {devices === undefined ? (
            <p className="text-on-surface-variant p-6 text-sm">
              {tr("Chargement…", "جارٍ التحميل…")}
            </p>
          ) : sorted.length === 0 ? (
            <div className="text-on-surface-variant flex flex-col items-center gap-3 p-10 text-center">
              <ShieldCheck className="size-8 stroke-[1.5] opacity-50" aria-hidden />
              <p className="text-sm">
                {tr(
                  "Aucun appareil enregistré pour le moment.",
                  "لا توجد أجهزة مسجلة حاليًا.",
                )}
              </p>
            </div>
          ) : (
            <ul className="divide-outline-variant/20 divide-y">
              {sorted.map((device) => (
                <li
                  key={device.id}
                  className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5"
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate font-bold">{device.userName}</p>
                      <span
                        className={cn(
                          statusPillClass,
                          "px-2.5 py-0.5 text-[11px] font-bold tracking-wide uppercase",
                          statusTone(device.status),
                        )}
                      >
                        {statusLabel(device.status, isAr)}
                      </span>
                    </div>
                    <p className="text-on-surface-variant mt-0.5 truncate text-sm">
                      {device.label ?? tr("Appareil", "جهاز")}
                      {device.userEmail ? ` · ${device.userEmail}` : ""}
                    </p>
                    <p className="text-outline mt-1 text-xs">
                      {tr("Vu", "آخر ظهور")}: {formatSeenAt(device.lastSeenAt)}
                    </p>
                  </div>
                  {device.status === "approved" ? (
                    <Button
                      type="button"
                      variant="outline"
                      className="shrink-0 rounded-xl font-bold text-red-700"
                      disabled={busyId === device.id}
                      onClick={() => void handleRevoke(device.id)}
                    >
                      <Trash2 className="size-4 stroke-[1.75]" aria-hidden />
                      {tr("Révoquer", "إلغاء")}
                    </Button>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <BarcodeScanDialog
        open={scanOpen}
        onOpenChange={setScanOpen}
        onScan={(value) => void handleScan(value)}
      />
    </main>
  );
}
