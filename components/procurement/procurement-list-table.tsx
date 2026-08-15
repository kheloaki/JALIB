"use client";

import { useMemo } from "react";
import { Check, History, Trash2 } from "lucide-react";

import { MadPriceField } from "@/components/money/mad-price-field";
import { QtyKeypadField } from "@/components/money/qty-keypad-field";
import { ProductCatalogImage } from "@/components/products/product-catalog-image";
import { Button } from "@/components/ui/button";
import type { Id } from "@/convex/_generated/dataModel";
import { formatMad, formatMadCompact } from "@/lib/money/mad";
import { statusPillClass } from "@/lib/ui/status-pill";
import { cn } from "@/lib/utils";

export type ProcurementListTableItem = {
  id: Id<"procurementListItems">;
  productId: Id<"products">;
  quantity: number;
  status: "pending" | "bought";
  plannedCostMad: number | null;
  paidCostMad: number | null;
  boughtAt: string | null;
  product: {
    id: Id<"products">;
    name: string;
    category: string;
    image: string;
    imageAlt: string;
    barcode: string | null;
    costMad: number | null;
    priceMad: number;
    stockQty: number;
  };
};

type ProcurementListTableProps = {
  items: ProcurementListTableItem[];
  paidByItem: Record<string, number>;
  onPaidChange: (itemId: string, value: number) => void;
  selectedProductId: Id<"products"> | null;
  onSelectProduct: (productId: Id<"products">) => void;
  locale: string;
  isDraftMode: boolean;
  canEditCost: boolean;
  canRemovePending?: boolean;
  canFulfill: boolean;
  hasActiveList: boolean;
  busy: boolean;
  onFulfill: (item: ProcurementListTableItem) => void;
  onRemove: (item: ProcurementListTableItem) => void;
  onQtyChange: (item: ProcurementListTableItem, quantity: number) => void;
  onPlannedCostChange: (
    item: ProcurementListTableItem,
    plannedCostMad: number,
  ) => void;
  onShowPriceHistory: (item: ProcurementListTableItem) => void;
  listTotals: {
    lineCount: number;
    totalQty: number;
    totalPurchase: number;
    totalSell: number;
    hasMissingCost: boolean;
  } | null;
  tr: (key: string, values?: Record<string, string | number>) => string;
};

function unitCostMad(
  item: ProcurementListTableItem,
  paidByItem: Record<string, number>,
): number | null {
  if (item.status === "bought" && item.paidCostMad != null) {
    return item.paidCostMad;
  }
  const draft = paidByItem[item.id];
  if (draft != null && draft > 0) return draft;
  if (item.plannedCostMad != null && item.plannedCostMad > 0) {
    return item.plannedCostMad;
  }
  return item.product.costMad;
}

