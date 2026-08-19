"use client";

import {
  useCallback,
  useDeferredValue,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useConvex, useMutation, usePaginatedQuery, useQuery } from "convex/react";
import type { LucideIcon } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import {
  BookMarked,
  BookOpen,
  Briefcase,
  Cpu,
  History,
  Infinity,
  LayoutGrid,
  LayoutList,
  Layers,
  Notebook,
  Palette,
  Pencil,
  PlusCircle,
  Ruler,
  ScanBarcode,
  SquarePen,
  Trash2,
} from "lucide-react";

import { useSearchParams, useRouter } from "next/navigation";

import { BarcodeScanDialog } from "@/components/products/barcode-scan-dialog";
import { AddProductDialog } from "@/components/products/add-product-dialog";
import { EditProductDialog } from "@/components/stock/edit-product-dialog";
import { ProductBarcodeQuickDialog } from "@/components/stock/product-barcode-quick-dialog";
import { ProductImageQuickDialog } from "@/components/stock/product-image-quick-dialog";
import { ProductStockQuickDialog } from "@/components/stock/product-stock-quick-dialog";
import { PurchasePriceHistoryDialog } from "@/components/stock/purchase-price-history-dialog";
import { SellPriceDialog } from "@/components/stock/sell-price-dialog";
import { StockProductAddDestinationDialog } from "@/components/stock/stock-product-add-destination-dialog";

import { useAdminChrome } from "@/components/layout/admin-chrome-context";
import { AdminFilterSummary } from "@/components/layout/admin-filter-summary";
import { ProductCatalogImage } from "@/components/products/product-catalog-image";
import type { PosCategory } from "@/components/pos/constants";
import { CATALOG_CATEGORIES } from "@/lib/catalog/categories";
import {
  PosProductContextMenu,
  type PosProductContextMenuState,
} from "@/components/pos/pos-product-context-menu";
import type { Product } from "@/components/pos/types";
import { StockCategoriesDialog } from "@/components/stock/stock-categories-dialog";
import { Button } from "@/components/ui/button";
import { ConfirmDeleteDialog } from "@/components/ui/confirm-delete-dialog";
import { useToast } from "@/components/ui/toaster";
import { useConvexCatalogMeta } from "@/hooks/use-convex-catalog";
import { useLoadMoreOnIntersect } from "@/hooks/use-load-more-on-intersect";
import {
  StockProductGridSkeleton,
  StockProductTableSkeleton,
} from "@/components/skeletons";
import { useTableGridViewMode } from "@/hooks/use-table-grid-view-mode";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import {
  canBuildProcurementList,
  canDeleteProducts,
  canEditSalePrice,
  canReplenishStock,
} from "@/lib/auth/permissions";
import { productFromConvex } from "@/lib/convex/mappers";
import { formatMad, formatMadCompact } from "@/lib/money/mad";
import { normalizeBarcodeInput } from "@/lib/pos/catalog-lookup";
import { productMatchesSearch } from "@/lib/products/product-search";
import {
  buildSoldQtyByProductId,
  compareProductsByBestSellers,
} from "@/lib/products/product-sort";
import {
  marginMad,
  marginPercent,
} from "@/lib/stock/stock-utils";
import { cn } from "@/lib/utils";

const PAGE_SIZE = 50;

const CATEGORY_ICONS: Partial<Record<string, LucideIcon>> = {
  "Livres scolaires": BookOpen,
  Lecture: BookMarked,
  "Cahiers & papier": Notebook,
  Écriture: Pencil,
  "Sacs & trousses": Briefcase,
  "Géométrie & calculatrices": Ruler,
  "Arts plastiques": Palette,
  Informatique: Cpu,
};

const CATEGORY_TAB_KEYS: Record<
  string,
  | "tabSchoolBooks"
  | "tabReading"
  | "tabNotebooks"
  | "tabWriting"
  | "tabBags"
  | "tabGeometry"
  | "tabArt"
  | "tabComputing"
> = {
  "Livres scolaires": "tabSchoolBooks",
  Lecture: "tabReading",
  "Cahiers & papier": "tabNotebooks",
  Écriture: "tabWriting",
  "Sacs & trousses": "tabBags",
  "Géométrie & calculatrices": "tabGeometry",
  "Arts plastiques": "tabArt",
  Informatique: "tabComputing",
};

const STATIC_SHELF_TABS: { id: PosCategory; label: string; icon: LucideIcon }[] = [
  { id: "Tout", label: "Tous", icon: Infinity },
  ...CATALOG_CATEGORIES.map((id) => ({
    id,
    label: id,
    icon: CATEGORY_ICONS[id] ?? LayoutGrid,
  })),
];

function shortSku(p: Product): string {
  if (p.barcode && p.barcode.length >= 8) {
    return p.barcode.slice(-6);
  }
  return p.id.slice(0, 8);
}

function stockQtyDisplay(p: Product): string {
  const qty = Math.max(0, p.stockQty);
  return qty > 0 ? String(qty) : p.stockLabel.replace(/^STOCK:\s*/i, "");
}

type StockLevelFilter = "all" | "lte0" | "lte5" | "lte10" | "lte20";
type StockSort =
  | "default"
  | "stock-asc"
  | "stock-desc"
  | "price-asc"
  | "price-desc"
  | "best-sellers"
  | "newest";

function stockFilterToMaxQty(filter: StockLevelFilter): number | undefined {
  if (filter === "lte0") return 0;
  if (filter === "lte5") return 5;
  if (filter === "lte10") return 10;
  if (filter === "lte20") return 20;
  return undefined;
}

function matchesStockLevelFilter(
  product: Product,
  filter: StockLevelFilter,
): boolean {
  if (filter === "all") return true;
  const qty = Math.max(0, product.stockQty);
  if (filter === "lte0") return qty <= 0;
  if (filter === "lte5") return qty <= 5;
  if (filter === "lte10") return qty <= 10;
  return qty <= 20;
}

