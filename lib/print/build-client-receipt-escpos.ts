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
import { loadTicketLogoForThermal } from "@/lib/print/ticket-logo";

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

/**
 * ESC/POS client ticket for WD8260 — same sections/order as HTML + download PDF.
 */
export async function buildClientReceiptEscPos(
  invoice: Invoice,
  settings: ThermalReceiptSettings,
): Promise<Uint8Array> {
  const labels = getDocumentLabels(settings.documentLocale);
  const inv = labels.invoice;
  const locale = settings.documentLocale;
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

  const ticket = new EscPosBuilder().init();

  ticket.align("center");
  const logo = await loadTicketLogoForThermal(140);
  if (logo) {
    ticket.raster(logo);
    ticket.feed(1);
  } else {
    await ticket.lineAuto(settings.businessName?.trim() || "Jamaa Market", {
      align: "center",
      bold: true,
      fontSize: 34,
    });
  }
  await ticket.lineAuto(inv.clientCopyTitle, {
    align: "center",
    bold: true,
    fontSize: 26,
  });
  if (settings.storeAddress?.trim()) {
    await ticket.lineAuto(settings.storeAddress.trim(), {
      align: "center",
      fontSize: 24,
    });
  }
  if (settings.storePhone?.trim()) {
    ticket.align("center");
    ticket.line(`${labels.phonePrefix} ${settings.storePhone.trim()}`);
  }
  ticket.separator("-");

  ticket.align("left");
  await ticket.columnsAuto(inv.invoiceNumber, `#${invoice.number}`, {
    bold: true,
    fontSize: 28,
  });
  await ticket.columnsAuto(
    inv.dateTime,
    formatReceiptDateTimeForPdf(invoice.date, invoice.time),
    { bold: true, fontSize: 28 },
  );
  await ticket.columnsAuto(inv.customer, invoice.clientName.slice(0, 24), {
    bold: true,
    fontSize: 28,
  });
  await ticket.columnsAuto(
    inv.payment,
    paymentLabel(invoice.paymentType, locale),
    { bold: true, fontSize: 28 },
  );
  ticket.separator("-");

  for (const line of invoice.lines) {
    const qty = invoiceRemainingQty(line);
    const lineTotal = Math.round(line.unitPriceMad * qty * 100) / 100;
    await ticket.lineAuto(line.nameAr.trim().slice(0, 40), {
      align: "right",
      bold: true,
      fontSize: 30,
    });
    if ((line.returnedQty ?? 0) > 0) {
      await ticket.lineAuto(inv.returnedQty(line.returnedQty ?? 0), {
        align: "right",
        fontSize: 22,
      });
    }
    ticket.columns(
      `${qty} x ${formatReceiptMoney(line.unitPriceMad, "fr")}`,
      formatReceiptMoney(lineTotal, "fr"),
    );
  }

  ticket.separator("-");
  ticket.align("left");
  ticket.bold(true).doubleHeight(true);
  await ticket.columnsAuto(
    inv.totalTtc,
    formatReceiptMoney(invoice.totalMad, "fr"),
    { bold: true, fontSize: 32 },
  );
  ticket.doubleHeight(false).bold(false);

  if (showBalance) {
    await ticket.columnsAuto(
      inv.paidLabel,
      formatReceiptMoney(paidMad, "fr"),
      { bold: true, fontSize: 28 },
    );
    await ticket.columnsAuto(
      inv.remainingLabel,
      formatReceiptMoney(remainingMad, "fr"),
      { bold: true, fontSize: 28 },
    );
  }

  if (invoice.paymentHistory.length > 0) {
    ticket.separator("-");
    await ticket.lineAuto(inv.paymentHistory, {
      align: "left",
      bold: true,
      fontSize: 22,
    });
    for (const payment of invoice.paymentHistory) {
      const amount = `${payment.amountMad >= 0 ? "+" : ""}${formatReceiptMoney(payment.amountMad, "fr")}`;
      ticket.columns(
        amount,
        formatReceiptDateTimeForPdf(payment.date, "").trim(),
      );
      if (payment.note?.trim()) {
        await ticket.lineAuto(payment.note.trim().slice(0, 40), {
          align: "left",
          fontSize: 20,
        });
      }
    }
  }

  if (settings.receiptFooter?.trim()) {
    ticket.feed(1);
    await ticket.lineAuto(settings.receiptFooter.trim(), {
      align: "center",
      bold: true,
      fontSize: 24,
    });
  }

  if (invoice.barcode) {
    ticket.feed(1).ean13(invoice.barcode);
  }

  ticket.cut();
  return ticket.build();
}
