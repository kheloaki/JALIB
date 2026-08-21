import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

import type { InternalInvoiceSettings } from "@/components/invoices/internal-invoice-document";
import type { ClientLedgerSummary } from "@/lib/credits/invoice-settlement";
import {
  statementAmountDisplay,
  statementKindLabel,
  statementNoteDisplay,
  statementRowFillRgb,
  statementStatusLabel,
} from "@/lib/credits/statement-labels";
import type { LedgerEntry } from "@/lib/credits/types";
import type { Client } from "@/lib/clients/types";
import { STORE_LOGO_PRINT_PATH, STORE_NAME } from "@/lib/brand/constants";
import {
  documentLegalLines,
  formatDocumentDateForPdf,
  getDocumentLabels,
} from "@/lib/i18n/document-labels";
import { formatMad } from "@/lib/money/mad";
import { applyPdfFont, setupDocumentPdfFont } from "@/lib/pdf/document-pdf-font";
import {
  createAutoTableLocaleHooks,
  writePdfAligned,
} from "@/lib/pdf/pdf-text";

const MARGIN_MM = 12;
const PAGE_WIDTH_MM = 210;
const CONTENT_WIDTH_MM = PAGE_WIDTH_MM - MARGIN_MM * 2;

const GRID_COLOR: [number, number, number] = [100, 116, 139];
const HEAD_FILL: [number, number, number] = [248, 250, 252];
const MUTED_TEXT: [number, number, number] = [71, 85, 105];

export type CreditStatementDocument = {
  client: Pick<Client, "fullName" | "phone" | "creditLimitMad" | "isCashOnly">;
  summary: ClientLedgerSummary;
  entries: LedgerEntry[];
  settings: InternalInvoiceSettings;
};

function sanitizeFilename(value: string): string {
  return value.replace(/[^\w.-]+/g, "_");
}

function formatDate(date: string, locale: InternalInvoiceSettings["documentLocale"]): string {
  return formatDocumentDateForPdf(date, locale);
}

async function loadLogoForPdf(): Promise<{
  dataUrl: string;
  widthMm: number;
  heightMm: number;
} | null> {
  try {
    const response = await fetch(STORE_LOGO_PRINT_PATH);
    if (!response.ok) return null;
    const blob = await response.blob();
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(new Error("Logo read failed"));
      reader.readAsDataURL(blob);
    });

    const image = new Image();
    image.src = dataUrl;
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error("Logo decode failed"));
    });

    const maxHeightMm = 38;
    const ratio = image.naturalWidth / image.naturalHeight;
    const heightMm = maxHeightMm;
    const widthMm = heightMm * ratio;

    return { dataUrl, widthMm, heightMm };
  } catch {
    return null;
  }
}

const HISTORY_COL_WIDTHS = {
  date: 20,
  type: 22,
  ref: 30,
  note: 46,
  amount: 42,
  status: 26,
} as const;

const HISTORY_TABLE_WIDTH =
  HISTORY_COL_WIDTHS.date +
  HISTORY_COL_WIDTHS.type +
  HISTORY_COL_WIDTHS.ref +
  HISTORY_COL_WIDTHS.note +
  HISTORY_COL_WIDTHS.amount +
  HISTORY_COL_WIDTHS.status;

function sortedEntries(entries: LedgerEntry[]): LedgerEntry[] {
  return [...entries].sort((a, b) => {
    const byDate = a.date.localeCompare(b.date);
    if (byDate !== 0) return byDate;
    return a.ref.localeCompare(b.ref);
  });
}

