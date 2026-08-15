"use client";

import { useEffect, useMemo, useState } from "react";
import { Pencil, Trash2, User } from "lucide-react";

import {
  clientLedgerSummary,
  creditLimitLabel,
  creditTypeLabel,
  type ClientLedgerStatRow,
  type ClientsTr,
} from "@/components/clients/clients-list-shared";
import { Button } from "@/components/ui/button";
import {
  SortableTh,
  toggleSortState,
  type SortDirection,
} from "@/components/ui/sortable-th";
import { useLoadMoreOnIntersect } from "@/hooks/use-load-more-on-intersect";
import type { Client } from "@/lib/clients/types";
import type { CreditStore } from "@/lib/credits/types";
import { soldeToneClass } from "@/lib/credits/ledger-ui";
import { formatMad } from "@/lib/money/mad";
import { cn } from "@/lib/utils";

type ClientsTableProps = {
  clients: Client[];
  creditStore: CreditStore;
  ledgerStatsByClientId?: Map<string, ClientLedgerStatRow>;
  ledgerHydrated: boolean;
  tr: ClientsTr;
  locale: string;
  onSelect: (client: Client) => void;
  onEdit: (client: Client) => void;
  onDelete?: (client: Client) => void;
  /** When true, render all sorted rows (e.g. search results). */
  disableWindowing?: boolean;
};

type SortColumn = "name" | "type" | "solde" | "plafond";

const PAGE_SIZE = 50;

function creditLimitSortValue(client: Client): number {
  if (client.isCashOnly) return Number.NEGATIVE_INFINITY;
  if (client.creditLimitMad === null) return Number.POSITIVE_INFINITY;
  return client.creditLimitMad;
}

