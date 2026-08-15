import { jsPDF } from "jspdf";

import type { toReceiptSettings } from "@/lib/i18n/app-document-settings";
import { STORE_LOGO_PRINT_PATH, STORE_NAME } from "@/lib/brand/constants";
import { drawReceiptEan13BarcodePdf } from "@/lib/invoices/barcode-pdf";
import {
  invoicePaidMad,
  invoiceRemainingMad,
  invoiceRemainingQty,
} from "@/lib/invoices/storage";
import type { Invoice, InvoicePaymentType } from "@/lib/invoices/types";
import {
  formatReceiptDateTimeForPdf,
  formatReceiptLineQty,
  formatReceiptMoney,
} from "@/lib/invoices/receipt-display";
import { getDocumentLabels } from "@/lib/i18n/document-labels";
import {
  setupDocumentPdfFont,
  type DocumentPdfFonts,
} from "@/lib/pdf/document-pdf-font";
import {
  hasArabicLetters,
  writePdfArabicText,
  writePdfCentered,
  writePdfLatinText,
  writePdfReceiptText,
  writePdfTotalLine,
} from "@/lib/pdf/pdf-text";

type ClientReceiptPdfSettings = ReturnType<typeof toReceiptSettings>;

const PAGE_WIDTH_MM = 80;
const MARGIN_MM = 5;
const CONTENT_WIDTH_MM = PAGE_WIDTH_MM - MARGIN_MM * 2;
const MUTED_TEXT: [number, number, number] = [71, 85, 105];

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
  doc.setDrawColor(200, 200, 200);
  doc.setLineDashPattern([1, 1], 0);
  doc.line(MARGIN_MM, y, PAGE_WIDTH_MM - MARGIN_MM, y);
  doc.setLineDashPattern([], 0);
}

function estimateReceiptHeight(invoice: Invoice): number {
  const lineRows = invoice.lines.reduce((sum, line) => {
    const returnedExtra = (line.returnedQty ?? 0) > 0 ? 3 : 0;
    return sum + 5 + returnedExtra;
  }, 0);
  const paymentBlock =
    invoice.paymentHistory.length > 0
      ? 28 + invoice.paymentHistory.length * 14
      : 0;

  return (
    38 +
    18 +
    8 +
    lineRows +
    18 +
    paymentBlock +
    10 +
    22 +
    MARGIN_MM * 2
  );
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
    const maxHeightMm = 14;
    const ratio = image.naturalWidth / image.naturalHeight;
    const heightMm = maxHeightMm;
    return { dataUrl, widthMm: heightMm * ratio, heightMm };
  } catch {
    return null;
  }
}

function writeReceiptMetaRow(
  doc: jsPDF,
  label: string,
  value: string,
  y: number,
  locale: ClientReceiptPdfSettings["documentLocale"],
  fonts: DocumentPdfFonts,
) {
  doc.setFontSize(7);

  if (locale === "ar") {
    writePdfArabicText(doc, label, PAGE_WIDTH_MM - MARGIN_MM, y, fonts, {
      align: "right",
      color: MUTED_TEXT,
      maxWidth: CONTENT_WIDTH_MM * 0.48,
    });
    writePdfReceiptText(doc, value, MARGIN_MM, y, locale, fonts, {
      align: "left",
      style: "bold",
      forceLatin: !hasArabicLetters(value),
      maxWidth: CONTENT_WIDTH_MM * 0.52,
    });
    return;
  }

  writePdfLatinText(doc, label, MARGIN_MM, y, {
    color: MUTED_TEXT,
    maxWidth: CONTENT_WIDTH_MM * 0.48,
  });
  writePdfReceiptText(doc, value, PAGE_WIDTH_MM - MARGIN_MM, y, locale, fonts, {
    align: "right",
    style: "bold",
    maxWidth: CONTENT_WIDTH_MM * 0.52,
  });
}

type BuildClientReceiptOptions = {
  /** Append as a new page on an existing document (combined download). */
  existingDoc?: jsPDF;
  fonts?: DocumentPdfFonts;
  logo?: Awaited<ReturnType<typeof loadLogoForPdf>>;
};

