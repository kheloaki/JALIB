import type {
  Invoice,
  InvoicePaymentHistoryItem,
  InvoiceLine,
  InvoicePaymentType,
  InvoiceStatus,
} from "@/lib/invoices/types";
import { validateInvoiceLine } from "@/lib/invoices/types";
import {
  generateInvoiceBarcode,
  isValidEan13,
  normalizeInvoiceBarcode,
} from "@/lib/invoices/barcode";
import { LEGACY_MOCK_INVOICE_IDS, MOCK_INVOICES } from "@/lib/invoices/mock-data";

export const INVOICES_STORAGE_KEY = "matjar_invoices_v1";
/** Événement same-tab déclenché après écriture locale des factures. */
export const INVOICES_STORAGE_EVENT = "matjar:invoices-storage-updated";
export const DEFAULT_INVOICE_CASHIER_ID = "Yassine Ifguisse";

type AppendInvoiceInput = {
  clientName: string;
  paymentType: InvoicePaymentType;
  totalMad: number;
  status?: InvoiceStatus;
  lines: InvoiceLine[];
  paymentHistory?: InvoicePaymentHistoryItem[];
  cashierId?: string;
  now?: Date;
};

type AppendInvoicePaymentInput = {
  invoiceId: string;
  payment: InvoicePaymentHistoryItem;
};

type ApplyInvoiceReturnInput = {
  invoiceId: string;
  lines: Array<{ lineIndex: number; qtyReturned: number }>;
  date: string;
  note?: string;
};

function isPaymentType(x: unknown): x is InvoicePaymentType {
  return x === "cash" || x === "credit";
}

function isStatus(x: unknown): x is InvoiceStatus {
  return x === "paid" || x === "pending" || x === "returned";
}

function isValidStatusForPaymentType(
  paymentType: InvoicePaymentType,
  status: InvoiceStatus,
): boolean {
  if (status === "pending") return paymentType === "credit";
  return true;
}

function normalizeLine(o: unknown): InvoiceLine | null {
  return validateInvoiceLine(o);
}

function normalizePaymentHistoryItem(
  o: unknown,
): InvoicePaymentHistoryItem | null {
  if (!o || typeof o !== "object") return null;
  const r = o as Record<string, unknown>;
  if (
    typeof r.id !== "string" ||
    typeof r.date !== "string" ||
    typeof r.note !== "string" ||
    typeof r.ref !== "string"
  ) {
    return null;
  }
  if (typeof r.amountMad !== "number" || !Number.isFinite(r.amountMad)) {
    return null;
  }
  return {
    id: r.id,
    date: r.date,
    amountMad: Math.round(r.amountMad * 100) / 100,
    note: r.note,
    ref: r.ref,
  };
}

function normalizeInvoice(o: unknown): Invoice | null {
  if (!o || typeof o !== "object") return null;
  const r = o as Record<string, unknown>;
  if (typeof r.id !== "string" || typeof r.number !== "string") return null;
  const barcode =
    typeof r.barcode === "string" ? normalizeInvoiceBarcode(r.barcode) : "";
  if (typeof r.date !== "string" || typeof r.time !== "string") return null;
  if (typeof r.clientName !== "string") return null;
  if (!isPaymentType(r.paymentType) || !isStatus(r.status)) return null;
  if (!isValidStatusForPaymentType(r.paymentType, r.status)) return null;
  if (typeof r.totalMad !== "number" || !Number.isFinite(r.totalMad)) return null;
  if (typeof r.cashierId !== "string") return null;
  if (!Array.isArray(r.lines)) return null;
  const lines = r.lines
    .map(normalizeLine)
    .filter((x): x is InvoiceLine => x !== null);
  if (lines.length === 0) return null;
  const paymentHistory = Array.isArray(r.paymentHistory)
    ? r.paymentHistory
        .map(normalizePaymentHistoryItem)
        .filter((x): x is InvoicePaymentHistoryItem => x !== null)
    : [];
  return {
    id: r.id,
    number: r.number,
    barcode,
    date: r.date,
    time: r.time,
    clientName: r.clientName,
    paymentType: r.paymentType,
    totalMad: r.totalMad,
    status: r.status,
    cashierId: r.cashierId,
    lines,
    paymentHistory,
  } as Invoice;
}

function seedInvoices(): Invoice[] {
  return MOCK_INVOICES.map((inv) => ({
    ...inv,
    lines: inv.lines.map((l) => ({ ...l })),
    paymentHistory: (inv.paymentHistory ?? []).map((p) => ({ ...p })),
  }));
}

