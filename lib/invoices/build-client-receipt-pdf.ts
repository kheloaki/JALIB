import { jsPDF } from "jspdf";

import type { toReceiptSettings } from "@/lib/i18n/app-document-settings";
import { STORE_NAME } from "@/lib/brand/constants";
import { drawReceiptEan13BarcodePdf } from "@/lib/invoices/barcode-pdf";
import {
  invoicePaidMad,
  invoiceRemainingMad,
  invoiceRemainingQty,
} from "@/lib/invoices/storage";
import type { Invoice, InvoicePaymentType } from "@/lib/invoices/types";
import {
  formatReceiptDateTimeForPdf,
  formatReceiptMoney,
} from "@/lib/invoices/receipt-display";
import { getDocumentLabels } from "@/lib/i18n/document-labels";
import {
  setupDocumentPdfFont,
  type DocumentPdfFonts,
} from "@/lib/pdf/document-pdf-font";
import {
  writePdfCentered,
  writePdfLatinText,
  writePdfReceiptText,
} from "@/lib/pdf/pdf-text";
import {
  loadTicketLogoForPdf,
  type TicketLogoPdf,
} from "@/lib/print/ticket-logo";

type ClientReceiptPdfSettings = ReturnType<typeof toReceiptSettings>;

/** Match WD8260 / on-screen thermal ticket (same as HTML print). */
const PAGE_WIDTH_MM = 80;
const MARGIN_MM = 2;
const CONTENT_WIDTH_MM = PAGE_WIDTH_MM - MARGIN_MM * 2;

function sanitizeFilename(value: string): string {
  return value.replace(/[^\w.-]+/g, "_");
}

function paymentTypeLabel(
  type: InvoicePaymentType,
  locale: ClientReceiptPdfSettings["documentLocale"],
): string {
  const labels = getDocumentLabels(locale).invoice;
  return type === "cash" ? labels.cash : labels.credit;
}

function drawDashedLine(doc: jsPDF, y: number) {
  doc.setDrawColor(0, 0, 0);
  doc.setLineDashPattern([1.2, 1.2], 0);
  doc.setLineWidth(0.2);
  doc.line(MARGIN_MM, y, PAGE_WIDTH_MM - MARGIN_MM, y);
  doc.setLineDashPattern([], 0);
  doc.setLineWidth(0.2);
}

function estimateReceiptHeight(invoice: Invoice): number {
  const lineRows = invoice.lines.reduce((sum, line) => {
    const returnedExtra = (line.returnedQty ?? 0) > 0 ? 3.5 : 0;
    return sum + 9 + returnedExtra;
  }, 0);
  const showBalance =
    invoice.paymentType === "credit" ||
    invoice.paymentHistory.length > 0 ||
    invoiceRemainingMad(invoice) > 0;
  const balanceBlock = showBalance ? 12 : 0;
  const historyBlock =
    invoice.paymentHistory.length > 0
      ? 8 + invoice.paymentHistory.length * 6
      : 0;

  return Math.max(
    140,
    42 + 16 + 18 + lineRows + 12 + balanceBlock + historyBlock + 10 + 24,
  );
}

async function loadLogoForPdf(): Promise<TicketLogoPdf | null> {
  return loadTicketLogoForPdf(16);
}

/** Same LTR row layout as HTML thermal ticket: label left, value right. */
function writeTicketRow(
  doc: jsPDF,
  label: string,
  value: string,
  y: number,
  locale: ClientReceiptPdfSettings["documentLocale"],
  fonts: DocumentPdfFonts,
  options: { fontSize?: number; valueBold?: boolean } = {},
) {
  const fontSize = options.fontSize ?? 8;
  doc.setTextColor(0, 0, 0);
  writePdfReceiptText(doc, label, MARGIN_MM, y, locale, fonts, {
    align: "left",
    fontSize,
    style: "bold",
    maxWidth: CONTENT_WIDTH_MM * 0.45,
  });
  writePdfReceiptText(
    doc,
    value,
    PAGE_WIDTH_MM - MARGIN_MM,
    y,
    locale,
    fonts,
    {
      align: "right",
      fontSize,
      style: options.valueBold === false ? "normal" : "bold",
      maxWidth: CONTENT_WIDTH_MM * 0.52,
    },
  );
}

type BuildClientReceiptOptions = {
  existingDoc?: jsPDF;
  fonts?: DocumentPdfFonts;
  logo?: Awaited<ReturnType<typeof loadLogoForPdf>>;
};

/**
 * Client ticket PDF — layout matches on-screen / browser-printed thermal ticket.
 */
