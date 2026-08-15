import type {
  Invoice,
  InvoiceLine,
  InvoicePaymentHistoryItem,
  InvoicePaymentType,
  InvoiceStatus,
} from "@/lib/invoices/types";

function roundMad(n: number): number {
  return Math.round(n * 100) / 100;
}

function invoiceDateTimeKey(invoice: Invoice): string {
  const time = invoice.time?.trim() || "00:00";
  return `${invoice.date}T${time}`;
}

/** Gross factured amount (before returns) — used as Débit on the statement. */
export function invoiceGrossMad(invoice: Invoice): number {
  return roundMad(
    invoice.lines.reduce((sum, line) => sum + line.qty * line.unitPriceMad, 0),
  );
}

function cloneProductLine(
  line: InvoiceLine,
  lineIndex: number,
  source: Invoice,
): InvoiceLine {
  return {
    nameAr: line.nameAr,
    qty: line.qty,
    unitPriceMad: line.unitPriceMad,
    lineIndex,
    sourceKind: "product",
    sourceInvoiceNumber: source.number,
    sourceInvoiceDate: source.date,
    // Always gross so a later Retour crédit does not double-discount.
    sourceInvoiceTotalMad: invoiceGrossMad(source),
    ...(line.returnedQty != null && line.returnedQty > 0
      ? { returnedQty: line.returnedQty }
      : {}),
    ...(line.productId ? { productId: line.productId } : {}),
    ...(line.image ? { image: line.image } : {}),
    ...(line.imageAlt ? { imageAlt: line.imageAlt } : {}),
  };
}

