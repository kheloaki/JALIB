import type { AlertItem } from "@/lib/alerts/types";

export const ALERTS_STORAGE_KEY = "matjar_alerts_v1";
export const ALERTS_STORAGE_EVENT = "matjar:alerts-storage-updated";

function normalizeAlert(o: unknown): AlertItem | null {
  if (!o || typeof o !== "object") return null;
  const r = o as Record<string, unknown>;
  if (typeof r.id !== "string") return null;
  if (
    r.category !== "credit_over" &&
    r.category !== "credit_warn" &&
    r.category !== "unpaid" &&
    r.category !== "installment_missed" &&
    r.category !== "stock"
  ) {
    return null;
  }
  if (
    r.variant !== "whatsapp_ignore" &&
    r.variant !== "details" &&
    r.variant !== "phone_mail" &&
    r.variant !== "order"
  ) {
    return null;
  }
  if (
    typeof r.badge !== "string" ||
    typeof r.timeLabel !== "string" ||
    typeof r.title !== "string" ||
    typeof r.detail !== "string"
  ) {
    return null;
  }
  const clientName =
    typeof r.clientName === "string" && r.clientName.trim().length > 0
      ? r.clientName
      : undefined;
  const whatsappPhone =
    typeof r.whatsappPhone === "string" && r.whatsappPhone.trim().length > 0
      ? r.whatsappPhone
      : undefined;

  return {
    id: r.id,
    category: r.category,
    variant: r.variant,
    badge: r.badge,
    timeLabel: r.timeLabel,
    title: r.title,
    detail: r.detail,
    ...(clientName ? { clientName } : {}),
    ...(whatsappPhone ? { whatsappPhone } : {}),
  };
}

export function readAlerts(): AlertItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(ALERTS_STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map(normalizeAlert)
      .filter((x): x is AlertItem => x !== null);
  } catch {
    return [];
  }
}

export function writeAlerts(alerts: AlertItem[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(ALERTS_STORAGE_KEY, JSON.stringify(alerts));
    window.dispatchEvent(new CustomEvent(ALERTS_STORAGE_EVENT));
  } catch {
    // quota / navigation privée
  }
}
