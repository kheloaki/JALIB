import {
  formatDocumentDate,
  type DocumentLocale,
} from "@/lib/i18n/document-labels";

/** Matches on-screen client receipt money formatting (comma decimals, no currency suffix). */
export function formatReceiptMoney(
  amount: number,
  locale: DocumentLocale,
): string {
  return amount.toLocaleString(locale === "ar" ? "ar-MA" : "fr-FR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function formatReceiptDateTime(
  date: string,
  time: string,
  locale: DocumentLocale,
): string {
  return `${formatDocumentDate(date, locale)} ${time}`;
}

/** Stable LTR date/time for PDF (ASCII digits, matches on-screen tabular layout). */
export function formatReceiptDateTimeForPdf(date: string, time: string): string {
  const [year, month, day] = date.split("-");
  if (!year || !month || !day) return time;
  return `${day}/${month}/${year} ${time}`;
}

export function formatReceiptLineQty(
  unitPriceMad: number,
  qty: number,
  locale: DocumentLocale,
): string {
  return `${formatReceiptMoney(unitPriceMad, locale)} × ${qty}`;
}