/** Ledger / cash refunds tagged as returns (Retour #RT-…). */
export function isReturnPayment(payment: InvoicePaymentHistoryItem): boolean {
  const hay = `${payment.ref ?? ""} ${payment.note ?? ""}`.toLowerCase();
  return (
    hay.includes("retour") ||
    /\brt[-\s#]/.test(hay) ||
    payment.ref.trim().toUpperCase().startsWith("RT-")
  );
}

function paymentLine(
  payment: InvoicePaymentHistoryItem,
  lineIndex: number,
  _invoiceNumber: string,
  forceKind?: "payment" | "return",
): InvoiceLine {
  const ref = payment.ref?.trim() || "";
  const note = payment.note?.trim() || "";
  const isReturn =
    forceKind === "return" ||
    (forceKind !== "payment" && isReturnPayment(payment));
  // Exact note/ref only (space join — middle-dot breaks Arabic PDF paint).
  const label =
    note && ref && note !== ref
      ? `${note} ${ref}`
      : ref || note || (isReturn ? "Retour" : "Versement");
  return {
    nameAr: label,
    qty: 1,
    unitPriceMad: payment.amountMad,
    lineIndex,
    sourceKind: isReturn ? "return" : "payment",
    sourceInvoiceNumber: `pay-${payment.id}`,
    sourceInvoiceDate: payment.date,
    sourcePaymentAmountMad: payment.amountMad,
    sourcePaymentNote: note && note !== label ? note : ref,
  };
}

type StatementEvent =
  | { kind: "invoice"; sortKey: string; invoice: Invoice }
  | {
      kind: "payment";
      sortKey: string;
      payment: InvoicePaymentHistoryItem;
      invoiceNumber: string;
      forceKind?: "payment" | "return";
    };

function buildStatementEvents(
  invoices: readonly Invoice[],
  ledgerMovements: readonly StatementLedgerMovement[] = [],
): StatementEvent[] {
  const events: StatementEvent[] = [];
  const seenPaymentIds = new Set<string>();

  for (const invoice of invoices) {
    events.push({
      kind: "invoice",
      sortKey: `${invoiceDateTimeKey(invoice)}|0|${invoice.number}`,
      invoice,
    });
    for (const payment of invoice.paymentHistory) {
      if (!(payment.amountMad > 0)) continue;
      // Ignore synthetic merge aggregate if somehow present.
      if (payment.id === "bulk-merged-paid" || payment.ref === "LOT") continue;
      seenPaymentIds.add(payment.id);
      events.push({
        kind: "payment",
        sortKey: `${payment.date}T99:99|1|${payment.id}`,
        payment,
        invoiceNumber: invoice.number,
      });
    }
  }

  // Global client versements (no invoiceId) + any ledger row not already
  // attached to a selected facture.
  for (const movement of ledgerMovements) {
    if (!(movement.amountMad > 0)) continue;
    if (seenPaymentIds.has(movement.id)) continue;
    seenPaymentIds.add(movement.id);
    events.push({
      kind: "payment",
      sortKey: `${movement.date}T99:99|1|${movement.id}`,
      payment: {
        id: movement.id,
        date: movement.date,
        amountMad: movement.amountMad,
        note: movement.note,
        ref: movement.ref,
      },
      invoiceNumber: "ledger",
      forceKind: movement.kind,
    });
  }

  return events.sort((a, b) => a.sortKey.localeCompare(b.sortKey));
}

export type StatementLedgerMovement = {
  id: string;
  date: string;
  amountMad: number;
  note: string;
  ref: string;
  kind: "payment" | "return";
};

export type MergeInvoicesForPdfOptions = {
  /**
   * Debt-positive opening balance (initial solde + prior activity).
   * Shown as the first statement row; running solde continues from it.
   */
  openingBalanceMad?: number;
  /**
   * Client ledger versements / retours (including global Paiement #PY rows
   * not linked to a facture). Deduped against invoice paymentHistory by id.
   */
  ledgerMovements?: readonly StatementLedgerMovement[];
  /** Used when merging an empty invoice list (opening / versements only). */
  clientName?: string;
};

function emptyShellInvoice(
  clientName: string,
  date: string,
): Invoice {
  return {
    id: `client-releve-${date}`,
    number: `LOT-${date.replace(/-/g, "")}`,
    barcode: "",
    date,
    time: "00:00",
    clientName,
    cashierId: "Relevé client",
    paymentType: "credit",
    totalMad: 0,
    paidMad: 0,
    remainingMad: 0,
    status: "paid",
    lines: [],
    paymentHistory: [],
  };
}

/**
 * Merge several invoices into one synthetic facture for bulk PDF export.
 * Lines follow statement order: purchases then recouvrements by date,
 * so the PDF can show a running solde.
 */
export function mergeInvoicesForPdf(
  invoices: readonly Invoice[],
  options: MergeInvoicesForPdfOptions = {},
): Invoice {
  const hasOpening =
    options.openingBalanceMad != null &&
    Number.isFinite(options.openingBalanceMad);
  const hasLedger = (options.ledgerMovements?.length ?? 0) > 0;

  if (invoices.length === 0) {
    if (!hasOpening && !hasLedger) {
      throw new Error("No invoices to merge.");
    }
    const today = new Date().toISOString().slice(0, 10);
    return mergeInvoicesForPdf(
      [
        emptyShellInvoice(
          options.clientName?.trim() || "—",
          today,
        ),
      ],
      options,
    );
  }

  // Keep a plain single invoice unless we need statement opening / merge metadata.
  if (invoices.length === 1 && !hasOpening && !hasLedger) {
    return invoices[0]!;
  }

  const sorted = [...invoices].sort((a, b) =>
    invoiceDateTimeKey(a).localeCompare(invoiceDateTimeKey(b)),
  );

  const lines: InvoiceLine[] = [];
  for (const event of buildStatementEvents(
    sorted,
    options.ledgerMovements ?? [],
  )) {
    if (event.kind === "invoice") {
      for (const line of event.invoice.lines) {
        lines.push(cloneProductLine(line, lines.length, event.invoice));
      }
      continue;
    }
    lines.push(
      paymentLine(
        event.payment,
        lines.length,
        event.invoiceNumber,
        event.forceKind,
      ),
    );
  }

  const totalMad = roundMad(
    sorted.reduce((sum, inv) => sum + inv.totalMad, 0),
  );
  // Encaissé on the relevé = unique payment rows (facture history + ledger
  // versements), excluding retours. Avoids double-counting FIFO paidMad.
  const seenPaidIds = new Set<string>();
  let paidMad = 0;
  for (const inv of sorted) {
    for (const payment of inv.paymentHistory) {
      if (!(payment.amountMad > 0)) continue;
      if (payment.id === "bulk-merged-paid" || payment.ref === "LOT") continue;
      if (isReturnPayment(payment)) continue;
      if (seenPaidIds.has(payment.id)) continue;
      seenPaidIds.add(payment.id);
      paidMad += payment.amountMad;
    }
  }
  for (const movement of options.ledgerMovements ?? []) {
    if (movement.kind !== "payment" || !(movement.amountMad > 0)) continue;
    if (seenPaidIds.has(movement.id)) continue;
    seenPaidIds.add(movement.id);
    paidMad += movement.amountMad;
  }
  // Fallback when credit invoices are FIFO-settled but ledger rows were not
  // loaded (no client context): keep header encaissé coherent with paidMad.
  if (paidMad < 0.009 && !(options.ledgerMovements?.length)) {
    paidMad = sorted.reduce((sum, inv) => {
      if (typeof inv.paidMad === "number") return sum + inv.paidMad;
      return sum;
    }, 0);
  }
  paidMad = roundMad(paidMad);

  const paymentHistory: InvoicePaymentHistoryItem[] =
    paidMad > 0
      ? [
          {
            id: "bulk-merged-paid",
            date: sorted[sorted.length - 1]!.date,
            amountMad: paidMad,
            note: "Total encaissé (lot)",
            ref: "LOT",
          },
        ]
      : [];

  const clientNames = [
    ...new Set(sorted.map((inv) => inv.clientName.trim()).filter(Boolean)),
  ];
  const clientName =
    clientNames.length === 1
      ? clientNames[0]!
      : clientNames.length === 0
        ? "—"
        : `${clientNames[0]} +${clientNames.length - 1}`;

  const paymentTypes = new Set(sorted.map((inv) => inv.paymentType));
  const paymentType: InvoicePaymentType = paymentTypes.has("credit")
    ? "credit"
    : "cash";

  let status: InvoiceStatus = "paid";
  if (sorted.some((inv) => inv.status === "pending")) status = "pending";
  else if (sorted.every((inv) => inv.status === "returned")) {
    status = "returned";
  }

  const stamp = sorted[0]!.date.replace(/-/g, "");
  const sourceLabel = sorted.map((inv) => `#${inv.number}`).join(" · ");

  const base = {
    id: `bulk-merged-${stamp}`,
    number: `LOT-${stamp}`,
    barcode: sorted[0]!.barcode,
    date: sorted[0]!.date,
    time: sorted[0]!.time,
    clientName,
    cashierId:
      sourceLabel.length > 60
        ? `${sorted.length} factures`
        : sourceLabel,
    paymentType,
    totalMad,
    paidMad,
    remainingMad: roundMad(Math.max(0, totalMad - paidMad)),
    status,
    lines,
    paymentHistory,
    ...(hasOpening
      ? { statementOpeningBalanceMad: options.openingBalanceMad }
      : {}),
  };

  return base as Invoice;
}

/** Human-readable source invoice numbers for UI / footnotes. */
export function mergedInvoiceSourceNumbers(
  invoices: readonly Invoice[],
): string {
  return invoices.map((inv) => `#${inv.number}`).join(", ");
}