export function ProcurementListTable({
  items,
  paidByItem,
  onPaidChange,
  selectedProductId,
  onSelectProduct,
  locale,
  isDraftMode,
  canEditCost,
  canRemovePending = false,
  canFulfill,
  hasActiveList,
  busy,
  onFulfill,
  onRemove,
  onQtyChange,
  onPlannedCostChange,
  onShowPriceHistory,
  listTotals,
  tr,
}: ProcurementListTableProps) {
  const sortedItems = useMemo(() => {
    return [...items].sort((a, b) => {
      // Pending first (actionable), then bought.
      if (a.status !== b.status) return a.status === "pending" ? -1 : 1;

      if (a.status === "bought") {
        if (a.boughtAt && b.boughtAt) {
          const d = b.boughtAt.localeCompare(a.boughtAt);
          if (d !== 0) return d;
        } else if (a.boughtAt) {
          return -1;
        } else if (b.boughtAt) {
          return 1;
        }
      }

      const an = a.product.name.toLowerCase();
      const bn = b.product.name.toLowerCase();
      const nameCmp = an.localeCompare(bn, "en");
      if (nameCmp !== 0) return nameCmp;
      return String(a.id).localeCompare(String(b.id));
    });
  }, [items]);

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <div className="border-sidebar-border overflow-x-auto rounded-xl border bg-white print:overflow-visible print:border-slate-300">
        <table className="w-full min-w-[720px] border-collapse text-sm print:min-w-0">
          <thead>
            <tr className="border-sidebar-border bg-surface-container-low/80 border-b text-[10px] font-bold tracking-wide uppercase print:bg-slate-100">
              <th className="text-muted-foreground w-10 px-3 py-2.5 text-center">
                {tr("colIndex")}
              </th>
              <th className="text-muted-foreground px-3 py-2.5 text-start">
                {tr("colProduct")}
              </th>
              <th className="text-muted-foreground w-24 px-3 py-2.5 text-center">
                {tr("colQty")}
              </th>
              <th className="text-muted-foreground w-32 px-3 py-2.5 text-end">
                {tr("colCost")}
              </th>
              <th className="text-muted-foreground w-28 px-3 py-2.5 text-end">
                {tr("colSell")}
              </th>
              <th className="text-muted-foreground w-32 px-3 py-2.5 text-end">
                {tr("colLineTotal")}
              </th>
              <th className="text-muted-foreground min-w-[7.5rem] px-3 py-2.5 text-center whitespace-nowrap">
                {tr("colStatus")}
              </th>
              <th className="text-muted-foreground w-36 px-3 py-2.5 text-end print:hidden">
                {tr("colActions")}
              </th>
            </tr>
          </thead>
          <tbody>
            {sortedItems.map((item, index) => {
              const unitCost = unitCostMad(item, paidByItem);
              const linePurchase =
                unitCost != null && unitCost > 0
                  ? unitCost * item.quantity
                  : null;

              return (
                <tr
                  key={item.id}
                  className={cn(
                    "border-sidebar-border/70 border-b last:border-b-0 print:border-slate-200",
                    selectedProductId === item.productId && "bg-primary/5",
                    item.status === "bought" && "print:text-slate-700",
                  )}
                >
                  <td className="text-muted-foreground px-3 py-2.5 text-center font-semibold tabular-nums">
                    {index + 1}
                  </td>
                  <td className="px-3 py-2.5">
                    <button
                      type="button"
                      className="flex min-w-0 items-center gap-2.5 text-start print:pointer-events-none"
                      onClick={() => onSelectProduct(item.productId)}
                    >
                      <ProductCatalogImage
                        src={item.product.image}
                        alt={item.product.imageAlt}
                        wrapperClassName="size-9 shrink-0 rounded-md bg-slate-100 print:hidden"
                        sizes="36px"
                      />
                      <span className="min-w-0">
                        <span className="text-on-surface block font-semibold leading-snug">
                          {item.product.name}
                        </span>
                        <span className="text-muted-foreground text-xs">
                          {item.product.category}
                        </span>
                      </span>
                    </button>
                  </td>
                  <td className="px-3 py-2.5 text-center">
                    {isDraftMode ||
                    (canFulfill && hasActiveList && item.status === "pending") ? (
                      <QtyKeypadField
                        value={item.quantity}
                        onValueChange={(qty) => onQtyChange(item, qty)}
                        compact
                        disabled={busy}
                        keypadTitle={item.product.name}
                        wrapperClassName="mx-auto w-auto"
                        className="h-9 print:hidden"
                      />
                    ) : (
                      <span className="bg-primary/10 text-primary inline-flex min-w-9 items-center justify-center rounded-md px-2 py-1 text-sm font-black tabular-nums print:bg-transparent print:text-black">
                        {item.quantity}
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2.5 text-end">
                    {item.status === "bought" ? (
                      <span className="font-bold tabular-nums">
                        {item.paidCostMad != null
                          ? formatMadCompact(item.paidCostMad, 2, locale)
                          : "—"}
                      </span>
                    ) : canEditCost && item.status === "pending" ? (
                      <MadPriceField
                        value={
                          paidByItem[item.id] ??
                          item.plannedCostMad ??
                          item.product.costMad ??
                          0
                        }
                        onValueChange={(v) => {
                          onPaidChange(item.id, v);
                          onPlannedCostChange(item, v);
                        }}
                        compact
                        wrapperClassName="ms-auto"
                        className="h-9 text-sm font-semibold print:hidden"
                        aria-label={tr("paidPrice")}
                      />
                    ) : (
                      <span className="font-bold tabular-nums">
                        {item.product.costMad != null
                          ? formatMadCompact(item.product.costMad, 2, locale)
                          : "—"}
                      </span>
                    )}
                    {canFulfill && hasActiveList && item.status !== "bought" ? (
                      <span className="text-on-surface hidden font-bold tabular-nums print:inline">
                        {unitCost != null && unitCost > 0
                          ? formatMadCompact(unitCost, 2, locale)
                          : "—"}
                      </span>
                    ) : null}
                  </td>
                  <td className="text-primary px-3 py-2.5 text-end font-bold tabular-nums">
                    {formatMadCompact(item.product.priceMad, 2, locale)}
                  </td>
                  <td className="px-3 py-2.5 text-end font-black tabular-nums">
                    {linePurchase != null
                      ? formatMadCompact(linePurchase, 2, locale)
                      : "—"}
                  </td>
                  <td className="px-3 py-2.5 text-center whitespace-nowrap">
                    {item.status === "bought" ? (
                      <span className={cn(statusPillClass, "bg-tertiary-container text-on-tertiary-container px-2.5 py-1 text-[11px] font-semibold print:bg-transparent print:text-black")}>
                        <Check className="size-3.5 print:hidden" aria-hidden />
                        {tr("bought")}
                      </span>
                    ) : (
                      <span className={cn(statusPillClass, "text-muted-foreground bg-slate-100 px-2.5 py-1 text-[11px] font-semibold print:bg-transparent print:text-black")}>
                        {tr("pending")}
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2.5 text-end print:hidden">
                    <div className="flex items-center justify-end gap-1.5">
                      {item.status === "pending" && canFulfill && hasActiveList ? (
                        <Button
                          type="button"
                          size="sm"
                          className="h-8 rounded-lg px-2.5 text-xs font-bold"
                          disabled={busy}
                          onClick={() => onFulfill(item)}
                        >
                          <Check className="size-3.5" aria-hidden />
                          {tr("markBought")}
                        </Button>
                      ) : null}
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        className="text-primary hover:bg-primary/10 hover:text-primary size-8 shrink-0 rounded-lg"
                        onClick={() => onShowPriceHistory(item)}
                        aria-label={tr("priceHistory")}
                        title={tr("priceHistory")}
                      >
                        <History className="size-3.5 stroke-[1.75]" aria-hidden />
                      </Button>
                      {isDraftMode || (canRemovePending && item.status === "pending") ? (
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          className="text-destructive hover:bg-destructive/10 hover:text-destructive size-8 shrink-0 rounded-lg"
                          disabled={busy}
                          onClick={() => onRemove(item)}
                          aria-label={tr("removeItem")}
                          title={tr("removeItem")}
                        >
                          <Trash2 className="size-3.5 stroke-[1.75]" aria-hidden />
                        </Button>
                      ) : null}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
          {listTotals ? (
            <tfoot>
              <tr className="border-sidebar-border bg-surface-container-low/60 border-t font-bold print:bg-slate-50">
                <td
                  colSpan={2}
                  className="text-muted-foreground px-3 py-3 text-[10px] tracking-wide uppercase"
                >
                  {tr("listTotalsTitle")}
                </td>
                <td className="text-primary px-3 py-3 text-center text-base font-black tabular-nums">
                  {listTotals.totalQty}
                </td>
                <td colSpan={2} className="px-3 py-3" />
                <td className="px-3 py-3 text-end text-base font-black tabular-nums">
                  {listTotals.hasMissingCost
                    ? tr("totalPartial")
                    : formatMad(listTotals.totalPurchase, 2, locale)}
                </td>
                <td className="text-primary px-3 py-3 text-end text-sm font-black tabular-nums">
                  {formatMad(listTotals.totalSell, 2, locale)}
                </td>
                <td colSpan={2} className="print:hidden" />
              </tr>
            </tfoot>
          ) : null}
        </table>
      </div>
    </div>
  );
}

export { unitCostMad };
