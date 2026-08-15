import type { CartLine, PaymentMethod } from "@/components/pos/types";
import type { Invoice, InvoiceLine } from "@/lib/invoices/types";

export function remainingInvoiceLineQty(line: InvoiceLine): number {
  return Math.max(0, line.qty - (line.returnedQty ?? 0));
}

export function invoiceLineKey(line: InvoiceLine, fallbackIndex: number): number {
  return line.lineIndex ?? fallbackIndex;
}

export function invoiceLinesToCartLines(invoice: Invoice): CartLine[] {
  return invoice.lines
    .map((line, idx) => {
      const qty = remainingInvoiceLineQty(line);
      if (qty <= 0) return null;
      const lineIndex = invoiceLineKey(line, idx);
      return {
        productId: line.productId ?? `invoice-reopen:${invoice.id}:${lineIndex}`,
        name: line.nameAr,
        unitPrice: line.unitPriceMad,
        qty,
        ...(line.image ? { image: line.image } : {}),
        ...(line.imageAlt ? { imageAlt: line.imageAlt } : {}),
      } satisfies CartLine;
    })
    .filter((line): line is CartLine => line != null);
}

export type InvoicePriceTotals = {
  originalTotalMad: number;
  newTotalMad: number;
  differenceMad: number;
};

export function computeInvoicePriceTotals(
  lines: InvoiceLine[],
  unitPriceByLine: Record<number, number>,
): InvoicePriceTotals {
  let originalTotalMad = 0;
  let newTotalMad = 0;

  for (const [idx, line] of lines.entries()) {
    const lineIndex = invoiceLineKey(line, idx);
    const qty = remainingInvoiceLineQty(line);
    if (qty <= 0) continue;
    originalTotalMad += line.unitPriceMad * qty;
    const unitPrice = unitPriceByLine[lineIndex] ?? line.unitPriceMad;
    newTotalMad += unitPrice * qty;
  }

  const original = Math.round(originalTotalMad * 100) / 100;
  const updated = Math.round(newTotalMad * 100) / 100;
  return {
    originalTotalMad: original,
    newTotalMad: updated,
    differenceMad: Math.round((updated - original) * 100) / 100,
  };
}

export type PosInvoiceReopenPayload = {
  invoiceId: string;
  clientId: string;
  payment: PaymentMethod;
  lines: CartLine[];
  ledgerEntryId: string;
  invoiceNumber: string;
  /** When true, only checks whether the cart can accept a reload. */
  dryRun?: boolean;
};

export const PENDING_INVOICE_REOPEN_KEY = "matjar:pos:pending-invoice-reopen:v1";

export function writePendingInvoiceReopen(payload: PosInvoiceReopenPayload) {
  if (typeof window === "undefined") return;
  window.sessionStorage.setItem(PENDING_INVOICE_REOPEN_KEY, JSON.stringify(payload));
}

export function readPendingInvoiceReopen(): PosInvoiceReopenPayload | null {
  if (typeof window === "undefined") return null;
  const raw = window.sessionStorage.getItem(PENDING_INVOICE_REOPEN_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as PosInvoiceReopenPayload;
    if (!parsed || typeof parsed !== "object") return null;
    if (!Array.isArray(parsed.lines)) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function clearPendingInvoiceReopen() {
  if (typeof window === "undefined") return;
  window.sessionStorage.removeItem(PENDING_INVOICE_REOPEN_KEY);
}