export async function buildClientReceiptPdf(
  invoice: Invoice,
  settings: ClientReceiptPdfSettings,
  options?: BuildClientReceiptOptions,
): Promise<jsPDF> {
  const labels = getDocumentLabels(settings.documentLocale);
  const inv = labels.invoice;
  const locale = labels.locale;
  const paidMad = invoicePaidMad(invoice);
  const remainingMad = invoiceRemainingMad(invoice);
  const pageHeight = Math.max(140, estimateReceiptHeight(invoice));

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
      "PNG",
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
        fontSize: 9,
        style: "bold",
        pageCenterX: PAGE_WIDTH_MM / 2,
        maxWidth: CONTENT_WIDTH_MM,
      },
    );
    y += 5;
  }

  doc.setTextColor(0, 74, 198);
  writePdfCentered(doc, inv.clientCopyTitle, y, locale, fonts, {
    fontSize: 8,
    style: "bold",
    pageCenterX: PAGE_WIDTH_MM / 2,
    maxWidth: CONTENT_WIDTH_MM,
  });
  y += 4;

  if (settings.storeAddress || settings.storePhone) {
    doc.setTextColor(...MUTED_TEXT);
    if (settings.storeAddress) {
      writePdfCentered(doc, settings.storeAddress, y, locale, fonts, {
        fontSize: 6,
        pageCenterX: PAGE_WIDTH_MM / 2,
        maxWidth: CONTENT_WIDTH_MM,
      });
      y += 3.5;
    }
    if (settings.storePhone) {
      writePdfReceiptText(
        doc,
        `${labels.phonePrefix} ${settings.storePhone}`,
        PAGE_WIDTH_MM / 2,
        y,
        locale,
        fonts,
        {
          align: "center",
          fontSize: 6,
          forceLatin: !hasArabicLetters(settings.storePhone),
          maxWidth: CONTENT_WIDTH_MM,
        },
      );
      y += 3.5;
    }
  }

  y += 2;
  drawDashedLine(doc, y);
  y += 4;

  writeReceiptMetaRow(
    doc,
    inv.invoiceNumber,
    `#${invoice.number}`,
    y,
    locale,
    fonts,
  );
  y += 4;
  writeReceiptMetaRow(
    doc,
    inv.dateTime,
    formatReceiptDateTimeForPdf(invoice.date, invoice.time),
    y,
    locale,
    fonts,
  );
  y += 4;
  writeReceiptMetaRow(doc, inv.customer, invoice.clientName, y, locale, fonts);
  y += 4;
  writeReceiptMetaRow(
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

  if (locale === "ar") {
    writePdfArabicText(doc, inv.details, PAGE_WIDTH_MM - MARGIN_MM, y, fonts, {
      align: "right",
      fontSize: 6,
      style: "bold",
      color: MUTED_TEXT,
      maxWidth: CONTENT_WIDTH_MM,
    });
  } else {
    writePdfLatinText(doc, inv.details, MARGIN_MM, y, {
      fontSize: 6,
      style: "bold",
      color: MUTED_TEXT,
      maxWidth: CONTENT_WIDTH_MM,
    });
  }
  y += 4;

  for (const line of invoice.lines) {
    const qty = invoiceRemainingQty(line);
    const priceQty = formatReceiptLineQty(line.unitPriceMad, qty, locale);

    doc.setFontSize(7);
    doc.setTextColor(...MUTED_TEXT);
    writePdfLatinText(doc, priceQty, MARGIN_MM, y, { align: "left" });

    doc.setTextColor(0, 0, 0);
    doc.setFontSize(7);
    const priceWidth = doc.getTextWidth(priceQty) + 2;
    const nameMaxWidth = CONTENT_WIDTH_MM - priceWidth;
    writePdfReceiptText(
      doc,
      line.nameAr,
      PAGE_WIDTH_MM - MARGIN_MM,
      y,
      locale,
      fonts,
      {
        align: "right",
        style: "normal",
        maxWidth: nameMaxWidth,
      },
    );

    y += 4.5;

    if ((line.returnedQty ?? 0) > 0) {
      doc.setFontSize(6);
      doc.setTextColor(...MUTED_TEXT);
      writePdfReceiptText(
        doc,
        inv.returnedQty(line.returnedQty ?? 0),
        PAGE_WIDTH_MM - MARGIN_MM,
        y,
        locale,
        fonts,
        { align: "right", maxWidth: nameMaxWidth },
      );
      y += 3;
    }
  }

  y += 2;
  drawDashedLine(doc, y);
  y += 5;

  doc.setTextColor(...MUTED_TEXT);
  writePdfCentered(doc, inv.totalTtc, y, locale, fonts, {
    fontSize: 6,
    style: "bold",
    pageCenterX: PAGE_WIDTH_MM / 2,
    maxWidth: CONTENT_WIDTH_MM,
  });
  y += 5;

  writePdfTotalLine(
    doc,
    formatReceiptMoney(invoice.totalMad, locale),
    labels.currencyWord,
    y,
    locale,
    fonts,
    { fontSize: 12, pageCenterX: PAGE_WIDTH_MM / 2 },
  );
  y += 10;

  if (invoice.paymentHistory.length > 0) {
    drawDashedLine(doc, y);
    y += 4;
    writeReceiptMetaRow(
      doc,
      inv.paidLabel,
      formatReceiptMoney(paidMad, locale),
      y,
      locale,
      fonts,
    );
    y += 4;
    writeReceiptMetaRow(
      doc,
      inv.remainingLabel,
      formatReceiptMoney(remainingMad, locale),
      y,
      locale,
      fonts,
    );
    y += 5;
  }

  if (settings.receiptFooter) {
    doc.setTextColor(...MUTED_TEXT);
    writePdfLatinText(doc, settings.receiptFooter, PAGE_WIDTH_MM / 2, y, {
      align: "center",
      fontSize: 6,
      maxWidth: CONTENT_WIDTH_MM,
    });
    y += 6;
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

/** One PDF with each invoice on its own page (thermal ticket size). */
export async function buildCombinedClientReceiptPdf(
  invoices: readonly Invoice[],
  settings: ClientReceiptPdfSettings,
): Promise<jsPDF> {
  if (invoices.length === 0) {
    throw new Error("No invoices to export.");
  }
  const logo = await loadLogoForPdf();
  let doc = await buildClientReceiptPdf(invoices[0]!, settings, { logo });
  for (let i = 1; i < invoices.length; i++) {
    doc = await buildClientReceiptPdf(invoices[i]!, settings, {
      existingDoc: doc,
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
