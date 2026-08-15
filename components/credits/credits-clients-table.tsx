"use client";

import { useEffect, useMemo, useState } from "react";
import { useLocale } from "next-intl";
import {
  Banknote,
  FileText,
  Layers,
  User,
} from "lucide-react";

import { getLastClientPayment, soldeFromLedgerTotals } from "@/lib/credits/compute";
import { summarizeClientLedger } from "@/lib/credits/invoice-settlement";
import { formatLedgerDate, soldeToneClass } from "@/lib/credits/ledger-ui";
import type { Client } from "@/lib/clients/types";
import type { CreditStore } from "@/lib/credits/types";
import { CreditStatementActions } from "@/components/credits/credit-statement-actions";
import { InlineTableSkeleton } from "@/components/skeletons";
import { Button } from "@/components/ui/button";
import {
  SortableTh,
  toggleSortState,
  type SortDirection,
} from "@/components/ui/sortable-th";
import { useLoadMoreOnIntersect } from "@/hooks/use-load-more-on-intersect";
import { formatMad } from "@/lib/money/mad";
import { cn } from "@/lib/utils";

type SortColumn = "name" | "solde" | "lastPayment";

const PAGE_SIZE = 50;

export type ClientLedgerStatRow = {
  totalInvoicedMad: number;
  totalPaidMad: number;
  totalReturnedMad: number;
  lastPaymentDate: string | null;
  lastPaymentAmountMad: number | null;
};

