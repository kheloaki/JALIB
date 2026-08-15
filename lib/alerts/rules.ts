import type { AlertCategory, AlertItem } from "@/lib/alerts/types";
import type { Client } from "@/lib/clients/types";
import type { CreditStore } from "@/lib/credits/types";
import { summarizeLedger } from "@/lib/credits/compute";
import type { Product } from "@/components/pos/types";

export type AlertRuleKind = "credit_percent" | "stock_threshold" | "custom";

export type AlertRule = {
  id: string;
  label: string;
  kind: AlertRuleKind;
  enabled: boolean;
  createdAt: number;
  creditPercentThreshold?: number;
  stockThreshold?: number;
  customTitle?: string;
  customDetail?: string;
  customCategory?: AlertCategory;
};

export const ALERT_RULES_STORAGE_KEY = "matjar_alert_rules_v1";
export const ALERT_RULES_STORAGE_EVENT = "matjar:alert-rules-storage-updated";

function normalizeRule(o: unknown): AlertRule | null {
  if (!o || typeof o !== "object") return null;
  const r = o as Record<string, unknown>;
  if (typeof r.id !== "string" || typeof r.label !== "string") return null;
  if (
    r.kind !== "credit_percent" &&
    r.kind !== "stock_threshold" &&
    r.kind !== "custom"
  ) {
    return null;
  }
  if (typeof r.enabled !== "boolean" || typeof r.createdAt !== "number") {
    return null;
  }
  return {
    id: r.id,
    label: r.label.trim(),
    kind: r.kind,
    enabled: r.enabled,
    createdAt: r.createdAt,
    ...(typeof r.creditPercentThreshold === "number"
      ? { creditPercentThreshold: r.creditPercentThreshold }
      : {}),
    ...(typeof r.stockThreshold === "number"
      ? { stockThreshold: r.stockThreshold }
      : {}),
    ...(typeof r.customTitle === "string" ? { customTitle: r.customTitle } : {}),
    ...(typeof r.customDetail === "string" ? { customDetail: r.customDetail } : {}),
    ...(r.customCategory === "credit_over" ||
    r.customCategory === "credit_warn" ||
    r.customCategory === "unpaid" ||
    r.customCategory === "installment_missed" ||
    r.customCategory === "stock"
      ? { customCategory: r.customCategory }
      : {}),
  };
}

export function readAlertRules(): AlertRule[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(ALERT_RULES_STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map(normalizeRule)
      .filter((x): x is AlertRule => x !== null && x.label.length > 0);
  } catch {
    return [];
  }
}

export function writeAlertRules(rules: AlertRule[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(ALERT_RULES_STORAGE_KEY, JSON.stringify(rules));
    window.dispatchEvent(new CustomEvent(ALERT_RULES_STORAGE_EVENT));
  } catch {
    // quota / private mode
  }
}

export function appendAlertRule(rule: AlertRule): void {
  const rules = readAlertRules();
  writeAlertRules([...rules, rule]);
}

type BuildRuleAlertsArgs = {
  rules: AlertRule[];
  clients: Client[];
  creditStore: CreditStore;
  products: Product[];
  todayIso: string;
  timeLabel: string;
};

export function buildAlertsFromRules({
  rules,
  clients,
  creditStore,
  products,
  todayIso,
  timeLabel,
}: BuildRuleAlertsArgs): AlertItem[] {
  const out: AlertItem[] = [];

  for (const rule of rules) {
    if (!rule.enabled) continue;

    if (rule.kind === "credit_percent") {
      const threshold = Math.min(100, Math.max(1, rule.creditPercentThreshold ?? 80));
      const ratioMin = threshold / 100;
      for (const c of clients) {
        if (c.isCashOnly) continue;
        if (c.creditLimitMad === null || c.creditLimitMad <= 0) continue;
        const entries = creditStore.entriesByClient[c.id] ?? [];
        const balance = Math.round(summarizeLedger(entries, c.initialSoldeMad).balanceMad * 100) / 100;
        if (balance <= 0) continue;
        const ratio = balance / c.creditLimitMad;
        if (ratio < ratioMin) continue;
        const isOver = ratio >= 1;
        // Built-in alerts already cover 90% and 100%.
        if (isOver && threshold >= 100) continue;
        if (!isOver && ratio >= 0.9 && threshold >= 90) continue;
        out.push({
          id: `rule:${rule.id}:credit:${c.id}:${todayIso}`,
          category: isOver ? "credit_over" : "credit_warn",
          variant: isOver ? "whatsapp_ignore" : "details",
          badge: isOver
            ? `Règle • ${rule.label}`
            : `Règle • ${threshold}%`,
          timeLabel: `Aujourd'hui ${timeLabel}`,
          title: isOver
            ? `${c.fullName} — ${rule.label}`
            : `${c.fullName} atteint ${Math.round(ratio * 100)}% (règle ${threshold}%)`,
          detail: `Dû: ${balance.toLocaleString("fr-FR")} MAD / Limite: ${c.creditLimitMad.toLocaleString("fr-FR")} MAD`,
          clientName: c.fullName,
          whatsappPhone: c.phone.replace(/\D/g, ""),
        });
      }
      continue;
    }

    if (rule.kind === "stock_threshold") {
      const threshold = Math.max(0, rule.stockThreshold ?? 5);
      for (const p of products) {
        const qty = Math.max(0, p.stockQty);
        if (qty > threshold) continue;
        out.push({
          id: `rule:${rule.id}:stock:${p.id}:${todayIso}`,
          category: "stock",
          variant: "order",
          badge: `Règle • ${rule.label}`,
          timeLabel: `Aujourd'hui ${timeLabel}`,
          title: `Stock bas: ${p.name}`,
          detail: `Stock: ${qty} unité${qty > 1 ? "s" : ""} • Seuil: ${threshold}`,
        });
      }
      continue;
    }

    if (rule.kind === "custom") {
      const title = rule.customTitle?.trim();
      const detail = rule.customDetail?.trim();
      if (!title || !detail) continue;
      out.push({
        id: `rule:${rule.id}:custom:${todayIso}`,
        category: rule.customCategory ?? "credit_warn",
        variant: "details",
        badge: `Règle • ${rule.label}`,
        timeLabel: `Aujourd'hui ${timeLabel}`,
        title,
        detail,
      });
    }
  }

  return out;
}
