import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

import type { InternalInvoiceSettings } from "@/components/invoices/internal-invoice-document";
import {
  invoicePaidMad,
  invoiceRemainingMad,
  invoiceRemainingQty,
} from "@/lib/invoices/storage";
import type { Invoice, InvoiceLine, InvoicePaymentType, InvoiceStatus } from "@/lib/invoices/types";
import { STORE_LOGO_PRINT_FULL_PATH, STORE_NAME } from "@/lib/brand/constants";
import { drawCompactEan13BarcodePdf } from "@/lib/invoices/barcode-pdf";
import {
  documentLegalLines,
  formatDocumentDateForPdf,
  getDocumentLabels,
} from "@/lib/i18n/document-labels";
import { formatMad } from "@/lib/money/mad";
import {
  applyPdfFont,
  type DocumentPdfFonts,
  setupDocumentPdfFont,
} from "@/lib/pdf/document-pdf-font";
import {
  createAutoTableLocaleHooks,
  preparePdfText,
  writePdfArabicFooter,
} from "@/lib/pdf/pdf-text";

const MARGIN_MM = 12;
const PAGE_WIDTH_MM = 210;
const CONTENT_WIDTH_MM = PAGE_WIDTH_MM - MARGIN_MM * 2;

const GRID_COLOR: [number, number, number] = [100, 116, 139];
const HEAD_FILL: [number, number, number] = [248, 250, 252];
const MUTED_TEXT: [number, number, number] = [71, 85, 105];
/** Recouvrement / payment rows in bulk client statement. */
const PAYMENT_FILL: [number, number, number] = [220, 252, 231];
const PAYMENT_TEXT: [number, number, number] = [21, 128, 61];
/** Retour / refund rows in bulk client statement. */
const RETURN_FILL: [number, number, number] = [254, 226, 226];
const RETURN_TEXT: [number, number, number] = [185, 28, 28];

function sanitizeFilename(value: string): string {
  return value.replace(/[^\w.-]+/g, "_");
}

function paymentTypeLabel(
  type: InvoicePaymentType,
  locale: InternalInvoiceSettings["documentLocale"],
): string {
  const labels = getDocumentLabels(locale).invoice;
  return type === "cash" ? labels.cash : labels.credit;
}

function statusLabel(
  status: InvoiceStatus,
  locale: InternalInvoiceSettings["documentLocale"],
): string {
  const labels = getDocumentLabels(locale).invoice;
  if (status === "returned") return labels.returned;
  return status === "paid" ? labels.paid : labels.pending;
}

function lineTotalMad(line: InvoiceLine): number {
  return invoiceRemainingQty(line) * line.unitPriceMad;
}

function tableFontStyles(fonts: DocumentPdfFonts) {
  return { font: fonts.body, fontStyle: "normal" as const };
}

function tableLocaleStyles(locale: InternalInvoiceSettings["documentLocale"]) {
  if (locale !== "ar") return {};
  return {
    styles: { halign: "right" as const },
    headStyles: { halign: "right" as const },
  };
}

function pdfCellText(
  text: string,
  locale: InternalInvoiceSettings["documentLocale"],
): string {
  return preparePdfText(text, locale);
}

function autoTableLocaleHooks(
  locale: InternalInvoiceSettings["documentLocale"],
  fonts: DocumentPdfFonts,
  extra?: (data: import("jspdf-autotable").CellHookData) => void,
) {
  return createAutoTableLocaleHooks(locale, fonts, extra);
}

