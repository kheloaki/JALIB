import {
  isLedgerPayment,
  isLedgerReturn,
  outstandingWithInitialSolde,
  summarizeLedger,
  type LedgerSummary,
} from "@/lib/credits/compute";
import type { LedgerEntry, LedgerStatus } from "@/lib/credits/types";

const EPS_MAD = 0.01;

function invoiceNumberSortKey(ref: string): string {
  const match = ref.match(/INV-(\d+)/i);
  return match ? match[1]!.padStart(12, "0") : ref;
}

type InvoiceBalance = {
  invoiceId: string;
  date: string;
  refSortKey: string;
  sortKey: string;
  remainingMad: number;
};

type ClientInvoiceSettlement = {
  statusByInvoiceId: Map<string, Extract<LedgerStatus, "impayé" | "solde">>;
  outstandingMad: number;
};

function compareInvoiceOrder(a: InvoiceBalance, b: InvoiceBalance): number {
  const byDate = a.date.localeCompare(b.date);
  if (byDate !== 0) return byDate;
  const byRef = a.refSortKey.localeCompare(b.refSortKey);
  if (byRef !== 0) return byRef;
  return a.sortKey.localeCompare(b.sortKey);
}

function runClientInvoiceSettlement(
  entries: readonly LedgerEntry[],
): ClientInvoiceSettlement {
  const sorted = [...entries].sort((a, b) => {
    const byDate = a.date.localeCompare(b.date);
    if (byDate !== 0) return byDate;
    return a.id.localeCompare(b.id);
  });

  const invoicesById = new Map<string, InvoiceBalance>();
  for (const entry of sorted) {
    if (entry.kind === "invoice" && entry.invoiceId) {
      invoicesById.set(entry.invoiceId, {
        invoiceId: entry.invoiceId,
        date: entry.date,
        refSortKey: invoiceNumberSortKey(entry.ref),
        sortKey: entry.id,
        remainingMad: entry.amountMad,
      });
    }
  }

  const invoiceOrder = () => [...invoicesById.values()].sort(compareInvoiceOrder);

  function applyCredit(amountMad: number, targetInvoiceId?: string) {
    let left = amountMad;

    if (targetInvoiceId) {
      const invoice = invoicesById.get(targetInvoiceId);
      if (invoice && invoice.remainingMad > EPS_MAD) {
        const applied = Math.min(left, invoice.remainingMad);
        invoice.remainingMad =
          Math.round((invoice.remainingMad - applied) * 100) / 100;
        left = Math.round((left - applied) * 100) / 100;
      }
      return;
    }

    for (const invoice of invoiceOrder()) {
      if (left <= EPS_MAD) break;
      if (invoice.remainingMad <= EPS_MAD) continue;
      const applied = Math.min(left, invoice.remainingMad);
      invoice.remainingMad =
        Math.round((invoice.remainingMad - applied) * 100) / 100;
      left = Math.round((left - applied) * 100) / 100;
    }
  }

  for (const entry of sorted) {
    if (entry.kind === "invoice") continue;
    if (isLedgerPayment(entry) || isLedgerReturn(entry)) {
      applyCredit(entry.amountMad, entry.invoiceId ?? undefined);
    }
  }

  const statusByInvoiceId = new Map<
    string,
    Extract<LedgerStatus, "impayé" | "solde">
  >();
  for (const invoice of invoicesById.values()) {
    statusByInvoiceId.set(
      invoice.invoiceId,
      invoice.remainingMad <= EPS_MAD ? "solde" : "impayé",
    );
  }

  let outstandingMad = 0;
  for (const invoice of invoicesById.values()) {
    if (invoice.remainingMad > EPS_MAD) {
      outstandingMad += invoice.remainingMad;
    }
  }

  return {
    statusByInvoiceId,
    outstandingMad: Math.round(outstandingMad * 100) / 100,
  };
}

/**
 * FIFO settlement for one client's ledger rows (mirrors convex/invoiceCreditAdjustments).
 */
export function computeClientInvoiceSettlementStatuses(
  entries: readonly LedgerEntry[],
): Map<string, Extract<LedgerStatus, "impayé" | "solde">> {
  return runClientInvoiceSettlement(entries).statusByInvoiceId;
}

/** Remaining unpaid invoice amounts after FIFO payment allocation. */
export function computeClientOutstandingMad(
  entries: readonly LedgerEntry[],
): number {
  return runClientInvoiceSettlement(entries).outstandingMad;
}

/** FIFO settlement grouped by client — required when rendering all clients together. */
export function computeAllClientsInvoiceSettlementStatuses(
  entries: readonly LedgerEntry[],
): Map<string, Extract<LedgerStatus, "impayé" | "solde">> {
  const result = new Map<string, Extract<LedgerStatus, "impayé" | "solde">>();
  const byClientId = new Map<string, LedgerEntry[]>();

  for (const entry of entries) {
    const list = byClientId.get(entry.clientId) ?? [];
    list.push(entry);
    byClientId.set(entry.clientId, list);
  }

  for (const clientEntries of byClientId.values()) {
    const clientSettlement = runClientInvoiceSettlement(clientEntries);
    for (const [invoiceId, status] of clientSettlement.statusByInvoiceId) {
      result.set(invoiceId, status);
    }
  }

  return result;
}

export function resolveInvoiceRowStatus(
  row: LedgerEntry,
  settlementByInvoiceId: Map<string, Extract<LedgerStatus, "impayé" | "solde">>,
): LedgerStatus {
  if (row.kind === "invoice" && row.invoiceId) {
    return settlementByInvoiceId.get(row.invoiceId) ?? row.status;
  }
  return row.status;
}

export type ClientLedgerSummary = LedgerSummary & {
  /** En cours — remaining unpaid after FIFO allocation (≥ 0). */
  outstandingMad: number;
};

export function summarizeClientLedger(
  entries: readonly LedgerEntry[],
  initialSoldeMad = 0,
): ClientLedgerSummary {
  const summary = summarizeLedger([...entries], initialSoldeMad);
  return {
    ...summary,
    outstandingMad: outstandingWithInitialSolde(
      computeClientOutstandingMad(entries),
      initialSoldeMad,
    ),
  };
}
