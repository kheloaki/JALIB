"use client";

import { useState } from "react";
import { X } from "lucide-react";

import { PosCartPriceKeypadDialog } from "@/components/pos/pos-cart-price-keypad-dialog";
import { PosCartQtyKeypadDialog } from "@/components/pos/pos-cart-qty-keypad-dialog";
import { PosCartWeightKeypadDialog } from "@/components/pos/pos-cart-weight-keypad-dialog";
import { POS_CUSTOM_PRODUCT_PLACEHOLDER_IMAGE } from "@/components/pos/constants";
import type { CartLine } from "@/components/pos/types";
import { ProductCatalogImage } from "@/components/products/product-catalog-image";
import {
  cartLineTotalMad,
  formatCartQtyDisplay,
} from "@/lib/pos/cart-qty";
import { formatPosDh } from "@/lib/pos/format-pos-dh";
import { cn } from "@/lib/utils";

type PosCartLineItemProps = {
  line: CartLine;
  locale: string;
  tr: (fr: string, ar: string) => string;
  onQtyChange: (productId: string, qty: number) => void;
  onUnitPriceChange: (productId: string, unitPriceMad: number) => void;
  allowPriceEdit?: boolean;
  minQtyOne?: boolean;
  compact?: boolean;
};

const actionButtonClass =
  "shrink-0 rounded-lg border transition-colors active:scale-[0.98] focus-visible:ring-primary/30 focus-visible:ring-2 focus-visible:outline-none";

