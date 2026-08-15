import {
  buildClientReceiptPdf,
  buildCombinedClientReceiptPdf,
  downloadClientReceiptPdf,
  downloadCombinedClientReceiptPdf,
} from "@/lib/invoices/build-client-receipt-pdf";
import {
  buildInternalInvoicePdf,
  downloadInternalInvoicePdf,
} from "@/lib/invoices/build-internal-invoice-pdf";
import {
  mergeInvoicesForPdf,
  type StatementLedgerMovement,
} from "@/lib/invoices/merge-invoices-for-pdf";
import type { Invoice } from "@/lib/invoices/types";
import {
  toInternalInvoiceSettings,
  toReceiptSettings,
  type AppSettingsDocumentSource,
} from "@/lib/i18n/app-document-settings";
import { jsPdfOutputBlob } from "@/lib/share/share-pdf-whatsapp";

export type InvoicePdfMode = "client" | "owner";

function sanitizeFilename(value: string): string {
  return value.replace(/[^\w.-]+/g, "_");
}

export async function buildInvoicePdfBlob(
  invoice: Invoice,
  settingsSource: AppSettingsDocumentSource | null | undefined,
  mode: InvoicePdfMode,
): Promise<{ blob: Blob; filename: string }> {
  if (mode === "client") {
    const doc = await buildClientReceiptPdf(
      invoice,
      toReceiptSettings(settingsSource),
    );
    return {
      blob: jsPdfOutputBlob(doc),
      filename: `ticket-client-${sanitizeFilename(invoice.number)}.pdf`,
    };
  }
  const doc = await buildInternalInvoicePdf(
    invoice,
    toInternalInvoiceSettings(settingsSource),
  );
  return {
    blob: jsPdfOutputBlob(doc),
    filename: `facture-interne-${sanitizeFilename(invoice.number)}.pdf`,
  };
}

export async function downloadInvoicePdf(
  invoice: Invoice,
  settingsSource: AppSettingsDocumentSource | null | undefined,
  mode: InvoicePdfMode,
): Promise<void> {
  if (mode === "client") {
    await downloadClientReceiptPdf(invoice, toReceiptSettings(settingsSource));
    return;
  }
  await downloadInternalInvoicePdf(
    invoice,
    toInternalInvoiceSettings(settingsSource),
  );
}

/** Separate PDF file for each invoice. */
export async function downloadInvoicesPdfSeparate(
  invoices: readonly Invoice[],
  settingsSource: AppSettingsDocumentSource | null | undefined,
  mode: InvoicePdfMode = "owner",
): Promise<{ ok: number; failed: number }> {
  let ok = 0;
  let failed = 0;
  for (const invoice of invoices) {
    try {
      await downloadInvoicePdf(invoice, settingsSource, mode);
      ok += 1;
    } catch {
      failed += 1;
    }
  }
  return { ok, failed };
}

/**
 * One PDF as a single merged facture (all line items + totals together).
 * For client tickets, falls back to multi-page combined receipts.
 */
export type CombinedInvoicePdfOptions = {
  /** Debt-positive opening (initial solde + prior) for the client statement. */
  openingBalanceMad?: number;
  /** Client ledger versements / retours for the statement period. */
  ledgerMovements?: readonly StatementLedgerMovement[];
  /** Header name when exporting a client relevé with no factures. */
  clientName?: string;
};

export async function downloadInvoicesPdfCombined(
  invoices: readonly Invoice[],
  settingsSource: AppSettingsDocumentSource | null | undefined,
  mode: InvoicePdfMode = "owner",
  options: CombinedInvoicePdfOptions = {},
): Promise<void> {
  const hasStatementContext =
    options.openingBalanceMad != null ||
    (options.ledgerMovements?.length ?? 0) > 0;
  if (invoices.length === 0 && !hasStatementContext) return;
  if (mode === "client") {
    if (invoices.length === 0) return;
    await downloadCombinedClientReceiptPdf(
      invoices,
      toReceiptSettings(settingsSource),
    );
    return;
  }
  const merged = mergeInvoicesForPdf(invoices, {
    openingBalanceMad: options.openingBalanceMad,
    ledgerMovements: options.ledgerMovements,
    clientName: options.clientName,
  });
  const doc = await buildInternalInvoicePdf(
    merged,
    toInternalInvoiceSettings(settingsSource),
  );
  const stamp = new Date().toISOString().slice(0, 10);
  doc.save(`facture-lot-${stamp}-${Math.max(invoices.length, 1)}.pdf`);
}

export async function buildCombinedInvoicePdfBlob(
  invoices: readonly Invoice[],
  settingsSource: AppSettingsDocumentSource | null | undefined,
  mode: InvoicePdfMode = "owner",
  options: CombinedInvoicePdfOptions = {},
): Promise<{ blob: Blob; filename: string }> {
  const stamp = new Date().toISOString().slice(0, 10);
  if (mode === "client") {
    if (invoices.length === 0) {
      throw new Error("No invoices to export.");
    }
    const doc = await buildCombinedClientReceiptPdf(
      invoices,
      toReceiptSettings(settingsSource),
    );
    return {
      blob: jsPdfOutputBlob(doc),
      filename: `tickets-clients-${stamp}-${invoices.length}.pdf`,
    };
  }
  const merged = mergeInvoicesForPdf(invoices, {
    openingBalanceMad: options.openingBalanceMad,
    ledgerMovements: options.ledgerMovements,
    clientName: options.clientName,
  });
  const doc = await buildInternalInvoicePdf(
    merged,
    toInternalInvoiceSettings(settingsSource),
  );
  return {
    blob: jsPdfOutputBlob(doc),
    filename: `facture-lot-${stamp}-${Math.max(invoices.length, 1)}.pdf`,
  };
}
