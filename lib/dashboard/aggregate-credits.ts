import { isLedgerPayment, summarizeLedger } from "@/lib/credits/compute";
import type { Client } from "@/lib/clients/types";
import type { CreditStore, LedgerEntry } from "@/lib/credits/types";

export function flattenLedgerEntries(store: CreditStore): LedgerEntry[] {
  return Object.values(store.entriesByClient).flat();
}

export type GlobalCreditTotals = {
  totalInvoicedMad: number;
  totalPaidMad: number;
  totalReturnedMad: number;
  /** Somme des encours positifs par client (dette). */
  totalOutstandingMad: number;
  clientsWithDebt: number;
};

export function computeGlobalCreditTotals(
  store: CreditStore,
  clients: Client[],
): GlobalCreditTotals {
  const clientById = new Map(clients.map((c) => [c.id, c]));
  const clientIds = clients.map((c) => c.id);
  let totalInvoicedMad = 0;
  let totalPaidMad = 0;
  let totalReturnedMad = 0;
  let totalOutstandingMad = 0;
  let clientsWithDebt = 0;

  for (const id of clientIds) {
    const entries = store.entriesByClient[id] ?? [];
    const initialSoldeMad = clientById.get(id)?.initialSoldeMad ?? 0;
    const s = summarizeLedger(entries, initialSoldeMad);
    totalInvoicedMad += s.totalInvoicedMad;
    totalPaidMad += s.totalPaidMad;
    totalReturnedMad += s.totalReturnedMad;
    if (s.balanceMad > 0) {
      totalOutstandingMad += s.balanceMad;
      clientsWithDebt += 1;
    }
  }

  return {
    totalInvoicedMad,
    totalPaidMad,
    totalReturnedMad,
    totalOutstandingMad,
    clientsWithDebt,
  };
}

export type ClientBalanceRow = {
  clientId: string;
  fullName: string;
  balanceMad: number;
};

export function computeClientBalances(
  store: CreditStore,
  clients: Client[],
): ClientBalanceRow[] {
  return clients.map((c) => {
    const s = summarizeLedger(
      store.entriesByClient[c.id] ?? [],
      c.initialSoldeMad,
    );
    return {
      clientId: c.id,
      fullName: c.fullName,
      balanceMad: s.balanceMad,
    };
  });
}

export type MonthInvoicedPaid = {
  monthKey: string;
  /** Libellé court pour l’axe (ex. mai 24) */
  label: string;
  invoicedMad: number;
  paidMad: number;
};

function monthKeyFromIso(iso: string): string {
  return iso.slice(0, 7);
}

function formatMonthLabelFr(monthKey: string): string {
  const [y, m] = monthKey.split("-").map(Number);
  const d = new Date(y, (m ?? 1) - 1, 1);
  return d.toLocaleDateString("fr-FR", { month: "short", year: "2-digit" });
}

/** Dernières tranches mensuelles avec facturation vs encaissements (crédits). */
export function computeMonthlyInvoicedPaidSeries(
  store: CreditStore,
  maxMonths = 6,
): MonthInvoicedPaid[] {
  const entries = flattenLedgerEntries(store);
  const keys = new Set<string>();
  for (const e of entries) {
    keys.add(monthKeyFromIso(e.date));
  }
  const sorted = [...keys].sort();
  const tail = sorted.slice(-maxMonths);

  if (tail.length === 0) return [];

  return tail.map((monthKey) => {
    let invoicedMad = 0;
    let paidMad = 0;
    for (const e of entries) {
      if (monthKeyFromIso(e.date) !== monthKey) continue;
      if (e.kind === "invoice") invoicedMad += e.amountMad;
      else if (isLedgerPayment(e)) paidMad += e.amountMad;
    }
    return {
      monthKey,
      label: formatMonthLabelFr(monthKey),
      invoicedMad,
      paidMad,
    };
  });
}
