"use client";

import { useLocale } from "next-intl";

import { PosCartFooter } from "@/components/pos/pos-cart-footer";
import { PosCartLineItem } from "@/components/pos/pos-cart-line-item";
import type { CartLine, PaymentMethod } from "@/components/pos/types";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

type PosCartSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cart: CartLine[];
  totalTtc: number;
  payment: PaymentMethod;
  onPaymentChange: (method: PaymentMethod) => void;
  selectedClientId: string | null;
  onClientChange: (clientId: string | null) => void;
  checkoutDisabledReason: string | null;
  onClearCart: () => void;
  onLineQtyChange: (productId: string, qty: number) => void;
  onLineUnitPriceChange: (productId: string, unitPriceMad: number) => void;
  onCheckout: () => void;
  allowCreditPayment?: boolean;
  allowPriceEdit?: boolean;
  allowCheckout?: boolean;
  allowParkDraft?: boolean;
  parkDisabled?: boolean;
  parkBusy?: boolean;
  onParkDraft: () => void;
};

export function PosCartSheet({
  open,
  onOpenChange,
  cart,
  totalTtc,
  payment,
  onPaymentChange,
  selectedClientId,
  onClientChange,
  checkoutDisabledReason,
  onClearCart,
  onLineQtyChange,
  onLineUnitPriceChange,
  onCheckout,
  allowCreditPayment = true,
  allowPriceEdit = true,
  allowCheckout = true,
  allowParkDraft = false,
  parkDisabled,
  parkBusy,
  onParkDraft,
}: PosCartSheetProps) {
  const locale = useLocale();
  const isAr = locale === "ar";
  const tr = (fr: string, ar: string) => (isAr ? ar : fr);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        showCloseButton
        className={cn(
          "border-border bg-card flex h-full max-h-svh w-full flex-col gap-0 overflow-hidden p-0 shadow-[-8px_0_32px_rgba(122,21,24,0.08)]",
          "sm:max-w-[380px]",
        )}
      >
        <SheetTitle className="sr-only">
          {tr("Panier actuel", "السلة الحالية")}
        </SheetTitle>
        <SheetDescription className="sr-only">
          {tr(
            "Articles ajoutés à la vente en cours et paiement.",
            "المنتجات المضافة للبيع الحالي والدفع.",
          )}
        </SheetDescription>

        <div
          className="min-h-0 min-w-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-y-contain px-2 py-2 pb-1 [scrollbar-gutter:stable]"
          aria-label={tr("Lignes du panier", "عناصر السلة")}
        >
          {cart.length === 0 ? (
            <p className="text-on-surface-variant px-2 text-center text-sm">
              {tr("Le panier est vide.", "السلة فارغة.")}
            </p>
          ) : (
            <div className="space-y-1.5">
              {cart.map((line) => (
                <PosCartLineItem
                  key={line.productId}
                  line={line}
                  locale={locale}
                  tr={tr}
                  onQtyChange={onLineQtyChange}
                  onUnitPriceChange={onLineUnitPriceChange}
                  allowPriceEdit={allowPriceEdit}
                  minQtyOne
                />
              ))}
            </div>
          )}
        </div>

        <PosCartFooter
          cartEmpty={cart.length === 0}
          totalTtc={totalTtc}
          payment={payment}
          onPaymentChange={onPaymentChange}
          selectedClientId={selectedClientId}
          onClientChange={onClientChange}
          checkoutDisabledReason={checkoutDisabledReason}
          onCheckout={onCheckout}
          allowCheckout={allowCheckout}
          allowParkDraft={allowParkDraft}
          onParkDraft={onParkDraft}
          parkDisabled={parkDisabled}
          parkBusy={parkBusy}
          allowCreditPayment={allowCreditPayment}
          locale={locale}
          tr={tr}
        />
      </SheetContent>
    </Sheet>
  );
}
