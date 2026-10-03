"use client";

import { useEffect, useRef, useState } from "react";
import { StickyNote } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  PosDialog,
  PosKeypadDialogContent,
  PosDialogDescription,
  PosDialogFooter,
  PosDialogHeader,
  PosDialogTitle,
} from "@/components/pos/pos-dialog";
import {
  clampMadPrice,
  parseMadToNumber,
} from "@/lib/money/mad";
import { formatPosDh } from "@/lib/pos/format-pos-dh";
import { cn } from "@/lib/utils";
import { useKeypadKeyboard } from "@/hooks/use-keypad-keyboard";

const MAX_PRICE = 999_999.99;
const MAX_NOTE_LEN = 80;

type PosCartPriceKeypadDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  productName: string;
  unitPriceMad: number;
  locale: string;
  tr: (fr: string, ar: string) => string;
  onConfirm: (unitPriceMad: number, note?: string) => void;
  labelFr?: string;
  labelAr?: string;
  /** Montant libre — optional label shown as the cart / invoice line name. */
  enableNote?: boolean;
};

function priceToDraft(price: number, locale: string): string {
  if (price <= 0) return "";
  const fixed = (Math.round(price * 100) / 100).toFixed(2);
  return locale === "ar" ? fixed : fixed.replace(".", ",");
}

function parsePriceDraft(draft: string, fallback: number): number {
  const parsed = parseMadToNumber(draft);
  if (parsed === null) return fallback;
  return clampMadPrice(parsed, MAX_PRICE);
}

function PriceKey({
  label,
  onPress,
  className,
  ariaLabel,
}: {
  label: string;
  onPress: () => void;
  className?: string;
  ariaLabel?: string;
}) {
  return (
    <button
      type="button"
      onMouseDown={(e) => e.preventDefault()}
      onClick={onPress}
      aria-label={ariaLabel ?? label}
      className={cn(
        "bg-surface-container-lowest text-on-surface hover:bg-surface-container-low flex min-h-[4.25rem] items-center justify-center rounded-2xl text-2xl font-black tabular-nums shadow-sm transition-colors active:scale-[0.98]",
        className,
      )}
    >
      {label}
    </button>
  );
}

export function PosCartPriceKeypadDialog({
  open,
  onOpenChange,
  productName,
  unitPriceMad,
  locale,
  tr,
  onConfirm,
  labelFr,
  labelAr,
  enableNote = false,
}: PosCartPriceKeypadDialogProps) {
  const [draft, setDraft] = useState(() => priceToDraft(unitPriceMad, locale));
  const [note, setNote] = useState("");
  const [noteOpen, setNoteOpen] = useState(false);
  const replaceNextRef = useRef(true);

  useEffect(() => {
    if (!open) return;
    setDraft(priceToDraft(unitPriceMad, locale));
    replaceNextRef.current = true;
    if (enableNote) {
      setNote("");
      setNoteOpen(false);
    }
  }, [enableNote, locale, open, unitPriceMad]);

  function enterDigit(digit: string) {
    setDraft((prev) => {
      if (replaceNextRef.current) {
        replaceNextRef.current = false;
        return digit;
      }
      const next = `${prev}${digit}`;
      const digits = next.replace(/[^\d]/g, "");
      if (digits.length > 9) return prev;
      return next;
    });
  }

  function enterDecimal() {
    setDraft((prev) => {
      if (replaceNextRef.current) {
        replaceNextRef.current = false;
        return locale === "ar" ? "0." : "0,";
      }
      if (prev.includes(",") || prev.includes(".")) return prev;
      return prev === "" ? (locale === "ar" ? "0." : "0,") : `${prev}${locale === "ar" ? "." : ","}`;
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
    const amount = parsePriceDraft(draft, unitPriceMad);
    const trimmedNote = enableNote ? note.trim().slice(0, MAX_NOTE_LEN) : "";
    onConfirm(amount, trimmedNote || undefined);
    onOpenChange(false);
  }

  useKeypadKeyboard(open, {
    onDigit: enterDigit,
    onDecimal: enterDecimal,
    onBackspace: backspace,
    onClear: clearDraft,
    onConfirm: handleConfirm,
  });

  const displayPrice = formatPosDh(
    parsePriceDraft(draft.trim() === "" ? "0" : draft, 0),
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
            {tr(labelFr ?? "Prix unitaire", labelAr ?? "سعر الوحدة")}
          </PosDialogDescription>
          <PosDialogTitle className="text-on-surface line-clamp-2 text-base font-bold">
            {productName}
          </PosDialogTitle>
          {enableNote && note.trim() ? (
            <p className="text-on-surface-variant line-clamp-2 text-sm font-semibold">
              {note.trim()}
            </p>
          ) : null}
          <p
            className="text-primary pt-2 text-5xl leading-none font-black tabular-nums sm:text-6xl"
            aria-live="polite"
          >
            {displayPrice}
          </p>
        </PosDialogHeader>

        {enableNote ? (
          <div className="space-y-2 border-b border-sidebar-border/60 px-4 py-3 sm:px-5">
            <Button
              type="button"
              variant="outline"
              className={cn(
                "h-11 w-full gap-2 rounded-xl font-bold",
                noteOpen || note.trim()
                  ? "border-primary/30 bg-primary/8 text-primary"
                  : undefined,
              )}
              onClick={() => setNoteOpen((v) => !v)}
            >
              <StickyNote className="size-4 stroke-[1.75]" aria-hidden />
              {note.trim()
                ? tr("Modifier la note", "تعديل الملاحظة")
                : tr("Ajouter une note", "إضافة ملاحظة")}
            </Button>
            {noteOpen ? (
              <Input
                autoFocus
                value={note}
                maxLength={MAX_NOTE_LEN}
                onChange={(e) => setNote(e.target.value.slice(0, MAX_NOTE_LEN))}
                placeholder={tr(
                  "Ex. réparation, livraison…",
                  "مثال: إصلاح، توصيل…",
                )}
                className="bg-surface-container-low border-transparent h-11 rounded-xl"
                aria-label={tr("Note", "ملاحظة")}
              />
            ) : null}
          </div>
        ) : null}

        <div className="grid grid-cols-3 gap-2 p-4 sm:gap-3 sm:p-5">
          {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((digit) => (
            <PriceKey
              key={digit}
              label={digit}
              onPress={() => enterDigit(digit)}
            />
          ))}
          <PriceKey
            label={locale === "ar" ? "." : ","}
            ariaLabel={tr("Décimales", "الفاصلة العشرية")}
            onPress={enterDecimal}
            className="text-xl"
          />
          <PriceKey label="0" onPress={() => enterDigit("0")} />
          <PriceKey
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
