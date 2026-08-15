import { StoreLogo } from "@/components/brand/store-logo";
import type { ClientLedgerSummary } from "@/lib/credits/invoice-settlement";
import {
  statementAmountDisplay,
  statementKindLabel,
  statementNoteDisplay,
  statementRowClass,
  statementStatusLabel,
} from "@/lib/credits/statement-labels";
import type { LedgerEntry } from "@/lib/credits/types";
import type { Client } from "@/lib/clients/types";
import type { InternalInvoiceSettings } from "@/components/invoices/internal-invoice-document";
import {
  documentLegalLines,
  formatDocumentDate,
  getDocumentLabels,
} from "@/lib/i18n/document-labels";
import { formatMad } from "@/lib/money/mad";
import { cn } from "@/lib/utils";

export type CreditStatementPrintProps = {
  client: Pick<Client, "fullName" | "phone" | "creditLimitMad" | "isCashOnly">;
  summary: ClientLedgerSummary;
  entries: LedgerEntry[];
  settings: InternalInvoiceSettings;
};

function sortedEntries(entries: LedgerEntry[]): LedgerEntry[] {
  return [...entries].sort((a, b) => {
    const byDate = a.date.localeCompare(b.date);
    if (byDate !== 0) return byDate;
    return a.ref.localeCompare(b.ref);
  });
}

export function CreditStatementPrint({
  client,
  summary,
  entries,
  settings,
}: CreditStatementPrintProps) {
  const labels = getDocumentLabels(settings.documentLocale);
  const credit = labels.credit;
  const issuedOn = formatDocumentDate(
    new Date().toISOString().slice(0, 10),
    labels.locale,
  );
  const rows = sortedEntries(entries);
  const legalLines = documentLegalLines(settings, labels);

  const th =
    "border border-slate-500 bg-slate-100 px-2 py-1.5 text-left text-[9px] font-bold uppercase tracking-wide text-slate-600";
  const td = "border border-slate-500 px-2 py-1.5 text-[10px] text-slate-900";

  return (
    <div
      dir={labels.dir}
      lang={labels.lang}
      className={cn(
        "credit-statement-print font-sans text-[10pt] leading-snug text-black",
        labels.locale === "ar" && "font-[family-name:var(--font-arabic)]",
      )}
    >
      <header className="mb-5 border-b-2 border-black pb-4">
        <StoreLogo variant="print" size="print" priority className="mb-3" />
        {legalLines.length > 0 ? (
          <div className="mb-3 space-y-0.5 text-[9pt] text-slate-700">
            {legalLines.map((line) => (
              <p key={line}>{line}</p>
            ))}
          </div>
        ) : null}
        <div className="flex items-start justify-between gap-6">
          <h1 className="text-[16pt] font-bold">{credit.title}</h1>
          <p className="text-[9pt] text-slate-600">{credit.issuedOn(issuedOn)}</p>
        </div>
      </header>

      <table className="mb-4 w-full border-collapse border border-slate-500">
        <thead>
          <tr>
            <th className={th}>{credit.client}</th>
            <th className={th}>{credit.phone}</th>
            <th className={th}>{credit.creditLimit}</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td className={`${td} font-bold`}>{client.fullName}</td>
            <td className={td}>{client.phone}</td>
            <td className={td}>
              {client.isCashOnly
                ? credit.cashOnly
                : client.creditLimitMad != null && client.creditLimitMad > 0
                  ? formatMad(client.creditLimitMad)
                  : credit.noLimit}
            </td>
          </tr>
        </tbody>
      </table>

      <table className="mb-6 w-full border-collapse border border-slate-500">
        <thead>
          <tr>
            <th className={th}>{credit.totalDebt}</th>
            <th className={th}>{credit.totalPaid}</th>
            <th className={th}>{credit.returns}</th>
            <th className={th}>{credit.balanceDue}</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td className={`${td} font-bold tabular-nums`}>
              {formatMad(summary.totalInvoicedMad)}
            </td>
            <td className={`${td} font-bold tabular-nums`}>
              {formatMad(summary.totalPaidMad)}
            </td>
            <td className={`${td} font-bold tabular-nums`}>
              {formatMad(summary.totalReturnedMad)}
            </td>
            <td className={`${td} font-bold tabular-nums text-red-700`}>
              {formatMad(Math.max(0, summary.outstandingMad))}
            </td>
          </tr>
        </tbody>
      </table>

      <p className="mb-2 text-[8pt] font-bold tracking-[0.15em] text-slate-600 uppercase">
        {credit.historyTitle}
      </p>

      <table className="mb-6 w-full border-collapse border border-slate-500">
        <thead>
          <tr>
            <th className={th}>{credit.colDate}</th>
            <th className={th}>{credit.colType}</th>
            <th className={th}>{credit.colRef}</th>
            <th className={th}>{credit.colNote}</th>
            <th className={`${th} text-right`}>{credit.colAmount}</th>
            <th className={th}>{credit.colStatus}</th>
          </tr>
        </thead>
        <tbody>
          {rows.length > 0 ? (
            rows.map((entry) => (
              <tr key={entry.id} className={statementRowClass(entry)}>
                <td className={`${td} tabular-nums`}>
                  {formatDocumentDate(entry.date, labels.locale)}
                </td>
                <td className={td}>
                  {statementKindLabel(entry, labels.locale)}
                </td>
                <td className={`${td} font-medium`}>{entry.ref}</td>
                <td className={td}>{statementNoteDisplay(entry.note)}</td>
                <td className={`${td} text-right font-bold tabular-nums`}>
                  {statementAmountDisplay(entry)}
                </td>
                <td className={td}>
                  {statementStatusLabel(entry.status, labels.locale)}
                </td>
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan={6} className={`${td} text-center text-slate-600`}>
                {credit.noEntries}
              </td>
            </tr>
          )}
        </tbody>
      </table>

      <footer className="border-t border-slate-400 pt-3">
        <p className="text-center text-[8pt] leading-relaxed text-slate-600">
          {credit.footer(
            client.fullName,
            formatMad(Math.max(0, summary.outstandingMad)),
          )}
        </p>
      </footer>
    </div>
  );
}
