"use client";

import { useMemo, useState, useDeferredValue } from "react";
import { useQuery } from "convex/react";
import { useLocale } from "next-intl";
import { PackagePlus, Search, ShoppingCart } from "lucide-react";

import { POS_SHELF_CATEGORIES } from "@/components/pos/constants";
import type { Product } from "@/components/pos/types";
import { BrandStrip } from "@/components/brands/brand-strip";
import { useAdminChrome } from "@/components/layout/admin-chrome-context";
import { ProductCatalogImage } from "@/components/products/product-catalog-image";
import { Input } from "@/components/ui/input";
import { useConvexCatalog } from "@/hooks/use-convex-catalog";
import { buildPosCategoryTabs } from "@/lib/pos/pos-categories";
import { formatPosDh } from "@/lib/pos/format-pos-dh";
import {
  buildSoldQtyByProductId,
  compareProductsByBestSellers,
  sortProductsByBestSellers,
} from "@/lib/products/product-sort";
import { filterAndRankProductsBySearch } from "@/lib/products/product-search";
import { sortProductsByStockAsc } from "@/lib/stock/stock-utils";
import { cn } from "@/lib/utils";
import { api } from "@/convex/_generated/api";

type PosDialogProductPickerProps = {
  selectedProductId: string | null;
  onSelectProduct: (product: Product) => void;
  tr: (fr: string, ar: string) => string;
  /** When "stock", shows a plus icon instead of cart (replenishment flow). */
  pickMode?: "cart" | "stock";
  className?: string;
  gridClassName?: string;
};

export function PosDialogProductPicker({
  selectedProductId,
  onSelectProduct,
  tr,
  pickMode = "cart",
  className,
  gridClassName,
}: PosDialogProductPickerProps) {
  const locale = useLocale();
  const { headerSearchQuery } = useAdminChrome();
  const { products, categories, brands, isLoading } = useConvexCatalog();
  const soldQtyRows = useQuery(api.products.soldQuantities);
  const soldQtyByProductId = useMemo(
    () => buildSoldQtyByProductId(soldQtyRows),
    [soldQtyRows],
  );
  const tabCategories = useMemo(
    () => buildPosCategoryTabs(POS_SHELF_CATEGORIES, categories),
    [categories],
  );
  const [category, setCategory] = useState("Tout");
  const [brandId, setBrandId] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const effectiveSearch = search.trim() || headerSearchQuery.trim();
  const deferredSearch = useDeferredValue(effectiveSearch);
  const activeCategory = tabCategories.includes(category) ? category : "Tout";
  const hasSearch = deferredSearch.length > 0;

  const filteredProducts = useMemo(() => {
    const base = hasSearch
      ? products
      : activeCategory === "Tout"
        ? products
        : products.filter((p) => p.category === activeCategory);
    const byBrand = brandId
      ? base.filter((p) => p.brandId === brandId)
      : base;
    if (!hasSearch) {
      return pickMode === "stock"
        ? sortProductsByStockAsc(byBrand)
        : sortProductsByBestSellers(byBrand, soldQtyByProductId);
    }
    return filterAndRankProductsBySearch(
      byBrand,
      deferredSearch,
      pickMode === "stock"
        ? undefined
        : (a, b) => compareProductsByBestSellers(a, b, soldQtyByProductId),
    );
  }, [
    activeCategory,
    brandId,
    deferredSearch,
    hasSearch,
    pickMode,
    products,
    soldQtyByProductId,
  ]);

  if (isLoading) {
    return (
      <p className="text-on-surface-variant text-sm">
        {tr("Chargement du catalogue…", "جاري تحميل المنتجات…")}
      </p>
    );
  }

  return (
    <div className={cn("flex min-h-0 flex-col gap-3", className)}>
      <div className="relative">
        <Search
          className="text-on-surface-variant pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2"
          aria-hidden
        />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={tr("Rechercher un produit…", "ابحث عن منتج…")}
          className="h-10 rounded-xl ps-9"
          dir="auto"
          lang={locale}
        />
      </div>

      <div className="no-scrollbar flex gap-1.5 overflow-x-auto pb-0.5">
        {tabCategories.map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => setCategory(tab)}
            className={cn(
              "shrink-0 rounded-lg px-3 py-1.5 text-xs font-bold transition-colors",
              tab === activeCategory && !hasSearch
                ? "bg-primary text-on-primary"
                : "bg-surface-container-low text-on-surface-variant hover:bg-surface-container-high",
            )}
          >
            {tab}
          </button>
        ))}
      </div>

      {brands.length > 0 ? (
        <BrandStrip
          brands={brands}
          activeBrandId={brandId}
          onChange={setBrandId}
          allLabel={tr("Tout", "الكل")}
          className="px-0"
        />
      ) : null}

      <div
        className={cn(
          "grid max-h-[min(50vh,360px)] grid-cols-2 gap-2 overflow-y-auto sm:grid-cols-3 lg:grid-cols-4",
          gridClassName,
        )}
      >
        {filteredProducts.length === 0 ? (
          <p className="text-on-surface-variant col-span-full py-6 text-center text-sm">
            {tr("Aucun produit trouvé.", "لم يُعثر على منتج.")}
          </p>
        ) : (
          filteredProducts.map((product) => {
            const selected = selectedProductId === product.id;
            return (
              <button
                key={product.id}
                type="button"
                onClick={() => onSelectProduct(product)}
                className={cn(
                  "border-sidebar-border/70 flex flex-col overflow-hidden rounded-xl border bg-surface-container-lowest text-start transition-all active:scale-[0.99]",
                  selected
                    ? "border-primary/50 ring-primary/25 ring-2"
                    : "hover:border-primary/25 hover:shadow-sm",
                )}
              >
                <div className="relative aspect-square w-full overflow-hidden bg-slate-100">
                  <ProductCatalogImage
                    src={product.image}
                    alt={product.imageAlt}
                    fit="cover"
                    sizes="(max-width: 640px) 40vw, 120px"
                  />
                </div>
                <div className="flex items-start justify-between gap-1 p-2">
                  <div className="min-w-0 flex-1">
                    <p className="text-on-surface line-clamp-2 text-xs leading-snug font-bold">
                      {product.name}
                    </p>
                    <p className="text-primary mt-0.5 text-sm font-black tabular-nums">
                      {formatPosDh(product.price, 2, locale)}
                    </p>
                  </div>
                  <span
                    className={cn(
                      "flex size-7 shrink-0 items-center justify-center rounded-full",
                      selected
                        ? "bg-primary text-on-primary"
                        : "bg-surface-container-low text-on-surface-variant",
                    )}
                    aria-hidden
                  >
                    {pickMode === "stock" ? (
                      <PackagePlus className="size-3.5 stroke-[1.75]" />
                    ) : (
                      <ShoppingCart className="size-3.5 stroke-[1.75]" />
                    )}
                  </span>
                </div>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}
