import { isLedgerPayment, isLedgerReturn } from "@/lib/credits/compute";
import type { LedgerEntry, LedgerStatus } from "@/lib/credits/types";
import {
  type DocumentLocale,
  getDocumentLabels,
} from "@/lib/i18n/document-labels";
import { formatMad } from "@/lib/money/mad";

export function statementKindLabel(
  entry: LedgerEntry,
  locale: DocumentLocale = "fr",
): string {
  const labels = getDocumentLabels(locale).credit;
  if (isLedgerReturn(entry)) return labels.kindReturn;
  if (isLedgerPayment(entry)) return labels.kindPayment;
  return labels.kindInvoice;
}

export function statementStatusLabel(
  status: LedgerStatus,
  locale: DocumentLocale = "fr",
): string {
  const labels = getDocumentLabels(locale).credit;
  switch (status) {
    case "valide":
      return labels.statusValid;
    case "impayé":
      return labels.statusUnpaid;
    case "solde":
      return labels.statusSettled;
    default:
      return status;
  }
}

/** ASCII-safe amount for PDF / print (Helvetica lacks Unicode minus). */
export function statementAmountDisplay(entry: LedgerEntry): string {
  const amount = formatMad(entry.amountMad);
  return entry.kind === "invoice" ? `- ${amount}` : `+ ${amount}`;
}

export function statementNoteDisplay(note: string): string {
  const trimmed = note.trim();
  if (!trimmed) return "-";
  return trimmed;
}

export function statementRowClass(entry: LedgerEntry): string {
  if (isLedgerReturn(entry)) return "bg-orange-50";
  if (isLedgerPayment(entry)) return "bg-green-50";
  return "";
}

/** RGB fill for PDF/print history rows. */
export function statementRowFillRgb(
  entry: LedgerEntry,
): [number, number, number] | null {
  if (isLedgerReturn(entry)) return [255, 247, 237];
  if (isLedgerPayment(entry)) return [240, 253, 244];
  return null;
}
