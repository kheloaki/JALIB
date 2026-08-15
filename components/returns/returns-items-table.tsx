"use client";

import Link from "next/link";
import { useCallback, useMemo } from "react";
import { useLocale } from "next-intl";
import { Eye } from "lucide-react";

import type { ReturnItemRow } from "@/lib/returns/types";
import { formatMad } from "@/lib/money/mad";
import { formatReturnRef } from "@/lib/returns/format-return-ref";
import { InlineTableSkeleton } from "@/components/skeletons";
import { SortableTh } from "@/components/ui/sortable-th";
import { useClientTableSort } from "@/hooks/use-client-table-sort";
import { cn } from "@/lib/utils";

import { formatDateFr } from "@/lib/dates/format-date";

type ReturnSortColumn =
  | "date"
  | "client"
  | "facture"
  | "product"
  | "montant"
  | "motif";

function reasonLabel(
  reason: ReturnItemRow["reason"],
  tr: (fr: string, ar: string) => string,
): string {
  switch (reason) {
    case "Endommagé":
      return tr("Endommagé", "تالف");
    case "Mauvais article":
      return tr("Mauvais article", "صنف خاطئ");
    case "Choix du client":
      return tr("Choix du client", "خيار الزبون");
    case "Autre":
      return tr("Autre", "آخر");
    default:
      return reason;
  }
}

function stockLabel(
  disposition: ReturnItemRow["stockDisposition"],
  tr: (fr: string, ar: string) => string,
): string {
  return disposition === "Disponible"
    ? tr("Disponible", "متاح")
    : tr("Invendable", "غير قابل للبيع");
}

function compareReturnRows(
  a: ReturnItemRow,
  b: ReturnItemRow,
  column: ReturnSortColumn,
): number {
  let cmp = 0;
  switch (column) {
    case "date":
      cmp = a.createdAtIso.localeCompare(b.createdAtIso);
      break;
    case "client":
      cmp = a.clientName.localeCompare(b.clientName, "fr");
      break;
    case "facture":
      cmp = a.invoiceNumber.localeCompare(b.invoiceNumber, "fr", {
        numeric: true,
      });
      break;
    case "product":
      cmp = a.productName.localeCompare(b.productName, "fr");
      break;
    case "montant":
      cmp = a.lineRefundMad - b.lineRefundMad;
      break;
    case "motif":
      cmp = a.reason.localeCompare(b.reason, "fr");
      break;
  }
  if (cmp !== 0) return cmp;
  const returnCmp = a.returnId.localeCompare(b.returnId);
  if (returnCmp !== 0) return returnCmp;
  return a.productName.localeCompare(b.productName, "fr");
}

