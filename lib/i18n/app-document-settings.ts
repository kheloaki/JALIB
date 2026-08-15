import type { InternalInvoiceSettings } from "@/components/invoices/internal-invoice-document";
import {
  type DocumentLocale,
  resolveDocumentLocale,
} from "@/lib/i18n/document-labels";

export type AppSettingsDocumentSource = {
  businessName: string;
  storePhone: string;
  storeAddress: string;
  taxIce: string;
  taxIf: string;
  taxRc: string;
  documentLocale?: DocumentLocale;
  defaultLocale?: DocumentLocale;
  receiptFooter?: string;
};

export const FALLBACK_DOCUMENT_LOCALE: DocumentLocale = "fr";

export const FALLBACK_INTERNAL_INVOICE_SETTINGS: InternalInvoiceSettings = {
  businessName: "Jamaa Market",
  storePhone: "",
  storeAddress: "",
  taxIce: "",
  taxIf: "",
  taxRc: "",
  documentLocale: FALLBACK_DOCUMENT_LOCALE,
};

export function toInternalInvoiceSettings(
  settings: AppSettingsDocumentSource | null | undefined,
): InternalInvoiceSettings {
  if (!settings) return FALLBACK_INTERNAL_INVOICE_SETTINGS;
  return {
    businessName: settings.businessName,
    storePhone: settings.storePhone,
    storeAddress: settings.storeAddress,
    taxIce: settings.taxIce,
    taxIf: settings.taxIf,
    taxRc: settings.taxRc,
    documentLocale: resolveDocumentLocale(settings),
  };
}

export function toReceiptSettings(
  settings: AppSettingsDocumentSource | null | undefined,
) {
  const base = settings ?? FALLBACK_INTERNAL_INVOICE_SETTINGS;
  return {
    businessName: base.businessName,
    storePhone: base.storePhone,
    storeAddress: base.storeAddress,
    taxIce: base.taxIce,
    taxIf: base.taxIf,
    taxRc: base.taxRc,
    receiptFooter: settings?.receiptFooter ?? "",
    documentLocale: resolveDocumentLocale(base),
  };
}
