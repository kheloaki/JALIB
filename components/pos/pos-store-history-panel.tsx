"use client";

import { useCallback, useMemo, useState } from "react";
import { useQuery } from "convex/react";
import { useAdminChrome } from "@/components/layout/admin-chrome-context";
import { useLocale } from "next-intl";
import {
  Banknote,
  FileText,
  RotateCcw,
  Search,
} from "lucide-react";

import { PosLedgerUpdateRequestDialog } from "@/components/pos/pos-ledger-update-request-dialog";
import { Input } from "@/components/ui/input";
import { SortableTh } from "@/components/ui/sortable-th";
import { useClientTableSort } from "@/hooks/use-client-table-sort";
import {
  filterLedgerEntries,
  formatLedgerDate,
  formatWeekday,
  ledgerAmountClass,
  ledgerAmountSign,
  ledgerIconClass,
  ledgerKindLabel,
  ledgerSourceLabel,
  statusBadgeClass,
  statusLabel,
  type HistoryKindFilter,
} from "@/lib/credits/ledger-ui";
import { isLedgerPayment, isLedgerReturn } from "@/lib/credits/compute";
import type { Client } from "@/lib/clients/types";
import type { LedgerEntry } from "@/lib/credits/types";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { clientFromConvex } from "@/lib/convex/mappers";
import { formatPosDh } from "@/lib/pos/format-pos-dh";
import { statusPillClass } from "@/lib/ui/status-pill";
import { cn } from "@/lib/utils";

type PosHistorySortColumn =
  | "date"
  | "client"
  | "montant"
  | "statut"
  | "source";

