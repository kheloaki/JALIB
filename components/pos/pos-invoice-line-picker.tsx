"use client";

import { Check } from "lucide-react";

import { useLocale } from "next-intl";

import { QtyKeypadField } from "@/components/money/qty-keypad-field";
import { POS_CUSTOM_PRODUCT_PLACEHOLDER_IMAGE } from "@/components/pos/constants";
import { ProductCatalogImage } from "@/components/products/product-catalog-image";
import type { InvoiceLine } from "@/lib/invoices/types";
import { formatPosDh } from "@/lib/pos/format-pos-dh";
import { cn } from "@/lib/utils";

function remainingQty(qty: number, returnedQty?: number): number {
  return Math.max(0, qty - (returnedQty ?? 0));
}

export type InvoiceLineRow = {
  idx: number;
  line: InvoiceLine;
  maxQty: number;
};

type PosInvoiceLinePickerProps = {
  rows: InvoiceLineRow[];
  mode: "single" | "multiple";
  selectedLineIndex: number | null;
  returnQtyByLine: Record<number, number>;
  onSelectLine: (lineIndex: number) => void;
  onQtyChange: (lineIndex: number, qty: number) => void;
  tr: (fr: string, ar: string) => string;
  readOnly?: boolean;
};

export function PosInvoiceLinePicker({
  rows,
  mode,
  selectedLineIndex,
  returnQtyByLine,
  onSelectLine,
  onQtyChange,
  tr,
  readOnly = false,
}: PosInvoiceLinePickerProps) {
  const locale = useLocale();
  return (
    <div className="space-y-2">
      {rows.map((row) => {
        const isSelected =
          mode === "single"
            ? selectedLineIndex === row.idx
            : (returnQtyByLine[row.idx] ?? 0) > 0;
        const qty =
          mode === "single" && isSelected
            ? 1
            : Math.min(
                row.maxQty,
                Math.max(0, returnQtyByLine[row.idx] ?? 0),
              );
        const disabled = row.maxQty === 0;

        function handleSelect() {
          if (disabled || readOnly) return;
          onSelectLine(row.idx);
        }

        function handleSelectKeyDown(e: React.KeyboardEvent) {
          if (disabled || readOnly) return;
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onSelectLine(row.idx);
          }
        }

        return (
          <div
            key={row.idx}
            className={cn(
              "border-sidebar-border/70 flex w-full items-center gap-3 rounded-xl border p-2.5 text-start transition-colors",
              isSelected
                ? "border-primary/40 bg-primary/8 ring-primary/20 ring-1"
                : "bg-surface-container-low/50 hover:border-primary/20 hover:bg-primary/5",
              (disabled || readOnly) && "hover:bg-surface-container-low/50",
              disabled && "opacity-40",
            )}
          >
            <div
              role="button"
              tabIndex={disabled || readOnly ? -1 : 0}
              aria-disabled={disabled || readOnly}
              onClick={handleSelect}
              onKeyDown={handleSelectKeyDown}
              className={cn(
                "flex min-w-0 flex-1 items-center gap-3 text-start outline-none",
                disabled || readOnly ? "cursor-default" : "cursor-pointer",
                disabled && "cursor-not-allowed",
              )}
            >
              <div className="relative size-14 shrink-0 overflow-hidden rounded-lg bg-slate-100">
                <ProductCatalogImage
                  src={row.line.image || POS_CUSTOM_PRODUCT_PLACEHOLDER_IMAGE}
                  alt={row.line.imageAlt || row.line.nameAr}
                  fit="cover"
                  sizes="56px"
                />
                {isSelected ? (
                  <span className="bg-primary text-on-primary absolute inset-0 flex items-center justify-center bg-black/35">
                    <Check className="size-5 stroke-[2.5]" aria-hidden />
                  </span>
                ) : null}
              </div>

              <div className="min-w-0 flex-1">
                <p className="text-on-surface line-clamp-2 text-sm font-bold">
                  {row.line.nameAr}
                </p>
                <p className="text-on-surface-variant mt-0.5 text-xs tabular-nums">
                  {formatPosDh(row.line.unitPriceMad, 2, locale)} ·{" "}
                  {tr("Qté", "الكمية")} {row.line.qty}
                  {row.maxQty < row.line.qty
                    ? ` · ${tr("max", "أقصى")} ${row.maxQty}`
                    : ""}
                </p>
              </div>
            </div>

            {mode === "multiple" && isSelected ? (
              <QtyKeypadField
                value={qty || 1}
                onValueChange={(n) =>
                  onQtyChange(row.idx, Math.min(row.maxQty, Math.max(1, n)))
                }
                min={1}
                max={row.maxQty}
                compact
                keypadTitle={row.line.nameAr}
                wrapperClassName="w-16 shrink-0"
              />
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

export function buildInvoiceLineRows(
  lines: InvoiceLine[],
): InvoiceLineRow[] {
  return lines.map((line, idx) => ({
    idx: line.lineIndex ?? idx,
    line,
    maxQty: remainingQty(line.qty, line.returnedQty),
  }));
}