export function CreditsClientsTable({
  clients,
  creditStore,
  ledgerStatsByClientId,
  hydrated,
  tr,
  title,
  totalCount,
  emptyHint,
  onOpenFiche,
  onOpenPlanDialog,
  onOpenPaymentDialog,
  disableWindowing = false,
}: {
  clients: Client[];
  creditStore: CreditStore;
  /** Full-ledger totals per client — prefer over truncated creditStore for solde. */
  ledgerStatsByClientId?: Map<string, ClientLedgerStatRow>;
  hydrated: boolean;
  tr: (fr: string, ar: string) => string;
  title?: string;
  totalCount?: number;
  emptyHint?: string;
  onOpenFiche: (clientId: string) => void;
  onOpenPlanDialog: (clientId: string) => void;
  onOpenPaymentDialog: (clientId: string) => void;
  disableWindowing?: boolean;
}) {
  const locale = useLocale();
  const badgeCount = totalCount ?? clients.length;
  const [sortColumn, setSortColumn] = useState<SortColumn>("solde");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [loadingMore, setLoadingMore] = useState(false);

  function handleSort(column: SortColumn) {
    const next = toggleSortState(sortColumn, sortDirection, column, "asc");
    setSortColumn(next.column);
    setSortDirection(next.direction);
  }

  const sortedClientRows = useMemo(() => {
    const dir = sortDirection === "asc" ? 1 : -1;
    return [...clients]
      .map((c) => {
        const entries = creditStore.entriesByClient[c.id] ?? [];
        const stats = ledgerStatsByClientId?.get(c.id);
        const soldeMad = stats
          ? soldeFromLedgerTotals(stats, c.initialSoldeMad)
          : summarizeClientLedger(entries, c.initialSoldeMad).soldeMad;
        const lastPayment = stats?.lastPaymentDate
          ? {
              date: stats.lastPaymentDate,
              amountMad: stats.lastPaymentAmountMad ?? 0,
            }
          : getLastClientPayment(entries);
        return { c, lastPayment, soldeMad };
      })
      .sort((a, b) => {
        let cmp = 0;
        if (sortColumn === "name") {
          cmp = a.c.fullName.localeCompare(b.c.fullName, "fr");
        } else if (sortColumn === "solde") {
          cmp = a.soldeMad - b.soldeMad;
          if (cmp === 0) cmp = a.c.fullName.localeCompare(b.c.fullName, "fr");
        } else {
          const ad = a.lastPayment?.date ?? "";
          const bd = b.lastPayment?.date ?? "";
          if (!ad && !bd) cmp = 0;
          else if (!ad) cmp = 1;
          else if (!bd) cmp = -1;
          else cmp = ad.localeCompare(bd);
          if (cmp === 0) cmp = a.c.fullName.localeCompare(b.c.fullName, "fr");
        }
        return cmp * dir;
      });
  }, [clients, creditStore, ledgerStatsByClientId, sortColumn, sortDirection]);

  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [clients, sortColumn, sortDirection]);

  const displayedRows = disableWindowing
    ? sortedClientRows
    : sortedClientRows.slice(0, visibleCount);

  const canLoadMore =
    !disableWindowing && visibleCount < sortedClientRows.length;
  const loadMoreSentinelRef = useLoadMoreOnIntersect(
    canLoadMore,
    loadingMore,
    () => {
      if (loadingMore) return;
      setLoadingMore(true);
      setVisibleCount((prev) =>
        Math.min(prev + PAGE_SIZE, sortedClientRows.length),
      );
      requestAnimationFrame(() => setLoadingMore(false));
    },
  );

  return (
    <div className="bg-surface-container-lowest border-sidebar-border overflow-hidden rounded-xl border shadow-sm">
      <div className="border-sidebar-border flex items-center justify-between border-b px-6 py-5">
        <h2 className="text-lg font-bold tracking-tight">
          {title ?? tr("Clients avec dette", "عملاء مدينون")}
        </h2>
        <span className="bg-surface-container-high text-on-surface-variant rounded-full px-2 py-1 text-xs font-semibold">
          {badgeCount} {tr("Clients", "عملاء")}
        </span>
      </div>

      {!hydrated ? (
        <InlineTableSkeleton cols={4} rows={7} />
      ) : clients.length === 0 ? (
        <p className="text-on-surface-variant px-6 py-8 text-sm">
          {emptyHint ??
            tr(
              "Aucun client avec dette. Recherchez un client pour enregistrer un paiement.",
              "لا يوجد عملاء مدينون. ابحث عن عميل لتسجيل دفعة.",
            )}
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] border-collapse">
            <thead>
              <tr className="bg-surface-container-low/50">
                <SortableTh
                  column="name"
                  activeColumn={sortColumn}
                  direction={sortDirection}
                  onSort={handleSort}
                  className="px-6 py-4"
                >
                  {tr("Client", "العميل")}
                </SortableTh>
                <SortableTh
                  column="solde"
                  activeColumn={sortColumn}
                  direction={sortDirection}
                  onSort={handleSort}
                  align="end"
                  className="px-4 py-4"
                >
                  {tr("Solde", "الرصيد")}
                </SortableTh>
                <SortableTh
                  column="lastPayment"
                  activeColumn={sortColumn}
                  direction={sortDirection}
                  onSort={handleSort}
                  className="px-4 py-4"
                >
                  {tr("Dernier paiement", "آخر دفعة")}
                </SortableTh>
                <th className="text-on-surface-variant px-4 py-4 text-right text-[10px] font-bold tracking-wider uppercase">
                  {tr("Actions", "إجراءات")}
                </th>
              </tr>
            </thead>
            <tbody className="divide-sidebar-border divide-y">
              {displayedRows.map(
                ({ c, lastPayment, soldeMad }) => {
                  return (
                    <tr
                      key={c.id}
                      role="button"
                      tabIndex={0}
                      onClick={() => onOpenFiche(c.id)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          onOpenFiche(c.id);
                        }
                      }}
                      className="hover:bg-surface-container-low/40 cursor-pointer transition-colors"
                      aria-label={tr(
                        `Fiche de ${c.fullName}`,
                        `بطاقة ${c.fullName}`,
                      )}
                    >
                      <td className="px-6 py-3.5">
                        <div className="flex min-w-0 items-center gap-3">
                          <div className="bg-surface-container-high text-on-surface-variant flex size-9 shrink-0 items-center justify-center rounded-full">
                            <User
                              className="size-4 stroke-[1.75]"
                              aria-hidden
                            />
                          </div>
                          <div className="min-w-0">
                            <p className="truncate text-sm font-bold">
                              {c.fullName}
                            </p>
                            <p className="text-on-surface-variant mt-0.5 truncate text-xs font-medium tabular-nums">
                              {c.phone}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3.5 text-right">
                        <p
                          className={cn(
                            "text-sm font-bold tabular-nums",
                            soldeToneClass(soldeMad),
                          )}
                        >
                          {formatMad(soldeMad, 2, locale)}
                        </p>
                        <p className="text-on-surface-variant text-[10px] font-bold uppercase">
                          {soldeMad > 0.009
                            ? tr("Avoir", "رصيد دائن")
                            : soldeMad < -0.009
                              ? tr("Dette", "دين")
                              : tr("Soldé", "مسدد")}
                        </p>
                      </td>
                      <td className="px-4 py-3.5">
                        {lastPayment ? (
                          <>
                            <p className="text-sm font-semibold tabular-nums">
                              {formatLedgerDate(lastPayment.date, locale)}
                            </p>
                            <p className="text-on-surface-variant text-[10px] font-medium tabular-nums">
                              {formatMad(lastPayment.amountMad, 2, locale)}
                            </p>
                          </>
                        ) : (
                          <span className="text-on-surface-variant text-xs">
                            —
                          </span>
                        )}
                      </td>
                      <td
                        className="px-4 py-3.5"
                        onClick={(event) => event.stopPropagation()}
                        onKeyDown={(event) => event.stopPropagation()}
                      >
                        <div className="flex flex-wrap items-center justify-end gap-1">
                          <CreditStatementActions
                            client={c}
                            tr={tr}
                            iconOnly
                            className="flex flex-wrap items-center justify-end gap-1"
                          />
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => onOpenFiche(c.id)}
                            className="h-8 gap-1 rounded-lg px-2 text-[11px] font-bold"
                            title={tr("Fiche client", "بطاقة العميل")}
                          >
                            <FileText
                              className="size-3.5 stroke-[1.75]"
                              aria-hidden
                            />
                            {tr("Fiche", "بطاقة")}
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => onOpenPlanDialog(c.id)}
                            className="h-8 gap-1 rounded-lg px-2 text-[11px] font-bold"
                            title={tr(
                              "Payer en plusieurs fois",
                              "الدفع بالتقسيط",
                            )}
                          >
                            <Layers
                              className="size-3.5 stroke-[1.75]"
                              aria-hidden
                            />
                            {tr("Plan", "خطة")}
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            onClick={() => onOpenPaymentDialog(c.id)}
                            className="h-8 gap-1 rounded-lg px-2 text-[11px] font-bold"
                            title={tr(
                              "Enregistrer un paiement",
                              "تسجيل دفعة",
                            )}
                          >
                            <Banknote
                              className="size-3.5 stroke-[1.75]"
                              aria-hidden
                            />
                            {tr("Paiement", "دفعة")}
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                },
              )}
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
      )}
    </div>
  );
}