function sortProducts(
  products: Product[],
  sortBy: StockSort,
  soldQtyByProductId: Map<string, number>,
): Product[] {
  const rows = [...products];
  const byName = (a: Product, b: Product) => a.name.localeCompare(b.name, "fr");
  switch (sortBy) {
    case "stock-asc":
      return rows.sort((a, b) => a.stockQty - b.stockQty || byName(a, b));
    case "stock-desc":
      return rows.sort((a, b) => b.stockQty - a.stockQty || byName(a, b));
    case "price-asc":
      return rows.sort((a, b) => a.price - b.price || byName(a, b));
    case "price-desc":
      return rows.sort((a, b) => b.price - a.price || byName(a, b));
    case "best-sellers":
      return rows.sort((a, b) =>
        compareProductsByBestSellers(a, b, soldQtyByProductId),
      );
    case "newest":
      return rows.sort(
        (a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0) || byName(a, b),
      );
    default:
      return rows.sort(byName);
  }
}

function stockLevelFilterLabel(
  filter: StockLevelFilter,
  t: (key: string) => string,
): string {
  if (filter === "lte0") return t("filterStockLte0");
  if (filter === "lte5") return t("filterStockLte5");
  if (filter === "lte10") return t("filterStockLte10");
  if (filter === "lte20") return t("filterStockLte20");
  return t("filterStockAll");
}

export function StockCatalogTab() {
  return <StockCatalogTabContent />;
}