async function loadLogoForPdf(): Promise<{
  dataUrl: string;
  widthMm: number;
  heightMm: number;
} | null> {
  try {
    const response = await fetch(STORE_LOGO_PRINT_FULL_PATH);
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

function drawFactureHeader(
  doc: jsPDF,
  invoice: Invoice,
  settings: InternalInvoiceSettings,
  fonts: DocumentPdfFonts,
  startY: number,
  leftContentBottomY: number,
): number {
  const labels = getDocumentLabels(settings.documentLocale);
  const inv = labels.invoice;
  const remainingMad = invoiceRemainingMad(invoice);
  const legal = documentLegalLines(settings, labels);
  const rightX = PAGE_WIDTH_MM - MARGIN_MM;

  let leftY = leftContentBottomY;
  if (legal.length > 0) {
    applyPdfFont(doc, fonts, "normal");
    doc.setFontSize(8);
    doc.setTextColor(...MUTED_TEXT);
    for (const line of legal) {
      doc.text(line, MARGIN_MM, leftY);
      leftY += 4;
    }
  }

  const boxTop = startY;
  const boxPadding = 3;
  const boxWidth = 52;
  const boxLeft = rightX - boxWidth;
  let boxHeight = 24;
  if (remainingMad > 0) boxHeight += 4;

  doc.setDrawColor(...GRID_COLOR);
  doc.setLineWidth(0.2);
  doc.rect(boxLeft, boxTop, boxWidth, boxHeight);

  let boxY = boxTop + boxPadding + 3;
  applyPdfFont(doc, fonts, "bold");
  doc.setFontSize(7);
  doc.setTextColor(...MUTED_TEXT);
  const titleText =
    labels.locale === "ar"
      ? preparePdfText(inv.title, labels.locale)
      : inv.title.toUpperCase();
  doc.text(titleText, rightX - boxPadding, boxY, { align: "right" });

  boxY += 5;
  doc.setFont("courier", "bold");
  doc.setFontSize(12);
  doc.setTextColor(0, 0, 0);
  doc.text(`#${invoice.number}`, rightX - boxPadding, boxY, { align: "right" });

  boxY += 5;
  applyPdfFont(doc, fonts, "normal");
  doc.setFontSize(8);
  doc.setTextColor(...MUTED_TEXT);
  doc.text(
    `${formatDocumentDateForPdf(invoice.date, labels.locale)} ${labels.atTime} ${invoice.time}`,
    rightX - boxPadding,
    boxY,
    { align: "right" },
  );

  boxY += 5;
  applyPdfFont(doc, fonts, "bold");
  doc.setFontSize(10);
  doc.setTextColor(0, 0, 0);
  doc.text(`${formatMad(invoice.totalMad)} ${labels.ttc}`, rightX - boxPadding, boxY, {
    align: "right",
  });

  if (remainingMad > 0) {
    boxY += 4;
    applyPdfFont(doc, fonts, "normal");
    doc.setFontSize(8);
    doc.setTextColor(...MUTED_TEXT);
    doc.text(
      pdfCellText(`${inv.remainingDue} : ${formatMad(remainingMad)}`, labels.locale),
      rightX - boxPadding,
      boxY,
      { align: "right" },
    );
  }

  const barcodeBottom = drawCompactEan13BarcodePdf(
    doc,
    invoice.barcode,
    rightX - boxPadding,
    boxTop + boxHeight + 2,
  );

  const headerBottom = Math.max(leftY, barcodeBottom);
  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.4);
  doc.line(MARGIN_MM, headerBottom + 3, rightX, headerBottom + 3);

  return headerBottom + 8;
}

const STRIPE_FILL: [number, number, number] = [245, 247, 250];

function roundStatementMad(n: number): number {
  return Math.round(n * 100) / 100;
}

/** French-style amounts like the classic ledger (12 345,67). */
/** Compact FR amount for narrow PDF columns (no thousands grouping). */
function formatLedgerAmount(n: number): string {
  return n.toLocaleString("fr-FR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
    useGrouping: false,
  });
}

