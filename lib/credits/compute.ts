import type { LedgerEntry } from "@/lib/credits/types";

export type LedgerSummary = {
  totalInvoicedMad: number;
  totalPaidMad: number;
  totalReturnedMad: number;
  /**
   * Accounting net: achats − encaissé − retours.
   * Positive = client owes; negative = client overpaid.
   */
  balanceMad: number;
  /**
   * Client solde: encaissé + retours − achats.
   * Positive = client credit (paid more than bought); negative = owes (show red).
   */
  soldeMad: number;
};

export function isLedgerReturn(
  entry: Pick<LedgerEntry, "kind" | "source">,
): boolean {
  return entry.kind === "return" || entry.source === "return";
}

export function isLedgerPayment(
  entry: Pick<LedgerEntry, "kind" | "source">,
): boolean {
  return entry.kind === "payment" && !isLedgerReturn(entry);
}

export type ClientLedgerTotals = {
  totalInvoicedMad: number;
  totalPaidMad: number;
  totalReturnedMad: number;
};

/** Solde from full-ledger totals (same formula as summarizeLedger). */
export function soldeFromLedgerTotals(
  totals: ClientLedgerTotals,
  initialSoldeMad = 0,
): number {
  const ledgerBalanceMad =
    Math.round(
      (totals.totalInvoicedMad -
        totals.totalPaidMad -
        totals.totalReturnedMad) *
        100,
    ) / 100;
  const init = Math.round(initialSoldeMad * 100) / 100;
  return Math.round((-ledgerBalanceMad + init) * 100) / 100;
}

export function summarizeLedger(
  entries: LedgerEntry[],
  initialSoldeMad = 0,
): LedgerSummary {
  let totalInvoicedMad = 0;
  let totalPaidMad = 0;
  let totalReturnedMad = 0;
  for (const e of entries) {
    if (e.kind === "invoice") totalInvoicedMad += e.amountMad;
    else if (isLedgerReturn(e)) totalReturnedMad += e.amountMad;
    else if (isLedgerPayment(e)) totalPaidMad += e.amountMad;
  }
  const soldeMad = soldeFromLedgerTotals(
    { totalInvoicedMad, totalPaidMad, totalReturnedMad },
    initialSoldeMad,
  );
  return {
    totalInvoicedMad,
    totalPaidMad,
    totalReturnedMad,
    balanceMad: Math.round((-soldeMad) * 100) / 100,
    soldeMad,
  };
}

/**
 * Encours for credit-limit checks: unpaid invoices adjusted by opening solde.
 * Negative initial solde (dette) raises encours; positive (avoir) lowers it.
 */
export function outstandingWithInitialSolde(
  outstandingMad: number,
  initialSoldeMad = 0,
): number {
  return (
    Math.max(
      0,
      Math.round((outstandingMad - initialSoldeMad) * 100) / 100,
    )
  );
}

export function getLastClientPayment(
  entries: LedgerEntry[],
): { date: string; amountMad: number } | null {
  const payment = entries.find(isLedgerPayment);
  if (!payment) return null;
  return { date: payment.date, amountMad: payment.amountMad };
}

/**
 * Chronological running solde after each entry (UI: +avoir / −dette).
 * Invoice decreases solde; payment / return increases it.
 */
export function runningSoldeAfterByEntryId(
  entries: readonly Pick<
    LedgerEntry,
    "id" | "date" | "kind" | "source" | "amountMad"
  >[],
  initialSoldeMad = 0,
): Map<string, number> {
  const sorted = [...entries].sort((a, b) => {
    const byDate = a.date.localeCompare(b.date);
    if (byDate !== 0) return byDate;
    return a.id.localeCompare(b.id);
  });

  let running = Math.round(initialSoldeMad * 100) / 100;
  const byId = new Map<string, number>();

  for (const entry of sorted) {
    const amount = Math.round(entry.amountMad * 100) / 100;
    if (entry.kind === "invoice") {
      running = Math.round((running - amount) * 100) / 100;
    } else {
      // payment or return (including payment+return source)
      running = Math.round((running + amount) * 100) / 100;
    }
    byId.set(entry.id, running);
  }

  return byId;
}
