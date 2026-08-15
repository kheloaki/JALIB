import type { Product } from "@/components/pos/types";
import type { AlertRule } from "@/lib/alerts/rules";
import { buildAlertsFromRules } from "@/lib/alerts/rules";
import type { AlertItem } from "@/lib/alerts/types";
import type { Client } from "@/lib/clients/types";
import { buildInstallmentScheduleAlertItems } from "@/lib/credits/installments/schedule-alerts";
import type { InstallmentPlan } from "@/lib/credits/installments/types";
import { summarizeLedger } from "@/lib/credits/compute";
import type { CreditStore } from "@/lib/credits/types";

export type AlertClock = {
  todayIso: string;
  timeLabel: string;
};

export function createAlertClock(now = new Date()): AlertClock {
  return {
    todayIso: now.toISOString().slice(0, 10),
    timeLabel: now.toLocaleTimeString("fr-FR", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }),
  };
}

export function alertPriority(category: AlertItem["category"]): number {
  switch (category) {
    case "credit_over":
      return 0;
    case "installment_missed":
      return 1;
    case "credit_warn":
      return 2;
    case "unpaid":
      return 3;
    case "stock":
      return 4;
    default:
      return 5;
  }
}

export function sortAlertsByPriority(alerts: readonly AlertItem[]): AlertItem[] {
  return [...alerts].sort(
    (a, b) => alertPriority(a.category) - alertPriority(b.category),
  );
}

export function buildAlertFeed(input: {
  clients: readonly Client[];
  creditStore: CreditStore;
  installmentPlans: readonly InstallmentPlan[];
  products: readonly Product[];
  storedAlerts: readonly AlertItem[];
  storedRules: readonly AlertRule[];
  clock: AlertClock;
}): AlertItem[] {
  const auto: AlertItem[] = [];

  for (const alert of buildInstallmentScheduleAlertItems(
    input.installmentPlans,
    input.creditStore,
    input.clients,
    input.clock.todayIso,
    input.clock.timeLabel,
  )) {
    auto.push(alert);
  }

  for (const client of input.clients) {
    if (client.isCashOnly) continue;
    if (client.creditLimitMad === null || client.creditLimitMad <= 0) continue;

    const entries = input.creditStore.entriesByClient[client.id] ?? [];
    const summary = summarizeLedger(entries, client.initialSoldeMad);
    const balance = Math.round(summary.balanceMad * 100) / 100;
    if (balance <= 0) continue;

    const limit = client.creditLimitMad;
    const ratio = balance / limit;
    if (ratio >= 1) {
      auto.push({
        id: `auto:credit_over:${client.id}:${input.clock.todayIso}`,
        category: "credit_over",
        variant: "whatsapp_ignore",
        badge: "Urgent • Limite dépassée",
        timeLabel: `Aujourd'hui ${input.clock.timeLabel}`,
        title: `${client.fullName} a dépassé sa limite de crédit`,
        detail: `Dû: ${balance.toLocaleString("fr-FR")} MAD / Limite: ${limit.toLocaleString("fr-FR")} MAD`,
        clientName: client.fullName,
        whatsappPhone: client.phone.replace(/\D/g, ""),
      });
    } else if (ratio >= 0.9) {
      auto.push({
        id: `auto:credit_warn:${client.id}:${input.clock.todayIso}`,
        category: "credit_warn",
        variant: "details",
        badge: "Attention • Proche limite",
        timeLabel: `Aujourd'hui ${input.clock.timeLabel}`,
        title: `${client.fullName} approche sa limite de crédit`,
        detail: `Dû: ${balance.toLocaleString("fr-FR")} MAD (≈ ${Math.round(ratio * 100)}%) • Limite: ${limit.toLocaleString("fr-FR")} MAD`,
        clientName: client.fullName,
        whatsappPhone: client.phone.replace(/\D/g, ""),
      });
    }
  }

  for (const alert of buildAlertsFromRules({
    rules: [...input.storedRules],
    clients: [...input.clients],
    creditStore: input.creditStore,
    products: [...input.products],
    todayIso: input.clock.todayIso,
    timeLabel: input.clock.timeLabel,
  })) {
    auto.push(alert);
  }

  const byId = new Map<string, AlertItem>();
  for (const alert of [...auto, ...input.storedAlerts]) {
    byId.set(alert.id, alert);
  }
  return [...byId.values()];
}
