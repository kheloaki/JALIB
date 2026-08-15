"use client";

import { useCallback } from "react";
import { useTranslations } from "next-intl";

import { SortableTh } from "@/components/ui/sortable-th";
import { useClientTableSort } from "@/hooks/use-client-table-sort";
import { formatDateShortFr } from "@/lib/dates/format-date";
import { formatMad } from "@/lib/money/mad";

export type ClientActivityRow = {
  clientId: string | null;
  name: string;
  lastTransactionDate: string;
  cashMad: number;
  creditMad: number;
  collectedMad: number;
  totalMad: number;
  invoiceCount: number;
};

type ActivitySortColumn =
  | "client"
  | "lastVisit"
  | "invoices"
  | "cash"
  | "credit"
  | "collected"
  | "total";

function compareActivityRows(
  a: ClientActivityRow,
  b: ClientActivityRow,
  column: ActivitySortColumn,
): number {
  switch (column) {
    case "client":
      return a.name.localeCompare(b.name, "fr");
    case "lastVisit":
      return a.lastTransactionDate.localeCompare(b.lastTransactionDate);
    case "invoices":
      return a.invoiceCount - b.invoiceCount;
    case "cash":
      return a.cashMad - b.cashMad;
    case "credit":
      return a.creditMad - b.creditMad;
    case "collected":
      return a.collectedMad - b.collectedMad;
    case "total":
      return a.totalMad - b.totalMad;
    default:
      return 0;
  }
}

type ClientsActivityTableProps = {
  rows: ClientActivityRow[];
  locale: string;
  onSelect?: (clientId: string) => void;
};

export function ClientsActivityTable({
  rows,
  locale,
  onSelect,
}: ClientsActivityTableProps) {
  const t = useTranslations("dashboard");
  const compare = useCallback(compareActivityRows, []);

  const {
    sortColumn,
    sortDirection,
    handleSort,
    sortedRows,
  } = useClientTableSort({
    rows,
    initialColumn: "lastVisit" as ActivitySortColumn,
    initialDirection: "desc",
    compare,
  });

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[960px] table-fixed border-collapse text-left text-[12px]">
        <colgroup>
          <col className="w-[2.75rem]" />
          <col className="w-[22%]" />
          <col className="w-[14%]" />
          <col className="w-[8%]" />
          <col className="w-[12%]" />
          <col className="w-[12%]" />
          <col className="w-[12%]" />
          <col className="w-[12%]" />
        </colgroup>
        <thead>
          <tr className="bg-surface-container-low/50 text-[10px] font-bold uppercase tracking-wide text-on-surface-variant">
            <th className="px-4 py-3 sm:px-6">#</th>
            <SortableTh
              column="client"
              activeColumn={sortColumn}
              direction={sortDirection}
              onSort={handleSort}
              className="px-4 py-3 tracking-wide sm:px-6"
            >
              {t("clientColClient")}
            </SortableTh>
            <SortableTh
              column="lastVisit"
              activeColumn={sortColumn}
              direction={sortDirection}
              onSort={handleSort}
              className="px-4 py-3 tracking-wide sm:px-6"
            >
              {t("clientColLastVisit")}
            </SortableTh>
            <SortableTh
              column="invoices"
              activeColumn={sortColumn}
              direction={sortDirection}
              onSort={handleSort}
              align="center"
              className="px-4 py-3 tracking-wide sm:px-6"
            >
              {t("invoiceCountLabel")}
            </SortableTh>
            <SortableTh
              column="cash"
              activeColumn={sortColumn}
              direction={sortDirection}
              onSort={handleSort}
              align="end"
              className="px-4 py-3 tracking-wide sm:px-6"
            >
              {t("clientCashTotal")}
            </SortableTh>
            <SortableTh
              column="credit"
              activeColumn={sortColumn}
              direction={sortDirection}
              onSort={handleSort}
              align="end"
              className="px-4 py-3 tracking-wide sm:px-6"
            >
              {t("clientCreditTotal")}
            </SortableTh>
            <SortableTh
              column="collected"
              activeColumn={sortColumn}
              direction={sortDirection}
              onSort={handleSort}
              align="end"
              className="px-4 py-3 tracking-wide sm:px-6"
            >
              {t("clientCollectedTotal")}
            </SortableTh>
            <SortableTh
              column="total"
              activeColumn={sortColumn}
              direction={sortDirection}
              onSort={handleSort}
              align="end"
              className="px-4 py-3 tracking-wide sm:px-6"
            >
              {t("clientRevenueTotal")}
            </SortableTh>
          </tr>
        </thead>
        <tbody className="divide-sidebar-border divide-y">
          {sortedRows.map((client, index) => {
            const clickable = Boolean(client.clientId && onSelect);
            return (
              <tr
                key={client.clientId ?? client.name}
                className={
                  clickable
                    ? "hover:bg-surface-container-low/40 cursor-pointer transition-colors"
                    : undefined
                }
                onClick={() => {
                  if (client.clientId && onSelect) onSelect(client.clientId);
                }}
              >
                <td className="px-4 py-3 sm:px-6">
                  <span className="bg-surface-container-high text-primary flex size-7 items-center justify-center rounded-full text-[11px] font-bold">
                    {index + 1}
                  </span>
                </td>
                <td className="truncate px-4 py-3 font-semibold sm:px-6" title={client.name}>
                  {client.name}
                </td>
                <td className="text-on-surface-variant truncate px-4 py-3 sm:px-6">
                  {formatDateShortFr(client.lastTransactionDate)}
                </td>
                <td className="text-on-surface-variant px-4 py-3 text-center tabular-nums sm:px-6">
                  {client.invoiceCount}
                </td>
                <td className="px-4 py-3 text-right font-semibold tabular-nums sm:px-6">
                  {formatMad(client.cashMad, 0, locale)}
                </td>
                <td className="px-4 py-3 text-right font-semibold tabular-nums sm:px-6">
                  {formatMad(client.creditMad, 0, locale)}
                </td>
                <td className="px-4 py-3 text-right font-semibold tabular-nums sm:px-6">
                  {formatMad(client.collectedMad, 0, locale)}
                </td>
                <td className="px-4 py-3 text-right font-bold tabular-nums sm:px-6">
                  {formatMad(client.totalMad, 0, locale)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
