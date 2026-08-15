import { STORE_NAME } from "@/lib/brand/constants";
import type { Invoice } from "@/lib/invoices/types";
import { formatMad } from "@/lib/money/mad";

export function invoiceWhatsAppShareMessage(
  invoice: Invoice,
  locale: string,
): string {
  const isAr = locale === "ar";
  const total = formatMad(invoice.totalMad, 2, locale);
  if (isAr) {
    return `السلام عليكم ${invoice.clientName}، مرفق فاتورتكم رقم ${invoice.number} من ${STORE_NAME}. المجموع: ${total}.`;
  }
  return `Bonjour ${invoice.clientName}, voici votre facture ${invoice.number} — ${STORE_NAME}. Total : ${total}. Merci.`;
}
