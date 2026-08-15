"use client";

import { useCallback } from "react";
import { Download, Eye, LockOpen, Printer } from "lucide-react";

import { WhatsAppShareButton } from "@/components/share/whatsapp-share-button";

import { Button } from "@/components/ui/button";
import { SortableTh } from "@/components/ui/sortable-th";
import { useClientTableSort } from "@/hooks/use-client-table-sort";
import type { Id } from "@/convex/_generated/dataModel";
import { formatMad } from "@/lib/money/mad";
import { statusPillClass } from "@/lib/ui/status-pill";
import { cn } from "@/lib/utils";

export type ProcurementBonSummary = {
  id: Id<"procurementLists">;
  number: string;
  title: string | null;
  status: "active" | "completed";
  publishedAt: string;
  completedAt: string | null;
  lineCount: number;
  totalQty: number;
  totalPurchaseMad: number;
  totalSellMad: number;
  pendingCount: number;
  hasMissingCost: boolean;
};

type BonSortColumn =
  | "number"
  | "title"
  | "date"
  | "total"
  | "statut";

function compareBons(
  a: ProcurementBonSummary,
  b: ProcurementBonSummary,
  column: BonSortColumn,
): number {
  switch (column) {
    case "number":
      return a.number.localeCompare(b.number, "en", { numeric: true });
    case "title":
      return (a.title ?? "").localeCompare(b.title ?? "", "fr");
    case "date":
      return a.publishedAt.localeCompare(b.publishedAt);
    case "total":
      return a.totalPurchaseMad - b.totalPurchaseMad;
    case "statut":
      return a.status.localeCompare(b.status);
    default:
      return 0;
  }
}

type ProcurementBonsTableProps = {
  bons: ProcurementBonSummary[];
  selectedBonId: Id<"procurementLists"> | null;
  locale: string;
  canExportPdf: boolean;
  pdfDownloadingId: Id<"procurementLists"> | null;
  pdfSharingId: Id<"procurementLists"> | null;
  onOpen: (bonId: Id<"procurementLists">) => void;
  onUnlock: (bon: ProcurementBonSummary) => void;
  onPrint: (bon: ProcurementBonSummary) => void;
  onDownload: (bon: ProcurementBonSummary) => void;
  onShare: (bon: ProcurementBonSummary) => void;
  tr: (key: string, values?: Record<string, string | number>) => string;
  formatDate: (iso: string) => string;
};

