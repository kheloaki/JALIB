"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { useQuery } from "convex/react";
import { Building2, Plus, ReceiptText } from "lucide-react";
import { useLocale } from "next-intl";

import { StoreLogo } from "@/components/brand/store-logo";
import { InvoiceBarcode } from "@/components/invoices/invoice-barcode";
import {
  InternalInvoiceCompact,
  InternalInvoicePrint,
} from "@/components/invoices/internal-invoice-document";
import type { Invoice, InvoicePaymentType } from "@/lib/invoices/types";
import { buttonVariants } from "@/components/ui/button";
import { api } from "@/convex/_generated/api";
import {
  toInternalInvoiceSettings,
  toReceiptSettings,
} from "@/lib/i18n/app-document-settings";
import {
  formatDocumentDate,
  getDocumentLabels,
  type DocumentLocale,
} from "@/lib/i18n/document-labels";
import {
  formatReceiptMoney,
} from "@/lib/invoices/receipt-display";
import {
  invoicePaidMad,
  invoiceRemainingMad,
  invoiceRemainingQty,
} from "@/lib/invoices/storage";
import { cn } from "@/lib/utils";

export type InvoiceReceiptMode = "client" | "owner";

type ReceiptSettings = ReturnType<typeof toReceiptSettings>;

function paymentTypeLabel(type: InvoicePaymentType, locale: DocumentLocale) {
  const labels = getDocumentLabels(locale).invoice;
  return type === "cash" ? labels.cash : labels.credit;
}

type ReceiptBodyProps = {
  invoice: Invoice;
  settings: ReceiptSettings;
  compact?: boolean;
};