export function PosCartLineItem({
  line,
  locale,
  tr,
  onQtyChange,
  onUnitPriceChange,
  allowPriceEdit = true,
  minQtyOne = false,
  compact = false,
}: PosCartLineItemProps) {
  const [qtyKeypadOpen, setQtyKeypadOpen] = useState(false);
  const [weightKeypadOpen, setWeightKeypadOpen] = useState(false);
  const [priceKeypadOpen, setPriceKeypadOpen] = useState(false);
  const minQty = minQtyOne ? 1 : 0;
  const soldByWeight = line.soldByWeight === true;
  const missingPrice =
    !Number.isFinite(line.unitPrice) || line.unitPrice <= 0;
  const canSetPrice = allowPriceEdit || missingPrice;

  const imageSrc = line.image || POS_CUSTOM_PRODUCT_PLACEHOLDER_IMAGE;
  const imageAlt = line.imageAlt || line.name;
  const totalDh = formatPosDh(cartLineTotalMad(line), 2, locale);
  const qtyLabel = formatCartQtyDisplay(line.qty, soldByWeight, locale);

  return (
    <>
      <article
        className={cn(
          "pos-line-card flex w-full flex-col",
          compact ? "gap-1 p-1.5" : "gap-1.5 p-2",
        )}
      >
        <div className="flex gap-2">
          <div
            className={cn(
              "relative shrink-0 overflow-hidden rounded-md bg-slate-100",
              compact ? "size-10" : "size-12",
            )}
          >
            <ProductCatalogImage src={imageSrc} alt={imageAlt} sizes={compact ? "40px" : "48px"} />
          </div>

          <div className="flex min-w-0 flex-1 items-start gap-1.5">
            <div className="min-w-0 flex-1">
              <h4
                className={cn(
                  "text-on-surface line-clamp-2 leading-tight font-bold",
                  compact ? "text-xs" : "text-sm",
                )}
              >
                {line.name}
              </h4>
              {line.costMad != null &&
              Number.isFinite(line.costMad) &&
              line.costMad > 0 ? (
                <p
                  className="text-on-surface-variant mt-0.5 text-[10px] leading-tight font-semibold tabular-nums"
                  title={tr("Prix d’achat", "سعر الشراء")}
                >
                  {tr("Achat", "شراء")}{" "}
                  {formatPosDh(line.costMad, 2, locale)}
                </p>
              ) : null}
            </div>
            <button
              type="button"
              onClick={() => onQtyChange(line.productId, 0)}
              className={cn(
                actionButtonClass,
                "border-error/25 bg-error/10 text-error hover:bg-error/15",
                "flex items-center justify-center",
                compact ? "size-8" : "size-9",
              )}
              aria-label={tr("Retirer du panier", "إزالة من السلة")}
              title={tr("Retirer", "إزالة")}
            >
              <X className="size-4 stroke-[2.5]" aria-hidden />
            </button>
          </div>
        </div>

        <div className="flex min-w-0 items-center gap-1.5">
          {canSetPrice ? (
            <button
              type="button"
              onClick={() => setPriceKeypadOpen(true)}
              className={cn(
                actionButtonClass,
                missingPrice
                  ? "border-error/40 bg-error-container/40 text-error hover:bg-error-container/60 ring-error/20 ring-2"
                  : "border-sidebar-border/70 bg-surface-container-low hover:bg-surface-container-high",
                "min-w-[3rem] px-2 py-1.5 text-start",
              )}
              aria-label={tr(
                soldByWeight
                  ? `Prix au kg pour ${line.name}`
                  : missingPrice
                    ? `Saisir le prix pour ${line.name}`
                    : `Modifier le prix pour ${line.name}`,
                soldByWeight
                  ? `سعر الكيلو لـ ${line.name}`
                  : missingPrice
                    ? `إدخال السعر لـ ${line.name}`
                    : `تعديل السعر لـ ${line.name}`,
              )}
            >
              <span
                className={cn(
                  "inline-flex items-baseline gap-0.5 text-sm leading-none font-black whitespace-nowrap tabular-nums",
                  missingPrice ? "text-error" : "text-on-surface",
                )}
              >
                <span>
                  {missingPrice
                    ? tr("Prix ?", "السعر؟")
                    : formatPosDh(line.unitPrice, 2, locale)}
                </span>
                {!missingPrice && soldByWeight ? (
                  <span className="text-on-surface-variant text-[10px] font-semibold">
                    / kg
                  </span>
                ) : null}
              </span>
            </button>
          ) : (
            <span className="text-on-surface min-w-[3rem] px-2 py-1.5 text-sm leading-none font-black whitespace-nowrap tabular-nums">
              {formatPosDh(line.unitPrice, 2, locale)}
              {soldByWeight ? " / kg" : ""}
            </span>
          )}

          <div className="flex min-w-0 flex-1 items-center justify-center gap-1">
            {!soldByWeight ? (
              <button
                type="button"
                onClick={() => setQtyKeypadOpen(true)}
                className={cn(
                  actionButtonClass,
                  "border-primary/20 bg-primary/8 hover:bg-primary/12 px-3 py-1",
                )}
                aria-label={tr(
                  `Modifier la quantité pour ${line.name}`,
                  `تعديل الكمية لـ ${line.name}`,
                )}
              >
                <span className="text-primary text-lg leading-none font-black tabular-nums">
                  {line.qty}
                </span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setWeightKeypadOpen(true)}
                className={cn(
                  actionButtonClass,
                  "border-secondary/30 bg-secondary-container/40 hover:bg-secondary-container/60 min-w-0 px-3 py-1.5",
                )}
                aria-label={tr(
                  `Poids pour ${line.name}`,
                  `الوزن لـ ${line.name}`,
                )}
                title={tr("Poids exact", "وزن دقيق")}
              >
                <span className="text-secondary text-sm leading-none font-black whitespace-nowrap tabular-nums">
                  {qtyLabel}
                </span>
              </button>
            )}
          </div>

          <span className="text-primary shrink-0 text-sm font-black whitespace-nowrap tabular-nums">
            {totalDh}
          </span>
        </div>
      </article>

      {!soldByWeight ? (
        <PosCartQtyKeypadDialog
          open={qtyKeypadOpen}
          onOpenChange={setQtyKeypadOpen}
          productName={line.name}
          qty={line.qty}
          minQty={minQty}
          tr={tr}
          onConfirm={(nextQty) => onQtyChange(line.productId, nextQty)}
        />
      ) : null}

      {soldByWeight ? (
        <PosCartWeightKeypadDialog
          open={weightKeypadOpen}
          onOpenChange={setWeightKeypadOpen}
          productName={line.name}
          weightKg={line.qty}
          unitPriceMad={line.unitPrice}
          locale={locale}
          tr={tr}
          onConfirm={(nextWeight) => onQtyChange(line.productId, nextWeight)}
        />
      ) : null}

      <PosCartPriceKeypadDialog
        open={priceKeypadOpen && canSetPrice}
        onOpenChange={setPriceKeypadOpen}
        productName={line.name}
        unitPriceMad={line.unitPrice}
        locale={locale}
        tr={tr}
        labelFr={soldByWeight ? "Prix au kg" : undefined}
        labelAr={soldByWeight ? "سعر الكيلو" : undefined}
        onConfirm={(nextPrice) => onUnitPriceChange(line.productId, nextPrice)}
      />
    </>
  );
}