export function ProcurementBonsTable({
  bons,
  selectedBonId,
  locale,
  canExportPdf,
  pdfDownloadingId,
  pdfSharingId,
  onOpen,
  onUnlock,
  onPrint,
  onDownload,
  onShare,
  tr,
  formatDate,
}: ProcurementBonsTableProps) {
  const compare = useCallback(compareBons, []);
  const {
    sortColumn,
    sortDirection,
    handleSort,
    sortedRows: sortedBons,
  } = useClientTableSort({
    rows: bons,
    initialColumn: "date" as BonSortColumn,
    initialDirection: "desc",
    compare,
  });

  return (
    <div className="border-sidebar-border overflow-x-auto rounded-xl border bg-white">
      <table className="w-full min-w-[880px] border-collapse text-sm">
        <thead>
          <tr className="border-sidebar-border bg-surface-container-low/80 border-b text-[10px] font-bold tracking-wide uppercase">
            <th className="text-muted-foreground w-10 px-3 py-2.5 text-center">
              {tr("colIndex")}
            </th>
            <SortableTh
              column="number"
              activeColumn={sortColumn}
              direction={sortDirection}
              onSort={handleSort}
              className="text-muted-foreground px-3 py-2.5 tracking-wide"
            >
              {tr("colBon")}
            </SortableTh>
            <SortableTh
              column="title"
              activeColumn={sortColumn}
              direction={sortDirection}
              onSort={handleSort}
              className="text-muted-foreground px-3 py-2.5 tracking-wide"
            >
              {tr("colBonTitle")}
            </SortableTh>
            <SortableTh
              column="date"
              activeColumn={sortColumn}
              direction={sortDirection}
              onSort={handleSort}
              className="text-muted-foreground w-36 px-3 py-2.5 tracking-wide"
            >
              {tr("colBonDate")}
            </SortableTh>
            <th className="text-muted-foreground w-20 px-3 py-2.5 text-center">
              {tr("colBonLines")}
            </th>
            <th className="text-muted-foreground w-20 px-3 py-2.5 text-center">
              {tr("colQty")}
            </th>
            <SortableTh
              column="total"
              activeColumn={sortColumn}
              direction={sortDirection}
              onSort={handleSort}
              align="end"
              className="text-muted-foreground w-32 px-3 py-2.5 tracking-wide"
            >
              {tr("totalPurchase")}
            </SortableTh>
            <SortableTh
              column="statut"
              activeColumn={sortColumn}
              direction={sortDirection}
              onSort={handleSort}
              align="center"
              className="text-muted-foreground min-w-[10.5rem] px-3 py-2.5 tracking-wide whitespace-nowrap"
            >
              {tr("colStatus")}
            </SortableTh>
            <th className="text-muted-foreground w-44 px-3 py-2.5 text-end">
              {tr("colActions")}
            </th>
          </tr>
        </thead>
        <tbody>
          {sortedBons.map((bon, index) => {
            const isActive = bon.status === "active";
            const isSelected = selectedBonId === bon.id;
            return (
              <tr
                key={bon.id}
                className={cn(
                  "border-sidebar-border/70 border-b last:border-b-0",
                  isSelected && "bg-primary/5",
                )}
              >
                <td className="text-muted-foreground px-3 py-2.5 text-center font-semibold tabular-nums">
                  {index + 1}
                </td>
                <td className="px-3 py-2.5">
                  <span className="text-primary font-black tabular-nums">
                    {bon.number}
                  </span>
                </td>
                <td className="px-3 py-2.5">
                  <span className="font-semibold">
                    {bon.title?.trim() || tr("bonUntitled")}
                  </span>
                </td>
                <td className="text-muted-foreground px-3 py-2.5 text-xs">
                  {formatDate(bon.publishedAt)}
                </td>
                <td className="px-3 py-2.5 text-center font-bold tabular-nums">
                  {bon.lineCount}
                </td>
                <td className="text-primary px-3 py-2.5 text-center font-black tabular-nums">
                  {bon.totalQty}
                </td>
                <td className="px-3 py-2.5 text-end font-black tabular-nums">
                  {bon.hasMissingCost
                    ? tr("totalPartial")
                    : formatMad(bon.totalPurchaseMad, 2, locale)}
                </td>
                <td className="px-3 py-2.5 text-center whitespace-nowrap">
                  {isActive ? (
                    <span className={cn(statusPillClass, "bg-warning-container text-on-warning-container px-2.5 py-1 text-[11px] font-semibold")}>
                      {bon.pendingCount > 0
                        ? tr("bonStatusActivePending", {
                            count: bon.pendingCount,
                          })
                        : tr("listStatusActive")}
                    </span>
                  ) : (
                    <span className={cn(statusPillClass, "text-muted-foreground bg-slate-100 px-2.5 py-1 text-[11px] font-semibold")}>
                      {tr("listStatusCompleted")}
                    </span>
                  )}
                </td>
                <td className="px-3 py-2.5">
                  <div className="flex items-center justify-end gap-1">
                    <Button
                      type="button"
                      size="sm"
                      variant={isSelected ? "default" : "outline"}
                      className="h-8 rounded-lg px-2 text-xs font-bold"
                      onClick={() => onOpen(bon.id)}
                    >
                      <Eye className="size-3.5" aria-hidden />
                      {tr("openBon")}
                    </Button>
                    {isActive ? (
                      <Button
                        type="button"
                        size="icon"
                        variant="outline"
                        className="text-primary hover:bg-primary/10 hover:text-primary size-8 rounded-lg"
                        onClick={() => onUnlock(bon)}
                        aria-label={tr("unlockList")}
                        title={tr("unlockList")}
                      >
                        <LockOpen className="size-3.5" aria-hidden />
                      </Button>
                    ) : null}
                    <Button
                      type="button"
                      size="icon"
                      variant="outline"
                      className="size-8 rounded-lg"
                      onClick={() => onPrint(bon)}
                      aria-label={tr("printList")}
                      title={tr("printList")}
                    >
                      <Printer className="size-3.5" aria-hidden />
                    </Button>
                    <Button
                      type="button"
                      size="icon"
                      variant="outline"
                      className="size-8 rounded-lg"
                      disabled={
                        !canExportPdf ||
                        pdfDownloadingId === bon.id ||
                        pdfSharingId === bon.id
                      }
                      onClick={() => onDownload(bon)}
                      aria-label={tr("downloadList")}
                      title={tr("downloadList")}
                    >
                      <Download className="size-3.5" aria-hidden />
                    </Button>
                    <WhatsAppShareButton
                      onClick={() => onShare(bon)}
                      disabled={!canExportPdf}
                      busy={pdfSharingId === bon.id}
                      ariaLabel={tr("shareListWhatsApp")}
                      className="size-8 shrink-0 rounded-lg"
                    />
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
