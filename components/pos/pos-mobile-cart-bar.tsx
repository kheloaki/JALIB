"use client";

import { CheckCircle2, ChevronUp, ShoppingBasket } from "lucide-react";
import { useLocale } from "next-intl";

import { formatPosDh } from "@/lib/pos/format-pos-dh";
import type { CartLine } from "@/components/pos/types";
import { cn } from "@/lib/utils";

type PosMobileCartBarProps = {
  cart: CartLine[];
  totalTtc: number;
  checkoutDisabledReason: string | null;
  onOpenCart: () => void;
  onCheckout: () => void;
};

export function PosMobileCartBar({
  cart,
  totalTtc,
  checkoutDisabledReason,
  onOpenCart,
  onCheckout,
}: PosMobileCartBarProps) {
  const locale = useLocale();
  const isAr = locale === "ar";
  const tr = (fr: string, ar: string) => (isAr ? ar : fr);
  const itemCount = cart.reduce((sum, line) => sum + line.qty, 0);
  const canCheckout = cart.length > 0 && !checkoutDisabledReason;

  return (
    <div
      className={cn(
        "border-sidebar-border bg-surface-container-lowest z-30 shrink-0 border-t shadow-[0_-10px_28px_rgba(0,0,0,0.1)]",
        "md:hidden",
        "pb-[max(0.75rem,env(safe-area-inset-bottom))]",
      )}
    >
      <div className="flex items-stretch gap-2 px-3 pt-3 sm:px-4">
        <button
          type="button"
          onClick={onOpenCart}
          className="bg-surface-container-low hover:bg-surface-container flex min-w-0 flex-1 items-center gap-3 rounded-2xl px-3 py-2.5 text-start transition-colors active:scale-[0.99]"
          aria-label={tr("Ouvrir le panier", "فتح السلة")}
        >
          <span className="bg-primary/10 text-primary flex size-11 shrink-0 items-center justify-center rounded-xl">
            <ShoppingBasket className="size-5 stroke-[1.75]" aria-hidden />
          </span>
          <span className="min-w-0 flex-1">
            <span className="text-on-surface-variant block text-xs font-semibold">
              {itemCount}{" "}
              {tr(
                itemCount === 1 ? "article" : "articles",
                itemCount === 1 ? "عنصر" : "عناصر",
              )}
            </span>
            <span className="text-primary block truncate text-xl font-black tabular-nums">
              {formatPosDh(totalTtc, 2, locale)}
            </span>
          </span>
          <ChevronUp
            className="text-outline size-5 shrink-0 stroke-[1.75]"
            aria-hidden
          />
        </button>
        <button
          type="button"
          onClick={onCheckout}
          disabled={!canCheckout}
        className={cn(
          "pos-btn-valider flex shrink-0 items-center justify-center gap-2 rounded-2xl px-4 py-2.5 text-sm font-black shadow-sm transition-all active:scale-[0.98]",
          !canCheckout && "opacity-50 active:scale-100",
        )}
          aria-label={tr("Valider la vente", "تأكيد البيع")}
        >
          <CheckCircle2 className="size-5 shrink-0 stroke-[1.75]" aria-hidden />
          <span>{tr("Valider", "تأكيد")}</span>
        </button>
      </div>
      {checkoutDisabledReason && cart.length > 0 ? (
        <p className="text-error px-4 pt-2 text-center text-[11px] font-semibold">
          {checkoutDisabledReason}
        </p>
      ) : null}
    </div>
  );
}