function isLegacyMockInvoiceList(list: Invoice[]): boolean {
  return (
    list.length > 0 &&
    list.length === LEGACY_MOCK_INVOICE_IDS.size &&
    list.every((invoice) => LEGACY_MOCK_INVOICE_IDS.has(invoice.id))
  );
}

function extractInvoiceNumberValue(number: string): number | null {
  const match = number.match(/(\d+)/g);
  if (!match || match.length === 0) return null;
  const lastChunk = match[match.length - 1];
  const parsed = Number.parseInt(lastChunk, 10);
  return Number.isFinite(parsed) ? parsed : null;
}

function getNextInvoiceNumber(list: Invoice[]): string {
  const maxExisting = list.reduce((max, invoice) => {
    const value = extractInvoiceNumberValue(invoice.number);
    return value === null ? max : Math.max(max, value);
  }, 1000);
  return `INV-${maxExisting + 1}`;
}

export function invoicePaidMad(invoice: Invoice): number {
  if (typeof invoice.paidMad === "number" && Number.isFinite(invoice.paidMad)) {
    return Math.round(invoice.paidMad * 100) / 100;
  }
  return Math.round(
    invoice.paymentHistory.reduce((sum, item) => sum + item.amountMad, 0) * 100,
  ) / 100;
}

export function invoiceRemainingQty(line: InvoiceLine): number {
  return Math.max(0, line.qty - (line.returnedQty ?? 0));
}

export function invoiceRemainingMad(invoice: Invoice): number {
  if (
    typeof invoice.remainingMad === "number" &&
    Number.isFinite(invoice.remainingMad)
  ) {
    return Math.max(0, Math.round(invoice.remainingMad * 100) / 100);
  }
  return Math.max(0, Math.round((invoice.totalMad - invoicePaidMad(invoice)) * 100) / 100);
}

function deriveInvoiceStatus(invoice: Invoice): InvoiceStatus {
  const hasReturnedItems = invoice.lines.some((line) => (line.returnedQty ?? 0) > 0);
  if (hasReturnedItems && invoice.totalMad <= 0) return "returned";
  if (invoice.paymentType === "cash") return "paid";
  return invoiceRemainingMad(invoice) <= 0 ? "paid" : "pending";
}

type DraftInvoice = {
  id: string;
  number: string;
  barcode: string;
  date: string;
  time: string;
  clientName: string;
  paymentType: InvoicePaymentType;
  totalMad: number;
  status: InvoiceStatus;
  cashierId: string;
  lines: InvoiceLine[];
  paymentHistory: InvoicePaymentHistoryItem[];
};

function materializeInvoice(draft: DraftInvoice): Invoice {
  if (draft.status === "pending") {
    return {
      ...draft,
      paymentType: "credit",
      status: "pending",
    };
  }
  if (draft.status === "returned") {
    return {
      ...draft,
      status: "returned",
    };
  }
  if (draft.paymentType === "cash") {
    return {
      ...draft,
      paymentType: "cash",
      status: "paid",
    };
  }
  return {
    ...draft,
    paymentType: "credit",
    status: "paid",
  };
}

/**
 * Lit les factures depuis localStorage. Si vide ou invalide, initialise avec
 * les données de démo et les persiste.
 */
export function readInvoices(): Invoice[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(INVOICES_STORAGE_KEY);
    if (!raw) {
      const seed = seedInvoices();
      writeInvoices(seed);
      return seed;
    }
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      const seed = seedInvoices();
      writeInvoices(seed);
      return seed;
    }
    let list = parsed
      .map(normalizeInvoice)
      .filter((x): x is Invoice => x !== null);
    if (list.length === 0) {
      const seed = seedInvoices();
      writeInvoices(seed);
      return seed;
    }
    if (isLegacyMockInvoiceList(list)) {
      const seed = seedInvoices();
      writeInvoices(seed);
      return seed;
    }
    let needsRewrite = false;
    list = list.map((invoice, index, arr) => {
      if (isValidEan13(invoice.barcode)) return invoice;
      needsRewrite = true;
      const prior = arr
        .slice(0, index)
        .map((item) =>
          isValidEan13(item.barcode)
            ? item
            : {
                ...item,
                barcode: generateInvoiceBarcode(arr.slice(0, index)),
              },
        );
      return {
        ...invoice,
        barcode: generateInvoiceBarcode(prior),
      };
    });
    if (needsRewrite) {
      writeInvoices(list);
    }
    return list;
  } catch {
    const seed = seedInvoices();
    writeInvoices(seed);
    return seed;
  }
}

export function writeInvoices(invoices: Invoice[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(INVOICES_STORAGE_KEY, JSON.stringify(invoices));
    window.dispatchEvent(
      new CustomEvent(INVOICES_STORAGE_EVENT, {
        detail: { key: INVOICES_STORAGE_KEY },
      }),
    );
  } catch {
    // quota / navigation privée
  }
}

