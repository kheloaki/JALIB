import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

import { STORE_NAME } from "@/lib/brand/constants";
import {
  type DocumentLocale,
  formatDocumentDateTimeForPdf,
  getDocumentLabels,
} from "@/lib/i18n/document-labels";
import { formatMad } from "@/lib/money/mad";
import { applyPdfFont, setupDocumentPdfFont } from "@/lib/pdf/document-pdf-font";

const MARGIN_MM = 12;
const PAGE_WIDTH_MM = 210;
const CONTENT_WIDTH_MM = PAGE_WIDTH_MM - MARGIN_MM * 2;

const GRID_COLOR: [number, number, number] = [100, 116, 139];
const HEAD_FILL: [number, number, number] = [248, 250, 252];
const MUTED_TEXT: [number, number, number] = [71, 85, 105];

export type StockCatalogPdfRow = {
  name: string;
  category: string;
  barcode: string;
  costLabel: string;
  sellLabel: string;
  marginLabel: string;
  stockLabel: string;
};

export type StockCatalogPdfDocument = {
  title: string;
  filterLabel: string;
  searchQuery: string;
  referencesCount: number;
  lowStockCount: number;
  sellValuationLabel: string;
  costValuationLabel: string | null;
  rows: StockCatalogPdfRow[];
  documentLocale?: DocumentLocale;
};

function sanitizeFilename(value: string): string {
  return value.replace(/[^\w.-]+/g, "_");
}

export async function buildStockCatalogPdf(
  document: StockCatalogPdfDocument,
): Promise<jsPDF> {
  const locale = document.documentLocale ?? "fr";
  const labels = getDocumentLabels(locale);
  const stock = labels.stock;
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const fonts = await setupDocumentPdfFont(doc, locale);
  let y = MARGIN_MM;

  applyPdfFont(doc, fonts, "bold");
  doc.setFontSize(14);
  doc.setTextColor(15, 23, 42);
  doc.text(STORE_NAME, MARGIN_MM, y);

  applyPdfFont(doc, fonts, "normal");
  doc.setFontSize(9);
  doc.setTextColor(...MUTED_TEXT);
  const generatedAt = formatDocumentDateTimeForPdf(locale);
  doc.text(generatedAt, PAGE_WIDTH_MM - MARGIN_MM, y, { align: "right" });
  y += 8;

  applyPdfFont(doc, fonts, "bold");
  doc.setFontSize(16);
  doc.setTextColor(15, 23, 42);
  doc.text(document.title, MARGIN_MM, y);
  y += 7;

  applyPdfFont(doc, fonts, "normal");
  doc.setFontSize(9);
  doc.setTextColor(...MUTED_TEXT);
  const meta = [
    stock.filter(document.filterLabel),
    document.searchQuery
      ? stock.search(document.searchQuery)
      : stock.searchEmpty,
    stock.references(document.referencesCount),
    stock.lowStock(document.lowStockCount),
    stock.sellValuation(document.sellValuationLabel),
    document.costValuationLabel
      ? stock.costValuation(document.costValuationLabel)
      : null,
  ]
    .filter((line): line is string => line !== null)
    .join("  •  ");
  doc.text(meta, MARGIN_MM, y, { maxWidth: CONTENT_WIDTH_MM });
  y += 10;

  autoTable(doc, {
    startY: y,
    margin: { left: MARGIN_MM, right: MARGIN_MM },
    head: [
      [
        stock.colProduct,
        stock.colCategory,
        stock.colBarcode,
        stock.colCost,
        stock.colSell,
        stock.colMargin,
        stock.colStock,
      ],
    ],
    body: document.rows.map((row) => [
      row.name,
      row.category,
      row.barcode || "—",
      row.costLabel,
      row.sellLabel,
      row.marginLabel,
      row.stockLabel,
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
      0: { cellWidth: 42 },
      1: { cellWidth: 24 },
      2: { cellWidth: 28 },
      3: { halign: "right", cellWidth: 22 },
      4: { halign: "right", cellWidth: 22 },
      5: { halign: "right", cellWidth: 24 },
      6: { halign: "right", cellWidth: 16 },
    },
  });

  return doc;
}

export async function downloadStockCatalogPdf(
  document: StockCatalogPdfDocument,
): Promise<void> {
  const doc = await buildStockCatalogPdf(document);
  const dateSlug = new Date().toISOString().slice(0, 10);
  const filterSlug = sanitizeFilename(document.filterLabel);
  doc.save(`produits-marges-${filterSlug}-${dateSlug}.pdf`);
}

export function stockRowLabels(
  product: {
    price: number;
    costMad?: number | null;
    stockQty: number;
    stockLabel: string;
    barcode?: string | null;
  },
  locale: string,
): Pick<
  StockCatalogPdfRow,
  "costLabel" | "sellLabel" | "marginLabel" | "stockLabel"
> {
  const cost = product.costMad;
  const qty = Math.max(0, product.stockQty);
  const marginPct =
    cost && cost > 0 ? ((product.price - cost) / cost) * 100 : null;
  const marginMad = cost && cost > 0 ? product.price - cost : null;

  return {
    costLabel:
      cost && cost > 0 ? formatMad(cost, 2, locale) : "—",
    sellLabel: formatMad(product.price, 2, locale),
    marginLabel:
      marginPct !== null && marginMad !== null
        ? `${marginPct >= 0 ? "+" : ""}${marginPct.toFixed(1)}% (${formatMad(marginMad, 2, locale)})`
        : "—",
    stockLabel:
      qty > 0 ? String(qty) : product.stockLabel.replace(/^STOCK:\s*/i, ""),
  };
}
