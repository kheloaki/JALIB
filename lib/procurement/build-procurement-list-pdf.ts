import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

import { STORE_NAME } from "@/lib/brand/constants";
import {
  type DocumentLocale,
  formatDocumentDateTimeForPdf,
  getDocumentLabels,
} from "@/lib/i18n/document-labels";
import { applyPdfFont, setupDocumentPdfFont } from "@/lib/pdf/document-pdf-font";
import {
  createAutoTableLocaleHooks,
  writePdfTextLine,
} from "@/lib/pdf/pdf-text";

const MARGIN_MM = 12;
const PAGE_WIDTH_MM = 210;
const CONTENT_WIDTH_MM = PAGE_WIDTH_MM - MARGIN_MM * 2;

const GRID_COLOR: [number, number, number] = [100, 116, 139];
const HEAD_FILL: [number, number, number] = [248, 250, 252];
const MUTED_TEXT: [number, number, number] = [71, 85, 105];

export type ProcurementListPdfRow = {
  index: number;
  name: string;
  category: string;
  qty: number;
  unitCostLabel: string;
  unitSellLabel: string;
  lineTotalLabel: string;
  statusLabel: string;
};

export type ProcurementListPdfDocument = {
  title: string;
  listTitle: string | null;
  statusLabel: string;
  metaLine: string;
  totalLines: number;
  totalQty: number;
  totalPurchaseLabel: string;
  totalSellLabel: string;
  rows: ProcurementListPdfRow[];
  documentLocale?: DocumentLocale;
};

function sanitizeFilename(value: string): string {
  return value.replace(/[^\p{L}\p{N}.-]+/gu, "_");
}

export async function buildProcurementListPdf(
  document: ProcurementListPdfDocument,
): Promise<jsPDF> {
  const locale = document.documentLocale ?? "fr";
  const labels = getDocumentLabels(locale);
  const proc = labels.procurement;
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const fonts = await setupDocumentPdfFont(doc, locale);
  let y = MARGIN_MM;

  applyPdfFont(doc, fonts, "bold");
  doc.setFontSize(14);
  doc.setTextColor(15, 23, 42);
  writePdfTextLine(doc, STORE_NAME, MARGIN_MM, y, locale, fonts);

  applyPdfFont(doc, fonts, "normal");
  doc.setFontSize(9);
  doc.setTextColor(...MUTED_TEXT);
  const generatedAt = formatDocumentDateTimeForPdf(locale);
  writePdfTextLine(
    doc,
    generatedAt,
    PAGE_WIDTH_MM - MARGIN_MM,
    y,
    locale,
    fonts,
    { align: "right" },
  );
  y += 8;

  applyPdfFont(doc, fonts, "bold");
  doc.setFontSize(16);
  doc.setTextColor(15, 23, 42);
  writePdfTextLine(doc, document.title, MARGIN_MM, y, locale, fonts);
  y += 6;

  if (document.listTitle) {
    applyPdfFont(doc, fonts, "bold");
    doc.setFontSize(11);
    writePdfTextLine(doc, document.listTitle, MARGIN_MM, y, locale, fonts);
    y += 5;
  }

  applyPdfFont(doc, fonts, "normal");
  doc.setFontSize(9);
  doc.setTextColor(...MUTED_TEXT);
  writePdfTextLine(
    doc,
    `${document.statusLabel}  •  ${document.metaLine}`,
    MARGIN_MM,
    y,
    locale,
    fonts,
    { maxWidth: CONTENT_WIDTH_MM },
  );
  y += 8;

  autoTable(doc, {
    startY: y,
    margin: { left: MARGIN_MM, right: MARGIN_MM },
    head: [
      [
        proc.colIndex,
        proc.colDesignation,
        proc.colCategory,
        proc.colQty,
        proc.colUnitCost,
        proc.colUnitSell,
        proc.colLineTotal,
        proc.colStatus,
      ],
    ],
    body: document.rows.map((row) => [
      String(row.index),
      row.name,
      row.category,
      String(row.qty),
      row.unitCostLabel,
      row.unitSellLabel,
      row.lineTotalLabel,
      row.statusLabel,
    ]),
    styles: {
      font: fonts.body,
      fontSize: 8,
      cellPadding: 2,
      lineColor: GRID_COLOR,
      lineWidth: 0.1,
      textColor: [15, 23, 42],
    },
    headStyles: {
      fillColor: HEAD_FILL,
      textColor: [15, 23, 42],
      fontStyle: "bold",
      font: fonts.body,
    },
    alternateRowStyles: { fillColor: [252, 252, 253] },
    columnStyles: {
      0: { halign: "center", cellWidth: 8 },
      1: { cellWidth: 42 },
      2: { cellWidth: 24 },
      3: { halign: "center", cellWidth: 12 },
      4: { halign: "right", cellWidth: 22 },
      5: { halign: "right", cellWidth: 22 },
      6: { halign: "right", cellWidth: 24 },
      7: { cellWidth: 22 },
    },
    ...createAutoTableLocaleHooks(locale, fonts),
  });

  const finalY =
    (doc as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable
      ?.finalY ?? y + 20;
  y = finalY + 6;

  applyPdfFont(doc, fonts, "bold");
  doc.setFontSize(9);
  doc.setTextColor(15, 23, 42);
  writePdfTextLine(
    doc,
    proc.summary(
      document.totalLines,
      document.totalQty,
      document.totalPurchaseLabel,
      document.totalSellLabel,
    ),
    MARGIN_MM,
    y,
    locale,
    fonts,
    { maxWidth: CONTENT_WIDTH_MM },
  );

  return doc;
}

function procurementListPdfFilename(document: ProcurementListPdfDocument): string {
  const dateSlug = new Date().toISOString().slice(0, 10);
  const titleSlug = sanitizeFilename(document.listTitle ?? "liste-achats");
  return `liste-achats-${titleSlug}-${dateSlug}.pdf`;
}

export async function buildProcurementListPdfBlob(
  document: ProcurementListPdfDocument,
): Promise<{ blob: Blob; filename: string }> {
  const doc = await buildProcurementListPdf(document);
  return {
    blob: doc.output("blob"),
    filename: procurementListPdfFilename(document),
  };
}

/** Print the same PDF document as download (not the on-screen table UI). */
export async function printProcurementListPdf(
  document: ProcurementListPdfDocument,
): Promise<void> {
  const doc = await buildProcurementListPdf(document);
  // Embed a print trigger so the browser PDF viewer opens the print dialog.
  doc.autoPrint();
  const blob = doc.output("blob");
  const url = URL.createObjectURL(blob);

  const printWindow = window.open(url, "_blank");
  if (!printWindow) {
    URL.revokeObjectURL(url);
    // Popup blocked — fall back to download (same file the user would print).
    await downloadProcurementListPdf(document);
    return;
  }

  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

export async function downloadProcurementListPdf(
  pdfDocument: ProcurementListPdfDocument,
): Promise<void> {
  const { blob, filename } = await buildProcurementListPdfBlob(pdfDocument);
  const url = URL.createObjectURL(blob);
  const anchor = window.document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}