export async function buildCreditStatementPdf(
  document: CreditStatementDocument,
): Promise<jsPDF> {
  const { client, summary, entries, settings } = document;
  const locale = settings.documentLocale;
  const labels = getDocumentLabels(locale);
  const credit = labels.credit;
  const doc = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
  const fonts = await setupDocumentPdfFont(doc, locale);
  const issuedOn = formatDocumentDateForPdf(
    new Date().toISOString().slice(0, 10),
    locale,
  );
  const legal = documentLegalLines(settings, labels);
  const rightX = PAGE_WIDTH_MM - MARGIN_MM;
  let y = MARGIN_MM;

  const logo = await loadLogoForPdf();
  if (logo) {
    doc.addImage(logo.dataUrl, "PNG", MARGIN_MM, y, logo.widthMm, logo.heightMm);
    y += logo.heightMm + 4;
  } else {
    applyPdfFont(doc, fonts, "bold");
    doc.setFontSize(14);
    doc.text(STORE_NAME, MARGIN_MM, y + 5);
    y += 10;
  }

  if (legal.length > 0) {
    for (const line of legal) {
      writePdfAligned(doc, line, MARGIN_MM, y, locale, fonts, {
        align: "left",
        fontSize: 8,
        color: MUTED_TEXT,
        maxWidth: CONTENT_WIDTH_MM,
      });
      y += 4;
    }
    y += 2;
  }

  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.4);
  doc.line(MARGIN_MM, y, rightX, y);
  y += 8;

  writePdfAligned(doc, credit.title, MARGIN_MM, y, locale, fonts, {
    align: "left",
    fontSize: 14,
    style: "bold",
    maxWidth: CONTENT_WIDTH_MM * 0.55,
  });

  writePdfAligned(
    doc,
    credit.issuedOn(issuedOn),
    rightX,
    y,
    locale,
    fonts,
    {
      align: "right",
      fontSize: 8,
      color: MUTED_TEXT,
      maxWidth: CONTENT_WIDTH_MM * 0.4,
    },
  );
  y += 8;

  const tableHooks = createAutoTableLocaleHooks(locale, fonts);

  autoTable(doc, {
    startY: y,
    margin: { left: MARGIN_MM, right: MARGIN_MM },
    tableWidth: CONTENT_WIDTH_MM,
    theme: "grid",
    head: [[credit.client, credit.phone, credit.creditLimit]],
    body: [
      [
        client.fullName,
        client.phone,
        client.isCashOnly
          ? credit.cashOnly
          : client.creditLimitMad != null && client.creditLimitMad > 0
            ? formatMad(client.creditLimitMad)
            : credit.noLimit,
      ],
    ],
    styles: {
      font: fonts.body,
      fontSize: 9,
      cellPadding: 2.5,
      lineColor: GRID_COLOR,
      lineWidth: 0.1,
      textColor: [0, 0, 0],
    },
    headStyles: {
      fillColor: HEAD_FILL,
      textColor: MUTED_TEXT,
      fontSize: 7,
      fontStyle: "bold",
      font: fonts.body,
    },
    bodyStyles: { fontStyle: "bold", font: fonts.body },
    ...tableHooks,
  });

  y = doc.lastAutoTable.finalY + 4;

  autoTable(doc, {
    startY: y,
    margin: { left: MARGIN_MM, right: MARGIN_MM },
    tableWidth: CONTENT_WIDTH_MM,
    theme: "grid",
    head: [[credit.totalDebt, credit.totalPaid, credit.returns, credit.balanceDue]],
    body: [
      [
        formatMad(summary.totalInvoicedMad),
        formatMad(summary.totalPaidMad),
        formatMad(summary.totalReturnedMad),
        formatMad(Math.max(0, summary.outstandingMad)),
      ],
    ],
    styles: {
      font: fonts.body,
      fontSize: 9,
      cellPadding: 2.5,
      lineColor: GRID_COLOR,
      lineWidth: 0.1,
      textColor: [0, 0, 0],
    },
    headStyles: {
      fillColor: HEAD_FILL,
      textColor: MUTED_TEXT,
      fontSize: 7,
      fontStyle: "bold",
      font: fonts.body,
    },
    bodyStyles: { fontStyle: "bold", font: fonts.body },
    columnStyles: {
      0: { halign: "right", cellWidth: CONTENT_WIDTH_MM / 4 },
      1: { halign: "right", cellWidth: CONTENT_WIDTH_MM / 4 },
      2: { halign: "right", cellWidth: CONTENT_WIDTH_MM / 4 },
      3: { halign: "right", cellWidth: CONTENT_WIDTH_MM / 4, textColor: [180, 35, 24] },
    },
    ...tableHooks,
  });

  y = doc.lastAutoTable.finalY + 6;

  writePdfAligned(doc, credit.historyTitle, MARGIN_MM, y, locale, fonts, {
    align: "left",
    fontSize: 8,
    style: "bold",
    color: MUTED_TEXT,
    maxWidth: CONTENT_WIDTH_MM,
  });
  y += 3;

  const rows = sortedEntries(entries);

  autoTable(doc, {
    startY: y,
    margin: { left: MARGIN_MM, right: MARGIN_MM },
    tableWidth: HISTORY_TABLE_WIDTH,
    theme: "grid",
    head: [
      [
        credit.colDate,
        credit.colType,
        credit.colRef,
        credit.colNote,
        credit.colAmount,
        credit.colStatus,
      ],
    ],
    body:
      rows.length > 0
        ? rows.map((entry) => [
            formatDate(entry.date, locale),
            statementKindLabel(entry, locale),
            entry.ref,
            statementNoteDisplay(entry.note),
            statementAmountDisplay(entry),
            statementStatusLabel(entry.status, locale),
          ])
        : [["-", "-", "-", credit.noEntries, "-", "-"]],
    styles: {
      font: fonts.body,
      fontSize: 8,
      cellPadding: { top: 2, right: 2.5, bottom: 2, left: 2.5 },
      lineColor: GRID_COLOR,
      lineWidth: 0.1,
      textColor: [0, 0, 0],
      overflow: "linebreak",
    },
    headStyles: {
      fillColor: HEAD_FILL,
      textColor: MUTED_TEXT,
      fontSize: 7,
      fontStyle: "bold",
      font: fonts.body,
    },
    columnStyles: {
      0: { cellWidth: HISTORY_COL_WIDTHS.date },
      1: { cellWidth: HISTORY_COL_WIDTHS.type },
      2: { cellWidth: HISTORY_COL_WIDTHS.ref },
      3: { cellWidth: HISTORY_COL_WIDTHS.note },
      4: {
        cellWidth: HISTORY_COL_WIDTHS.amount,
        halign: "right",
        fontStyle: "bold",
        overflow: "hidden",
        cellPadding: { top: 2, right: 3, bottom: 2, left: 2 },
      },
      5: { cellWidth: HISTORY_COL_WIDTHS.status, halign: "center" },
    },
    ...createAutoTableLocaleHooks(locale, fonts, (data) => {
      if (data.section === "body" && data.column.index === 4) {
        data.cell.styles.overflow = "hidden";
        data.cell.styles.halign = "right";
      }
      if (data.section === "body" && data.row.index >= 0) {
        const entry = rows[data.row.index];
        if (entry) {
          const fill = statementRowFillRgb(entry);
          if (fill) {
            data.cell.styles.fillColor = fill;
          }
        }
      }
    }),
  });

  y = doc.lastAutoTable.finalY + 6;
  doc.setDrawColor(...GRID_COLOR);
  doc.setLineWidth(0.1);
  doc.line(MARGIN_MM, y, rightX, y);
  y += 5;

  const footer = credit.footer(
    client.fullName,
    formatMad(Math.max(0, summary.outstandingMad)),
  );
  writePdfAligned(doc, footer, PAGE_WIDTH_MM / 2, y, locale, fonts, {
    align: "center",
    fontSize: 7,
    color: MUTED_TEXT,
    maxWidth: CONTENT_WIDTH_MM,
  });

  return doc;
}

export async function downloadCreditStatementPdf(
  document: CreditStatementDocument,
): Promise<void> {
  const doc = await buildCreditStatementPdf(document);
  const slug = sanitizeFilename(document.client.fullName);
  doc.save(`releve-compte-${slug}.pdf`);
}