export function appendInvoice(input: AppendInvoiceInput): Invoice {
  const current = readInvoices();
  const now = input.now ?? new Date();
  const normalizedLines = input.lines
    .map((line) => validateInvoiceLine(line))
    .filter((line): line is InvoiceLine => line !== null);
  if (normalizedLines.length !== input.lines.length) {
    throw new Error(
      "appendInvoice: invalid line (qty > 0, unitPriceMad > 0, returnedQty in [0..qty])",
    );
  }
  const draft: DraftInvoice = {
    id: `inv:${crypto.randomUUID()}`,
    number: getNextInvoiceNumber(current),
    barcode: generateInvoiceBarcode(current),
    date: now.toISOString().slice(0, 10),
    time: now.toLocaleTimeString("fr-FR", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }),
    clientName: input.clientName,
    paymentType: input.paymentType,
    totalMad: Math.round(input.totalMad * 100) / 100,
    status: input.status ?? "pending",
    cashierId: input.cashierId ?? DEFAULT_INVOICE_CASHIER_ID,
    lines: normalizedLines.map((line) => ({ ...line })),
    paymentHistory: (input.paymentHistory ?? []).map((item) => ({ ...item })),
  };
  if (input.status == null || !isValidStatusForPaymentType(draft.paymentType, draft.status)) {
    draft.status = deriveInvoiceStatus(materializeInvoice(draft));
  }
  const invoice = materializeInvoice(draft);
  writeInvoices([invoice, ...current]);
  return invoice;
}

export function appendInvoicePayment(
  input: AppendInvoicePaymentInput,
): Invoice | null {
  const current = readInvoices();
  const index = current.findIndex((invoice) => invoice.id === input.invoiceId);
  if (index < 0) return null;
  const existing = current[index]!;
  const nextInvoice: Invoice = {
    ...existing,
    paymentHistory: [input.payment, ...existing.paymentHistory],
  };
  nextInvoice.status = deriveInvoiceStatus(nextInvoice);
  const next = [...current];
  next[index] = nextInvoice;
  writeInvoices(next);
  return nextInvoice;
}

export function findInvoiceByNumber(number: string): Invoice | null {
  return readInvoices().find((invoice) => invoice.number === number) ?? null;
}

export function findInvoiceById(invoiceId: string): Invoice | null {
  return readInvoices().find((invoice) => invoice.id === invoiceId) ?? null;
}

export function findInvoiceByBarcode(barcode: string): Invoice | null {
  const normalized = normalizeInvoiceBarcode(barcode);
  if (!normalized) return null;
  return readInvoices().find((invoice) => invoice.barcode === normalized) ?? null;
}

export function applyInvoiceReturn(input: ApplyInvoiceReturnInput): Invoice | null {
  const current = readInvoices();
  const index = current.findIndex((invoice) => invoice.id === input.invoiceId);
  if (index < 0) return null;

  const existing = current[index]!;
  let refundTotalMad = 0;
  const nextLines = existing.lines.map((line, lineIndex) => {
    const update = input.lines.find((item) => item.lineIndex === lineIndex);
    if (!update) return line;
    const remainingQty = invoiceRemainingQty(line);
    const qtyReturned = Math.max(0, Math.min(remainingQty, Math.floor(update.qtyReturned)));
    refundTotalMad += qtyReturned * line.unitPriceMad;
    return {
      ...line,
      returnedQty: (line.returnedQty ?? 0) + qtyReturned,
    };
  });

  refundTotalMad = Math.round(refundTotalMad * 100) / 100;
  const nextTotalMad = Math.max(0, Math.round((existing.totalMad - refundTotalMad) * 100) / 100);
  const paidBefore = invoicePaidMad(existing);
  const overpaidMad = Math.max(0, Math.round((paidBefore - nextTotalMad) * 100) / 100);
  const refundHistory =
    overpaidMad > 0
      ? [
          {
            id: `invpay:${crypto.randomUUID()}`,
            date: input.date,
            amountMad: -overpaidMad,
            note: input.note?.trim() || "Retour validé",
            ref: `Retour #RT-${Date.now().toString(36).toUpperCase().slice(-6)}`,
          },
        ]
      : [];

  const nextInvoice: Invoice = {
    ...existing,
    totalMad: nextTotalMad,
    lines: nextLines,
    paymentHistory: [...refundHistory, ...existing.paymentHistory],
  };
  nextInvoice.status = deriveInvoiceStatus(nextInvoice);

  const next = [...current];
  next[index] = nextInvoice;
  writeInvoices(next);
  return nextInvoice;
}
