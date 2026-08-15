import { StoreLogo } from "@/components/brand/store-logo";
import { InvoiceBarcode } from "@/components/invoices/invoice-barcode";
import type { Invoice, InvoiceLine, InvoicePaymentType, InvoiceStatus } from "@/lib/invoices/types";
import {
  invoicePaidMad,
  invoiceRemainingMad,
  invoiceRemainingQty,
} from "@/lib/invoices/storage";
import {
  type DocumentLocale,
  documentLegalLines,
  formatDocumentDate,
  getDocumentLabels,
} from "@/lib/i18n/document-labels";
import { formatMad } from "@/lib/money/mad";
import { cn } from "@/lib/utils";

export type InternalInvoiceSettings = {
  businessName: string;
  storePhone: string;
  storeAddress: string;
  taxIce: string;
  taxIf: string;
  taxRc: string;
  documentLocale: DocumentLocale;
};

function formatMoney(n: number): string {
  return formatMad(n);
}

function paymentTypeLabel(type: InvoicePaymentType, locale: DocumentLocale) {
  const labels = getDocumentLabels(locale).invoice;
  return type === "cash" ? labels.cash : labels.credit;
}

function statusLabel(status: InvoiceStatus, locale: DocumentLocale) {
  const labels = getDocumentLabels(locale).invoice;
  if (status === "returned") return labels.returned;
  return status === "paid" ? labels.paid : labels.pending;
}

function lineTotalMad(line: InvoiceLine) {
  return invoiceRemainingQty(line) * line.unitPriceMad;
}

function useInvoiceLabels(settings: InternalInvoiceSettings) {
  return getDocumentLabels(settings.documentLocale);
}

export function InternalInvoiceCompact({
  invoice,
  settings,
}: {
  invoice: Invoice;
  settings: InternalInvoiceSettings;
}) {
  const labels = useInvoiceLabels(settings);
  const inv = labels.invoice;
  const paidMad = invoicePaidMad(invoice);
  const remainingMad = invoiceRemainingMad(invoice);
  const grossLinesMad = invoice.lines.reduce(
    (sum, line) => sum + line.qty * line.unitPriceMad,
    0,
  );
  const returnedMad = grossLinesMad - invoice.totalMad;

  return (
    <div
      dir={labels.dir}
      lang={labels.lang}
      className={cn(
        "font-sans text-[11px] leading-snug text-slate-900",
        labels.locale === "ar" && "font-[family-name:var(--font-arabic)]",
      )}
    >
      <header className="border-slate-900 mb-4 space-y-3 border-b-2 pb-3">
        <StoreLogo
          variant="print"
          size="sm"
          priority
          className="mx-auto w-full max-w-[140px]"
        />
        <div className="flex items-start justify-between gap-3">
          <div className="border-slate-300 min-w-0 flex-1 rounded border bg-slate-50 px-3 py-2">
            <p className="text-slate-500 text-[9px] font-bold uppercase">{inv.title}</p>
            <p className="font-mono text-base font-bold">#{invoice.number}</p>
            <p className="text-slate-600 mt-1 text-[11px]">
              {formatDocumentDate(invoice.date, labels.locale)} {labels.atTime}{" "}
              {invoice.time}
            </p>
          </div>
          <InvoiceBarcode
            size="sm"
            value={invoice.barcode}
            className="h-[38px] w-[118px] shrink-0 text-slate-900"
          />
        </div>
      </header>

      <section className="mb-3 grid grid-cols-2 gap-2">
        <CompactMeta label={inv.client} value={invoice.clientName} />
        <CompactMeta label={inv.cashier} value={invoice.cashierId} />
        <CompactMeta
          label={inv.paymentType}
          value={paymentTypeLabel(invoice.paymentType, labels.locale)}
        />
        <CompactMeta
          label={inv.status}
          value={statusLabel(invoice.status, labels.locale)}
        />
      </section>

      <ul className="border-slate-200 divide-slate-200 divide-y rounded-lg border">
        {invoice.lines.map((line, idx) => (
          <li key={`${line.nameAr}:${idx}`} className="space-y-1 px-3 py-2.5">
            <div className="flex items-start justify-between gap-2">
              <p className="min-w-0 flex-1 font-semibold">{line.nameAr}</p>
              <p className="shrink-0 font-bold tabular-nums">
                {formatMoney(lineTotalMad(line))}
              </p>
            </div>
            <p className="text-slate-500 text-[10px] tabular-nums">
              {invoiceRemainingQty(line)} × {formatMoney(line.unitPriceMad)}
              {(line.returnedQty ?? 0) > 0
                ? ` · ${inv.returnedQty(line.returnedQty ?? 0)}`
                : ""}
            </p>
          </li>
        ))}
      </ul>

      <div className="border-slate-300 mt-3 rounded border text-xs">
        <CompactTotal label={inv.grossSold} value={grossLinesMad} />
        <CompactTotal label={inv.returns} value={returnedMad} />
        <CompactTotal label={inv.netTtc} value={invoice.totalMad} strong />
        <CompactTotal label={inv.collected} value={paidMad} />
        <CompactTotal label={inv.balanceDue} value={remainingMad} strong />
      </div>
    </div>
  );
}

