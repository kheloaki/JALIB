"use client";

import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  PosDialog,
  PosDialogContent,
  PosDialogDescription,
  PosDialogFooter,
  PosDialogHeader,
  PosDialogTitle,
} from "@/components/pos/pos-dialog";
import { useKeypadKeyboard } from "@/hooks/use-keypad-keyboard";
import { cn } from "@/lib/utils";

const MAX_QTY_DIGITS = 4;
const MAX_QTY = 9999;

type PosCartQtyKeypadDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  productName: string;
  qty: number;
  minQty?: number;
  tr: (fr: string, ar: string) => string;
  onConfirm: (qty: number) => void;
};

function parseDraft(draft: string, fallback: number): number {
  const trimmed = draft.trim();
  if (!trimmed) return fallback;
  const n = Number.parseInt(trimmed, 10);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(MAX_QTY, Math.max(0, n));
}

function QtyKey({
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

export function PosCartQtyKeypadDialog({
  open,
  onOpenChange,
  productName,
  qty,
  minQty = 0,
  tr,
  onConfirm,
}: PosCartQtyKeypadDialogProps) {
  const [draft, setDraft] = useState(String(qty));
  const replaceNextRef = useRef(true);

  useEffect(() => {
    if (!open) return;
    setDraft(String(qty));
    replaceNextRef.current = true;
  }, [open, qty]);

  function enterDigit(digit: string) {
    setDraft((prev) => {
      if (replaceNextRef.current) {
        replaceNextRef.current = false;
        return digit;
      }
      const next = `${prev}${digit}`;
      if (next.length > MAX_QTY_DIGITS) return prev;
      return next;
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
    const parsed = parseDraft(draft, qty);
    if (minQty > 0 && parsed < minQty) {
      onConfirm(minQty);
    } else {
      onConfirm(parsed);
    }
    onOpenChange(false);
  }

  useKeypadKeyboard(open, {
    onDigit: enterDigit,
    onBackspace: backspace,
    onClear: clearDraft,
    onConfirm: handleConfirm,
  });

  const displayQty = draft.trim() || "0";

  return (
    <PosDialog open={open} onOpenChange={onOpenChange}>
      <PosDialogContent
        showCloseButton
        className="border-sidebar-border bg-surface-container-lowest text-on-surface max-w-md gap-0 overflow-hidden rounded-3xl p-0 sm:max-w-lg"
      >
        <PosDialogHeader className="space-y-1 border-b border-sidebar-border/80 px-6 pt-6 pb-4 text-center">
          <PosDialogDescription className="text-on-surface-variant text-xs font-bold tracking-wide uppercase">
            {tr("Quantité", "الكمية")}
          </PosDialogDescription>
          <PosDialogTitle className="text-on-surface line-clamp-2 text-base font-bold">
            {productName}
          </PosDialogTitle>
          <p
            className="text-primary pt-2 text-6xl leading-none font-black tabular-nums sm:text-7xl"
            aria-live="polite"
          >
            {displayQty}
          </p>
        </PosDialogHeader>

        <div className="grid grid-cols-3 gap-2 p-4 sm:gap-3 sm:p-5">
          {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((digit) => (
            <QtyKey
              key={digit}
              label={digit}
              onPress={() => enterDigit(digit)}
            />
          ))}
          <QtyKey
            label="C"
            ariaLabel={tr("Effacer", "مسح")}
            onPress={clearDraft}
            className="text-error text-xl"
          />
          <QtyKey label="0" onPress={() => enterDigit("0")} />
          <QtyKey
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
          >
            {tr("Valider", "تأكيد")}
          </Button>
        </PosDialogFooter>
      </PosDialogContent>
    </PosDialog>
  );
}
