"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Hash, Languages } from "lucide-react";
import { useLocale } from "next-intl";

import { usePosKeyboard } from "@/components/pos/pos-keyboard-context";
import { POS_KEYBOARD_Z_CLASS } from "@/components/pos/pos-dialog";
import { keyboardRowsForLayout } from "@/lib/pos/keyboard-layouts";
import { cn } from "@/lib/utils";

function KeyButton({
  label,
  wide,
  onPress,
  className,
  arabic,
}: {
  label: string;
  wide?: boolean;
  onPress: () => void;
  className?: string;
  arabic?: boolean;
}) {
  const display =
    label === "Backspace" ? "←" : label === "Clear" ? "✕" : label;

  return (
    <button
      type="button"
      onMouseDown={(e) => e.preventDefault()}
      onClick={onPress}
      className={cn(
        "border-outline-variant/50 bg-white text-on-surface hover:bg-surface-container-low flex min-h-12 items-center justify-center border font-semibold transition-colors active:bg-surface-container-high",
        arabic ? "text-xl leading-none" : "text-base",
        wide ? "col-span-6" : "",
        className,
      )}
    >
      {display}
    </button>
  );
}

export function PosOnScreenKeyboard({
  tr,
}: {
  tr: (fr: string, ar: string) => string;
}) {
  const {
    isEnabled,
    isOpen,
    target,
    layout,
    close,
    toggleNumeric,
    toggleLetterLanguage,
    setValue,
  } = usePosKeyboard();
  const locale = useLocale();
  const isRtl = locale === "ar";
  const [portalEl, setPortalEl] = useState<HTMLElement | null>(null);

  useEffect(() => {
    setPortalEl(document.body);
  }, []);

  if (!portalEl || !isEnabled || !isOpen || !target) return null;

  const value = target.value;
  const isArabic = layout === "arabic";
  const isLetterLayout = layout === "alpha" || layout === "arabic";

  function append(text: string) {
    setValue(value + text);
  }

  function handleKey(key: string) {
    if (key === "Backspace") {
      setValue(value.slice(0, -1));
      return;
    }
    if (key === "Clear") {
      setValue("");
      return;
    }
    if (key === "Space") {
      append(" ");
      return;
    }
    append(key);
  }

  const rows = keyboardRowsForLayout(layout);

  return createPortal(
    <div
      className={cn(
        "border-sidebar-border pointer-events-auto fixed inset-x-0 bottom-0 border-t shadow-2xl pb-[env(safe-area-inset-bottom)]",
        POS_KEYBOARD_Z_CLASS,
      )}
      dir={isRtl ? "rtl" : "ltr"}
    >
      <div
        className="bg-[#e8dcc8] border-[#c9b896] flex items-center gap-2 border-b px-3 py-2 sm:gap-3 sm:px-4"
        dir={isRtl ? "rtl" : "ltr"}
      >
        <button
          type="button"
          className="border-error text-error shrink-0 rounded-md border-2 bg-white px-3 py-2 text-xs font-bold whitespace-nowrap"
        >
          {target.label}
        </button>

        <div className="min-w-0 flex-1">
          <input
            type="text"
            readOnly
            value={value}
            dir="auto"
            className="border-error text-on-surface h-11 w-full rounded-md border-2 bg-white px-3 text-sm font-medium"
            aria-label={target.label}
          />
        </div>

        <button
          type="button"
          onClick={toggleLetterLanguage}
          className="border-error text-error flex h-11 min-w-11 shrink-0 items-center justify-center rounded-md border-2 bg-white px-2 text-xs font-bold transition-colors hover:bg-white/80"
          aria-label={
            layout === "arabic"
              ? tr("Clavier latin", "لوحة لاتينية")
              : tr("Clavier arabe", "لوحة عربية")
          }
          title={
            layout === "arabic"
              ? tr("ABC", "ABC")
              : tr("عربي", "عربي")
          }
        >
          {layout === "arabic" ? (
            <span className="tracking-tight">ABC</span>
          ) : (
            <span className="flex items-center gap-1">
              <Languages className="size-4 shrink-0 stroke-[2]" aria-hidden />
              <span>عربي</span>
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={toggleNumeric}
          className={cn(
            "border-error text-error flex size-11 shrink-0 items-center justify-center rounded-md border-2 bg-white transition-colors hover:bg-white/80",
            layout === "numeric" && "bg-primary/10 border-primary text-primary",
          )}
          aria-label={
            layout === "numeric"
              ? tr("Clavier lettres", "لوحة حروف")
              : tr("Clavier numérique", "لوحة أرقام")
          }
          title={layout === "numeric" ? tr("ABC", "ABC") : "123"}
        >
          <Hash className="size-5 stroke-[2]" aria-hidden />
        </button>

        <button
          type="button"
          onClick={close}
          className="bg-error text-on-error shrink-0 rounded-md px-4 py-2.5 text-sm font-bold whitespace-nowrap"
        >
          {tr("Fermer", "إغلاق")}
        </button>
      </div>

      <div
        className="bg-[#e8dcc8] grid gap-px p-1"
        dir={isArabic ? "rtl" : "ltr"}
      >
        {rows.map((row, rowIndex) => (
          <div
            key={`row-${rowIndex}`}
            className={cn(
              "grid gap-px",
              layout === "numeric" ? "grid-cols-3" : "grid-cols-11",
            )}
          >
            {row.map((key) => (
              <KeyButton
                key={`${rowIndex}-${key}`}
                label={key}
                arabic={isArabic}
                onPress={() => handleKey(key)}
              />
            ))}
          </div>
        ))}

        {isLetterLayout ? (
          <div className="grid grid-cols-11 gap-px">
            <KeyButton
              label="@"
              arabic={isArabic}
              onPress={() => handleKey("@")}
            />
            <KeyButton
              label="Space"
              wide
              arabic={isArabic}
              onPress={() => handleKey("Space")}
              className="col-span-9 min-h-12"
            />
            <div className="bg-[#e8dcc8] min-h-12" aria-hidden />
          </div>
        ) : null}
      </div>
    </div>,
    portalEl,
  );
}
