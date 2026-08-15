"use client";

import { Banknote } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type PosHeaderMiscTotalProps = {
  onMiscTotal: () => void;
  locale: string;
  className?: string;
};

export function PosHeaderMiscTotal({
  onMiscTotal,
  locale,
  className,
}: PosHeaderMiscTotalProps) {
  const isAr = locale === "ar";
  const label = isAr ? "مبلغ حر" : "Montant libre";

  return (
    <Button
      type="button"
      onClick={onMiscTotal}
      className={cn(
        "h-10 shrink-0 gap-1.5 rounded-xl border-0 bg-emerald-600 px-3 text-xs font-black text-white shadow-sm hover:bg-emerald-700",
        className,
      )}
      aria-label={label}
      title={label}
    >
      <Banknote className="size-4 stroke-[1.75]" aria-hidden />
      <span className="hidden sm:inline">{label}</span>
    </Button>
  );
}
