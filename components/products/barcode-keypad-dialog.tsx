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
import { cn } from "@/lib/utils";

const MAX_BARCODE_DIGITS = 32;

type BarcodeKeypadDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialValue?: string;
  tr: (fr: string, ar: string) => string;
  onConfirm: (barcode: string) => void;
};

function PadKey({
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

export function BarcodeKeypadDialog({
  open,
  onOpenChange,
  initialValue = "",
  tr,
  onConfirm,
}: BarcodeKeypadDialogProps) {
  const [draft, setDraft] = useState("");
  const replaceNextRef = useRef(true);

  useEffect(() => {
    if (!open) return;
    const digits = initialValue.replace(/\D/g, "");
    setDraft(digits);
    replaceNextRef.current = digits.length === 0;
  }, [open, initialValue]);

  function enterDigit(digit: string) {
    setDraft((prev) => {
      if (replaceNextRef.current) {
        replaceNextRef.current = false;
        return digit;
      }
      if (prev.length >= MAX_BARCODE_DIGITS) return prev;
      return `${prev}${digit}`;
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
    const value = draft.trim();
    if (!value) return;
    onConfirm(value);
    onOpenChange(false);
  }

  useKeypadKeyboard(open, {
    onDigit: enterDigit,
    onBackspace: backspace,
    onClear: clearDraft,
    onConfirm: handleConfirm,
  });

  const display = draft.trim() || "—";

  return (
    <PosDialog open={open} onOpenChange={onOpenChange}>
      <PosKeypadDialogContent
        showCloseButton
        className="border-sidebar-border bg-surface-container-lowest text-on-surface max-w-md gap-0 overflow-hidden rounded-3xl p-0 sm:max-w-lg"
      >
        <PosDialogHeader className="space-y-1 border-b border-sidebar-border/80 px-6 pt-6 pb-4 text-center">
          <PosDialogDescription className="text-on-surface-variant text-xs font-bold tracking-wide uppercase">
            {tr("Code-barres", "الباركود")}
          </PosDialogDescription>
          <PosDialogTitle className="text-on-surface text-base font-bold">
            {tr("Saisie numérique", "إدخال رقمي")}
          </PosDialogTitle>
          <p
            className="text-primary break-all pt-2 font-mono text-3xl leading-tight font-black tabular-nums sm:text-4xl"
            aria-live="polite"
          >
            {display}
          </p>
        </PosDialogHeader>

        <div className="grid grid-cols-3 gap-2 p-4 sm:gap-3 sm:p-5">
          {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((digit) => (
            <PadKey
              key={digit}
              label={digit}
              onPress={() => enterDigit(digit)}
            />
          ))}
          <PadKey
            label="C"
            ariaLabel={tr("Effacer", "مسح")}
            onPress={clearDraft}
            className="text-error text-xl"
          />
          <PadKey label="0" onPress={() => enterDigit("0")} />
          <PadKey
            label="⌫"
            ariaLabel={tr("Retour", "حذف")}
            onPress={backspace}
            className="text-xl"
          />
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
            disabled={!draft.trim()}
          >
            {tr("Valider", "تأكيد")}
          </Button>
        </PosDialogFooter>
      </PosKeypadDialogContent>
    </PosDialog>
  );
}
