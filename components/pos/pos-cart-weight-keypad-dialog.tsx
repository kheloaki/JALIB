"use client";

import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  PosDialog,
  PosKeypadDialogContent,
  PosDialogDescription,
  PosDialogFooter,
  PosDialogHeader,
  PosDialogTitle,
} from "@/components/pos/pos-dialog";
import { useKeypadKeyboard } from "@/hooks/use-keypad-keyboard";
import {
  cartLineTotalMad,
  clampWeightQty,
  defaultWeightInputUnit,
  formatWeightGrams,
  gramsToKg,
  parseGramDraft,
  parseWeightDraft,
  type WeightInputUnit,
  weightToDraft,
  weightToGramDraft,
} from "@/lib/pos/cart-qty";
import { formatPosDh } from "@/lib/pos/format-pos-dh";
import { cn } from "@/lib/utils";

type PosCartWeightKeypadDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  productName: string;
  weightKg: number;
  unitPriceMad: number;
  locale: string;
  tr: (fr: string, ar: string) => string;
  onConfirm: (weightKg: number) => void;
};

function WeightKey({
  label,
  onPress,
  className,
  ariaLabel,
  disabled = false,
}: {
  label: string;
  onPress: () => void;
  className?: string;
  ariaLabel?: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onPress}
      aria-label={ariaLabel ?? label}
      className={cn(
        "bg-surface-container-lowest text-on-surface hover:bg-surface-container-low flex min-h-[4.25rem] items-center justify-center rounded-2xl text-2xl font-black tabular-nums shadow-sm transition-colors active:scale-[0.98] disabled:opacity-40",
        className,
      )}
    >
      {label}
    </button>
  );
}

function draftForUnit(weightKg: number, unit: WeightInputUnit, locale: string): string {
  return unit === "g" ? weightToGramDraft(weightKg) : weightToDraft(weightKg, locale);
}

function parsedWeightKg(
  draft: string,
  unit: WeightInputUnit,
  weightKg: number,
): number {
  if (unit === "g") {
    const grams = parseGramDraft(draft, Math.round(weightKg * 1000));
    return gramsToKg(grams);
  }
  return parseWeightDraft(draft, weightKg);
}

