import { EscPosBuilder } from "@/lib/print/escpos-builder";
import type { Invoice } from "@/lib/invoices/types";
import {
  formatReceiptMoney,
  formatReceiptDateTimeForPdf,
} from "@/lib/invoices/receipt-display";
import {
  invoicePaidMad,
  invoiceRemainingMad,
  invoiceRemainingQty,
} from "@/lib/invoices/storage";
import {
  getDocumentLabels,
  type DocumentLocale,
} from "@/lib/i18n/document-labels";

export type ThermalReceiptSettings = {
  businessName?: string;
  storePhone?: string;
  storeAddress?: string;
  receiptFooter?: string;
  documentLocale: DocumentLocale;
};

function paymentLabel(
  type: Invoice["paymentType"],
  locale: DocumentLocale,
): string {
  const labels = getDocumentLabels(locale).invoice;
  return type === "cash" ? labels.cash : labels.credit;
}

/** Build ESC/POS payload for an 80mm client thermal ticket. */
export function buildClientReceiptEscPos(
  invoice: Invoice,
  settings: ThermalReceiptSettings,
): Uint8Array {
  const labels = getDocumentLabels(settings.documentLocale);
  const inv = labels.invoice;
  const locale = settings.documentLocale;
  const paidMad =
    invoice.paymentType === "cash"
      ? invoice.totalMad
      : invoicePaidMad(invoice);
  const remainingMad =
    invoice.paymentType === "cash" ? 0 : invoiceRemainingMad(invoice);

  const ticket = new EscPosBuilder().init();

  ticket.align("center").bold(true);
  ticket.line(settings.businessName?.trim() || "Jamaa Market");
  ticket.bold(false).line(inv.clientCopyTitle);
  if (settings.storeAddress?.trim()) ticket.line(settings.storeAddress.trim());
  if (settings.storePhone?.trim()) {
    ticket.line(`${labels.phonePrefix} ${settings.storePhone.trim()}`);
  }
  ticket.separator("=");

  ticket.align("left");
  ticket.columns(inv.invoiceNumber, `#${invoice.number}`);
  ticket.columns(
    inv.dateTime,
    formatReceiptDateTimeForPdf(invoice.date, invoice.time),
  );
  ticket.columns(inv.customer, invoice.clientName.slice(0, 20));
  ticket.columns(inv.payment, paymentLabel(invoice.paymentType, locale));
  ticket.separator("-");

  for (const line of invoice.lines) {
    const qty = invoiceRemainingQty(line);
    const lineTotal = Math.round(line.unitPriceMad * qty * 100) / 100;
    ticket.line(line.nameAr.slice(0, 32));
    ticket.columns(
      `${qty} x ${formatReceiptMoney(line.unitPriceMad, locale)}`,
      formatReceiptMoney(lineTotal, locale),
    );
  }

  ticket.separator("=");
  ticket.bold(true).doubleHeight(true);
  ticket.columns(
    inv.totalTtc,
    `${formatReceiptMoney(invoice.totalMad, locale)} ${labels.currencyWord}`,
  );
  ticket.doubleHeight(false).bold(false);

  if (invoice.paymentType === "credit" || remainingMad > 0) {
    ticket.columns(inv.paidLabel, formatReceiptMoney(paidMad, locale));
    ticket.columns(inv.remainingLabel, formatReceiptMoney(remainingMad, locale));
  }

  if (settings.receiptFooter?.trim()) {
    ticket.feed(1).align("center").line(settings.receiptFooter.trim());
  }

  if (invoice.barcode) {
    ticket.feed(1).ean13(invoice.barcode);
  }

  ticket.cut();
  return ticket.build();
}
