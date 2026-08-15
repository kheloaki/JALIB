"use client";

import { Scale } from "lucide-react";
import { useLocale } from "next-intl";

import { cn } from "@/lib/utils";

type SoldByWeightFieldProps = {
  value: boolean;
  onChange: (value: boolean) => void;
  disabled?: boolean;
};

export function SoldByWeightField({
  value,
  onChange,
  disabled = false,
}: SoldByWeightFieldProps) {
  const locale = useLocale();
  const isAr = locale === "ar";

  return (
    <button
      type="button"
      role="switch"
      aria-checked={value}
      disabled={disabled}
      onClick={() => onChange(!value)}
      className={cn(
        "flex w-full items-center gap-3 rounded-xl border-2 px-4 py-3 text-start transition-colors disabled:opacity-60",
        value
          ? "border-primary/40 bg-primary/8"
          : "border-outline-variant/40 bg-surface-container-low/60 hover:bg-surface-container-low",
      )}
    >
      <span
        className={cn(
          "flex size-10 shrink-0 items-center justify-center rounded-lg",
          value ? "bg-primary text-on-primary" : "bg-surface-container-high text-on-surface-variant",
        )}
      >
        <Scale className="size-5 stroke-[1.75]" aria-hidden />
      </span>
      <span className="min-w-0">
        <span className="text-on-background block text-sm font-bold">
          {isAr ? "بيع بالكيلو" : "Vendu au kilo (kg)"}
        </span>
        <span className="text-on-surface-variant text-xs leading-snug">
          {isAr
            ? "السماح بكميات مثل 0.5 أو 1.2 كغ في الصندوق."
            : "Autorise 0,5 kg, 1,2 kg, etc. à la caisse."}
        </span>
      </span>
    </button>
  );
}