export function ReturnsItemsTable({
  rows,
  hydrated,
  tr,
}: {
  rows: ReturnItemRow[];
  hydrated: boolean;
  tr: (fr: string, ar: string) => string;
}) {
  const locale = useLocale();

  const compare = useCallback(compareReturnRows, []);

  const {
    sortColumn,
    sortDirection,
    handleSort,
    sortedRows,
  } = useClientTableSort({
    rows,
    initialColumn: "date" as ReturnSortColumn,
    initialDirection: "desc",
    compare,
  });

  const returnGroupTone = useMemo(() => {
    const toneByReturnId = new Map<string, number>();
    let groupCounter = 0;
    for (const row of sortedRows) {
      if (!toneByReturnId.has(row.returnId)) {
        toneByReturnId.set(row.returnId, groupCounter++);
      }
    }
    return toneByReturnId;
  }, [sortedRows]);

  const returnRowMeta = useMemo(() => {
    const spanByIndex = new Map<number, number>();
    const counts = new Map<string, number>();
    for (const row of sortedRows) {
      counts.set(row.returnId, (counts.get(row.returnId) ?? 0) + 1);
    }
    sortedRows.forEach((row, index) => {
      const firstIndex = sortedRows.findIndex(
        (r) => r.returnId === row.returnId,
      );
      if (firstIndex === index) {
        spanByIndex.set(index, counts.get(row.returnId) ?? 1);
      }
    });
    return spanByIndex;
  }, [sortedRows]);

  return (
    <div className="bg-surface-container-lowest border-sidebar-border overflow-hidden rounded-xl border shadow-sm">
      <div className="border-sidebar-border flex items-center justify-between border-b px-6 py-5">
        <h2 className="text-lg font-bold tracking-tight">
          {tr("Articles retournés", "المنتجات المرتجعة")}
        </h2>
        <span className="bg-surface-container-high text-on-surface-variant rounded-full px-2 py-1 text-xs font-semibold">
          {sortedRows.length} {tr("lignes", "سطور")}
        </span>
      </div>

      {!hydrated ? (
        <InlineTableSkeleton cols={8} rows={7} />
      ) : sortedRows.length === 0 ? (
        <p className="text-on-surface-variant px-6 py-8 text-sm">
          {tr(
            "Aucun retour enregistré pour le moment.",
            "لا توجد مرتجعات مسجلة حالياً.",
          )}
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1040px] border-collapse">
            <thead>
              <tr className="bg-surface-container-low/50">
                <th className="text-on-surface-variant px-6 py-4 text-left text-[10px] font-bold tracking-wider uppercase">
                  {tr("Retour", "الإرجاع")}
                </th>
                <SortableTh
                  column="date"
                  activeColumn={sortColumn}
                  direction={sortDirection}
                  onSort={handleSort}
                >
                  {tr("Date", "التاريخ")}
                </SortableTh>
                <SortableTh
                  column="facture"
                  activeColumn={sortColumn}
                  direction={sortDirection}
                  onSort={handleSort}
                >
                  {tr("Facture", "الفاتورة")}
                </SortableTh>
                <SortableTh
                  column="client"
                  activeColumn={sortColumn}
                  direction={sortDirection}
                  onSort={handleSort}
                >
                  {tr("Client", "العميل")}
                </SortableTh>
                <SortableTh
                  column="product"
                  activeColumn={sortColumn}
                  direction={sortDirection}
                  onSort={handleSort}
                >
                  {tr("Produit", "المنتج")}
                </SortableTh>
                <th className="text-on-surface-variant px-6 py-4 text-right text-[10px] font-bold tracking-wider uppercase">
                  {tr("Qté retournée", "الكمية المرتجعة")}
                </th>
                <th className="text-on-surface-variant px-6 py-4 text-right text-[10px] font-bold tracking-wider uppercase">
                  {tr("Prix unit.", "سعر الوحدة")}
                </th>
                <SortableTh
                  column="montant"
                  activeColumn={sortColumn}
                  direction={sortDirection}
                  onSort={handleSort}
                  align="end"
                >
                  {tr("Montant", "المبلغ")}
                </SortableTh>
                <SortableTh
                  column="motif"
                  activeColumn={sortColumn}
                  direction={sortDirection}
                  onSort={handleSort}
                >
                  {tr("Motif", "السبب")}
                </SortableTh>
                <th className="text-on-surface-variant px-6 py-4 text-right text-[10px] font-bold tracking-wider uppercase">
                  {tr("Stock", "المخزون")}
                </th>
                <th className="text-on-surface-variant px-6 py-4 text-right text-[10px] font-bold tracking-wider uppercase">
                  {tr("Détails", "التفاصيل")}
                </th>
              </tr>
            </thead>
            <tbody className="divide-sidebar-border divide-y">
              {sortedRows.map((row, index) => {
                const striped =
                  (returnGroupTone.get(row.returnId) ?? 0) % 2 === 1;
                const rowSpan = returnRowMeta.get(index);
                const detailHref = `/${locale}/retours/${row.returnId}`;

                return (
                  <tr
                    key={`${row.returnId}-${row.productName}-${row.qtyReturned}-${row.createdAtIso}`}
                    className={cn(
                      "hover:bg-surface-container-low/40 transition-colors",
                      striped && "bg-surface-container-low/30",
                    )}
                  >
                    {rowSpan ? (
                      <td
                        rowSpan={rowSpan}
                        className="border-sidebar-border/60 border-r px-6 py-4 align-top"
                      >
                        <Link
                          href={detailHref}
                          className="text-primary hover:underline text-sm font-black"
                        >
                          #{formatReturnRef(row.returnId)}
                        </Link>
                      </td>
                    ) : null}
                    {rowSpan ? (
                      <td
                        rowSpan={rowSpan}
                        className="text-on-surface-variant border-sidebar-border/60 border-r px-6 py-4 align-top text-sm font-medium tabular-nums"
                      >
                        {formatDateFr(row.createdAtIso)}
                      </td>
                    ) : null}
                    {rowSpan ? (
                      <td
                        rowSpan={rowSpan}
                        className="border-sidebar-border/60 border-r px-6 py-4 align-top"
                      >
                        <Link
                          href={`/${locale}/factures/${row.invoiceId}`}
                          className="text-primary hover:underline text-sm font-bold"
                        >
                          {row.invoiceNumber}
                        </Link>
                      </td>
                    ) : null}
                    {rowSpan ? (
                      <td
                        rowSpan={rowSpan}
                        className="border-sidebar-border/60 border-r px-6 py-4 align-top text-sm font-semibold"
                      >
                        {row.clientName}
                      </td>
                    ) : null}
                    <td className="max-w-[220px] px-6 py-4">
                      <p className="truncate text-sm font-semibold">
                        {row.productName}
                      </p>
                    </td>
                    <td className="px-6 py-4 text-right text-sm font-bold tabular-nums">
                      {row.qtyReturned}
                    </td>
                    <td className="text-on-surface-variant px-6 py-4 text-right text-sm font-medium tabular-nums">
                      {formatMad(row.unitPriceMad, 2, locale)}
                    </td>
                    <td className="px-6 py-4 text-right text-sm font-bold tabular-nums">
                      {formatMad(row.lineRefundMad, 2, locale)}
                    </td>
                    {rowSpan ? (
                      <td
                        rowSpan={rowSpan}
                        className="text-on-surface-variant border-sidebar-border/60 border-r px-6 py-4 align-top text-sm font-medium"
                      >
                        {reasonLabel(row.reason, tr)}
                      </td>
                    ) : null}
                    {rowSpan ? (
                      <td
                        rowSpan={rowSpan}
                        className="border-sidebar-border/60 border-r px-6 py-4 align-top text-sm font-medium"
                      >
                        {stockLabel(row.stockDisposition, tr)}
                      </td>
                    ) : null}
                    {rowSpan ? (
                      <td rowSpan={rowSpan} className="px-6 py-4 text-right align-top">
                        <Link
                          href={detailHref}
                          className="border-primary/25 bg-primary/8 text-primary hover:bg-primary/15 inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-black uppercase transition-colors"
                        >
                          <Eye className="size-3.5" aria-hidden />
                          {tr("Voir", "عرض")}
                        </Link>
                      </td>
                    ) : null}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