export function InternalInvoicePrint({
  invoice,
  settings,
}: {
  invoice: Invoice;
  settings: InternalInvoiceSettings;
}) {
  const labels = useInvoiceLabels(settings);
  const inv = labels.invoice;
  const paidMad = invoicePaidMad(invoice);
  const remainingMad = invoiceRemainingMad(invoice);
  const grossLinesMad = invoice.lines.reduce(
    (sum, line) => sum + line.qty * line.unitPriceMad,
    0,
  );
  const returnedMad = grossLinesMad - invoice.totalMad;
  const netQty = invoice.lines.reduce(
    (sum, line) => sum + invoiceRemainingQty(line),
    0,
  );
  const legalLines = documentLegalLines(settings, labels);
  const issuedOn = formatDocumentDate(
    new Date().toISOString().slice(0, 10),
    labels.locale,
  );

  const cell = "border border-slate-500 px-2 py-1.5";
  const th = `${cell} bg-slate-100 text-left text-[9px] font-bold uppercase tracking-wide`;
  const td = `${cell} text-[10px]`;

  return (
    <div
      dir={labels.dir}
      lang={labels.lang}
      className={cn(
        "internal-invoice-print font-sans text-[10pt] leading-snug text-black",
        labels.locale === "ar" && "font-[family-name:var(--font-arabic)]",
      )}
    >
      <header className="mb-5 flex items-start justify-between gap-6 border-b-2 border-black pb-4">
        <div className="min-w-0 flex-1">
          <StoreLogo
            variant="printFull"
            size="print"
            priority
            className="mb-3 w-full max-w-[220px]"
          />
          {legalLines.length > 0 ? (
            <div className="mt-2 space-y-0.5 text-[9pt] text-slate-700">
              {legalLines.map((line) => (
                <p key={line}>{line}</p>
              ))}
            </div>
          ) : null}
        </div>
        <div className="flex shrink-0 flex-col items-end gap-2">
          <div className="border border-slate-500 px-4 py-3 text-right">
            <p className="text-[8pt] font-bold tracking-[0.15em] text-slate-600 uppercase">
              {inv.title}
            </p>
            <p className="mt-1 font-mono text-[14pt] font-bold">#{invoice.number}</p>
            <p className="mt-1 text-[9pt] text-slate-700">
              {formatDocumentDate(invoice.date, labels.locale)} {labels.atTime}{" "}
              {invoice.time}
            </p>
            <p className="mt-2 text-[11pt] font-bold tabular-nums">
              {formatMoney(invoice.totalMad)} {labels.ttc}
            </p>
            {remainingMad > 0 ? (
              <p className="mt-0.5 text-[9pt] text-slate-700 tabular-nums">
                {inv.remainingDue} : {formatMoney(remainingMad)}
              </p>
            ) : null}
          </div>
          <InvoiceBarcode
            size="sm"
            value={invoice.barcode}
            className="h-[42px] w-[128px] text-black"
          />
        </div>
      </header>

      <section className="mb-4 grid grid-cols-4 gap-3">
        <PrintMeta label={inv.client} value={invoice.clientName} />
        <PrintMeta label={inv.cashier} value={invoice.cashierId} />
        <PrintMeta
          label={inv.paymentType}
          value={paymentTypeLabel(invoice.paymentType, labels.locale)}
        />
        <PrintMeta
          label={inv.status}
          value={statusLabel(invoice.status, labels.locale)}
        />
      </section>

      <section className="mb-4 grid grid-cols-3 gap-3">
        <PrintMeta label={inv.grossAmount} value={formatMoney(grossLinesMad)} />
        <PrintMeta label={inv.collected} value={formatMoney(paidMad)} />
        <PrintMeta label={inv.netTtc} value={formatMoney(invoice.totalMad)} emphasis />
      </section>

      <table className="mb-4 w-full border-collapse border border-slate-500">
        <thead>
          <tr>
            <th className={th}>{inv.lineIndex}</th>
            <th className={th}>{inv.designation}</th>
            <th className={`${th} text-right`}>{inv.qtySold}</th>
            <th className={`${th} text-right`}>{inv.qtyReturned}</th>
            <th className={`${th} text-right`}>{inv.netQty}</th>
            <th className={`${th} text-right`}>{inv.unitPrice}</th>
            <th className={`${th} text-right`}>{inv.lineTotal}</th>
          </tr>
        </thead>
        <tbody>
          {invoice.lines.map((line, idx) => (
            <tr key={`${line.nameAr}:${idx}`}>
              <td className={`${td} text-slate-600 tabular-nums`}>{idx + 1}</td>
              <td className={`${td} font-medium`}>{line.nameAr}</td>
              <td className={`${td} text-right tabular-nums`}>{line.qty}</td>
              <td className={`${td} text-right tabular-nums`}>{line.returnedQty ?? 0}</td>
              <td className={`${td} text-right font-semibold tabular-nums`}>
                {invoiceRemainingQty(line)}
              </td>
              <td className={`${td} text-right tabular-nums`}>
                {formatMoney(line.unitPriceMad)}
              </td>
              <td className={`${td} text-right font-semibold tabular-nums`}>
                {formatMoney(lineTotalMad(line))}
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="bg-slate-50">
            <td colSpan={6} className={`${td} text-right font-semibold`}>
              {inv.totalNet(netQty)}
            </td>
            <td className={`${td} text-right font-bold tabular-nums`}>
              {formatMoney(invoice.totalMad)}
            </td>
          </tr>
        </tfoot>
      </table>

      <div className="flex justify-end">
        <table className="w-[72mm] border-collapse border border-slate-500 text-[10pt]">
          <tbody>
            <PrintTotal label={inv.grossSold} value={grossLinesMad} />
            <PrintTotal label={inv.returns} value={returnedMad} />
            <PrintTotal label={inv.netTtc} value={invoice.totalMad} strong />
            <PrintTotal label={inv.collected} value={paidMad} />
            <PrintTotal label={inv.balanceDue} value={remainingMad} strong />
          </tbody>
        </table>
      </div>

      {invoice.paymentHistory.length > 0 ? (
        <section className="mt-5">
          <p className="mb-2 text-[8pt] font-bold tracking-[0.15em] text-slate-600 uppercase">
            {inv.payments}
          </p>
          <table className="w-full border-collapse border border-slate-500">
            <thead>
              <tr>
                <th className={th}>{inv.paymentDate}</th>
                <th className={th}>{inv.paymentNote}</th>
                <th className={th}>{inv.paymentRef}</th>
                <th className={`${th} text-right`}>{inv.paymentAmount}</th>
              </tr>
            </thead>
            <tbody>
              {invoice.paymentHistory.map((payment) => (
                <tr key={payment.id}>
                  <td className={`${td} tabular-nums`}>
                    {formatDocumentDate(payment.date, labels.locale)}
                  </td>
                  <td className={td}>{payment.note}</td>
                  <td className={`${td} font-mono text-slate-700`}>{payment.ref}</td>
                  <td className={`${td} text-right font-semibold tabular-nums`}>
                    {payment.amountMad >= 0 ? "+" : ""}
                    {formatMoney(payment.amountMad)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      ) : null}

      <footer className="mt-8 border-t border-slate-400 pt-3">
        {labels.locale === "ar" ? (
          <div className="space-y-1 text-center text-[8pt] leading-relaxed text-slate-600">
            <p>{inv.internalFooterArabicLine}</p>
            <p className="font-mono tabular-nums">
              {inv.internalFooterMetaLine(issuedOn, invoice.number)}
            </p>
          </div>
        ) : (
          <p className="text-center text-[8pt] leading-relaxed text-slate-600">
            {inv.internalFooter(issuedOn, invoice.number)}
          </p>
        )}
      </footer>
    </div>
  );
}

function CompactMeta({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-slate-200 rounded border bg-slate-50 px-2.5 py-2">
      <p className="text-slate-500 text-[9px] font-bold uppercase">{label}</p>
      <p className="mt-0.5 text-[11px] leading-snug font-semibold break-words">{value}</p>
    </div>
  );
}

function CompactTotal({
  label,
  value,
  strong = false,
}: {
  label: string;
  value: number;
  strong?: boolean;
}) {
  return (
    <div
      className={cn(
        "border-slate-200 flex items-center justify-between gap-3 border-b px-2.5 py-1.5 last:border-b-0",
        strong && "bg-slate-50",
      )}
    >
      <span className={cn("text-[11px]", strong && "font-bold")}>{label}</span>
      <span className={cn("text-[11px] font-mono font-semibold tabular-nums", strong && "font-bold")}>
        {formatMoney(value)}
      </span>
    </div>
  );
}

function PrintMeta({
  label,
  value,
  emphasis = false,
}: {
  label: string;
  value: string;
  emphasis?: boolean;
}) {
  return (
    <div className="border border-slate-500 bg-slate-50 px-3 py-2">
      <p className="text-[8pt] font-bold tracking-wide text-slate-600 uppercase">{label}</p>
      <p
        className={cn(
          "mt-0.5 text-[10pt] font-semibold break-words tabular-nums",
          emphasis && "text-[11pt] font-bold",
        )}
      >
        {value}
      </p>
    </div>
  );
}

function PrintTotal({
  label,
  value,
  strong = false,
}: {
  label: string;
  value: number;
  strong?: boolean;
}) {
  const cell = "border border-slate-500 px-2 py-1.5";
  return (
    <tr>
      <td className={cn(cell, strong && "bg-slate-50 font-bold")}>{label}</td>
      <td
        className={cn(
          cell,
          "text-right font-mono tabular-nums",
          strong && "bg-slate-50 font-bold",
        )}
      >
        {formatMoney(value)}
      </td>
    </tr>
  );
}
