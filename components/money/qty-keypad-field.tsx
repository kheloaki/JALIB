"use client";

import { useState } from "react";
import { ChevronRight } from "lucide-react";
import { useLocale } from "next-intl";

import { PosCartQtyKeypadDialog } from "@/components/pos/pos-cart-qty-keypad-dialog";
import { cn } from "@/lib/utils";

export type QtyKeypadFieldProps = {
  value: number;
  onValueChange: (value: number) => void;
  min?: number;
  max?: number;
  keypadTitle?: string;
  compact?: boolean;
  className?: string;
  wrapperClassName?: string;
  id?: string;
  disabled?: boolean;
  /** @deprecated Use keypad (default). Set false for plain number input. */
  useKeypad?: boolean;
};

export function QtyKeypadField({
  value,
  onValueChange,
  min = 1,
  max = 9999,
  keypadTitle = "",
  compact = false,
  className,
  wrapperClassName,
  id,
  disabled = false,
  useKeypad = true,
}: QtyKeypadFieldProps) {
  const locale = useLocale();
  const isAr = locale === "ar";
  const tr = (fr: string, ar: string) => (isAr ? ar : fr);
  const [open, setOpen] = useState(false);

  function clampQty(qty: number) {
    return Math.min(max, Math.max(min, Math.floor(qty)));
  }

  if (!useKeypad) {
    return (
      <input
        id={id}
        type="number"
        min={min}
        max={max}
        step={1}
        disabled={disabled}
        value={value}
        onChange={(e) => {
          const n = Number.parseInt(e.target.value, 10);
          onValueChange(Number.isFinite(n) ? clampQty(n) : min);
        }}
        className={cn(
          "bg-surface-container-low border-transparent h-11 rounded-xl border px-3 tabular-nums",
          compact && "h-9 w-20 text-sm",
          className,
        )}
      />
    );
  }

  return (
    <>
      <button
        id={id}
        type="button"
        disabled={disabled}
        onClick={(e) => {
          e.stopPropagation();
          setOpen(true);
        }}
        className={cn(
          "border-outline-variant/40 bg-surface-container-low hover:bg-surface-container-low/80 inline-flex items-center rounded-xl border text-left transition-colors disabled:opacity-50",
          compact ? "inline-flex h-9 w-auto justify-center gap-0 px-2.5" : "h-11 w-full max-w-xs justify-between gap-2 px-3",
          wrapperClassName,
          className,
        )}
      >
        <span
          className={cn(
            "text-on-background font-bold tabular-nums",
            compact ? "text-sm" : "text-lg",
          )}
        >
          {value}
        </span>
        {!compact ? (
          <ChevronRight className="text-on-surface-variant size-4 shrink-0" aria-hidden />
        ) : null}
      </button>

      <PosCartQtyKeypadDialog
        open={open}
        onOpenChange={setOpen}
        productName={keypadTitle || tr("Quantité", "الكمية")}
        qty={value}
        minQty={min}
        tr={tr}
        onConfirm={(qty) => onValueChange(clampQty(qty))}
      />
    </>
  );
}
