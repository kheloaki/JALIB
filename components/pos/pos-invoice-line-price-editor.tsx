"use client";

import { useLocale } from "next-intl";

import { POS_CUSTOM_PRODUCT_PLACEHOLDER_IMAGE } from "@/components/pos/constants";
import { MadPriceField } from "@/components/money/mad-price-field";
import { ProductCatalogImage } from "@/components/products/product-catalog-image";
import {
  computeInvoicePriceTotals,
  invoiceLineKey,
  remainingInvoiceLineQty,
} from "@/lib/pos/invoice-to-cart";
import type { InvoiceLine } from "@/lib/invoices/types";
import { formatPosDh } from "@/lib/pos/format-pos-dh";
import { cn } from "@/lib/utils";

type PosInvoiceLinePriceEditorProps = {
  lines: InvoiceLine[];
  unitPriceByLine: Record<number, number>;
  onUnitPriceChange: (lineIndex: number, unitPriceMad: number) => void;
  tr: (fr: string, ar: string) => string;
};

export function PosInvoiceLinePriceEditor({
  lines,
  unitPriceByLine,
  onUnitPriceChange,
  tr,
}: PosInvoiceLinePriceEditorProps) {
  const locale = useLocale();
  const totals = computeInvoicePriceTotals(lines, unitPriceByLine);
  const hasChange = totals.differenceMad !== 0;

  return (
    <div className="space-y-3">
      <p className="text-on-surface-variant text-xs font-medium">
        {tr(
          "Modifiez le prix unitaire de chaque article",
          "عدّل سعر الوحدة لكل منتج",
        )}
      </p>

      <div className="space-y-2">
        {lines.map((line, idx) => {
          const lineIndex = invoiceLineKey(line, idx);
          const qty = remainingInvoiceLineQty(line);
          if (qty <= 0) return null;
          const currentUnit = unitPriceByLine[lineIndex] ?? line.unitPriceMad;
          const changed = currentUnit !== line.unitPriceMad;

          return (
            <div
              key={lineIndex}
              className={cn(
                "border-sidebar-border/70 flex items-center gap-3 rounded-xl border p-2.5",
                changed
                  ? "border-primary/35 bg-primary/5"
                  : "bg-surface-container-low/50",
              )}
            >
              <div className="size-14 shrink-0 overflow-hidden rounded-lg bg-slate-100">
                <ProductCatalogImage
                  src={line.image || POS_CUSTOM_PRODUCT_PLACEHOLDER_IMAGE}
                  alt={line.imageAlt || line.nameAr}
                  fit="cover"
                  sizes="56px"
                />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-on-surface line-clamp-2 text-sm font-bold">
                  {line.nameAr}
                </p>
                <p className="text-on-surface-variant text-xs tabular-nums">
                  ×{qty} · {tr("Ancien", "السابق")}{" "}
                  {formatPosDh(line.unitPriceMad, 2, locale)}
                </p>
              </div>
              <div className="w-[7.5rem] shrink-0">
                <MadPriceField
                  id={`line-price-${lineIndex}`}
                  value={currentUnit}
                  onValueChange={(value) => onUnitPriceChange(lineIndex, value)}
                  min={0.01}
                  wrapperClassName="max-w-full"
                />
              </div>
            </div>
          );
        })}
      </div>

      <PosPriceChangeSummary totals={totals} hasChange={hasChange} tr={tr} />
    </div>
  );
}

export function PosPriceChangeSummary({
  totals,
  hasChange,
  tr,
}: {
  totals: ReturnType<typeof computeInvoicePriceTotals>;
  hasChange: boolean;
  tr: (fr: string, ar: string) => string;
}) {
  const locale = useLocale();
  const { originalTotalMad, newTotalMad, differenceMad } = totals;

  let settlementLabel: string | null = null;
  let settlementClass = "text-on-surface-variant";
  if (differenceMad > 0) {
    settlementLabel = tr(
      `À encaisser du client : ${formatPosDh(differenceMad)}`,
      `يُستوفى من العميل: ${formatPosDh(differenceMad, 2, "ar")}`,
    );
    settlementClass = "text-error";
  } else if (differenceMad < 0) {
    settlementLabel = tr(
      `À rendre au client : ${formatPosDh(Math.abs(differenceMad))}`,
      `يُرد للعميل: ${formatPosDh(Math.abs(differenceMad), 2, "ar")}`,
    );
    settlementClass = "text-primary";
  } else if (hasChange) {
    settlementLabel = tr("Aucun écart de total", "لا فرق في المجموع");
  }

  return (
    <div className="border-sidebar-border/70 bg-surface-container-low/60 space-y-2 rounded-xl border px-4 py-3">
      <div className="flex items-center justify-between gap-3 text-sm">
        <span className="text-on-surface-variant">{tr("Total achat", "مجموع الشراء")}</span>
        <span className="font-bold tabular-nums">
          {formatPosDh(originalTotalMad, 2, locale)}
        </span>
      </div>
      <div className="flex items-center justify-between gap-3 text-sm">
        <span className="text-on-surface-variant">{tr("Nouveau total", "المجموع الجديد")}</span>
        <span className="text-on-surface font-black tabular-nums">
          {formatPosDh(newTotalMad, 2, locale)}
        </span>
      </div>
      {settlementLabel ? (
        <p className={cn("border-sidebar-border/60 border-t pt-2 text-sm font-bold", settlementClass)}>
          {settlementLabel}
        </p>
      ) : null}
    </div>
  );
}
