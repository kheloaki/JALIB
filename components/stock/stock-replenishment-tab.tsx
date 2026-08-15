"use client";

import { useCallback, useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { PackagePlus, ScanBarcode, Trash2, X } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";

import { MadPriceField } from "@/components/money/mad-price-field";
import { QtyKeypadField } from "@/components/money/qty-keypad-field";
import { useAdminChrome } from "@/components/layout/admin-chrome-context";
import { AdminFilterSummary } from "@/components/layout/admin-filter-summary";
import { BarcodeScanDialog } from "@/components/products/barcode-scan-dialog";
import { ProductCatalogImage } from "@/components/products/product-catalog-image";
import { PosDialogProductPicker } from "@/components/pos/pos-dialog-product-picker";
import type { Product } from "@/components/pos/types";
import { Button } from "@/components/ui/button";
import { SortableTh } from "@/components/ui/sortable-th";
import { useToast } from "@/components/ui/toaster";
import { useClientTableSort } from "@/hooks/use-client-table-sort";
import { useConvexCatalog } from "@/hooks/use-convex-catalog";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { clampMadPrice, formatMadCompact } from "@/lib/money/mad";
import { findProductByBarcode, normalizeBarcodeInput } from "@/lib/pos/catalog-lookup";
import { formatDateTimeMediumFr } from "@/lib/dates/format-date";
import { InlineTableSkeleton } from "@/components/skeletons";
import { cn } from "@/lib/utils";

type HistorySortColumn = "date" | "product" | "qty" | "total";

type DraftLine = {
  key: string;
  product: Product;
  quantity: number;
  costMad: number;
  sellPriceMad: number;
};

function sourceLabel(source: string | null, t: (key: string) => string): string {
  if (source === "procurement") return t("replenishmentSourceProcurement");
  if (source === "stock_in") return t("replenishmentSourceManual");
  return source ?? "—";
}

export function StockReplenishmentTab() {
  const t = useTranslations("stock");
  const locale = useLocale();
  const isAr = locale === "ar";
  const tr = (fr: string, ar: string) => (isAr ? ar : fr);
  const toast = useToast();
  const { headerSearchQuery, setHeaderSearchQuery } = useAdminChrome();
  const { products: catalog } = useConvexCatalog();
  const history = useQuery(api.products.listStockInHistory, { limit: 80 });
  const addStockLines = useMutation(api.products.addStockLines);

  const [sessionOpen, setSessionOpen] = useState(false);
  const [lines, setLines] = useState<DraftLine[]>([]);
  const [scanOpen, setScanOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [lastPickedId, setLastPickedId] = useState<string | null>(null);

  const draftTotals = useMemo(() => {
    let qty = 0;
    let total = 0;
    for (const line of lines) {
      qty += line.quantity;
      if (line.costMad > 0) total += line.costMad * line.quantity;
    }
    return { lineCount: lines.length, qty, total };
  }, [lines]);

  const filteredHistory = useMemo(() => {
    const rows = history ?? [];
    const q = headerSearchQuery.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((row) => {
      const hay = [row.productName, row.source ?? ""].join(" ").toLowerCase();
      return hay.includes(q);
    });
  }, [headerSearchQuery, history]);

  type HistoryRow = (typeof filteredHistory)[number];

  const compareHistory = useCallback(
    (a: HistoryRow, b: HistoryRow, column: HistorySortColumn) => {
      switch (column) {
        case "date":
          return a.at.localeCompare(b.at);
        case "product":
          return a.productName.localeCompare(b.productName, "fr");
        case "qty":
          return (a.quantity ?? 0) - (b.quantity ?? 0);
        case "total":
          return (a.lineTotalMad ?? 0) - (b.lineTotalMad ?? 0);
        default:
          return 0;
      }
    },
    [],
  );

  const {
    sortColumn,
    sortDirection,
    handleSort,
    sortedRows: sortedHistory,
  } = useClientTableSort({
    rows: filteredHistory,
    initialColumn: "date" as HistorySortColumn,
    initialDirection: "desc",
    compare: compareHistory,
  });

  function addProductToDraft(product: Product) {
    setLastPickedId(product.id);
    setLines((prev) => {
      const existing = prev.find((line) => line.product.id === product.id);
      if (existing) {
        return prev.map((line) =>
          line.product.id === product.id
            ? { ...line, quantity: line.quantity + 1 }
            : line,
        );
      }
      return [
        ...prev,
        {
          key: product.id,
          product,
          quantity: 1,
          costMad:
            product.costMad && product.costMad > 0 ? product.costMad : 0,
          sellPriceMad: product.price,
        },
      ];
    });
  }

  function handleBarcodeScan(raw: string) {
    const key = normalizeBarcodeInput(raw);
    setScanOpen(false);
    if (!key) return;
    const hit = findProductByBarcode(catalog, key);
    if (!hit) {
      toast.info(t("barcodeNotFoundTitle"), t("barcodeNotFoundDescription"));
      return;
    }
    addProductToDraft(hit);
  }

  function updateLine(
    productId: string,
    patch: Partial<Pick<DraftLine, "quantity" | "costMad" | "sellPriceMad">>,
  ) {
    setLines((prev) =>
      prev.map((line) =>
        line.product.id === productId ? { ...line, ...patch } : line,
      ),
    );
  }

  function removeLine(productId: string) {
    setLines((prev) => prev.filter((line) => line.product.id !== productId));
  }

  function closeSession() {
    setSessionOpen(false);
    setLines([]);
    setLastPickedId(null);
  }

  function openSession() {
    setLines([]);
    setLastPickedId(null);
    setSessionOpen(true);
  }

  async function handleSubmit() {
    if (lines.length === 0) {
      toast.error(t("replenishmentEmptyTitle"), t("replenishmentEmptyDescription"));
      return;
    }

    for (const line of lines) {
      if (line.quantity < 1) {
        toast.error(t("invalidQtyTitle"), t("invalidQtyDescription"));
        return;
      }
      if (line.costMad <= 0) {
        toast.error(t("invalidPriceTitle"), t("invalidPriceDescription"));
        return;
      }
      if (line.sellPriceMad <= 0) {
        toast.error(t("invalidSellPriceTitle"), t("invalidSellPriceDescription"));
        return;
      }
    }

    setSaving(true);
    try {
      await addStockLines({
        lines: lines.map((line) => ({
          productId: line.product.id as Id<"products">,
          quantity: line.quantity,
          costMad: clampMadPrice(line.costMad),
          sellPriceMad: clampMadPrice(line.sellPriceMad),
        })),
      });
      toast.success(t("replenishmentSuccessTitle"), t("replenishmentSuccessDescription"));
      closeSession();
    } catch (error) {
      toast.error(
        t("replenishmentErrorTitle"),
        error instanceof Error ? error.message : t("errorGeneric"),
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-6 p-4 sm:p-6 lg:px-8">
      {sessionOpen ? (
        <section className="border-outline-variant/40 bg-surface-container-lowest flex flex-col rounded-xl border shadow-sm">
          <header className="border-outline-variant/30 flex flex-wrap items-center justify-between gap-3 border-b px-4 py-4 sm:px-5">
            <div>
              <h2 className="text-on-background text-lg font-bold">{t("replenishmentTitle")}</h2>
              <p className="text-on-surface-variant mt-0.5 text-sm">
                {t("replenishmentSessionHint")}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                className="rounded-xl"
                onClick={() => setScanOpen(true)}
              >
                <ScanBarcode className="size-4" aria-hidden />
                {t("scanButton")}
              </Button>
              <Button
                type="button"
                variant="outline"
                className="rounded-xl"
                onClick={closeSession}
              >
                <X className="size-4" aria-hidden />
                {t("cancel")}
              </Button>
              <Button
                type="button"
                className="rounded-xl"
                onClick={() => void handleSubmit()}
                disabled={lines.length === 0 || saving}
              >
                <PackagePlus className="size-4" aria-hidden />
                {saving ? t("saving") : t("replenishmentConfirm")}
              </Button>
            </div>
          </header>

          <div className="px-4 py-4 sm:px-5">
            <PosDialogProductPicker
              selectedProductId={lastPickedId}
              onSelectProduct={addProductToDraft}
              pickMode="stock"
              tr={tr}
              gridClassName="max-h-[min(55vh,480px)] sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6"
            />

            {lines.length > 0 ? (
              <div className="mt-6 overflow-x-auto rounded-xl border">
                <table className="w-full min-w-[820px] border-collapse text-sm">
                  <thead>
                    <tr className="border-outline-variant/30 bg-surface-container-low border-b">
                      <th className="text-on-surface-variant px-4 py-2.5 text-left text-xs font-bold uppercase">
                        {t("colProduct")}
                      </th>
                      <th className="text-on-surface-variant px-4 py-2.5 text-left text-xs font-bold uppercase">
                        {t("replenishmentQtyCol")}
                      </th>
                      <th className="text-on-surface-variant px-4 py-2.5 text-left text-xs font-bold uppercase">
                        {t("replenishmentCostCol")}
                      </th>
                      <th className="text-on-surface-variant px-4 py-2.5 text-left text-xs font-bold uppercase">
                        {t("replenishmentSellCol")}
                      </th>
                      <th className="text-on-surface-variant px-4 py-2.5 text-left text-xs font-bold uppercase">
                        {t("replenishmentLineTotalCol")}
                      </th>
                      <th className="px-4 py-2.5" />
                    </tr>
                  </thead>
                  <tbody>
                    {lines.map((line) => (
                      <tr
                        key={line.key}
                        className="border-outline-variant/20 border-b last:border-b-0"
                      >
                        <td className="px-4 py-3">
                          <div className="flex min-w-0 items-center gap-2">
                            <div className="relative size-10 shrink-0 overflow-hidden rounded-lg">
                              <ProductCatalogImage
                                src={line.product.image}
                                alt={line.product.imageAlt}
                                sizes="40px"
                              />
                            </div>
                            <span className="truncate font-semibold">{line.product.name}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <QtyKeypadField
                            value={line.quantity}
                            onValueChange={(quantity) =>
                              updateLine(line.product.id, { quantity })
                            }
                            min={1}
                            compact
                            keypadTitle={line.product.name}
                            wrapperClassName="max-w-[5rem]"
                          />
                        </td>
                        <td className="px-4 py-3">
                          <MadPriceField
                            value={line.costMad}
                            onValueChange={(costMad) =>
                              updateLine(line.product.id, { costMad })
                            }
                            min={0.01}
                            compact
                            keypadTitle={line.product.name}
                            labelFr="Prix achat"
                            labelAr="سعر الشراء"
                            wrapperClassName="max-w-[7rem]"
                          />
                        </td>
                        <td className="px-4 py-3">
                          <MadPriceField
                            value={line.sellPriceMad}
                            onValueChange={(sellPriceMad) =>
                              updateLine(line.product.id, { sellPriceMad })
                            }
                            min={0.01}
                            compact
                            keypadTitle={line.product.name}
                            labelFr="Prix vente"
                            labelAr="سعر البيع"
                            wrapperClassName="max-w-[7rem]"
                          />
                        </td>
                        <td className="px-4 py-3 font-bold tabular-nums">
                          {line.costMad > 0
                            ? formatMadCompact(line.costMad * line.quantity, 2, locale)
                            : "—"}
                        </td>
                        <td className="px-4 py-3">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="size-8 rounded-lg"
                            onClick={() => removeLine(line.product.id)}
                            aria-label={t("replenishmentRemoveLine")}
                          >
                            <Trash2 className="size-4" aria-hidden />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <footer className="border-outline-variant/30 flex flex-wrap items-center justify-between gap-3 border-t px-4 py-3">
                  <p className="text-on-surface-variant text-sm">
                    {t("replenishmentDraftSummary", {
                      lines: draftTotals.lineCount,
                      qty: draftTotals.qty,
                    })}
                  </p>
                  <p className="text-on-background text-sm font-bold tabular-nums">
                    {draftTotals.total > 0
                      ? formatMadCompact(draftTotals.total, 2, locale)
                      : "—"}
                  </p>
                </footer>
              </div>
            ) : (
              <p className="text-on-surface-variant mt-4 text-center text-sm">
                {t("replenishmentPickHint")}
              </p>
            )}
          </div>
        </section>
      ) : (
        <section className="border-outline-variant/40 bg-surface-container-lowest rounded-xl border shadow-sm">
          <header className="border-outline-variant/30 flex flex-wrap items-center justify-between gap-3 border-b px-4 py-4 sm:px-5">
            <div>
              <h2 className="text-on-background text-lg font-bold">
                {t("replenishmentHistoryTitle")}
              </h2>
              <p className="text-on-surface-variant mt-0.5 text-sm">
                {t("replenishmentHistoryDescription")}
              </p>
            </div>
            <Button type="button" className="rounded-xl" onClick={openSession}>
              <PackagePlus className="size-4" aria-hidden />
              {t("addStock")}
            </Button>
          </header>

          <AdminFilterSummary
            filteredCount={filteredHistory.length}
            totalCount={history?.length ?? 0}
            searchQuery={headerSearchQuery}
            onClearSearch={() => setHeaderSearchQuery("")}
            itemLabel={tr("entrée", "إدخال")}
            itemLabelPlural={tr("entrées", "إدخالات")}
            className="px-4 pt-4 sm:px-5"
          />

        {history === undefined ? (
          <div className="overflow-x-auto px-2 pb-4 sm:px-3">
            <InlineTableSkeleton cols={6} rows={6} />
          </div>
        ) : history.length === 0 ? (
          <p className="text-on-surface-variant px-4 py-6 text-sm sm:px-5">
            {t("replenishmentHistoryEmpty")}
          </p>
        ) : sortedHistory.length === 0 ? (
          <p className="text-on-surface-variant px-4 py-6 text-sm sm:px-5">
            {tr("Aucune entrée ne correspond à la recherche.", "لا يوجد إدخال يطابق البحث.")}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] border-collapse text-sm">
              <thead>
                <tr className="border-outline-variant/30 bg-surface-container-low border-b">
                  <SortableTh
                    column="date"
                    activeColumn={sortColumn}
                    direction={sortDirection}
                    onSort={handleSort}
                    className="px-4 py-2.5 text-xs tracking-wide"
                  >
                    {t("replenishmentHistoryDateCol")}
                  </SortableTh>
                  <SortableTh
                    column="product"
                    activeColumn={sortColumn}
                    direction={sortDirection}
                    onSort={handleSort}
                    className="px-4 py-2.5 text-xs tracking-wide"
                  >
                    {t("colProduct")}
                  </SortableTh>
                  <SortableTh
                    column="qty"
                    activeColumn={sortColumn}
                    direction={sortDirection}
                    onSort={handleSort}
                    className="px-4 py-2.5 text-xs tracking-wide"
                  >
                    {t("replenishmentQtyCol")}
                  </SortableTh>
                  <th className="text-on-surface-variant px-4 py-2.5 text-left text-xs font-bold uppercase">
                    {t("replenishmentCostCol")}
                  </th>
                  <SortableTh
                    column="total"
                    activeColumn={sortColumn}
                    direction={sortDirection}
                    onSort={handleSort}
                    className="px-4 py-2.5 text-xs tracking-wide"
                  >
                    {t("replenishmentLineTotalCol")}
                  </SortableTh>
                  <th className="text-on-surface-variant px-4 py-2.5 text-left text-xs font-bold uppercase">
                    {t("replenishmentSourceCol")}
                  </th>
                </tr>
              </thead>
              <tbody>
                {sortedHistory.map((row) => (
                  <tr
                    key={row.id}
                    className="border-outline-variant/20 border-b last:border-b-0"
                  >
                    <td className="text-on-surface-variant px-4 py-2.5 text-xs whitespace-nowrap">
                      {formatDateTimeMediumFr(row.at)}
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="flex min-w-0 items-center gap-2">
                        <div className="relative size-8 shrink-0 overflow-hidden rounded-md">
                          <ProductCatalogImage
                            src={row.productImage}
                            alt={row.productName}
                            sizes="32px"
                          />
                        </div>
                        <span className="truncate font-medium">{row.productName}</span>
                      </div>
                    </td>
                    <td className="px-4 py-2.5 font-semibold tabular-nums">
                      {row.quantity ?? "—"}
                    </td>
                    <td className="px-4 py-2.5 tabular-nums">
                      {formatMadCompact(row.costMad, 2, locale)}
                    </td>
                    <td className="px-4 py-2.5 font-semibold tabular-nums">
                      {row.lineTotalMad != null
                        ? formatMadCompact(row.lineTotalMad, 2, locale)
                        : "—"}
                    </td>
                    <td className="px-4 py-2.5">
                      <span
                        className={cn(
                          "inline-flex rounded-md px-2 py-0.5 text-xs font-semibold",
                          row.source === "procurement"
                            ? "bg-primary/10 text-primary"
                            : "bg-secondary-container text-on-secondary-container",
                        )}
                      >
                        {sourceLabel(row.source, t)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        </section>
      )}

      <BarcodeScanDialog
        open={scanOpen}
        onOpenChange={setScanOpen}
        onScan={handleBarcodeScan}
      />
    </div>
  );
}
