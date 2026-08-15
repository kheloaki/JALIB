"use client";

import { useCallback, useState } from "react";
import { useQuery } from "convex/react";
import { useLocale } from "next-intl";

import type { Product } from "@/components/pos/types";
import { BrandStrip, type BrandStripItem } from "@/components/brands/brand-strip";
import { PosCategoryTabs } from "@/components/pos/pos-category-tabs";
import { PosKeyboardHost } from "@/components/pos/pos-keyboard-host";
import {
  PosProductContextMenu,
  type PosProductContextMenuState,
} from "@/components/pos/pos-product-context-menu";
import { PosProductGrid } from "@/components/pos/pos-product-grid";
import { EditProductDialog } from "@/components/stock/edit-product-dialog";
import { ProductBarcodeQuickDialog } from "@/components/stock/product-barcode-quick-dialog";
import { ProductImageQuickDialog } from "@/components/stock/product-image-quick-dialog";
import { ProductStockQuickDialog } from "@/components/stock/product-stock-quick-dialog";
import { PurchasePriceHistoryDialog } from "@/components/stock/purchase-price-history-dialog";
import { SellPriceDialog } from "@/components/stock/sell-price-dialog";
import { api } from "@/convex/_generated/api";
import {
  canEditSalePrice,
  canReplenishStock,
} from "@/lib/auth/permissions";
import { cn } from "@/lib/utils";

type PosCatalogSectionProps = {
  category: string;
  onCategoryChange: (category: string) => void;
  tabCategories: string[];
  brands?: BrandStripItem[];
  activeBrandId?: string | null;
  onBrandChange?: (brandId: string | null) => void;
  brandAllLabel?: string;
  products: Product[];
  onAddToCart: (product: Product) => void;
  compact?: boolean;
  className?: string;
  /** Reset product grid window when filters change (keeps scroll on load-more). */
  listResetKey?: string;
};

export function PosCatalogSection({
  category,
  onCategoryChange,
  tabCategories,
  brands = [],
  activeBrandId = null,
  onBrandChange,
  brandAllLabel = "Tout",
  products,
  onAddToCart,
  compact = false,
  className,
  listResetKey,
}: PosCatalogSectionProps) {
  const locale = useLocale();
  const isAr = locale === "ar";
  const tr = (fr: string, ar: string) => (isAr ? ar : fr);

  const currentUser = useQuery(api.authz.currentUser);
  const permissions = currentUser?.permissions ?? [];
  const canEditProduct = permissions.includes("stock.edit_products");
  const canEditSellPrice =
    canEditSalePrice(permissions) || canEditProduct;
  const canAddStock = canReplenishStock(permissions);

  const [menu, setMenu] = useState<PosProductContextMenuState | null>(null);
  const [editProduct, setEditProduct] = useState<Product | null>(null);
  const [sellProduct, setSellProduct] = useState<Product | null>(null);
  const [historyProduct, setHistoryProduct] = useState<Product | null>(null);
  const [barcodeProduct, setBarcodeProduct] = useState<Product | null>(null);
  const [imageProduct, setImageProduct] = useState<Product | null>(null);
  const [stockQuickProduct, setStockQuickProduct] = useState<Product | null>(null);

  const closeMenu = useCallback(() => setMenu(null), []);

  const openContextMenu = useCallback(
    (product: Product, clientX: number, clientY: number) => {
      setMenu({ product, x: clientX, y: clientY });
    },
    [],
  );

  return (
    <section
      className={cn(
        "pos-surface relative flex h-full min-h-0 min-w-0 flex-1 flex-col self-stretch overflow-hidden",
        className,
      )}
    >
      <PosCategoryTabs
        tabs={tabCategories}
        active={category}
        onChange={onCategoryChange}
      />
      {brands.length > 0 && onBrandChange ? (
        <BrandStrip
          brands={brands}
          activeBrandId={activeBrandId}
          onChange={onBrandChange}
          allLabel={brandAllLabel}
        />
      ) : null}
      <PosProductGrid
        products={products}
        onAddToCart={onAddToCart}
        onProductContextMenu={openContextMenu}
        compact={compact}
        listResetKey={
          listResetKey ?? `${category}\0${activeBrandId ?? ""}`
        }
      />
      <PosKeyboardHost />

      <PosProductContextMenu
        menu={menu}
        onClose={closeMenu}
        tr={tr}
        onAddToCart={onAddToCart}
        canEditProduct={canEditProduct}
        canEditSellPrice={canEditSellPrice}
        canAddStock={canAddStock}
        onEditProduct={setEditProduct}
        onOpenSellPrice={setSellProduct}
        onOpenHistory={setHistoryProduct}
        onEditBarcode={setBarcodeProduct}
        onEditImage={setImageProduct}
        onAddStock={setStockQuickProduct}
      />

      <EditProductDialog
        key={editProduct?.id ?? "pos-edit-product-closed"}
        product={editProduct}
        open={Boolean(editProduct)}
        onOpenChange={(open) => {
          if (!open) setEditProduct(null);
        }}
      />

      <ProductBarcodeQuickDialog
        key={barcodeProduct?.id ?? "pos-barcode-closed"}
        product={barcodeProduct}
        open={Boolean(barcodeProduct)}
        onOpenChange={(open) => {
          if (!open) setBarcodeProduct(null);
        }}
      />

      <ProductImageQuickDialog
        key={imageProduct?.id ?? "pos-image-closed"}
        product={imageProduct}
        open={Boolean(imageProduct)}
        onOpenChange={(open) => {
          if (!open) setImageProduct(null);
        }}
      />

      <SellPriceDialog
        key={sellProduct?.id ?? "pos-sell-price-closed"}
        product={sellProduct}
        open={Boolean(sellProduct)}
        onOpenChange={(open) => {
          if (!open) setSellProduct(null);
        }}
        onPricingUpdated={() => {
          /* Convex subscriptions refresh the catalog */
        }}
      />

      <PurchasePriceHistoryDialog
        key={historyProduct?.id ?? "pos-purchase-history-closed"}
        product={historyProduct}
        open={Boolean(historyProduct)}
        onOpenChange={(open) => {
          if (!open) setHistoryProduct(null);
        }}
        onPricingUpdated={() => {}}
      />

      <ProductStockQuickDialog
        key={stockQuickProduct?.id ?? "pos-stock-quick-closed"}
        product={stockQuickProduct}
        open={Boolean(stockQuickProduct)}
        onOpenChange={(open) => {
          if (!open) setStockQuickProduct(null);
        }}
      />
    </section>
  );
}