function ClientReceipt({ invoice, settings }: ReceiptBodyProps) {
  const labels = getDocumentLabels(settings.documentLocale);
  const inv = labels.invoice;
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

  return (
    <div
      dir={labels.dir}
      lang={labels.lang}
      className={cn(
        "thermal-ticket font-sans text-black",
        labels.locale === "ar" && "font-[family-name:var(--font-arabic)]",
      )}
    >
      <div className="space-y-0.5 border-b border-dashed border-black/40 pb-2 text-center">
        <StoreLogo
          variant="print"
          size="thermal"
          priority
          className="mx-auto mb-1 max-w-[48mm]"
        />
        <p className="text-[9px] font-black tracking-wide uppercase">
          {inv.clientCopyTitle}
        </p>
        <div className="text-[8px] leading-tight text-black/70">
          {settings.storeAddress ? <p>{settings.storeAddress}</p> : null}
          {settings.storePhone ? (
            <p dir="ltr">
              {labels.phonePrefix} {settings.storePhone}
            </p>
          ) : null}
        </div>
      </div>

      <div className="space-y-0 border-b border-dashed border-black/40 py-2 text-[10px] leading-tight">
        <div className="flex justify-between gap-2">
          <span>{inv.invoiceNumber}</span>
          <span className="font-mono font-bold tabular-nums">
            #{invoice.number}
          </span>
        </div>
        <div className="flex justify-between gap-2">
          <span>{inv.dateTime}</span>
          <span className="font-mono tabular-nums" dir="ltr">
            {formatDocumentDate(invoice.date, labels.locale)} {invoice.time}
          </span>
        </div>
        <div className="flex justify-between gap-2">
          <span>{inv.customer}</span>
          <span className="max-w-[55%] truncate font-bold">
            {invoice.clientName}
          </span>
        </div>
        <div className="flex justify-between gap-2">
          <span>{inv.payment}</span>
          <span className="font-bold">
            {paymentTypeLabel(invoice.paymentType, labels.locale)}
          </span>
        </div>
      </div>

      <div className="border-b border-dashed border-black/40 py-2">
        <ul className="space-y-1.5">
          {invoice.lines.map((line, idx) => {
            const qty = invoiceRemainingQty(line);
            const lineTotal =
              Math.round(line.unitPriceMad * qty * 100) / 100;
            return (
              <li key={`${line.nameAr}:${idx}`} className="text-[10px] leading-snug">
                <p className="font-medium break-words">{line.nameAr}</p>
                {(line.returnedQty ?? 0) > 0 ? (
                  <p className="text-[8px] text-black/60">
                    {inv.returnedQty(line.returnedQty ?? 0)}
                  </p>
                ) : null}
                <div
                  className="mt-0.5 flex justify-between gap-2 font-mono tabular-nums text-black/80"
                  dir="ltr"
                >
                  <span>
                    {qty} × {formatReceiptMoney(line.unitPriceMad, labels.locale)}
                  </span>
                  <span className="font-bold text-black">
                    {formatReceiptMoney(lineTotal, labels.locale)}
                  </span>
                </div>
              </li>
            );
          })}
        </ul>
      </div>

      <div className="border-b border-dashed border-black/40 py-2">
        <div className="flex items-baseline justify-between gap-2">
          <span className="text-[10px] font-bold uppercase">{inv.totalTtc}</span>
          <span className="font-mono text-lg font-black tabular-nums" dir="ltr">
            {formatReceiptMoney(invoice.totalMad, labels.locale)}{" "}
            <span className="text-xs font-bold">{labels.currencyWord}</span>
          </span>
        </div>
        {showBalance ? (
          <div className="mt-1.5 space-y-0.5 text-[10px] font-mono tabular-nums">
            <div className="flex justify-between gap-2" dir="ltr">
              <span>{inv.paidLabel}</span>
              <span>{formatReceiptMoney(paidMad, labels.locale)}</span>
            </div>
            <div className="flex justify-between gap-2 font-bold" dir="ltr">
              <span>{inv.remainingLabel}</span>
              <span>{formatReceiptMoney(remainingMad, labels.locale)}</span>
            </div>
          </div>
        ) : null}
      </div>

      {invoice.paymentHistory.length > 0 ? (
        <div className="border-b border-dashed border-black/40 py-2">
          <p className="mb-1 text-[8px] font-bold uppercase tracking-wide">
            {inv.paymentHistory}
          </p>
          <ul className="space-y-1 text-[9px]">
            {invoice.paymentHistory.map((payment) => (
              <li key={payment.id}>
                <div className="flex justify-between gap-2 font-mono tabular-nums">
                  <span dir="ltr">
                    {payment.amountMad >= 0 ? "+" : ""}
                    {formatReceiptMoney(payment.amountMad, labels.locale)}
                  </span>
                  <span className="text-black/60" dir="ltr">
                    {formatDocumentDate(payment.date, labels.locale)}
                  </span>
                </div>
                {payment.note ? (
                  <p className="truncate text-[8px] text-black/70">
                    {payment.note}
                  </p>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {settings.receiptFooter ? (
        <p className="mt-2 text-center text-[8px] leading-tight text-black/70">
          {settings.receiptFooter}
        </p>
      ) : null}

      <div className="mt-2 flex justify-center overflow-hidden">
        <InvoiceBarcode
          value={invoice.barcode}
          size="sm"
          className="mx-auto max-w-full text-black"
        />
      </div>
      {/* Extra feed so thermal cutters clear the barcode */}
      <div className="h-3" aria-hidden />
    </div>
  );
}

function OwnerCopy({ invoice, settings, compact = false }: ReceiptBodyProps) {
  const internalSettings = toInternalInvoiceSettings(settings);
  if (compact) {
    return (
      <>
        <div className="invoice-preview-screen-only">
          <InternalInvoiceCompact invoice={invoice} settings={internalSettings} />
        </div>
        <div className="invoice-preview-print-only" aria-hidden>
          <InternalInvoicePrint invoice={invoice} settings={internalSettings} />
        </div>
      </>
    );
  }

  return <InternalInvoicePrint invoice={invoice} settings={internalSettings} />;
}

type InvoiceReceiptPreviewProps = {
  invoice: Invoice | null;
  className?: string;
  defaultMode?: InvoiceReceiptMode;
  mode?: InvoiceReceiptMode;
  onModeChange?: (mode: InvoiceReceiptMode) => void;
  /** Wrapper id for print targeting */
  printRootId?: string;
  showModeSwitch?: boolean;
  /** Narrow sidebar layout for the invoices list */
  layout?: "sidebar" | "full";
  showQuickAction?: boolean;
  /** Mount only the print portal (faster POS auto-print). */
  printOnly?: boolean;
};

export function InvoiceReceiptPreview({
  invoice,
  className,
  defaultMode = "client",
  mode,
  onModeChange,
  printRootId = "invoice-print-area",
  showModeSwitch = true,
  layout = "full",
  showQuickAction = false,
  printOnly = false,
}: InvoiceReceiptPreviewProps) {
  const locale = useLocale();
  const isAr = locale === "ar";
  const tr = (fr: string, ar: string) => (isAr ? ar : fr);
  const settingsRow = useQuery(api.settings.getAppSettings);
  const settings: ReceiptSettings = toReceiptSettings(settingsRow);
  const [internalMode, setInternalMode] = useState<InvoiceReceiptMode>(defaultMode);
  const [mounted, setMounted] = useState(false);
  const activeMode = mode ?? internalMode;
  const setMode = onModeChange ?? setInternalMode;
  const showSidebarCompact =
    layout === "sidebar" && activeMode === "owner";

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!invoice) {
    if (printOnly) return null;
    return (
      <div
        className={cn(
          "border-sidebar-border bg-surface-container-low/50 flex min-h-[320px] flex-col items-center justify-center rounded-2xl border border-dashed p-8 text-center",
          className,
        )}
      >
        <p className="text-on-surface-variant text-sm font-medium">
          {tr(
            "Sélectionnez une facture pour afficher l'aperçu.",
            "اختر فاتورة لعرض المعاينة.",
          )}
        </p>
      </div>
    );
  }

  const isClientMode = activeMode === "client";

  const printBody = isClientMode ? (
    <ClientReceipt invoice={invoice} settings={settings} />
  ) : (
    <InternalInvoicePrint
      invoice={invoice}
      settings={toInternalInvoiceSettings(settings)}
    />
  );

  const printPortal =
    mounted && typeof document !== "undefined"
      ? createPortal(
          <div
            id={printRootId}
            data-print-root=""
            data-copy-mode={activeMode}
            className={cn(
              "invoice-print-root bg-white text-black",
              isClientMode ? "w-[72mm] px-1 py-0" : "w-[186mm] max-w-full p-0",
            )}
          >
            {printBody}
          </div>,
          document.body,
        )
      : null;

  if (printOnly) {
    return <>{printPortal}</>;
  }

  const screenBody = isClientMode ? (
    <ClientReceipt invoice={invoice} settings={settings} />
  ) : (
    <OwnerCopy
      invoice={invoice}
      settings={settings}
      compact={showSidebarCompact}
    />
  );

  return (
    <div className={cn("space-y-3", layout === "sidebar" ? "" : "relative", className)}>
      {showModeSwitch ? (
        <div className="print:hidden">
          <div className="bg-surface-container-low border-sidebar-border grid grid-cols-2 gap-1 rounded-xl border p-1">
            <button
              type="button"
              onClick={() => setMode("client")}
              className={cn(
                "inline-flex h-9 items-center justify-center gap-2 rounded-lg text-xs font-black transition-colors",
                isClientMode
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-on-surface-variant hover:bg-surface-container-high",
              )}
            >
              <ReceiptText className="size-4" aria-hidden />
              {tr("Client", "الزبون")}
            </button>
            <button
              type="button"
              onClick={() => setMode("owner")}
              className={cn(
                "inline-flex h-9 items-center justify-center gap-2 rounded-lg text-xs font-black transition-colors",
                !isClientMode
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-on-surface-variant hover:bg-surface-container-high",
              )}
            >
              <Building2 className="size-4" aria-hidden />
              {tr("Interne", "المتجر")}
            </button>
          </div>
        </div>
      ) : null}

      <div
        className={cn(
          "border-sidebar-border bg-surface-container-lowest text-on-surface shadow-sm w-full rounded-lg border print:hidden",
          isClientMode
            ? "mx-auto max-w-[280px] p-3"
            : showSidebarCompact
              ? "p-3"
              : "mx-auto max-w-[760px] p-6",
        )}
      >
        {screenBody}
      </div>

      {printPortal}

      {showQuickAction ? (
        <div className="pointer-events-none absolute right-0 bottom-2 left-0 flex justify-center print:hidden">
          <Link
            href={`/${locale}/pos`}
            className={cn(
              buttonVariants({ variant: "default" }),
              "bg-primary text-primary-foreground shadow-primary/25 pointer-events-auto inline-flex size-12 items-center justify-center rounded-full shadow-lg",
            )}
            aria-label={tr("Nouvelle vente — caisse", "بيع جديد — الصندوق")}
          >
            <Plus className="size-6 stroke-2" aria-hidden />
          </Link>
        </div>
      ) : null}
    </div>
  );
}
