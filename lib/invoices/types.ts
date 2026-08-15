export type InvoicePaymentType = "cash" | "credit";

export type InvoiceStatus = "paid" | "pending" | "returned";

/**
 * Ligne de facture normalisée.
 * Invariants runtime attendus:
 * - `qty` est un entier strictement positif.
 * - `unitPriceMad` est strictement positif.
 * - `returnedQty` est un entier >= 0 et <= `qty`.
 */
export type InvoiceLine = {
  lineIndex?: number;
  nameAr: string;
  qty: number;
  unitPriceMad: number;
  returnedQty?: number;
  productId?: string;
  image?: string;
  imageAlt?: string;
  /** Set when lines from several invoices are merged into one PDF table. */
  sourceInvoiceNumber?: string;
  sourceInvoiceDate?: string;
  /** Purchase total of the source invoice (increases running solde). */
  sourceInvoiceTotalMad?: number;
  /**
   * Statement rows in a merged client PDF:
   * - `payment` = recouvrement (credit)
   * - `return` = retour / remboursement (credit, shown in red)
   */
  sourceKind?: "product" | "payment" | "return";
  sourcePaymentAmountMad?: number;
  sourcePaymentNote?: string;
};

/**
 * Valide et normalise une ligne de facture.
 * Retourne `null` si la ligne ne respecte pas les invariants.
 */
export function validateInvoiceLine(input: unknown): InvoiceLine | null {
  if (!input || typeof input !== "object") return null;
  const line = input as Partial<InvoiceLine>;
  if (typeof line.nameAr !== "string" || !line.nameAr.trim()) return null;
  if (typeof line.qty !== "number" || !Number.isFinite(line.qty)) return null;
  if (
    typeof line.unitPriceMad !== "number" ||
    !Number.isFinite(line.unitPriceMad)
  ) {
    return null;
  }
  const qty = Math.floor(line.qty);
  if (qty <= 0) return null;
  const unitPriceMad = Math.round(line.unitPriceMad * 100) / 100;
  if (unitPriceMad <= 0) return null;
  const returnedQtyRaw =
    typeof line.returnedQty === "number" && Number.isFinite(line.returnedQty)
      ? Math.floor(line.returnedQty)
      : 0;
  if (returnedQtyRaw < 0 || returnedQtyRaw > qty) return null;
  return {
    nameAr: line.nameAr.trim(),
    qty,
    unitPriceMad,
    ...(returnedQtyRaw > 0 ? { returnedQty: returnedQtyRaw } : {}),
  };
}

export type InvoiceSummary = {
  id: string;
  number: string;
  barcode: string;
  date: string;
  time: string;
  clientName: string;
  cashierId: string;
  paymentType: InvoicePaymentType;
  totalMad: number;
  status: InvoiceStatus;
};

export type InvoicePaymentHistoryItem = {
  id: string;
  /** ISO date YYYY-MM-DD */
  date: string;
  amountMad: number;
  note: string;
  ref: string;
};

type InvoiceBase = {
  id: string;
  number: string;
  barcode: string;
  /** ISO date YYYY-MM-DD */
  date: string;
  time: string;
  /** Linked client when known (needed for relevé versements). */
  clientId?: string | null;
  clientName: string;
  cashierId: string;
  lines: InvoiceLine[];
  totalMad: number;
  /** Settled paid amount (FIFO + linked). Prefer over summing history. */
  paidMad?: number;
  /** Remaining owed after client settlement. */
  remainingMad?: number;
  /**
   * Debt-positive opening for merged client statement PDFs
   * (initial solde + prior activity). Purchases raise it; payments lower it.
   */
  statementOpeningBalanceMad?: number;
};

/** Vente réglée comptant. Invariant runtime: l'historique doit représenter les encaissements nets. */
type InvoicePaidCash = InvoiceBase & {
  status: "paid";
  paymentType: "cash";
  paymentHistory: InvoicePaymentHistoryItem[];
};

/** Vente crédit soldée. Invariant runtime: la somme des paiements couvre le total. */
type InvoicePaidCredit = InvoiceBase & {
  status: "paid";
  paymentType: "credit";
  paymentHistory: InvoicePaymentHistoryItem[];
};

/** Vente crédit encore ouverte. Invariant runtime: la somme des paiements reste < total. */
type InvoicePendingCredit = InvoiceBase & {
  status: "pending";
  paymentType: "credit";
  paymentHistory: InvoicePaymentHistoryItem[];
};

/** Facture avec retour(s) (partiel ou total), comptant ou crédit. */
type InvoiceReturned = InvoiceBase & {
  status: "returned";
  paymentType: InvoicePaymentType;
  paymentHistory: InvoicePaymentHistoryItem[];
};

export type Invoice =
  | InvoicePaidCash
  | InvoicePaidCredit
  | InvoicePendingCredit
  | InvoiceReturned;
