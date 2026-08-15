"use client";

import { useCallback, useState } from "react";
import { ChevronRight } from "lucide-react";
import { useLocale } from "next-intl";

import { PosCartPriceKeypadDialog } from "@/components/pos/pos-cart-price-keypad-dialog";
import { Input } from "@/components/ui/input";
import {
  clampMadAmount,
  currencyLabelForLocale,
} from "@/lib/money/mad";
import { formatPosDh } from "@/lib/pos/format-pos-dh";
import { cn } from "@/lib/utils";

export type MadPriceFieldProps = Omit<
  React.ComponentProps<typeof Input>,
  "type" | "value" | "onChange"
> & {
  value: number;
  onValueChange: (value: number) => void;
  min?: number;
  max?: number;
  /** Applied to the outer wrapper (default `max-w-xs`). */
  wrapperClassName?: string;
  /** Title shown on the price keypad header. */
  keypadTitle?: string;
  labelFr?: string;
  labelAr?: string;
  compact?: boolean;
  /** Open numeric keypad on tap (default true). */
  useKeypad?: boolean;
};

/**
 * Price field with optional MAD suffix. By default opens the caisse-style price keypad.
 */
export function MadPriceField({
  value,
  onValueChange,
  min = 0,
  max = 999_999.99,
  className,
  wrapperClassName,
  id,
  keypadTitle,
  labelFr = "Montant",
  labelAr = "المبلغ",
  compact = false,
  useKeypad = true,
  ...props
}: MadPriceFieldProps) {
  const locale = useLocale();
  const isAr = locale === "ar";
  const tr = (fr: string, ar: string) => (isAr ? ar : fr);
  const [open, setOpen] = useState(false);

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const raw = e.target.value;
      if (raw === "" || raw === "-") {
        onValueChange(0);
        return;
      }
      const n = Number.parseFloat(raw);
      if (Number.isFinite(n)) {
        onValueChange(clampMadAmount(n, min, max));
      }
    },
    [onValueChange, min, max],
  );

  function confirmPrice(price: number) {
    const clamped = clampMadAmount(price, min, max);
    onValueChange(clamped);
  }

  if (!useKeypad) {
    return (
      <div className={cn("relative w-full max-w-xs", wrapperClassName)}>
        <Input
          id={id}
          type="number"
          inputMode="decimal"
          min={min}
          max={max}
          step={0.01}
          value={value === 0 ? "" : value}
          onChange={handleChange}
          placeholder="0.00"
          className={cn(
            "bg-surface-container-low border-transparent pr-14 tabular-nums",
            "focus-visible:ring-primary/25 h-11 rounded-xl",
            className,
          )}
          {...props}
        />
        <span
          className="text-on-surface-variant pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-xs font-bold tracking-wide uppercase"
          aria-hidden
        >
          {currencyLabelForLocale(locale)}
        </span>
      </div>
    );
  }

  const display =
    value !== 0
      ? formatPosDh(value, 2, locale)
      : tr("Appuyer pour saisir", "اضغط للإدخال");

  return (
    <>
      <button
        id={id}
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setOpen(true);
        }}
        disabled={props.disabled}
        className={cn(
          "border-outline-variant/40 bg-surface-container-low hover:bg-surface-container-low/80 inline-flex items-center rounded-xl border transition-colors disabled:opacity-50",
          compact
            ? "h-9 w-auto justify-center px-2.5 text-center"
            : "h-11 w-full max-w-xs justify-between gap-2 px-3 text-left",
          wrapperClassName,
          className,
        )}
      >
        <span
          className={cn(
            "font-bold tabular-nums",
            compact ? "text-sm whitespace-nowrap" : "truncate text-base",
            value !== 0
              ? "text-on-background"
              : "text-on-surface-variant text-xs font-medium",
          )}
        >
          {display}
        </span>
        {!compact ? (
          <ChevronRight className="text-on-surface-variant size-4 shrink-0" aria-hidden />
        ) : null}
      </button>

      <PosCartPriceKeypadDialog
        open={open}
        onOpenChange={setOpen}
        productName={keypadTitle || tr(labelFr, labelAr)}
        unitPriceMad={value > 0 ? value : min > 0 ? min : 0}
        locale={locale}
        tr={tr}
        labelFr={labelFr}
        labelAr={labelAr}
        onConfirm={confirmPrice}
      />
    </>
  );
}