function StockCatalogTabContent() {
  const t = useTranslations("stock");
  const locale = useLocale();
  const searchParams = useSearchParams();
  const router = useRouter();
  const toast = useToast();
  const convex = useConvex();
  const currentUser = useQuery(api.authz.currentUser);
  const permissions = currentUser?.permissions ?? [];
  const canReplenish = canReplenishStock(permissions);
  const canProcurementList = canBuildProcurementList(permissions);
  const canEditProducts = permissions.includes("stock.edit_products");
  const canEditSellPrice = canEditSalePrice(permissions) || canEditProducts;
  const canAddStock = canReplenish || canProcurementList;
  const canDelete = canDeleteProducts(permissions);
  const removeProduct = useMutation(api.products.remove);
  const { headerSearchQuery, setHeaderSearchQuery } = useAdminChrome();
  const { categories, isLoading: metaLoading } = useConvexCatalogMeta();
  const isAr = locale === "ar";
  const tr = useCallback(
    (fr: string, ar: string) => (isAr ? ar : fr),
    [isAr],
  );
  const [contextMenu, setContextMenu] =
    useState<PosProductContextMenuState | null>(null);
  const [historyProduct, setHistoryProduct] = useState<Product | null>(null);
  const [sellEditProduct, setSellEditProduct] = useState<Product | null>(null);
  const [editProduct, setEditProduct] = useState<Product | null>(null);
  const [deleteProduct, setDeleteProduct] = useState<Product | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [addDestinationProduct, setAddDestinationProduct] = useState<Product | null>(null);
  const [stockQuickProduct, setStockQuickProduct] = useState<Product | null>(null);
  const [barcodeProduct, setBarcodeProduct] = useState<Product | null>(null);
  const [imageProduct, setImageProduct] = useState<Product | null>(null);
  const [scanOpen, setScanOpen] = useState(false);
  const [addProductOpen, setAddProductOpen] = useState(false);
  const [categoriesDialogOpen, setCategoriesDialogOpen] = useState(false);
  const [tab, setTab] = useState<string>("Tout");
  const [viewMode, setViewMode] = useTableGridViewMode("grid");
  const [showMargins, setShowMargins] = useState(false);
  const [stockLevelFilter, setStockLevelFilter] = useState<StockLevelFilter>(() =>
    searchParams.get("filter") === "low" ? "lte10" : "all",
  );
  const [sortBy, setSortBy] = useState<StockSort>("best-sellers");

  const trimmedSearch = headerSearchQuery.trim();
  const deferredSearch = useDeferredValue(trimmedSearch);
  const hasSearch = deferredSearch.length > 0;
  const maxStockQty = stockFilterToMaxQty(stockLevelFilter);

  const listArgs = useMemo(() => {
    const args: {
      categoryLabel?: string;
      maxStockQty?: number;
    } = {};
    if (tab !== "Tout") args.categoryLabel = tab;
    if (maxStockQty !== undefined) args.maxStockQty = maxStockQty;
    return args;
  }, [maxStockQty, tab]);

  const { results, status, loadMore } = usePaginatedQuery(
    api.products.listSummaries,
    hasSearch ? "skip" : listArgs,
    { initialNumItems: PAGE_SIZE },
  );

  const searchRows = useQuery(
    api.products.searchSummaries,
    hasSearch ? { query: deferredSearch, limit: 80 } : "skip",
  );

  const soldQtyRows = useQuery(
    api.products.soldQuantities,
    metaLoading ? "skip" : {},
  );
  const catalogTotal = useQuery(api.products.countActive, {
    ...(!hasSearch && tab !== "Tout" ? { categoryLabel: tab } : {}),
    ...(!hasSearch && maxStockQty !== undefined ? { maxStockQty } : {}),
  });
  const isLoadingList = hasSearch
    ? searchRows === undefined
    : status === "LoadingFirstPage";
  const hydrated = !metaLoading && !isLoadingList;

  useEffect(() => {
    if (searchParams.get("add") === "1") {
      setAddProductOpen(true);
    }
  }, [searchParams]);

  const openAddProduct = useCallback(() => setAddProductOpen(true), []);

  const tabLabel = (id: string) => {
    if (id === "Tout") return t("tabAll");
    const key = CATEGORY_TAB_KEYS[id];
    return key ? t(key) : id;
  };

  const shelfTabs = useMemo(() => {
    const dynamic = categories.map((category) => ({
      id: category,
      label: tabLabel(category),
      icon: CATEGORY_ICONS[category] ?? LayoutGrid,
    }));
    if (dynamic.length === 0) {
      return STATIC_SHELF_TABS.map((item) => ({
        ...item,
        label: tabLabel(item.id),
      }));
    }
    return [
      { id: "Tout", label: t("tabAll"), icon: Infinity },
      ...dynamic,
    ];
  }, [categories, t]);

  const refreshCatalogPricing = useCallback(() => {}, []);

  async function handleBarcodeScan(raw: string) {
    const key = normalizeBarcodeInput(raw);
    const trimmed = raw.trim();
    setScanOpen(false);
    setTab("Tout");
    if (key.length > 0) {
      try {
        const row = await convex.query(api.products.findByBarcode, {
          barcode: key,
        });
        if (row) {
          setHeaderSearchQuery(
            normalizeBarcodeInput(row.barcode ?? key) || key,
          );
        } else {
          setHeaderSearchQuery(key);
          toast.info(
            t("barcodeNotFoundTitle"),
            t("barcodeNotFoundDescription"),
          );
        }
      } catch {
        setHeaderSearchQuery(key);
        toast.info(
          t("barcodeNotFoundTitle"),
          t("barcodeNotFoundDescription"),
        );
      }
      return;
    }
    if (trimmed.length > 0) {
      setHeaderSearchQuery(trimmed);
    }
  }

  const soldQtyByProductId = useMemo(
    () => buildSoldQtyByProductId(soldQtyRows),
    [soldQtyRows],
  );

  const catalog = useMemo(() => {
    if (hasSearch) {
      return (searchRows ?? []).map(productFromConvex);
    }
    return results.map(productFromConvex);
  }, [hasSearch, results, searchRows]);

  const filtered = useMemo(() => {
    const rows = catalog.filter((p) => {
      if (!matchesStockLevelFilter(p, stockLevelFilter)) return false;
      if (!hasSearch && tab !== "Tout" && p.category !== tab) return false;
      if (hasSearch) return productMatchesSearch(p, deferredSearch);
      return true;
    });
    // Paginated browse: keep Convex order so each load-more appends below
    // and does not reshuffle cards already on screen (that jumps the view up).
    if (
      !hasSearch &&
      (status === "CanLoadMore" ||
        status === "LoadingMore" ||
        status === "LoadingFirstPage")
    ) {
      return rows;
    }
    return sortProducts(rows, sortBy, soldQtyByProductId);
  }, [
    catalog,
    deferredSearch,
    hasSearch,
    soldQtyByProductId,
    sortBy,
    status,
    stockLevelFilter,
    tab,
  ]);

  const totalProductCount = catalogTotal ?? filtered.length;
  const badgeFilteredCount = hasSearch ? filtered.length : totalProductCount;

  const canLoadMore =
    !hasSearch && (status === "CanLoadMore" || status === "LoadingMore");
  const loadMoreBusy = status === "LoadingMore";
  const catalogScrollRef = useRef<HTMLElement | null>(null);
  const lockedScrollTopRef = useRef<number | null>(null);

  useEffect(() => {
    const el = catalogScrollRef.current;
    if (el) el.scrollTop = 0;
  }, [sortBy, tab, stockLevelFilter]);

  const loadMoreKeepingScroll = useCallback(() => {
    const el = catalogScrollRef.current;
    if (el) lockedScrollTopRef.current = el.scrollTop;
    loadMore(PAGE_SIZE);
  }, [loadMore]);

  const loadMoreSentinelRef = useLoadMoreOnIntersect(
    canLoadMore && status === "CanLoadMore",
    loadMoreBusy,
    loadMoreKeepingScroll,
    catalogScrollRef,
  );

  useLayoutEffect(() => {
    const locked = lockedScrollTopRef.current;
    if (locked == null) return;
    const el = catalogScrollRef.current;
    if (el) el.scrollTop = locked;
    // Hold the lock through LoadingMore re-renders so a client re-sort
    // cannot leave the list scrolled back to the top.
    if (status !== "LoadingMore") {
      lockedScrollTopRef.current = null;
    }
  }, [filtered, status]);

  function clearStockLevelFilter() {
    setStockLevelFilter("all");
    const params = new URLSearchParams(searchParams.toString());
    params.delete("filter");
    const qs = params.toString();
    router.replace(qs ? `?${qs}` : "?", { scroll: false });
  }

  function updateStockLevelFilter(next: StockLevelFilter) {
    setStockLevelFilter(next);
    const params = new URLSearchParams(searchParams.toString());
    if (next === "lte10") {
      params.set("filter", "low");
    } else {
      params.delete("filter");
    }
    const qs = params.toString();
    router.replace(qs ? `?${qs}` : "?", { scroll: false });
  }

  const stats = useMemo(() => {
    let low = 0;
    let costTotal = 0;
    let sellTotal = 0;
    let countedLines = 0;
    for (const p of filtered) {
      const qty = Math.max(0, p.stockQty);
      if (qty <= 10) low += 1;
      if (qty > 0) {
        countedLines += 1;
        sellTotal += p.price * qty;
        if (p.costMad && p.costMad > 0) {
          costTotal += p.costMad * qty;
        }
      }
    }
    return {
      skuCount: filtered.length,
      low,
      costTotal,
      sellTotal,
      countedLines,
    };
  }, [filtered]);

  const closeContextMenu = useCallback(() => setContextMenu(null), []);
  const openContextMenu = useCallback(
    (product: Product, clientX: number, clientY: number) => {
      setContextMenu({ product, x: clientX, y: clientY });
    },
    [],
  );

  const productActions = {
    onEditProduct: setEditProduct,
    onDeleteProduct: canDelete ? setDeleteProduct : undefined,
    onAddProduct: setAddDestinationProduct,
    onOpenHistory: setHistoryProduct,
    onOpenSellPrice: setSellEditProduct,
    onProductContextMenu: openContextMenu,
  };

  async function handleConfirmDeleteProduct() {
    if (!deleteProduct) return;
    setDeleting(true);
    try {
      await removeProduct({
        productId: deleteProduct.id as Id<"products">,
      });
      toast.success(
        locale === "ar" ? "تم حذف المنتج" : "Produit supprimé",
        deleteProduct.name,
      );
      setDeleteProduct(null);
    } catch (error) {
      toast.error(
        locale === "ar" ? "تعذر الحذف" : "Suppression impossible",
        error instanceof Error ? error.message : "DELETE_FAILED",
      );
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div
      id="stock-catalog-print-area"
      data-print-root=""
      className="bg-surface text-on-background flex min-h-0 flex-1 flex-col print:bg-white"
    >
      <main
        ref={catalogScrollRef}
        className="w-full flex-1 overflow-auto px-3 pt-2 sm:p-6 lg:p-8 [overflow-anchor:none]"
      >
        <div className="mb-3 rounded-2xl bg-surface-container-lowest p-3 shadow-sm sm:mb-4 sm:p-4 lg:p-6 print:hidden">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between xl:gap-4">
            <div className="grid w-full grid-cols-1 gap-2 sm:grid-cols-3 sm:gap-3 xl:min-w-0 xl:max-w-3xl xl:flex-1">
              <label className="min-w-0 space-y-1">
                <span className="text-on-surface-variant block text-[10px] font-bold tracking-wide uppercase sm:text-xs">
                  {t("colCategory")}
                </span>
                <select
                  value={tab}
                  onChange={(event) => setTab(event.target.value)}
                  className="bg-surface-container-low border-sidebar-border text-on-surface focus:ring-primary/20 h-10 w-full min-w-0 rounded-xl border px-3 py-2 text-sm focus:ring-2 sm:h-11"
                >
                  {shelfTabs.map((shelfTab) => (
                    <option key={shelfTab.id} value={shelfTab.id}>
                      {shelfTab.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="min-w-0 space-y-1">
                <span className="text-on-surface-variant block text-[10px] font-bold tracking-wide uppercase sm:text-xs">
                  {t("filterStock")}
                </span>
                <select
                  value={stockLevelFilter}
                  onChange={(event) =>
                    updateStockLevelFilter(event.target.value as StockLevelFilter)
                  }
                  className="bg-surface-container-low border-sidebar-border text-on-surface focus:ring-primary/20 h-10 w-full min-w-0 rounded-xl border px-3 py-2 text-sm focus:ring-2 sm:h-11"
                >
                  <option value="all">{t("filterStockAll")}</option>
                  <option value="lte0">{t("filterStockLte0")}</option>
                  <option value="lte5">{t("filterStockLte5")}</option>
                  <option value="lte10">{t("filterStockLte10")}</option>
                  <option value="lte20">{t("filterStockLte20")}</option>
                </select>
              </label>
              <label className="min-w-0 space-y-1">
                <span className="text-on-surface-variant block text-[10px] font-bold tracking-wide uppercase sm:text-xs">
                  {t("sortBy")}
                </span>
                <select
                  value={sortBy}
                  onChange={(event) =>
                    setSortBy(event.target.value as StockSort)
                  }
                  className="bg-surface-container-low border-sidebar-border text-on-surface focus:ring-primary/20 h-10 w-full min-w-0 rounded-xl border px-3 py-2 text-sm focus:ring-2 sm:h-11"
                >
                  <option value="default">{t("sortDefault")}</option>
                  <option value="stock-asc">{t("sortStockAsc")}</option>
                  <option value="stock-desc">{t("sortStockDesc")}</option>
                  <option value="price-asc">{t("sortPriceAsc")}</option>
                  <option value="price-desc">{t("sortPriceDesc")}</option>
                  <option value="best-sellers">{t("sortBestSellers")}</option>
                  <option value="newest">{t("sortNewest")}</option>
                </select>
              </label>
            </div>

            <div className="flex flex-wrap items-center gap-2 xl:shrink-0 xl:justify-end">
              <button
                type="button"
                onClick={() => setShowMargins((value) => !value)}
                className={cn(
                  "h-10 shrink-0 rounded-xl px-3 text-xs font-semibold transition-colors sm:h-11 sm:px-4 sm:text-sm",
                  showMargins
                    ? "bg-secondary-container/50 text-on-secondary-container"
                    : "bg-surface-container-low text-on-surface-variant hover:bg-surface-container-highest hover:text-on-surface",
                )}
                aria-pressed={showMargins}
              >
                {showMargins ? t("hideMargins") : t("showMargins")}
              </button>

              <Button
                type="button"
                variant="outline"
                className="h-10 shrink-0 gap-2 rounded-xl px-3 text-xs font-bold sm:h-11 sm:px-5 sm:text-sm"
                onClick={() => setScanOpen(true)}
              >
                <ScanBarcode className="size-4 stroke-[1.75]" aria-hidden />
                {t("scanButton")}
              </Button>
              {canEditProducts ? (
                <Button
                  type="button"
                  variant="outline"
                  className="h-10 shrink-0 gap-2 rounded-xl px-3 text-xs font-bold sm:h-11 sm:px-5 sm:text-sm"
                  onClick={() => setCategoriesDialogOpen(true)}
                >
                  <Layers className="size-4 stroke-[1.75]" aria-hidden />
                  {t("manageCategories")}
                </Button>
              ) : null}
              <Button
                type="button"
                className="h-10 shrink-0 gap-2 rounded-xl px-3 text-xs font-bold sm:h-11 sm:px-5 sm:text-sm"
                onClick={openAddProduct}
              >
                <PlusCircle className="size-4 stroke-[1.75]" aria-hidden />
                {t("addProduct")}
              </Button>
            </div>
          </div>
        </div>

        <div className="mb-3 flex flex-col gap-3 sm:mb-4 sm:flex-row sm:items-center sm:justify-between print:hidden">
          <AdminFilterSummary
            filteredCount={hydrated ? badgeFilteredCount : 0}
            totalCount={hydrated ? totalProductCount : 0}
            searchQuery={headerSearchQuery}
            onClearSearch={() => setHeaderSearchQuery("")}
            extraActive={
              tab !== "Tout" ||
              stockLevelFilter !== "all" ||
              sortBy !== "best-sellers"
            }
            extraLabel={
              stockLevelFilter !== "all"
                ? `${t("filterStock")}: ${stockLevelFilterLabel(stockLevelFilter, t)}`
                : tab !== "Tout"
                  ? `${t("colCategory")}: ${tabLabel(tab)}`
                  : sortBy !== "best-sellers"
                    ? t(
                        sortBy === "stock-asc"
                          ? "sortStockAsc"
                          : sortBy === "stock-desc"
                            ? "sortStockDesc"
                            : sortBy === "price-asc"
                              ? "sortPriceAsc"
                              : sortBy === "price-desc"
                                ? "sortPriceDesc"
                                : sortBy === "default"
                                  ? "sortDefault"
                                  : "sortNewest",
                      )
                    : undefined
            }
            onClearExtra={
              stockLevelFilter !== "all"
                ? clearStockLevelFilter
                : tab !== "Tout"
                  ? () => setTab("Tout")
                  : sortBy !== "best-sellers"
                    ? () => setSortBy("best-sellers")
                    : undefined
            }
            itemLabel={locale === "ar" ? "منتج" : "produit"}
            itemLabelPlural={locale === "ar" ? "منتجات" : "produits"}
          />

          <div
            className="bg-surface-container-low flex w-fit shrink-0 items-center gap-1 rounded-xl p-1"
            role="group"
            aria-label={t("viewModeLabel")}
          >
            <button
              type="button"
              onClick={() => setViewMode("table")}
              className={cn(
                "flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold transition-colors",
                viewMode === "table"
                  ? "bg-surface-container-lowest text-primary shadow-sm"
                  : "text-on-surface-variant hover:text-on-surface",
              )}
              aria-pressed={viewMode === "table"}
            >
              <LayoutList className="size-4" aria-hidden />
              {t("viewTable")}
            </button>
            <button
              type="button"
              onClick={() => setViewMode("grid")}
              className={cn(
                "flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold transition-colors",
                viewMode === "grid"
                  ? "bg-surface-container-lowest text-primary shadow-sm"
                  : "text-on-surface-variant hover:text-on-surface",
              )}
              aria-pressed={viewMode === "grid"}
            >
              <LayoutGrid className="size-4" aria-hidden />
              {t("viewGrid")}
            </button>
          </div>
        </div>

        <div className="sr-only" aria-live="polite">
          {t("referencesFiltered")}: {hydrated ? stats.skuCount : "—"}.{" "}
          {t("stockAlerts")}: {hydrated ? stats.low : "—"}.{" "}
          {t("saleValuation")}:{" "}
          {hydrated && stats.countedLines > 0
            ? formatMad(stats.sellTotal, 0, locale)
            : "—"}
        </div>

        {!hydrated ? (
          viewMode === "grid" ? (
            <StockProductGridSkeleton />
          ) : (
            <StockProductTableSkeleton />
          )
        ) : filtered.length === 0 ? (
          <p className="text-on-surface-variant text-sm">
            {t("noProductsForFilter")}
          </p>
        ) : (
          <div className="flex flex-col gap-4">
            {viewMode === "table" ? (
              <StockProductTable
                products={filtered}
                locale={locale}
                showMargins={showMargins}
                {...productActions}
              />
            ) : (
              <StockProductGrid
                products={filtered}
                locale={locale}
                showMargins={showMargins}
                {...productActions}
              />
            )}
            {canLoadMore ? (
              <div
                ref={loadMoreSentinelRef}
                className="flex justify-center py-3 print:hidden"
                aria-hidden
              >
                {status === "LoadingMore" ? (
                  <p className="text-on-surface-variant text-xs font-medium">
                    {locale === "ar" ? "جاري التحميل…" : "Chargement…"}
                  </p>
                ) : (
                  <span className="h-1 w-1" />
                )}
              </div>
            ) : null}
          </div>
        )}
      </main>

      <PosProductContextMenu
        menu={contextMenu}
        onClose={closeContextMenu}
        tr={tr}
        showAddToCart={false}
        canEditProduct={canEditProducts}
        canEditSellPrice={canEditSellPrice}
        canAddStock={canAddStock}
        canDeleteProduct={canDelete}
        onEditProduct={setEditProduct}
        onOpenSellPrice={setSellEditProduct}
        onOpenHistory={setHistoryProduct}
        onEditBarcode={setBarcodeProduct}
        onEditImage={setImageProduct}
        onAddStock={setStockQuickProduct}
        onDeleteProduct={canDelete ? setDeleteProduct : undefined}
      />

      <AddProductDialog open={addProductOpen} onOpenChange={setAddProductOpen} />

      <BarcodeScanDialog
        open={scanOpen}
        onOpenChange={setScanOpen}
        onScan={handleBarcodeScan}
      />

      <EditProductDialog
        key={editProduct?.id ?? "edit-product-closed"}
        product={editProduct}
        open={Boolean(editProduct)}
        onOpenChange={(open) => {
          if (!open) setEditProduct(null);
        }}
      />

      <ProductBarcodeQuickDialog
        key={barcodeProduct?.id ?? "barcode-quick-closed"}
        product={barcodeProduct}
        open={Boolean(barcodeProduct)}
        onOpenChange={(open) => {
          if (!open) setBarcodeProduct(null);
        }}
      />

      <ProductImageQuickDialog
        key={imageProduct?.id ?? "image-quick-closed"}
        product={imageProduct}
        open={Boolean(imageProduct)}
        onOpenChange={(open) => {
          if (!open) setImageProduct(null);
        }}
      />

      <ConfirmDeleteDialog
        open={deleteProduct !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteProduct(null);
        }}
        entityName={deleteProduct?.name ?? ""}
        confirmText={deleteProduct?.name ?? ""}
        title={
          locale === "ar" ? "حذف هذا المنتج؟" : "Supprimer ce produit ?"
        }
        description={
          locale === "ar"
            ? "سيختفي المنتج من الكتالوج والصندوق. اكتب اسم المنتج تمامًا للتأكيد."
            : "Le produit disparaîtra du catalogue et de la caisse. Tapez le nom exact pour confirmer."
        }
        typePrompt={
          locale === "ar"
            ? `اكتب « ${deleteProduct?.name ?? ""} » للتأكيد`
            : `Tapez « ${deleteProduct?.name ?? ""} » pour confirmer`
        }
        confirmLabel={locale === "ar" ? "حذف نهائي" : "Supprimer définitivement"}
        cancelLabel={locale === "ar" ? "إلغاء" : "Annuler"}
        busy={deleting}
        onConfirm={handleConfirmDeleteProduct}
      />

      <ProductStockQuickDialog
        key={stockQuickProduct?.id ?? "stock-quick-closed"}
        product={stockQuickProduct}
        open={Boolean(stockQuickProduct)}
        onOpenChange={(open) => {
          if (!open) setStockQuickProduct(null);
        }}
      />

      <StockProductAddDestinationDialog
        key={addDestinationProduct?.id ?? "add-destination-closed"}
        product={addDestinationProduct}
        open={Boolean(addDestinationProduct)}
        onOpenChange={(open) => {
          if (!open) setAddDestinationProduct(null);
        }}
        canReplenishment={canReplenish}
        canProcurement={canProcurementList}
      />

      <PurchasePriceHistoryDialog
        key={historyProduct?.id ?? "purchase-history-closed"}
        product={historyProduct}
        open={Boolean(historyProduct)}
        onOpenChange={(open) => {
          if (!open) setHistoryProduct(null);
        }}
        onPricingUpdated={refreshCatalogPricing}
      />

      <SellPriceDialog
        key={sellEditProduct?.id ?? "sell-price-closed"}
        product={sellEditProduct}
        open={Boolean(sellEditProduct)}
        onOpenChange={(open) => {
          if (!open) setSellEditProduct(null);
        }}
        onPricingUpdated={refreshCatalogPricing}
      />

      <StockCategoriesDialog
        open={categoriesDialogOpen}
        onOpenChange={setCategoriesDialogOpen}
      />
    </div>
  );
}

type StockProductCallbacks = {
  onEditProduct: (p: Product) => void;
  onDeleteProduct?: (p: Product) => void;
  onAddProduct: (p: Product) => void;
  onOpenHistory: (p: Product) => void;
  onOpenSellPrice: (p: Product) => void;
  onProductContextMenu?: (
    product: Product,
    clientX: number,
    clientY: number,
  ) => void;
};

type StockProductActionsProps = StockProductCallbacks & {
  product: Product;
  compact?: boolean;
};

function StockProductActions({
  product,
  onEditProduct,
  onDeleteProduct,
  onAddProduct,
  onOpenHistory,
  onOpenSellPrice,
  compact = false,
}: StockProductActionsProps) {
  const t = useTranslations("stock");
  const locale = useLocale();
  const isAr = locale === "ar";
  const tr = (fr: string, ar: string) => (isAr ? ar : fr);

  if (compact) {
    return (
      <div className="flex items-center justify-between gap-1 print:hidden">
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="border-outline-variant/50 bg-surface-container-low text-on-surface hover:bg-surface-container-high size-7 rounded-lg"
          onClick={() => onEditProduct(product)}
          aria-label={t("editProduct")}
          title={t("editProduct")}
        >
          <SquarePen className="size-3.5" aria-hidden />
        </Button>
        {onDeleteProduct ? (
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="border-error/35 bg-error-container/40 text-on-error-container hover:bg-error-container size-7 rounded-lg"
            onClick={() => onDeleteProduct(product)}
            aria-label={tr("Supprimer", "حذف")}
            title={tr("Supprimer", "حذف")}
          >
            <Trash2 className="size-3.5" aria-hidden />
          </Button>
        ) : null}
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="border-secondary/35 bg-secondary-container/55 text-on-secondary-container hover:bg-secondary-container size-7 rounded-lg"
          onClick={() => onAddProduct(product)}
          aria-label={t("addProductAction")}
          title={t("addProductAction")}
        >
          <PlusCircle className="size-3.5" aria-hidden />
        </Button>
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="border-tertiary/30 bg-tertiary-fixed-dim/35 text-tertiary hover:bg-tertiary-fixed-dim/50 size-7 rounded-lg"
          onClick={() => onOpenHistory(product)}
          aria-label={t("purchaseHistory")}
          title={t("purchaseHistory")}
        >
          <History className="size-3.5" aria-hidden />
        </Button>
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="border-primary bg-primary text-primary-foreground hover:bg-primary/90 size-7 rounded-lg"
          onClick={() => onOpenSellPrice(product)}
          aria-label={t("sellPrice")}
          title={t("sellPrice")}
        >
          <span className="text-[9px] leading-none font-black">PV</span>
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap justify-end gap-1.5 print:hidden">
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="h-8 gap-1.5 rounded-lg px-2.5 text-xs font-bold"
        onClick={() => onEditProduct(product)}
      >
        <SquarePen className="size-3.5" aria-hidden />
        {t("editProduct")}
      </Button>
      {onDeleteProduct ? (
        <Button
          type="button"
          variant="destructive"
          size="sm"
          className="h-8 gap-1.5 rounded-lg px-2.5 text-xs font-bold"
          onClick={() => onDeleteProduct(product)}
        >
          <Trash2 className="size-3.5" aria-hidden />
          {tr("Supprimer", "حذف")}
        </Button>
      ) : null}
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="border-secondary/30 text-secondary h-8 gap-1.5 rounded-lg px-2.5 text-xs font-bold"
        onClick={() => onAddProduct(product)}
      >
        <PlusCircle className="size-3.5" aria-hidden />
        {t("addProductAction")}
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="text-primary h-8 gap-1.5 rounded-lg px-2.5 text-xs font-bold"
        onClick={() => onOpenHistory(product)}
      >
        <History className="size-3.5" aria-hidden />
        {t("purchaseHistory")}
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="text-on-surface-variant h-8 gap-1 rounded-lg px-2 text-xs font-bold"
        onClick={() => onOpenSellPrice(product)}
      >
        <Pencil className="size-3" aria-hidden />
        {t("edit")}
      </Button>
    </div>
  );
}

function StockMarginBadge({
  product,
  locale,
}: {
  product: Product;
  locale: string;
}) {
  const cost = product.costMad;
  const pct = cost && cost > 0 ? marginPercent(cost, product.price) : null;
  const mad = cost && cost > 0 ? marginMad(cost, product.price) : null;
  const marginPositive = mad !== null && mad >= 0;

  if (pct === null || mad === null) {
    return <span className="text-on-surface-variant text-sm">—</span>;
  }

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md px-2 py-0.5 text-xs font-bold whitespace-nowrap",
        marginPositive
          ? "bg-secondary-container text-on-secondary-container"
          : "bg-error-container text-on-error-container",
      )}
    >
      {marginPositive ? "+" : ""}
      {pct.toFixed(1)}% ({formatMadCompact(mad, 2, locale)})
    </span>
  );
}

function StockQtyBadge({ product }: { product: Product }) {
  const qty = Math.max(0, product.stockQty);
  const lowStock = qty <= 10;

  return (
    <div className="flex items-center gap-2">
      <span
        className={cn(
          "size-2 shrink-0 rounded-full",
          lowStock ? "bg-error" : "bg-secondary",
        )}
        aria-hidden
      />
      <span className="text-sm font-bold tabular-nums">{stockQtyDisplay(product)}</span>
    </div>
  );
}

function StockGridStockBadge({ product }: { product: Product }) {
  const qty = Math.max(0, product.stockQty);

  return (
    <span
      className={cn(
        "absolute top-1.5 right-1.5 z-[1] rounded-md px-2 py-0.5 text-xs font-black tabular-nums shadow-sm",
        product.stockLow
          ? "bg-error-container text-on-error-container"
          : "bg-secondary-container text-on-secondary-container",
      )}
    >
      {qty > 0 ? qty : "—"}
    </span>
  );
}

function StockGridPriceOverlay({
  product,
  locale,
}: {
  product: Product;
  locale: string;
}) {
  const cost = product.costMad;

  return (
    <div className="absolute inset-x-0 bottom-0 z-[1] flex items-end justify-between gap-1 bg-gradient-to-t from-black/75 via-black/45 to-transparent px-1.5 pt-5 pb-1.5">
      <span className="rounded bg-black/50 px-1.5 py-0.5 text-[9px] leading-none font-bold text-white tabular-nums sm:text-[10px]">
        PA{" "}
        {cost && cost > 0 ? formatMadCompact(cost, 2, locale) : "—"}
      </span>
      <span className="bg-primary rounded px-1.5 py-0.5 text-[9px] leading-none font-bold text-white tabular-nums sm:text-[10px]">
        PV {formatMadCompact(product.price, 2, locale)}
      </span>
    </div>
  );
}

function StockGridMeta({
  product,
  locale,
  showMargins,
}: {
  product: Product;
  locale: string;
  showMargins: boolean;
}) {
  if (!showMargins) return null;

  return (
    <p className="text-on-surface-variant text-xs tabular-nums">
      <StockMarginBadge product={product} locale={locale} />
    </p>
  );
}

function StockProductTable({
  products,
  locale,
  showMargins,
  onEditProduct,
  onDeleteProduct,
  onAddProduct,
  onOpenHistory,
  onOpenSellPrice,
  onProductContextMenu,
}: {
  products: Product[];
  locale: string;
  showMargins: boolean;
} & StockProductCallbacks) {
  const t = useTranslations("stock");
  const longPressTimer = useRef<number | null>(null);
  const clearLongPress = useCallback(() => {
    if (longPressTimer.current != null) {
      window.clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  }, []);

  return (
    <div className="border-outline-variant/40 bg-surface-container-lowest overflow-hidden rounded-xl border shadow-sm print:shadow-none">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[960px] border-collapse text-left text-sm">
          <thead>
            <tr className="border-outline-variant/40 bg-surface-container-low border-b">
              <th className="text-on-surface-variant px-4 py-3 text-xs font-bold tracking-wide uppercase">
                {t("colProduct")}
              </th>
              <th className="text-on-surface-variant px-4 py-3 text-xs font-bold tracking-wide uppercase">
                {t("colCategory")}
              </th>
              <th className="text-on-surface-variant px-4 py-3 text-xs font-bold tracking-wide uppercase">
                {t("purchasePrice")}
              </th>
              <th className="text-on-surface-variant px-4 py-3 text-xs font-bold tracking-wide uppercase">
                {t("sellPrice")}
              </th>
              {showMargins ? (
                <th className="text-on-surface-variant px-4 py-3 text-xs font-bold tracking-wide uppercase">
                  {t("margin")}
                </th>
              ) : null}
              <th className="text-on-surface-variant px-4 py-3 text-xs font-bold tracking-wide uppercase">
                {t("stock")}
              </th>
              <th className="text-on-surface-variant px-4 py-3 text-xs font-bold tracking-wide uppercase print:hidden">
                {t("colActions")}
              </th>
            </tr>
          </thead>
          <tbody>
            {products.map((p) => {
              const cost = p.costMad;
              return (
                <tr
                  key={p.id}
                  onContextMenu={(e) => {
                    if (!onProductContextMenu) return;
                    e.preventDefault();
                    onProductContextMenu(p, e.clientX, e.clientY);
                  }}
                  onTouchStart={(e) => {
                    if (!onProductContextMenu) return;
                    const touch = e.touches[0];
                    if (!touch) return;
                    clearLongPress();
                    longPressTimer.current = window.setTimeout(() => {
                      longPressTimer.current = null;
                      onProductContextMenu(p, touch.clientX, touch.clientY);
                    }, 520);
                  }}
                  onTouchEnd={clearLongPress}
                  onTouchMove={clearLongPress}
                  onTouchCancel={clearLongPress}
                  className="border-outline-variant/20 hover:bg-surface-container-low/60 border-b transition-colors last:border-b-0"
                >
                  <td className="px-4 py-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="bg-surface-container-low relative size-12 shrink-0 overflow-hidden rounded-lg">
                        <ProductCatalogImage
                          src={p.image}
                          alt={p.imageAlt}
                          className="mix-blend-multiply dark:mix-blend-normal"
                          sizes="48px"
                        />
                      </div>
                      <div className="min-w-0">
                        <p className="text-on-background truncate font-semibold">{p.name}</p>
                        <p className="text-on-surface-variant font-mono text-xs tabular-nums">
                          {shortSku(p)}
                          {p.barcode ? ` · ${p.barcode}` : ""}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="text-on-surface px-4 py-3 font-medium">{p.category}</td>
                  <td className="px-4 py-3 tabular-nums">
                    {cost && cost > 0 ? (
                      formatMadCompact(cost, 2, locale)
                    ) : (
                      <span className="text-on-surface-variant">—</span>
                    )}
                  </td>
                  <td className="text-on-background px-4 py-3 font-bold tabular-nums">
                    {formatMadCompact(p.price, 2, locale)}
                  </td>
                  {showMargins ? (
                    <td className="px-4 py-3">
                      <StockMarginBadge product={p} locale={locale} />
                    </td>
                  ) : null}
                  <td className="px-4 py-3">
                    <StockQtyBadge product={p} />
                  </td>
                  <td
                    className="px-4 py-3 print:hidden"
                    onContextMenu={(e) => e.stopPropagation()}
                    onTouchStart={(e) => e.stopPropagation()}
                  >
                    <StockProductActions
                      product={p}
                      onEditProduct={onEditProduct}
                      onDeleteProduct={onDeleteProduct}
                      onAddProduct={onAddProduct}
                      onOpenHistory={onOpenHistory}
                      onOpenSellPrice={onOpenSellPrice}
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function StockProductGrid({
  products,
  locale,
  showMargins,
  onEditProduct,
  onDeleteProduct,
  onAddProduct,
  onOpenHistory,
  onOpenSellPrice,
  onProductContextMenu,
}: {
  products: Product[];
  locale: string;
  showMargins: boolean;
} & StockProductCallbacks) {
  const longPressTimer = useRef<number | null>(null);
  const clearLongPress = useCallback(() => {
    if (longPressTimer.current != null) {
      window.clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  }, []);

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
      {products.map((p) => (
        <article
          key={p.id}
          onContextMenu={(e) => {
            if (!onProductContextMenu) return;
            e.preventDefault();
            onProductContextMenu(p, e.clientX, e.clientY);
          }}
          onTouchStart={(e) => {
            if (!onProductContextMenu) return;
            const touch = e.touches[0];
            if (!touch) return;
            clearLongPress();
            longPressTimer.current = window.setTimeout(() => {
              longPressTimer.current = null;
              onProductContextMenu(p, touch.clientX, touch.clientY);
            }, 520);
          }}
          onTouchEnd={clearLongPress}
          onTouchMove={clearLongPress}
          onTouchCancel={clearLongPress}
          className="border-outline-variant/30 bg-surface-container-lowest flex flex-col overflow-hidden rounded-xl border shadow-sm transition-shadow hover:shadow-md print:break-inside-avoid"
        >
          <div className="bg-surface-container-low relative aspect-square w-full overflow-hidden">
            <ProductCatalogImage
              src={p.image}
              alt={p.imageAlt}
              className="mix-blend-multiply dark:mix-blend-normal"
              sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 16vw"
            />
            <StockGridStockBadge product={p} />
            <StockGridPriceOverlay product={p} locale={locale} />
          </div>

          <div className="flex flex-1 flex-col gap-1.5 p-2 sm:gap-2 sm:p-2.5">
            <div className="min-w-0">
              <p className="text-primary truncate text-[11px] font-semibold">{p.category}</p>
              <h2 className="text-on-background line-clamp-1 text-sm leading-snug font-bold">
                {p.name}
              </h2>
            </div>

            <StockGridMeta product={p} locale={locale} showMargins={showMargins} />

            <div
              onContextMenu={(e) => e.stopPropagation()}
              onTouchStart={(e) => e.stopPropagation()}
            >
              <StockProductActions
                product={p}
                onEditProduct={onEditProduct}
                onDeleteProduct={onDeleteProduct}
                onAddProduct={onAddProduct}
                onOpenHistory={onOpenHistory}
                onOpenSellPrice={onOpenSellPrice}
                compact
              />
            </div>
          </div>
        </article>
      ))}
    </div>
  );
}