export async function buildClientReceiptPdf(
  invoice: Invoice,
  settings: ClientReceiptPdfSettings,
  options?: BuildClientReceiptOptions,
): Promise<jsPDF> {
  const labels = getDocumentLabels(settings.documentLocale);
  const inv = labels.invoice;
  const locale = labels.locale;
  const paidMad =
    invoice.paymentType === "cash"
      ? invoice.totalMad
      : invoicePaidMad(invoice);
  const remainingMad =
    invoice.paymentType === "cash" ? 0 : invoiceRemainingMad(invoice);
  const showBalance =
    invoice.paymentType === "credit" ||
    invoice.paymentHistory.length > 0 ||
    remainingMad > 0;
  const pageHeight = estimateReceiptHeight(invoice);

  let doc = options?.existingDoc;
  let fonts = options?.fonts;
  if (!doc) {
    doc = new jsPDF({
      unit: "mm",
      format: [PAGE_WIDTH_MM, pageHeight],
    });
    fonts = await setupDocumentPdfFont(doc, settings.documentLocale);
  } else {
    doc.addPage([PAGE_WIDTH_MM, pageHeight], "portrait");
    fonts =
      fonts ?? (await setupDocumentPdfFont(doc, settings.documentLocale));
  }

  let y = MARGIN_MM + 2;
  const logo =
    options?.logo !== undefined ? options.logo : await loadLogoForPdf();
  if (logo) {
    doc.addImage(
      logo.dataUrl,
      logo.format,
      (PAGE_WIDTH_MM - logo.widthMm) / 2,
      y,
      logo.widthMm,
      logo.heightMm,
    );
    y += logo.heightMm + 2;
  } else {
    writePdfCentered(
      doc,
      settings.businessName || STORE_NAME,
      y,
      locale,
      fonts,
      {
        fontSize: 10,
        style: "bold",
        pageCenterX: PAGE_WIDTH_MM / 2,
        maxWidth: CONTENT_WIDTH_MM,
      },
    );
    y += 5;
  }

  doc.setTextColor(0, 0, 0);
  writePdfCentered(doc, inv.clientCopyTitle, y, locale, fonts, {
    fontSize: 9,
    style: "bold",
    pageCenterX: PAGE_WIDTH_MM / 2,
    maxWidth: CONTENT_WIDTH_MM,
  });
  y += 4;

  if (settings.storeAddress) {
    writePdfCentered(doc, settings.storeAddress, y, locale, fonts, {
      fontSize: 7,
      style: "bold",
      pageCenterX: PAGE_WIDTH_MM / 2,
      maxWidth: CONTENT_WIDTH_MM,
    });
    y += 3.5;
  }
  if (settings.storePhone) {
    writePdfLatinText(
      doc,
      `${labels.phonePrefix} ${settings.storePhone}`,
      PAGE_WIDTH_MM / 2,
      y,
      {
        align: "center",
        fontSize: 7,
        style: "bold",
        maxWidth: CONTENT_WIDTH_MM,
      },
    );
    y += 3.5;
  }

  y += 1;
  drawDashedLine(doc, y);
  y += 4;

  writeTicketRow(
    doc,
    inv.invoiceNumber,
    `#${invoice.number}`,
    y,
    locale,
    fonts,
  );
  y += 4;
  writeTicketRow(
    doc,
    inv.dateTime,
    formatReceiptDateTimeForPdf(invoice.date, invoice.time),
    y,
    locale,
    fonts,
  );
  y += 4;
  writeTicketRow(doc, inv.customer, invoice.clientName, y, locale, fonts);
  y += 4;
  writeTicketRow(
    doc,
    inv.payment,
    paymentTypeLabel(invoice.paymentType, locale),
    y,
    locale,
    fonts,
  );
  y += 4;
  drawDashedLine(doc, y);
  y += 4;

  for (const line of invoice.lines) {
    const qty = invoiceRemainingQty(line);
    const lineTotal = Math.round(line.unitPriceMad * qty * 100) / 100;

    // Same order as HTML ClientReceipt: name → returned → qty × price | total
    writePdfReceiptText(
      doc,
      line.nameAr,
      PAGE_WIDTH_MM - MARGIN_MM,
      y,
      locale,
      fonts,
      {
        align: "right",
        style: "bold",
        fontSize: 9,
        maxWidth: CONTENT_WIDTH_MM,
      },
    );
    y += 4;

    if ((line.returnedQty ?? 0) > 0) {
      writePdfReceiptText(
        doc,
        inv.returnedQty(line.returnedQty ?? 0),
        PAGE_WIDTH_MM - MARGIN_MM,
        y,
        locale,
        fonts,
        { align: "right", fontSize: 7, maxWidth: CONTENT_WIDTH_MM },
      );
      y += 3.5;
    }

    writePdfLatinText(
      doc,
      `${qty} x ${formatReceiptMoney(line.unitPriceMad, "fr")}`,
      MARGIN_MM,
      y,
      { align: "left", fontSize: 8, style: "bold" },
    );
    writePdfLatinText(
      doc,
      formatReceiptMoney(lineTotal, "fr"),
      PAGE_WIDTH_MM - MARGIN_MM,
      y,
      { align: "right", fontSize: 8, style: "bold" },
    );
    y += 4.5;
  }

  drawDashedLine(doc, y);
  y += 5;

  // One total row like the printed ticket (label left, large amount right).
  writePdfReceiptText(doc, inv.totalTtc, MARGIN_MM, y, locale, fonts, {
    align: "left",
    fontSize: 9,
    style: "bold",
    maxWidth: CONTENT_WIDTH_MM * 0.4,
  });
  writePdfLatinText(
    doc,
    formatReceiptMoney(invoice.totalMad, "fr"),
    PAGE_WIDTH_MM - MARGIN_MM,
    y,
    { align: "right", fontSize: 14, style: "bold" },
  );
  y += 7;

  if (showBalance) {
    writeTicketRow(
      doc,
      inv.paidLabel,
      formatReceiptMoney(paidMad, "fr"),
      y,
      locale,
      fonts,
    );
    y += 4;
    writeTicketRow(
      doc,
      inv.remainingLabel,
      formatReceiptMoney(remainingMad, "fr"),
      y,
      locale,
      fonts,
    );
    y += 5;
  }

  if (invoice.paymentHistory.length > 0) {
    drawDashedLine(doc, y);
    y += 4;
    writePdfReceiptText(doc, inv.paymentHistory, MARGIN_MM, y, locale, fonts, {
      align: "left",
      fontSize: 7,
      style: "bold",
      maxWidth: CONTENT_WIDTH_MM,
    });
    y += 4;
    for (const payment of invoice.paymentHistory) {
      const amount = `${payment.amountMad >= 0 ? "+" : ""}${formatReceiptMoney(payment.amountMad, "fr")}`;
      writePdfLatinText(doc, amount, MARGIN_MM, y, {
        align: "left",
        fontSize: 7,
        style: "bold",
      });
      writePdfLatinText(
        doc,
        formatReceiptDateTimeForPdf(payment.date, "").trim(),
        PAGE_WIDTH_MM - MARGIN_MM,
        y,
        { align: "right", fontSize: 7 },
      );
      y += 3.5;
      if (payment.note) {
        writePdfReceiptText(
          doc,
          payment.note,
          MARGIN_MM,
          y,
          locale,
          fonts,
          { align: "left", fontSize: 6, maxWidth: CONTENT_WIDTH_MM },
        );
        y += 3;
      }
    }
    y += 2;
  }

  if (settings.receiptFooter) {
    writePdfReceiptText(
      doc,
      settings.receiptFooter,
      PAGE_WIDTH_MM / 2,
      y,
      locale,
      fonts,
      {
        align: "center",
        fontSize: 7,
        style: "bold",
        maxWidth: CONTENT_WIDTH_MM,
      },
    );
    y += 5;
  }

  y += 2;
  drawReceiptEan13BarcodePdf(
    doc,
    invoice.barcode,
    PAGE_WIDTH_MM / 2,
    y,
    CONTENT_WIDTH_MM,
  );

  return doc;
}

