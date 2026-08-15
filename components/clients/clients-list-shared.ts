import {
  outstandingWithInitialSolde,
  soldeFromLedgerTotals,
  summarizeLedger,
} from "@/lib/credits/compute";
import { computeClientOutstandingMad } from "@/lib/credits/invoice-settlement";
import { balanceTone } from "@/lib/credits/ledger-ui";
import type { CreditStore } from "@/lib/credits/types";
import type { Client } from "@/lib/clients/types";
import { formatMadCompact } from "@/lib/money/mad";

export type ClientsTr = (fr: string, ar: string) => string;

export type ClientLedgerStatRow = {
  totalInvoicedMad: number;
  totalPaidMad: number;
  totalReturnedMad: number;
  lastPaymentDate?: string | null;
  lastPaymentAmountMad?: number | null;
};

export function creditTypeLabel(client: Client, tr: ClientsTr) {
  if (client.isCashOnly) {
    return { label: tr("Comptant", "نقدي"), className: "text-error" };
  }
  return { label: tr("Crédit", "آجل"), className: "text-primary" };
}

export function creditLimitLabel(
  client: Client,
  tr: ClientsTr,
  locale: string,
) {
  if (client.isCashOnly) return "—";
  if (client.creditLimitMad === null) {
    return tr("Sans plafond", "بدون سقف");
  }
  return formatMadCompact(client.creditLimitMad, 0, locale);
}

export function clientLedgerSummary(
  client: Client,
  creditStore: CreditStore,
  ledgerStatsByClientId?: Map<string, ClientLedgerStatRow>,
) {
  const stats = ledgerStatsByClientId?.get(client.id);
  if (stats) {
    const soldeMad = soldeFromLedgerTotals(stats, client.initialSoldeMad);
    const outstandingMad = Math.max(0, Math.round(-soldeMad * 100) / 100);
    const summary = {
      totalInvoicedMad: stats.totalInvoicedMad,
      totalPaidMad: stats.totalPaidMad,
      totalReturnedMad: stats.totalReturnedMad,
      balanceMad: Math.round((-soldeMad) * 100) / 100,
      soldeMad,
    };
    const tone = balanceTone(outstandingMad);
    return { summary, outstandingMad, soldeMad, tone };
  }
  const entries = creditStore.entriesByClient[client.id] ?? [];
  const summary = summarizeLedger(entries, client.initialSoldeMad);
  const outstandingMad = outstandingWithInitialSolde(
    computeClientOutstandingMad(entries),
    client.initialSoldeMad,
  );
  const tone = balanceTone(outstandingMad);
  return { summary, outstandingMad, soldeMad: summary.soldeMad, tone };
}

export function clientInitials(fullName: string): string {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return `${parts[0]![0] ?? ""}${parts[parts.length - 1]![0] ?? ""}`.toUpperCase();
}
