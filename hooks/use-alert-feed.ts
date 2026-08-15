"use client";

import { useMemo, useSyncExternalStore } from "react";
import { useQuery } from "convex/react";

import type { Product } from "@/components/pos/types";
import {
  buildAlertFeed,
  createAlertClock,
  sortAlertsByPriority,
} from "@/lib/alerts/build-alert-feed";
import {
  ALERT_RULES_STORAGE_EVENT,
  ALERT_RULES_STORAGE_KEY,
  readAlertRules,
  type AlertRule,
} from "@/lib/alerts/rules";
import {
  ALERTS_STORAGE_EVENT,
  ALERTS_STORAGE_KEY,
  readAlerts,
} from "@/lib/alerts/storage";
import type { AlertItem } from "@/lib/alerts/types";
import type { Client } from "@/lib/clients/types";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import {
  clientFromConvex,
  installmentPlanFromConvex,
  ledgerEntryFromConvex,
  productFromConvex,
} from "@/lib/convex/mappers";
import type { CreditStore } from "@/lib/credits/types";
import type { InstallmentPlan } from "@/lib/credits/installments/types";

const EMPTY_ALERTS: AlertItem[] = [];
const EMPTY_RULES: AlertRule[] = readAlertRules();

let cachedStoredAlertsRaw: string | null = null;
let cachedStoredAlertsSnapshot: AlertItem[] = EMPTY_ALERTS;
let cachedStoredRulesRaw: string | null = null;
let cachedStoredRulesSnapshot: AlertRule[] = EMPTY_RULES;

function subscribeStoredAlerts(onStoreChange: () => void) {
  if (typeof window === "undefined") return () => {};
  const handleStorage = (event: StorageEvent) => {
    if (
      event.key === ALERTS_STORAGE_KEY ||
      event.key === ALERT_RULES_STORAGE_KEY
    ) {
      onStoreChange();
    }
  };
  window.addEventListener("storage", handleStorage);
  window.addEventListener(ALERTS_STORAGE_EVENT, onStoreChange);
  window.addEventListener(ALERT_RULES_STORAGE_EVENT, onStoreChange);
  return () => {
    window.removeEventListener("storage", handleStorage);
    window.removeEventListener(ALERTS_STORAGE_EVENT, onStoreChange);
    window.removeEventListener(ALERT_RULES_STORAGE_EVENT, onStoreChange);
  };
}

function getStoredAlertsSnapshot() {
  if (typeof window === "undefined") return EMPTY_ALERTS;
  const raw = window.localStorage.getItem(ALERTS_STORAGE_KEY);
  if (raw === cachedStoredAlertsRaw) return cachedStoredAlertsSnapshot;
  cachedStoredAlertsRaw = raw;
  cachedStoredAlertsSnapshot = readAlerts();
  return cachedStoredAlertsSnapshot;
}

function getStoredRulesSnapshot() {
  if (typeof window === "undefined") return EMPTY_RULES;
  const raw = window.localStorage.getItem(ALERT_RULES_STORAGE_KEY);
  if (raw === cachedStoredRulesRaw) return cachedStoredRulesSnapshot;
  cachedStoredRulesRaw = raw;
  cachedStoredRulesSnapshot = readAlertRules();
  return cachedStoredRulesSnapshot;
}

export function useAlertFeed(options?: { enabled?: boolean }) {
  const enabled = options?.enabled ?? true;
  // Avoid pulling the full catalog when alerts are disabled (POS first paint).
  const productRows = useQuery(
    api.products.listLowStock,
    enabled ? { limit: 50, threshold: 10 } : "skip",
  );
  const ledgerRows = useQuery(
    api.credits.listAllLedgerVisible,
    enabled ? { limit: 200 } : "skip",
  );
  const planRows = useQuery(
    api.installmentPlans.listAllVisible,
    enabled ? { limit: 200 } : "skip",
  );

  const alertClientIds = useMemo(() => {
    const ids = new Set<string>();
    for (const row of ledgerRows ?? []) ids.add(row.clientId);
    for (const row of planRows ?? []) ids.add(row.clientId);
    return [...ids].slice(0, 500) as Id<"clients">[];
  }, [ledgerRows, planRows]);

  const clientRows = useQuery(
    api.clients.getMany,
    enabled && alertClientIds.length > 0
      ? { clientIds: alertClientIds }
      : "skip",
  );

  const storedAlerts = useSyncExternalStore(
    subscribeStoredAlerts,
    getStoredAlertsSnapshot,
    () => EMPTY_ALERTS,
  );
  const storedRules = useSyncExternalStore(
    subscribeStoredAlerts,
    getStoredRulesSnapshot,
    () => EMPTY_RULES,
  );

  const catalogProducts = useMemo(
    () => (productRows ?? []).map(productFromConvex),
    [productRows],
  );

  const clients = useMemo<Client[]>(
    () => (clientRows ?? []).map(clientFromConvex),
    [clientRows],
  );

  const creditStore = useMemo<CreditStore>(() => {
    const entriesByClient: CreditStore["entriesByClient"] = {};
    for (const row of ledgerRows ?? []) {
      const entry = ledgerEntryFromConvex(row);
      const list = entriesByClient[entry.clientId];
      if (list) list.push(entry);
      else entriesByClient[entry.clientId] = [entry];
    }
    return { entriesByClient };
  }, [ledgerRows]);

  const installmentPlans = useMemo<InstallmentPlan[]>(
    () => (planRows ?? []).map(installmentPlanFromConvex),
    [planRows],
  );

  const clock = useMemo(() => createAlertClock(), []);

  const alerts = useMemo(() => {
    if (!enabled) return [];
    return buildAlertFeed({
      clients,
      creditStore,
      installmentPlans,
      products: catalogProducts,
      storedAlerts,
      storedRules,
      clock,
    });
  }, [
    enabled,
    catalogProducts,
    clients,
    clock,
    creditStore,
    installmentPlans,
    storedAlerts,
    storedRules,
  ]);

  const sortedAlerts = useMemo(
    () => sortAlertsByPriority(alerts),
    [alerts],
  );

  const stats = useMemo(() => {
    const critical = alerts.filter((a) => a.category === "credit_over").length;
    return {
      total: alerts.length,
      critical,
      pending: alerts.length - critical,
    };
  }, [alerts]);

  const isLoading =
    enabled &&
    (productRows === undefined ||
      clientRows === undefined ||
      ledgerRows === undefined ||
      planRows === undefined);

  return {
    alerts: sortedAlerts,
    stats,
    clients,
    creditStore,
    installmentPlans,
    isLoading,
  };
}