export async function buildCombinedClientReceiptPdf(
  invoices: readonly Invoice[],
  settings: ClientReceiptPdfSettings,
): Promise<jsPDF> {
  if (invoices.length === 0) {
    throw new Error("No invoices to export.");
  }
  const logo = await loadLogoForPdf();
  let doc = await buildClientReceiptPdf(invoices[0]!, settings, { logo });
  const fonts = await setupDocumentPdfFont(doc, settings.documentLocale);
  for (let i = 1; i < invoices.length; i += 1) {
    doc = await buildClientReceiptPdf(invoices[i]!, settings, {
      existingDoc: doc,
      fonts,
      logo,
    });
  }
  return doc;
}

export async function downloadClientReceiptPdf(
  invoice: Invoice,
  settings: ClientReceiptPdfSettings,
): Promise<void> {
  const doc = await buildClientReceiptPdf(invoice, settings);
  doc.save(`ticket-client-${sanitizeFilename(invoice.number)}.pdf`);
}

export async function downloadCombinedClientReceiptPdf(
  invoices: readonly Invoice[],
  settings: ClientReceiptPdfSettings,
): Promise<void> {
  const doc = await buildCombinedClientReceiptPdf(invoices, settings);
  const stamp = new Date().toISOString().slice(0, 10);
  doc.save(`tickets-clients-${stamp}-${invoices.length}.pdf`);
}