export function PosCartWeightKeypadDialog({
  open,
  onOpenChange,
  productName,
  weightKg,
  unitPriceMad,
  locale,
  tr,
  onConfirm,
}: PosCartWeightKeypadDialogProps) {
  const [inputUnit, setInputUnit] = useState<WeightInputUnit>(() =>
    defaultWeightInputUnit(weightKg),
  );
  const [draft, setDraft] = useState(() =>
    draftForUnit(weightKg, defaultWeightInputUnit(weightKg), locale),
  );
  const replaceNextRef = useRef(true);

  useEffect(() => {
    if (!open) return;
    const unit = defaultWeightInputUnit(weightKg);
    setInputUnit(unit);
    setDraft(draftForUnit(weightKg, unit, locale));
    replaceNextRef.current = true;
  }, [locale, open, weightKg]);

  function switchUnit(next: WeightInputUnit) {
    if (next === inputUnit) return;
    const currentKg = parsedWeightKg(draft, inputUnit, weightKg);
    setInputUnit(next);
    setDraft(draftForUnit(currentKg, next, locale));
    replaceNextRef.current = true;
  }

  function enterDigit(digit: string) {
    setDraft((prev) => {
      if (replaceNextRef.current) {
        replaceNextRef.current = false;
        return digit;
      }
      const next = `${prev}${digit}`;
      const digits = next.replace(/[^\d]/g, "");
      const maxDigits = inputUnit === "g" ? 7 : 7;
      if (digits.length > maxDigits) return prev;
      return next;
    });
  }

  function enterDecimal() {
    if (inputUnit === "g") return;
    setDraft((prev) => {
      if (replaceNextRef.current) {
        replaceNextRef.current = false;
        return locale === "ar" ? "0." : "0,";
      }
      if (prev.includes(",") || prev.includes(".")) return prev;
      return prev === ""
        ? locale === "ar"
          ? "0."
          : "0,"
        : `${prev}${locale === "ar" ? "." : ","}`;
    });
  }

  function clearDraft() {
    setDraft("");
    replaceNextRef.current = true;
  }

  function backspace() {
    setDraft((prev) => {
      const next = prev.slice(0, -1);
      if (!next) replaceNextRef.current = true;
      return next;
    });
  }

  function handleConfirm() {
    const parsed = parsedWeightKg(draft, inputUnit, weightKg);
    onConfirm(clampWeightQty(parsed));
    onOpenChange(false);
  }

  useKeypadKeyboard(open, {
    onDigit: enterDigit,
    onDecimal: inputUnit === "kg" ? enterDecimal : undefined,
    onBackspace: backspace,
    onClear: clearDraft,
    onConfirm: handleConfirm,
  });

  const resolvedKg = parsedWeightKg(
    draft.trim() === "" ? "0" : draft,
    inputUnit,
    weightKg,
  );
  const resolvedGrams = Math.round(resolvedKg * 1000);
  const primaryDisplay =
    inputUnit === "g"
      ? formatWeightGrams(resolvedGrams, locale)
      : locale.startsWith("ar")
        ? `${resolvedKg} كغ`
        : `${resolvedKg} kg`;
  const secondaryDisplay =
    inputUnit === "g"
      ? locale.startsWith("ar")
        ? `${resolvedKg} كغ`
        : `${resolvedKg} kg`
      : formatWeightGrams(resolvedGrams, locale);
  const lineTotal = formatPosDh(
    cartLineTotalMad({ unitPrice: unitPriceMad, qty: resolvedKg }),
    2,
    locale,
  );

  return (
    <PosDialog open={open} onOpenChange={onOpenChange}>
      <PosKeypadDialogContent
        showCloseButton
        className="border-sidebar-border bg-surface-container-lowest text-on-surface max-w-md gap-0 overflow-hidden rounded-3xl p-0 sm:max-w-lg"
      >
        <PosDialogHeader className="space-y-1 border-b border-sidebar-border/80 px-6 pt-6 pb-4 text-center">
          <PosDialogDescription className="text-on-surface-variant text-xs font-bold tracking-wide uppercase">
            {tr("Poids exact", "الوزن الدقيق")}
          </PosDialogDescription>
          <PosDialogTitle className="text-on-surface line-clamp-2 text-base font-bold">
            {productName}
          </PosDialogTitle>

          <div
            className="bg-surface-container-low mx-auto mt-3 flex w-full max-w-xs gap-1 rounded-xl p-1"
            role="tablist"
            aria-label={tr("Unité de saisie", "وحدة الإدخال")}
          >
            {(["kg", "g"] as const).map((unit) => (
              <button
                key={unit}
                type="button"
                role="tab"
                aria-selected={inputUnit === unit}
                onClick={() => switchUnit(unit)}
                className={cn(
                  "flex-1 rounded-lg py-2 text-sm font-black transition-colors",
                  inputUnit === unit
                    ? "bg-primary text-on-primary shadow-sm"
                    : "text-on-surface-variant hover:bg-surface-container-high",
                )}
              >
                {unit === "kg"
                  ? tr("Kilo (kg)", "كيلو (kg)")
                  : tr("Grammes (g)", "غرام (g)")}
              </button>
            ))}
          </div>

          <p
            className="text-primary pt-3 text-5xl leading-none font-black tabular-nums sm:text-6xl"
            aria-live="polite"
          >
            {primaryDisplay}
          </p>
          <p className="text-on-surface-variant text-sm font-semibold tabular-nums">
            {secondaryDisplay}
          </p>
          <p className="text-on-surface-variant pt-1 text-sm font-semibold tabular-nums">
            {tr("Total ligne", "إجمالي السطر")} : {lineTotal}
          </p>
          <p className="text-on-surface-variant text-xs tabular-nums">
            {formatPosDh(unitPriceMad, 2, locale)} / kg
          </p>
        </PosDialogHeader>

        <div className="grid grid-cols-3 gap-2 p-4 sm:gap-3 sm:p-5">
          {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((digit) => (
            <WeightKey
              key={digit}
              label={digit}
              onPress={() => enterDigit(digit)}
            />
          ))}
          {inputUnit === "kg" ? (
            <WeightKey
              label={locale === "ar" ? "." : ","}
              ariaLabel={tr("Décimales", "الفاصلة العشرية")}
              onPress={enterDecimal}
              className="text-xl"
            />
          ) : (
            <WeightKey
              label={tr("000", "000")}
              ariaLabel={tr("Ajouter trois zéros", "إضافة ثلاثة أصفار")}
              onPress={() => {
                setDraft((prev) => {
                  if (replaceNextRef.current) {
                    replaceNextRef.current = false;
                    return "000";
                  }
                  const digits = `${prev}000`.replace(/[^\d]/g, "");
                  if (digits.length > 7) return prev;
                  return `${prev}000`;
                });
              }}
              className="text-lg"
            />
          )}
          <WeightKey label="0" onPress={() => enterDigit("0")} />
          <WeightKey
            label="⌫"
            ariaLabel={tr("Retour", "حذف")}
            onPress={backspace}
            className="text-xl"
          />
        </div>

        <div className="px-4 pb-2 sm:px-5">
          <Button
            type="button"
            variant="outline"
            className="text-error border-error/30 h-11 w-full rounded-xl font-bold"
            onClick={clearDraft}
          >
            {tr("Effacer", "مسح")}
          </Button>
        </div>

        <PosDialogFooter className="gap-3 border-t border-sidebar-border/80 px-4 py-4 sm:flex-row sm:px-5">
          <Button
            type="button"
            variant="outline"
            className="min-h-[4.25rem] w-full shrink-0 rounded-xl text-base font-bold sm:min-h-12 sm:w-auto sm:flex-1"
            onClick={() => onOpenChange(false)}
          >
            {tr("Annuler", "إلغاء")}
          </Button>
          <Button
            type="button"
            className="min-h-[4.25rem] w-full shrink-0 rounded-xl text-base font-bold sm:min-h-12 sm:w-auto sm:flex-1"
            onClick={handleConfirm}
          >
            {tr("Valider", "تأكيد")}
          </Button>
        </PosDialogFooter>
      </PosKeypadDialogContent>
    </PosDialog>
  );
}