export function ClientsTable({
  clients,
  creditStore,
  ledgerStatsByClientId,
  ledgerHydrated,
  tr,
  locale,
  onSelect,
  onEdit,
  onDelete,
  disableWindowing = false,
}: ClientsTableProps) {
  const [sortColumn, setSortColumn] = useState<SortColumn>("name");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [loadingMore, setLoadingMore] = useState(false);

  function handleSort(column: SortColumn) {
    const next = toggleSortState(sortColumn, sortDirection, column, "asc");
    setSortColumn(next.column);
    setSortDirection(next.direction);
  }

  // Sort the full dataset first — then window for display.
  const sortedClients = useMemo(() => {
    const dir = sortDirection === "asc" ? 1 : -1;
    return [...clients].sort((a, b) => {
      let cmp = 0;
      if (sortColumn === "name") {
        cmp = a.fullName.localeCompare(b.fullName, "fr");
      } else if (sortColumn === "type") {
        cmp = Number(a.isCashOnly) - Number(b.isCashOnly);
        if (cmp === 0) cmp = a.fullName.localeCompare(b.fullName, "fr");
      } else if (sortColumn === "solde") {
        const sa = clientLedgerSummary(a, creditStore, ledgerStatsByClientId)
          .soldeMad;
        const sb = clientLedgerSummary(b, creditStore, ledgerStatsByClientId)
          .soldeMad;
        cmp = sa - sb;
        if (cmp === 0) cmp = a.fullName.localeCompare(b.fullName, "fr");
      } else {
        cmp = creditLimitSortValue(a) - creditLimitSortValue(b);
        if (cmp === 0) cmp = a.fullName.localeCompare(b.fullName, "fr");
      }
      return cmp * dir;
    });
  }, [clients, creditStore, ledgerStatsByClientId, sortColumn, sortDirection]);

  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [clients, sortColumn, sortDirection]);

  const displayedClients = disableWindowing
    ? sortedClients
    : sortedClients.slice(0, visibleCount);

  const canLoadMore =
    !disableWindowing && visibleCount < sortedClients.length;
  const loadMoreSentinelRef = useLoadMoreOnIntersect(
    canLoadMore,
    loadingMore,
    () => {
      if (loadingMore) return;
      setLoadingMore(true);
      setVisibleCount((prev) =>
        Math.min(prev + PAGE_SIZE, sortedClients.length),
      );
      requestAnimationFrame(() => setLoadingMore(false));
    },
  );

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[780px] border-collapse">
        <thead>
          <tr className="bg-surface-container-low/50">
            <SortableTh
              column="name"
              activeColumn={sortColumn}
              direction={sortDirection}
              onSort={handleSort}
            >
              {tr("Client", "العميل")}
            </SortableTh>
            <SortableTh
              column="type"
              activeColumn={sortColumn}
              direction={sortDirection}
              onSort={handleSort}
            >
              {tr("Type", "النوع")}
            </SortableTh>
            <SortableTh
              column="solde"
              activeColumn={sortColumn}
              direction={sortDirection}
              onSort={handleSort}
              align="end"
            >
              {tr("Solde", "الرصيد")}
            </SortableTh>
            <SortableTh
              column="plafond"
              activeColumn={sortColumn}
              direction={sortDirection}
              onSort={handleSort}
            >
              {tr("Plafond crédit", "حد الائتمان")}
            </SortableTh>
            <th className="text-on-surface-variant px-4 py-3 text-end text-[10px] font-bold tracking-wider uppercase sm:px-6">
              {tr("Actions", "إجراءات")}
            </th>
          </tr>
        </thead>
        <tbody className="divide-sidebar-border divide-y">
          {displayedClients.map((client) => {
            const type = creditTypeLabel(client, tr);
            const { soldeMad } = clientLedgerSummary(
              client,
              creditStore,
              ledgerStatsByClientId,
            );

            return (
              <tr
                key={client.id}
                className="hover:bg-surface-container-low/40 cursor-pointer transition-colors"
                onClick={() => onSelect(client)}
              >
                <td className="px-4 py-3 sm:px-6">
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="bg-surface-container-high text-on-surface-variant flex size-9 shrink-0 items-center justify-center rounded-full">
                      <User className="size-4 stroke-[1.75]" aria-hidden />
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-bold">
                        {client.fullName}
                      </p>
                      <p className="text-on-surface-variant mt-0.5 truncate text-xs font-medium tabular-nums">
                        {client.phone}
                      </p>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3 sm:px-6">
                  <span
                    className={cn(
                      "text-xs font-bold tracking-wide uppercase",
                      type.className,
                    )}
                  >
                    {type.label}
                  </span>
                </td>
                <td className="px-4 py-3 text-end sm:px-6">
                  {ledgerHydrated ? (
                    <span
                      className={cn(
                        "text-sm font-bold tabular-nums",
                        soldeToneClass(soldeMad),
                      )}
                    >
                      {formatMad(soldeMad, 2, locale)}
                    </span>
                  ) : (
                    "—"
                  )}
                </td>
                <td className="text-on-surface px-4 py-3 text-sm font-medium sm:px-6">
                  {creditLimitLabel(client, tr, locale)}
                </td>
                <td className="px-4 py-3 sm:px-6">
                  <div
                    className="flex items-center justify-end gap-1"
                    onClick={(e) => e.stopPropagation()}
                    onKeyDown={(e) => e.stopPropagation()}
                  >
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-8 gap-1.5 rounded-lg px-2.5 text-xs font-bold"
                      onClick={() => onEdit(client)}
                    >
                      <Pencil className="size-3.5" aria-hidden />
                      {tr("Modifier", "تعديل")}
                    </Button>
                    {onDelete ? (
                      <Button
                        type="button"
                        variant="destructive"
                        size="icon"
                        className="size-8 rounded-lg"
                        title={tr("Supprimer", "حذف")}
                        aria-label={tr("Supprimer", "حذف")}
                        onClick={() => onDelete(client)}
                      >
                        <Trash2 className="size-3.5" aria-hidden />
                      </Button>
                    ) : null}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {canLoadMore ? (
        <div
          ref={loadMoreSentinelRef}
          className="text-on-surface-variant flex justify-center py-3 text-xs"
          aria-hidden
        >
          {loadingMore ? tr("Chargement…", "جاري التحميل…") : null}
        </div>
      ) : null}
    </div>
  );
}
