import type { ConvexReactClient } from "convex/react";

import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { invoiceFromConvex } from "@/lib/convex/mappers";
import {
  buildCombinedInvoicePdfBlob,
  type CombinedInvoicePdfOptions,
} from "@/lib/invoices/download-invoice-pdf";
import type { Invoice } from "@/lib/invoices/types";
import type { AppSettingsDocumentSource } from "@/lib/i18n/app-document-settings";

const PAGE_SIZE = 50;
/** Soft cap — same ballpark as Factures bulk select for one client. */
const MAX_INVOICES = 500;

function sanitizeFilename(value: string): string {
  return value.replace(/[^\w.-]+/g, "_");
}

function triggerBlobDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

async function loadClientInvoices(
  convex: Pick<ConvexReactClient, "query">,
  clientId: Id<"clients">,
  dateRange: { dateFrom?: string; dateTo?: string },
): Promise<Invoice[]> {
  const summaries: Array<{ id: string; date: string }> = [];
  let cursor: string | null = null;
  let isDone = false;

  while (!isDone && summaries.length < MAX_INVOICES) {
    const page: {
      page: Array<{ id: string; date: string }>;
      isDone: boolean;
      continueCursor: string;
    } = await convex.query(api.invoices.listSummaries, {
      paginationOpts: {
        numItems: PAGE_SIZE,
        cursor,
      },
      clientId,
      ...(dateRange.dateFrom ? { dateFrom: dateRange.dateFrom } : {}),
      ...(dateRange.dateTo ? { dateTo: dateRange.dateTo } : {}),
    });
    for (const row of page.page) {
      summaries.push({ id: row.id, date: row.date });
      if (summaries.length >= MAX_INVOICES) break;
    }
    isDone = page.isDone;
    cursor = page.continueCursor;
    if (isDone || !page.continueCursor) break;
  }

  // Oldest first for statement chronology (listSummaries is desc).
  summaries.sort((a, b) => a.date.localeCompare(b.date));

  const invoices: Invoice[] = [];
  for (const row of summaries) {
    const full = await convex.query(api.invoices.getWithLines, {
      invoiceId: row.id,
    });
    if (full) invoices.push(invoiceFromConvex(full));
  }
  return invoices;
}

export type ClientRelevePdfArgs = {
  clientId: Id<"clients">;
  clientName: string;
  settingsSource: AppSettingsDocumentSource | null | undefined;
  /** Inclusive YYYY-MM-DD — history filter “Du”. */
  dateFrom?: string;
  /** Inclusive YYYY-MM-DD — history filter “Au”. */
  dateTo?: string;
};

export type ClientRelevePdfResult = {
  blob: Blob;
  invoiceCount: number;
  versementCount: number;
  filename: string;
};

/**
 * Build the same relevé as Factures bulk “Relevé client”
 * (product lines + opening solde + ledger versements).
 */
export async function buildClientRelevePdf(
  convex: Pick<ConvexReactClient, "query">,
  args: ClientRelevePdfArgs,
): Promise<ClientRelevePdfResult> {
  const filterFrom = args.dateFrom?.trim() || undefined;
  const filterTo = args.dateTo?.trim() || undefined;

  const invoices = await loadClientInvoices(convex, args.clientId, {
    dateFrom: filterFrom,
    dateTo: filterTo,
  });
  const today = new Date().toISOString().slice(0, 10);

  let fromDate = filterFrom ?? "2000-01-01";
  let toDate = filterTo ?? today;

  if (!filterFrom && invoices.length > 0) {
    fromDate = invoices[0]!.date;
    for (const inv of invoices) {
      if (inv.date < fromDate) fromDate = inv.date;
    }
  }
  if (!filterTo && invoices.length > 0) {
    toDate = invoices[0]!.date;
    for (const inv of invoices) {
      if (inv.date > toDate) toDate = inv.date;
    }
    if (today > toDate) toDate = today;
  }
  if (filterFrom && filterTo && filterFrom > filterTo) {
    fromDate = filterTo;
    toDate = filterFrom;
  }

  const statement = await convex.query(api.invoices.clientStatementContext, {
    clientId: args.clientId,
    fromDate,
    toDate,
  });

  const options: CombinedInvoicePdfOptions = {
    openingBalanceMad: statement.openingBalanceMad,
    ledgerMovements: statement.movements,
    clientName: args.clientName,
  };

  const { blob } = await buildCombinedInvoicePdfBlob(
    invoices,
    args.settingsSource,
    "owner",
    options,
  );

  const rangeSlug = [filterFrom, filterTo].filter(Boolean).join("_") || today;
  const filename = `releve-compte-${sanitizeFilename(args.clientName)}-${sanitizeFilename(rangeSlug)}.pdf`;

  return {
    blob,
    invoiceCount: invoices.length,
    versementCount: statement.movements.filter((m) => m.kind === "payment")
      .length,
    filename,
  };
}

export async function downloadClientRelevePdf(
  convex: Pick<ConvexReactClient, "query">,
  args: ClientRelevePdfArgs,
): Promise<Omit<ClientRelevePdfResult, "blob">> {
  const result = await buildClientRelevePdf(convex, args);
  triggerBlobDownload(result.blob, result.filename);
  return {
    invoiceCount: result.invoiceCount,
    versementCount: result.versementCount,
    filename: result.filename,
  };
}

/** Print the same relevé PDF as download (browser print dialog). */
export async function printClientRelevePdf(
  convex: Pick<ConvexReactClient, "query">,
  args: ClientRelevePdfArgs,
): Promise<Omit<ClientRelevePdfResult, "blob">> {
  const result = await buildClientRelevePdf(convex, args);
  await printPdfBlob(result.blob);
  return {
    invoiceCount: result.invoiceCount,
    versementCount: result.versementCount,
    filename: result.filename,
  };
}

function printPdfBlob(blob: Blob): Promise<void> {
  const url = URL.createObjectURL(blob);
  return new Promise((resolve, reject) => {
    const iframe = document.createElement("iframe");
    iframe.setAttribute("title", "releve-print");
    iframe.style.position = "fixed";
    iframe.style.right = "0";
    iframe.style.bottom = "0";
    iframe.style.width = "0";
    iframe.style.height = "0";
    iframe.style.border = "0";
    iframe.src = url;

    const cleanup = () => {
      iframe.remove();
      URL.revokeObjectURL(url);
    };

    iframe.onload = () => {
      const win = iframe.contentWindow;
      if (!win) {
        cleanup();
        reject(new Error("PRINT_FRAME_UNAVAILABLE"));
        return;
      }
      const onAfterPrint = () => {
        win.removeEventListener("afterprint", onAfterPrint);
        cleanup();
        resolve();
      };
      win.addEventListener("afterprint", onAfterPrint);
      // Give the PDF viewer a tick to paint before opening the dialog.
      window.setTimeout(() => {
        try {
          win.focus();
          win.print();
        } catch (error) {
          win.removeEventListener("afterprint", onAfterPrint);
          cleanup();
          reject(error instanceof Error ? error : new Error("PRINT_FAILED"));
        }
      }, 250);
      // Fallback if afterprint never fires (some PDF plugins).
      window.setTimeout(() => {
        win.removeEventListener("afterprint", onAfterPrint);
        cleanup();
        resolve();
      }, 120_000);
    };

    iframe.onerror = () => {
      cleanup();
      reject(new Error("PRINT_FRAME_LOAD_FAILED"));
    };

    document.body.appendChild(iframe);
  });
}