function parseLedgerAmount(text: string): number | null {
  const cleaned = text.replace(/\s/g, "").replace(",", ".");
  if (!cleaned) return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

function isCreditStatementLine(line: InvoiceLine): boolean {
  return line.sourceKind === "payment" || line.sourceKind === "return";
}

function isClientStatementInvoice(invoice: Invoice): boolean {
  return (
    invoice.number.startsWith("LOT-") ||
    invoice.statementOpeningBalanceMad != null ||
    invoice.lines.some(
      (line) =>
        isCreditStatementLine(line) || line.sourceInvoiceNumber != null,
    )
  );
}

/** Exact product name only — qty lives in its own column (avoids Arabic clipping). */
function productDesignation(line: InvoiceLine): string {
  return line.nameAr.trim();
}

function formatStatementQty(qty: number): string {
  if (!Number.isFinite(qty)) return "";
  const rounded = Math.round(qty * 1000) / 1000;
  if (Number.isInteger(rounded)) return String(rounded);
  return String(rounded);
}

/** Row role controls borders: no horizontal lines inside the same facture. */
type StatementRowRole =
  | "opening"
  | "group-single"
  | "group-start"
  | "group-mid"
  | "group-end"
  | "payment"
  | "return";

type ClientStatementTable = {
  body: string[][];
  roles: StatementRowRole[];
  /** Final debt-positive running solde after all rows. */
  finalBalanceMad: number;
};

/**
 * Ledger-style rows inspired by classic client account statements:
 * Date | Designation | Qté | P.U. | Débit | Crédit | Solde
 */
function buildClientStatementTable(
  invoice: Invoice,
  locale: InternalInvoiceSettings["documentLocale"],
  openingLabel: string,
): ClientStatementTable {
  const body: string[][] = [];
  const roles: StatementRowRole[] = [];
  const opening = roundStatementMad(invoice.statementOpeningBalanceMad ?? 0);
  let runningBalance = opening;
  let index = 0;
  const lines = invoice.lines;

  if (Math.abs(opening) > 0.009) {
    const openingDate = invoice.date
      ? formatDocumentDateForPdf(invoice.date, locale)
      : "";
    const debit = opening > 0 ? formatLedgerAmount(opening) : "";
    const credit = opening < 0 ? formatLedgerAmount(-opening) : "";
    body.push([
      openingDate,
      openingLabel,
      "",
      "",
      debit,
      credit,
      formatLedgerAmount(runningBalance),
    ]);
    roles.push("opening");
  }

  while (index < lines.length) {
    const line = lines[index]!;

    if (isCreditStatementLine(line)) {
      const amount = line.sourcePaymentAmountMad ?? line.unitPriceMad;
      runningBalance = roundStatementMad(runningBalance - amount);
      const dateLabel = line.sourceInvoiceDate
        ? formatDocumentDateForPdf(line.sourceInvoiceDate, locale)
        : "";
      body.push([
        dateLabel,
        line.nameAr.trim(),
        "",
        "",
        "",
        formatLedgerAmount(amount),
        formatLedgerAmount(runningBalance),
      ]);
      roles.push(line.sourceKind === "return" ? "return" : "payment");
      index += 1;
      continue;
    }

    const source = line.sourceInvoiceNumber ?? `row-${index}`;
    const group: InvoiceLine[] = [];
    while (
      index < lines.length &&
      !isCreditStatementLine(lines[index]!) &&
      (lines[index]!.sourceInvoiceNumber ?? `row-${index}`) === source
    ) {
      group.push(lines[index]!);
      index += 1;
    }

    // Prefer gross facture total; fall back to qty×PU (not remaining qty).
    const purchaseMad = roundStatementMad(
      group[0]?.sourceInvoiceTotalMad ??
        group.reduce((sum, item) => sum + item.qty * item.unitPriceMad, 0),
    );
    runningBalance = roundStatementMad(runningBalance + purchaseMad);
    const dateLabel = group[0]?.sourceInvoiceDate
      ? formatDocumentDateForPdf(group[0].sourceInvoiceDate, locale)
      : "";

    group.forEach((item, itemIndex) => {
      const isFirst = itemIndex === 0;
      const isLast = itemIndex === group.length - 1;
      body.push([
        isFirst ? dateLabel : "",
        productDesignation(item),
        formatStatementQty(item.qty),
        formatLedgerAmount(item.unitPriceMad),
        isLast ? formatLedgerAmount(purchaseMad) : "",
        "",
        isLast ? formatLedgerAmount(runningBalance) : "",
      ]);
      if (group.length === 1) roles.push("group-single");
      else if (isFirst) roles.push("group-start");
      else if (isLast) roles.push("group-end");
      else roles.push("group-mid");
    });
  }

  return { body, roles, finalBalanceMad: runningBalance };
}

function statementRowLineWidth(role: StatementRowRole | undefined): {
  top: number;
  right: number;
  bottom: number;
  left: number;
} {
  const edge = 0.12;
  switch (role) {
    case "group-start":
      return { top: edge, right: edge, bottom: 0, left: edge };
    case "group-mid":
      return { top: 0, right: edge, bottom: 0, left: edge };
    case "group-end":
      return { top: 0, right: edge, bottom: edge, left: edge };
    case "opening":
    case "group-single":
    case "payment":
    case "return":
    default:
      return { top: edge, right: edge, bottom: edge, left: edge };
  }
}

function buildInvoiceLinesTableBody(
  invoice: Invoice,
  _locale: InternalInvoiceSettings["documentLocale"],
  _inv: ReturnType<typeof getDocumentLabels>["invoice"],
): string[][] {
  let lineNo = 0;
  return invoice.lines
    .filter((line) => !isCreditStatementLine(line))
    .map((line) => {
      lineNo += 1;
      return [
        String(lineNo),
        line.nameAr,
        String(line.qty),
        String(line.returnedQty ?? 0),
        String(invoiceRemainingQty(line)),
        formatMad(line.unitPriceMad),
        formatMad(lineTotalMad(line)),
      ];
    });
}

export async function buildInternalInvoicePdf(
  invoice: Invoice,
  settings: InternalInvoiceSettings,
  existingDoc?: jsPDF,
): Promise<jsPDF> {
  const labels = getDocumentLabels(settings.documentLocale);
  const inv = labels.invoice;
  const doc =
    existingDoc ??
    new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
  if (existingDoc) {
    doc.addPage("a4", "portrait");
  }
  const fonts = await setupDocumentPdfFont(doc, settings.documentLocale);

  const paidMad = invoicePaidMad(invoice);
  const remainingMad = invoiceRemainingMad(invoice);
  const productLines = invoice.lines.filter(
    (line) => !isCreditStatementLine(line),
  );
  const grossLinesMad = productLines.reduce(
    (sum, line) => sum + line.qty * line.unitPriceMad,
    0,
  );
  const returnedMad = grossLinesMad - invoice.totalMad;
  const issuedOn = formatDocumentDateForPdf(
    new Date().toISOString().slice(0, 10),
    labels.locale,
  );

  const logo = await loadLogoForPdf();
  let y = MARGIN_MM;

  if (logo) {
    doc.addImage(
      logo.dataUrl,
      "PNG",
      MARGIN_MM,
      y,
      logo.widthMm,
      logo.heightMm,
    );
    y = drawFactureHeader(
      doc,
      invoice,
      settings,
      fonts,
      MARGIN_MM,
      MARGIN_MM + logo.heightMm + 3,
    );
  } else {
    applyPdfFont(doc, fonts, "bold");
    doc.setFontSize(14);
    doc.setTextColor(0, 0, 0);
    doc.text(STORE_NAME, MARGIN_MM, y + 5);
    y = drawFactureHeader(doc, invoice, settings, fonts, MARGIN_MM, y + 10);
  }

  const locale = settings.documentLocale;
  const localeTable = tableLocaleStyles(locale);

  autoTable(doc, {
    startY: y,
    margin: { left: MARGIN_MM, right: MARGIN_MM },
    tableWidth: CONTENT_WIDTH_MM,
    theme: "grid",
    head: [[inv.client, inv.cashier, inv.paymentType, inv.status]],
    body: [
      [
        invoice.clientName,
        invoice.cashierId,
        paymentTypeLabel(invoice.paymentType, locale),
        statusLabel(invoice.status, locale),
      ],
    ],
    ...localeTable,
    styles: {
      ...tableFontStyles(fonts),
      ...localeTable.styles,
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
      ...localeTable.headStyles,
    },
    bodyStyles: {
      fontStyle: "bold",
      font: fonts.body,
    },
    ...autoTableLocaleHooks(locale, fonts),
  });

  y = doc.lastAutoTable.finalY + 4;

  autoTable(doc, {
    startY: y,
    margin: { left: MARGIN_MM, right: MARGIN_MM },
    tableWidth: CONTENT_WIDTH_MM,
    theme: "grid",
    head: [[inv.grossAmount, inv.collected, inv.netTtc]],
    body: [[formatMad(grossLinesMad), formatMad(paidMad), formatMad(invoice.totalMad)]],
    ...localeTable,
    styles: {
      ...tableFontStyles(fonts),
      ...localeTable.styles,
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
      ...localeTable.headStyles,
    },
    bodyStyles: {
      fontStyle: "bold",
      font: fonts.body,
    },
    columnStyles: {
      2: { fontStyle: "bold" },
    },
    ...autoTableLocaleHooks(locale, fonts),
  });

  y = doc.lastAutoTable.finalY + 4;

  const statementMode = isClientStatementInvoice(invoice);

  if (statementMode) {
    const statement = buildClientStatementTable(
      invoice,
      locale,
      inv.openingBalance,
    );
    // Classic client ledger: Date | Designation | Qté | P.U. | Débit | Crédit | Solde
    autoTable(doc, {
      startY: y,
      margin: { left: MARGIN_MM, right: MARGIN_MM },
      tableWidth: CONTENT_WIDTH_MM,
      theme: "grid",
      head: [
        [
          inv.statementDate,
          inv.statementDesignation,
          inv.statementQty,
          inv.statementUnitPrice,
          inv.statementDebit,
          inv.statementCredit,
          inv.runningBalance,
        ],
      ],
      body: statement.body,
      ...localeTable,
      styles: {
        ...localeTable.styles,
        font: "helvetica",
        fontStyle: "normal",
        fontSize: 7.5,
        cellPadding: 1.4,
        lineColor: GRID_COLOR,
        lineWidth: 0.1,
        textColor: [0, 0, 0],
        overflow: "linebreak",
        valign: "middle",
        minCellHeight: 7,
      },
      headStyles: {
        fillColor: HEAD_FILL,
        textColor: MUTED_TEXT,
        fontSize: 7,
        fontStyle: "bold",
        font: fonts.body,
        ...localeTable.headStyles,
      },
      bodyStyles: {
        fontStyle: "normal",
      },
      columnStyles: {
        0: { cellWidth: 18, halign: "center", fontStyle: "bold" },
        1: {
          cellWidth: 58,
          halign: locale === "ar" ? "right" : "left",
          fontStyle: "normal",
        },
        2: { cellWidth: 14, halign: "center", fontStyle: "bold" },
        3: { cellWidth: 24, halign: "right", overflow: "ellipsize" },
        4: { cellWidth: 24, halign: "right", fontStyle: "bold" },
        5: { cellWidth: 24, halign: "right", fontStyle: "bold" },
        6: { cellWidth: 24, halign: "right", fontStyle: "bold" },
      },
      ...autoTableLocaleHooks(locale, fonts, (data) => {
        if (data.section !== "body") return;
        const role = statement.roles[data.row.index];
        data.cell.styles.lineWidth = statementRowLineWidth(role);
        if (data.column.index === 1) {
          data.cell.styles.fontStyle = "normal";
        }
        // Soft fill per facture / payment / return / opening block.
        if (role === "opening") {
          data.cell.styles.fillColor = HEAD_FILL;
          if (data.column.index !== 1) data.cell.styles.fontStyle = "bold";
        } else if (role === "payment") {
          data.cell.styles.fillColor = PAYMENT_FILL;
          data.cell.styles.textColor = PAYMENT_TEXT;
        } else if (role === "return") {
          data.cell.styles.fillColor = RETURN_FILL;
          data.cell.styles.textColor = RETURN_TEXT;
        } else {
          let block = 0;
          for (let i = 0; i <= data.row.index; i++) {
            const r = statement.roles[i];
            if (
              r === "opening" ||
              r === "group-start" ||
              r === "group-single" ||
              r === "payment" ||
              r === "return"
            ) {
              block += 1;
            }
          }
          if (block % 2 === 0) {
            data.cell.styles.fillColor = STRIPE_FILL;
          }
        }
        const raw = Array.isArray(data.row.raw) ? data.row.raw : null;
        const credit = String(raw?.[5] ?? "").trim();
        if (credit && data.column.index >= 5 && role === "payment") {
          data.cell.styles.textColor = PAYMENT_TEXT;
        }
        if (credit && data.column.index >= 5 && role === "return") {
          data.cell.styles.textColor = RETURN_TEXT;
        }
        // Solde: + = dette (red), − = avoir (green).
        if (data.column.index === 6 && raw) {
          const solde = parseLedgerAmount(String(raw[6] ?? ""));
          if (solde != null && solde > 0.009) {
            data.cell.styles.textColor = RETURN_TEXT;
          } else if (solde != null && solde < -0.009) {
            data.cell.styles.textColor = PAYMENT_TEXT;
          }
        }
      }),
    });

    y = doc.lastAutoTable.finalY + 4;

    const totalsTableWidth = 80;
    autoTable(doc, {
      startY: y,
      margin: {
        left: PAGE_WIDTH_MM - MARGIN_MM - totalsTableWidth,
        right: MARGIN_MM,
      },
      tableWidth: totalsTableWidth,
      theme: "grid",
      body: [
        [inv.grossSold, formatMad(grossLinesMad)],
        [inv.collected, formatMad(paidMad)],
        [
          inv.balanceDue,
          formatMad(
            Math.max(0, statement.finalBalanceMad),
          ),
        ],
      ],
      ...localeTable,
      styles: {
        ...tableFontStyles(fonts),
        ...localeTable.styles,
        fontSize: 9,
        cellPadding: 2,
        lineColor: GRID_COLOR,
        lineWidth: 0.1,
        textColor: [0, 0, 0],
      },
      columnStyles: {
        0: { cellWidth: 40, halign: locale === "ar" ? "right" : "left" },
        1: { halign: "right", fontStyle: "bold" },
      },
      ...autoTableLocaleHooks(locale, fonts, (data) => {
        if (data.section === "body" && data.row.index === 2) {
          data.cell.styles.fontStyle = "bold";
          data.cell.styles.fillColor = HEAD_FILL;
        }
      }),
    });

    y = doc.lastAutoTable.finalY + 6;
  } else {
    const lineBody = buildInvoiceLinesTableBody(invoice, locale, inv);

    autoTable(doc, {
      startY: y,
      margin: { left: MARGIN_MM, right: MARGIN_MM },
      tableWidth: CONTENT_WIDTH_MM,
      theme: "grid",
      head: [
        [
          inv.lineIndex,
          inv.designation,
          inv.qtySold,
          inv.qtyReturned,
          inv.netQty,
          inv.unitPrice,
          inv.lineTotal,
        ],
      ],
      body: lineBody,
      ...localeTable,
      styles: {
        ...tableFontStyles(fonts),
        ...localeTable.styles,
        fontSize: 8,
        cellPadding: 2,
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
        ...localeTable.headStyles,
      },
      columnStyles: {
        0: { cellWidth: 10, halign: "center" },
        1: { cellWidth: 70, halign: locale === "ar" ? "right" : "left" },
        2: { cellWidth: 22, halign: "right" },
        3: { cellWidth: 20, halign: "right" },
        4: { cellWidth: 20, halign: "right" },
        5: { cellWidth: 22, halign: "right" },
        6: { cellWidth: 22, halign: "right" },
      },
      ...autoTableLocaleHooks(locale, fonts),
    });

    y = doc.lastAutoTable.finalY + 4;

    const totalsTableWidth = 80;
    autoTable(doc, {
      startY: y,
      margin: {
        left: PAGE_WIDTH_MM - MARGIN_MM - totalsTableWidth,
        right: MARGIN_MM,
      },
      tableWidth: totalsTableWidth,
      theme: "grid",
      body: [
        [inv.grossSold, formatMad(grossLinesMad)],
        [inv.returns, formatMad(returnedMad)],
        [inv.netTtc, formatMad(invoice.totalMad)],
        [inv.collected, formatMad(paidMad)],
        [inv.balanceDue, formatMad(remainingMad)],
      ],
      ...localeTable,
      styles: {
        ...tableFontStyles(fonts),
        ...localeTable.styles,
        fontSize: 9,
        cellPadding: 2,
        lineColor: GRID_COLOR,
        lineWidth: 0.1,
        textColor: [0, 0, 0],
      },
      columnStyles: {
        0: { cellWidth: 40, halign: locale === "ar" ? "right" : "left" },
        1: { halign: "right", fontStyle: "bold" },
      },
      ...autoTableLocaleHooks(locale, fonts, (data) => {
        if (
          data.section === "body" &&
          (data.row.index === 2 || data.row.index === 4)
        ) {
          data.cell.styles.fontStyle = "bold";
          data.cell.styles.fillColor = HEAD_FILL;
        }
      }),
    });

    y = doc.lastAutoTable.finalY + 6;

    if (invoice.paymentHistory.length > 0) {
      applyPdfFont(doc, fonts, "bold");
      doc.setFontSize(7);
      doc.setTextColor(...MUTED_TEXT);
      doc.text(inv.payments.toUpperCase(), MARGIN_MM, y);
      y += 3;

      autoTable(doc, {
        startY: y,
        margin: { left: MARGIN_MM, right: MARGIN_MM },
        tableWidth: CONTENT_WIDTH_MM,
        theme: "grid",
        head: [
          [inv.paymentDate, inv.paymentNote, inv.paymentRef, inv.paymentAmount],
        ],
        body: invoice.paymentHistory.map((payment) => [
          formatDocumentDateForPdf(payment.date, labels.locale),
          payment.note,
          payment.ref,
          `${payment.amountMad >= 0 ? "+" : ""}${formatMad(payment.amountMad)}`,
        ]),
        styles: {
          ...tableFontStyles(fonts),
          ...localeTable.styles,
          fontSize: 8,
          cellPadding: 2,
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
          ...localeTable.headStyles,
        },
        columnStyles: {
          3: { halign: "right", fontStyle: "bold" },
        },
        ...autoTableLocaleHooks(locale, fonts),
      });

      y = doc.lastAutoTable.finalY + 6;
    }
  }

  doc.setDrawColor(...GRID_COLOR);
  doc.setLineWidth(0.1);
  doc.line(MARGIN_MM, y, PAGE_WIDTH_MM - MARGIN_MM, y);
  y += 5;

  applyPdfFont(doc, fonts, "normal");
  doc.setFontSize(7);
  doc.setTextColor(...MUTED_TEXT);
  if (labels.locale === "ar") {
    writePdfArabicFooter(
      doc,
      inv.internalFooterArabicLine,
      inv.internalFooterMetaLine(issuedOn, invoice.number),
      y,
      labels.locale,
      fonts,
      PAGE_WIDTH_MM / 2,
      CONTENT_WIDTH_MM,
    );
  } else {
    doc.text(
      inv.internalFooter(issuedOn, invoice.number),
      PAGE_WIDTH_MM / 2,
      y,
      { align: "center", maxWidth: CONTENT_WIDTH_MM },
    );
  }

  return doc;
}

export async function buildCombinedInternalInvoicePdf(
  invoices: readonly Invoice[],
  settings: InternalInvoiceSettings,
): Promise<jsPDF> {
  if (invoices.length === 0) {
    throw new Error("No invoices to export.");
  }
  let doc = await buildInternalInvoicePdf(invoices[0]!, settings);
  for (let i = 1; i < invoices.length; i++) {
    doc = await buildInternalInvoicePdf(invoices[i]!, settings, doc);
  }
  return doc;
}

export async function downloadInternalInvoicePdf(
  invoice: Invoice,
  settings: InternalInvoiceSettings,
): Promise<void> {
  const doc = await buildInternalInvoicePdf(invoice, settings);
  doc.save(`facture-interne-${sanitizeFilename(invoice.number)}.pdf`);
}