function historyRefLink(
  row: LedgerEntry,
  locale: string,
): { href: string } | null {
  if (isLedgerReturn(row)) {
    const params = new URLSearchParams();
    if (row.invoiceId) params.set("invoiceId", row.invoiceId);
    const refCode = row.ref.replace(/^Retour\s#RT-?/i, "").trim();
    if (refCode) params.set("ref", refCode);
    const query = params.toString();
    return {
      href: query
        ? `/${locale}/stock?tab=returns&${query}`
        : `/${locale}/stock?tab=returns`,
    };
  }
  if (row.kind === "invoice" && row.invoiceId) {
    return { href: `/${locale}/factures/${row.invoiceId}` };
  }
  return null;
}

type PosStoreHistoryPanelProps = {
  entries: LedgerEntry[];
  /** Optional known clients (selected / recent); names for other IDs load via getMany. */
  clients?: Client[];
  scopeAll: boolean;
  tr: (fr: string, ar: string) => string;
  onReopenSuccess?: () => void;
};

export function PosStoreHistoryPanel({
  entries,
  clients: knownClients = [],
  scopeAll,
  tr,
  onReopenSuccess,
}: PosStoreHistoryPanelProps) {
  const { posToolbar } = useAdminChrome();
  const locale = useLocale();
  const isAr = locale === "ar";

  const [kindFilter, setKindFilter] = useState<HistoryKindFilter>("all");
  const [search, setSearch] = useState("");
  const [updateEntry, setUpdateEntry] = useState<LedgerEntry | null>(null);

  const historyClientIds = useMemo(() => {
    const known = new Set(knownClients.map((c) => c.id));
    const ids = new Set<string>();
    for (const entry of entries) {
      if (!known.has(entry.clientId)) ids.add(entry.clientId);
    }
    return [...ids].slice(0, 500) as Id<"clients">[];
  }, [entries, knownClients]);

  const fetchedRows = useQuery(
    api.clients.getMany,
    scopeAll && historyClientIds.length > 0
      ? { clientIds: historyClientIds }
      : "skip",
  );

  const clients = useMemo(() => {
    const map = new Map<string, Client>();
    for (const client of knownClients) map.set(client.id, client);
    for (const row of fetchedRows ?? []) {
      map.set(row.id, clientFromConvex(row));
    }
    return [...map.values()];
  }, [fetchedRows, knownClients]);

  const stats = useMemo(() => {
    let invoices = 0;
    let payments = 0;
    let returns = 0;
    let invoiceMad = 0;
    let paymentMad = 0;
    for (const e of entries) {
      if (e.kind === "invoice") {
        invoices += 1;
        invoiceMad += e.amountMad;
      } else if (isLedgerReturn(e)) {
        returns += 1;
      } else if (isLedgerPayment(e)) {
        payments += 1;
        paymentMad += e.amountMad;
      }
    }
    return { invoices, payments, returns, invoiceMad, paymentMad };
  }, [entries]);

  const filtered = useMemo(
    () =>
      filterLedgerEntries(entries, {
        kind: kindFilter,
        status: "all",
        source: "all",
        search,
        dateFrom: "",
        dateTo: "",
        scopeAll,
        clients: clients.map((c) => ({
          id: c.id,
          fullName: c.fullName,
          phone: c.phone,
        })),
      }),
    [clients, entries, kindFilter, scopeAll, search],
  );

  const clientNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const client of clients) {
      map.set(client.id, client.fullName);
    }
    return map;
  }, [clients]);

  const compareHistory = useCallback(
    (a: LedgerEntry, b: LedgerEntry, column: PosHistorySortColumn) => {
      switch (column) {
        case "date":
          return a.date.localeCompare(b.date);
        case "client": {
          const na = clientNameById.get(a.clientId) ?? "";
          const nb = clientNameById.get(b.clientId) ?? "";
          return na.localeCompare(nb, "fr");
        }
        case "montant":
          return a.amountMad - b.amountMad;
        case "statut":
          return a.status.localeCompare(b.status);
        case "source":
          return (a.source ?? "").localeCompare(b.source ?? "");
        default:
          return 0;
      }
    },
    [clientNameById],
  );

  const {
    sortColumn,
    sortDirection,
    handleSort,
    sortedRows: sortedFiltered,
  } = useClientTableSort({
    rows: filtered,
    initialColumn: "date" as PosHistorySortColumn,
    initialDirection: "desc",
    compare: compareHistory,
  });

  const clientName = (clientId: string) =>
    clientNameById.get(clientId) ?? "—";

  const kindChips: { id: HistoryKindFilter; label: string }[] = [
    { id: "all", label: tr("Tous", "الكل") },
    { id: "invoice", label: tr("Achats", "المشتريات") },
    { id: "payment", label: tr("Paiements", "المدفوعات") },
    { id: "return", label: tr("Retours", "الإرجاعات") },
  ];

  return (
    <>
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <StatPill
            label={tr("Mouvements", "الحركات")}
            value={String(entries.length)}
          />
          <StatPill
            label={tr("Achats", "المشتريات")}
            value={String(stats.invoices)}
            sub={formatPosDh(stats.invoiceMad, 2, locale)}
          />
          <StatPill
            label={tr("Paiements", "المدفوعات")}
            value={String(stats.payments)}
            sub={formatPosDh(stats.paymentMad, 2, locale)}
          />
          <StatPill
            label={tr("Retours", "الإرجاعات")}
            value={String(stats.returns)}
          />
        </div>

        <div className="relative">
          <Search
            className="text-outline pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 stroke-[1.75]"
            aria-hidden
          />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={
              scopeAll
                ? tr("Client, référence, note…", "عميل، مرجع، ملاحظة…")
                : tr("Référence, note…", "مرجع، ملاحظة…")
            }
            className="bg-surface-container-low border-transparent h-11 rounded-xl pl-10"
          />
        </div>

        <div className="flex flex-wrap gap-1.5">
          {kindChips.map((chip) => (
            <button
              key={chip.id}
              type="button"
              onClick={() => setKindFilter(chip.id)}
              className={cn(
                "rounded-full px-3 py-1.5 text-xs font-bold transition-colors",
                kindFilter === chip.id
                  ? "bg-primary text-on-primary"
                  : "bg-surface-container-low text-on-surface-variant hover:bg-surface-container-high",
              )}
            >
              {chip.label}
            </button>
          ))}
        </div>

        <p className="text-on-surface-variant text-xs font-medium tabular-nums">
          {sortedFiltered.length} {tr("résultat", "نتيجة")}
          {sortedFiltered.length !== 1 ? tr("s", "") : ""}{" "}
          {tr("sur", "من")} {entries.length}
        </p>

        <div className="border-sidebar-border bg-surface-container-lowest overflow-hidden rounded-xl border shadow-sm">
          {sortedFiltered.length === 0 ? (
            <p className="text-on-surface-variant px-6 py-10 text-center text-sm">
              {tr("Aucun mouvement trouvé.", "لا توجد حركات.")}
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[980px] border-collapse">
                <thead>
                  <tr className="bg-surface-container-low/50">
                    {scopeAll ? (
                      <SortableTh
                        column="client"
                        activeColumn={sortColumn}
                        direction={sortDirection}
                        onSort={handleSort}
                        className="px-4 py-3"
                      >
                        {tr("Client", "العميل")}
                      </SortableTh>
                    ) : null}
                    <SortableTh
                      column="date"
                      activeColumn={sortColumn}
                      direction={sortDirection}
                      onSort={handleSort}
                      className="px-4 py-3"
                    >
                      {tr("Date", "التاريخ")}
                    </SortableTh>
                    <th className="text-on-surface-variant px-4 py-3 text-left text-[10px] font-bold tracking-wider uppercase">
                      {tr("Référence", "المرجع")}
                    </th>
                    <th className="text-on-surface-variant px-4 py-3 text-left text-[10px] font-bold tracking-wider uppercase">
                      {tr("Détail", "التفاصيل")}
                    </th>
                    <SortableTh
                      column="source"
                      activeColumn={sortColumn}
                      direction={sortDirection}
                      onSort={handleSort}
                      className="px-4 py-3"
                    >
                      {tr("Source", "المصدر")}
                    </SortableTh>
                    <SortableTh
                      column="statut"
                      activeColumn={sortColumn}
                      direction={sortDirection}
                      onSort={handleSort}
                      className="px-4 py-3"
                    >
                      {tr("Statut", "الحالة")}
                    </SortableTh>
                    <SortableTh
                      column="montant"
                      activeColumn={sortColumn}
                      direction={sortDirection}
                      onSort={handleSort}
                      align="end"
                      className="px-4 py-3"
                    >
                      {tr("Montant", "المبلغ")}
                    </SortableTh>
                    <th className="text-on-surface-variant px-4 py-3 text-right text-[10px] font-bold tracking-wider uppercase">
                      {tr("Actions", "إجراءات")}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-sidebar-border divide-y">
                  {sortedFiltered.map((row) => {
                    const origin = ledgerSourceLabel(row);
                    const isReturnRow = isLedgerReturn(row);
                    const isPaymentRow = isLedgerPayment(row);
                    const refLink = historyRefLink(row, locale);
                    const clientHref = `/${locale}/clients?clientId=${encodeURIComponent(row.clientId)}`;

                    return (
                      <tr
                        key={row.id}
                        className="hover:bg-surface-container-low/40 transition-colors"
                      >
                        {scopeAll ? (
                          <td className="px-4 py-3">
                            <a
                              href={clientHref}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-primary hover:underline text-sm font-bold"
                            >
                              {clientName(row.clientId)}
                            </a>
                          </td>
                        ) : null}
                        <td className="px-4 py-3">
                          <p className="text-sm font-bold tabular-nums">
                            {formatLedgerDate(row.date)}
                          </p>
                          <p className="text-on-surface-variant text-[10px] font-medium uppercase">
                            {formatWeekday(row.date)}
                          </p>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <span
                              className={cn(
                                "flex size-8 shrink-0 items-center justify-center rounded-lg",
                                ledgerIconClass(row),
                              )}
                            >
                              {isPaymentRow ? (
                                <Banknote className="size-4 stroke-[1.75]" aria-hidden />
                              ) : isReturnRow ? (
                                <RotateCcw className="size-4 stroke-[1.75]" aria-hidden />
                              ) : (
                                <FileText className="size-4 stroke-[1.75]" aria-hidden />
                              )}
                            </span>
                            <div className="min-w-0">
                              <div className="flex min-w-0 flex-wrap items-center gap-1.5">
                                {refLink ? (
                                  <a
                                    href={refLink.href}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-primary hover:underline text-sm font-bold"
                                  >
                                    {row.ref}
                                  </a>
                                ) : (
                                  <span className="text-sm font-semibold">
                                    {row.ref}
                                  </span>
                                )}
                                {row.kind === "invoice" &&
                                (row.returnedArticlesQty ?? 0) > 0 ? (
                                  <span className="bg-orange-100 text-orange-700 shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold tabular-nums">
                                    {row.returnedArticlesQty}{" "}
                                    {tr("ret.", "مرتجع")}
                                  </span>
                                ) : null}
                              </div>
                              <p className="text-on-surface-variant mt-0.5 text-[10px] font-medium">
                                {ledgerKindLabel(row, isAr)}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="max-w-[240px] px-4 py-3">
                          <p className="text-on-surface-variant line-clamp-2 text-sm">
                            {row.note}
                          </p>
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-on-surface-variant text-xs font-bold uppercase">
                            {origin.short}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={cn(
                              statusPillClass,
                              "px-2 py-0.5 text-[10px] font-black uppercase",
                              statusBadgeClass(row.status),
                            )}
                          >
                            {statusLabel(row.status, isAr)}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <span
                            className={cn(
                              "text-sm font-black tabular-nums",
                              ledgerAmountClass(row),
                            )}
                          >
                            {ledgerAmountSign(row)}{" "}
                            {formatPosDh(row.amountMad, 2, locale)}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button
                            type="button"
                            onClick={() => setUpdateEntry(row)}
                            className="border-primary/25 bg-primary/8 text-primary hover:bg-primary/15 inline-flex rounded-lg border px-3 py-1.5 text-xs font-black tracking-wide uppercase transition-colors"
                          >
                            {tr("Update", "تعديل")}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      <PosLedgerUpdateRequestDialog
        entry={updateEntry}
        clientName={
          updateEntry ? clientName(updateEntry.clientId) : ""
        }
        open={updateEntry != null}
        onOpenChange={(open) => {
          if (!open) setUpdateEntry(null);
        }}
        tr={tr}
        onReturnToCaisse={posToolbar?.clientHistory?.returnPurchaseToCaisse}
        onReopenSuccess={onReopenSuccess}
      />
    </>
  );
}

function StatPill({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div className="border-sidebar-border/60 bg-surface-container-low/50 rounded-xl border px-3 py-2">
      <p className="text-on-surface-variant text-[10px] font-bold tracking-wide uppercase">
        {label}
      </p>
      <p className="text-on-surface text-lg leading-tight font-black tabular-nums">
        {value}
      </p>
      {sub ? (
        <p className="text-on-surface-variant text-[11px] font-medium tabular-nums">
          {sub}
        </p>
      ) : null}
    </div>
  );
}
