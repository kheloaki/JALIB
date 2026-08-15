"use client";

import { useLocale } from "next-intl";
import { useRef } from "react";

import { usePosBarcodeScan } from "@/components/pos/pos-barcode-scan-context";
import { PosCartDraftsSection } from "@/components/pos/pos-cart-drafts-section";
import { PosCartFooter } from "@/components/pos/pos-cart-footer";
import { PosCartLineItem } from "@/components/pos/pos-cart-line-item";
import { PosInlineBarcodeScanner } from "@/components/pos/pos-inline-barcode-scanner";
import type { CartLine, PaymentMethod } from "@/components/pos/types";
import type { PosCartDraftView } from "@/lib/convex/pos-cart-draft";
import { useScanZoneLayout } from "@/hooks/use-scan-zone-layout";
import { cn } from "@/lib/utils";

type PosMobileCaisseCartProps = {
  cart: CartLine[];
  totalTtc: number;
  payment: PaymentMethod;
  onPaymentChange: (method: PaymentMethod) => void;
  selectedClientId: string | null;
  onClientChange: (clientId: string | null) => void;
  checkoutDisabledReason: string | null;
  onLineQtyChange: (productId: string, qty: number) => void;
  onLineUnitPriceChange: (productId: string, unitPriceMad: number) => void;
  onCheckout: () => void;
  onBarcodeScan: (raw: string) => void;
  allowCreditPayment?: boolean;
  allowPriceEdit?: boolean;
  allowCheckout?: boolean;
  allowParkDraft?: boolean;
  parkDisabled?: boolean;
  parkBusy?: boolean;
  canManageDrafts?: boolean;
  drafts?: PosCartDraftView[];
  draftsLoading?: boolean;
  draftsBusy?: boolean;
  onParkDraft: () => void;
  onRestoreDraft: (draftId: PosCartDraftView["id"]) => void;
  onDeleteDraft: (draftId: PosCartDraftView["id"]) => void;
  className?: string;
};

function CartItemsList({
  cart,
  cartHasItems,
  locale,
  tr,
  onLineQtyChange,
  onLineUnitPriceChange,
  allowPriceEdit,
  className,
}: {
  cart: CartLine[];
  cartHasItems: boolean;
  locale: string;
  tr: (fr: string, ar: string) => string;
  onLineQtyChange: (productId: string, qty: number) => void;
  onLineUnitPriceChange: (productId: string, unitPriceMad: number) => void;
  allowPriceEdit: boolean;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "min-w-0 overflow-x-hidden px-1.5 py-1 [scrollbar-gutter:stable]",
        className,
      )}
      aria-label={tr("Lignes du panier", "عناصر السلة")}
    >
      {cartHasItems ? (
        <div className="space-y-1">
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
              compact
            />
          ))}
        </div>
      ) : (
        <p className="text-on-surface-variant px-2 py-4 text-center text-xs">
          {tr(
            "Panier vide — scannez ou saisissez un code-barres.",
            "السلة فارغة — امسح أو أدخل باركودًا.",
          )}
        </p>
      )}
    </div>
  );
}

export function PosMobileCaisseCart({
  cart,
  totalTtc,
  payment,
  onPaymentChange,
  selectedClientId,
  onClientChange,
  checkoutDisabledReason,
  onLineQtyChange,
  onLineUnitPriceChange,
  onCheckout,
  onBarcodeScan,
  allowCreditPayment = true,
  allowPriceEdit = true,
  allowCheckout = true,
  allowParkDraft = false,
  parkDisabled,
  parkBusy,
  canManageDrafts = true,
  drafts,
  draftsLoading,
  draftsBusy,
  onParkDraft,
  onRestoreDraft,
  onDeleteDraft,
  className,
}: PosMobileCaisseCartProps) {
  const locale = useLocale();
  const isAr = locale === "ar";
  const tr = (fr: string, ar: string) => (isAr ? ar : fr);
  const { mobileInlineScanOpen } = usePosBarcodeScan();
  const cartHasItems = cart.length > 0;
  const showItemsWhileScanning = !(mobileInlineScanOpen && !cartHasItems);
  const scanBodyRef = useRef<HTMLDivElement>(null);
  const scanItemsRef = useRef<HTMLDivElement>(null);
  const { useStretch: scanZoneExpanded, defaultSquarePx } = useScanZoneLayout(
    scanBodyRef,
    scanItemsRef,
    cart.length,
    { enabled: mobileInlineScanOpen },
  );

  return (
    <section
      className={cn(
        "pos-mobile-caisse-cart pos-surface flex h-full min-h-0 w-full min-w-0 flex-1 flex-col overflow-hidden md:hidden",
        className,
      )}
    >
      {!canManageDrafts ? (
        <PosCartDraftsSection
          drafts={drafts}
          loading={draftsLoading}
          locale={locale}
          tr={tr}
          onParkDraft={onParkDraft}
          onRestoreDraft={onRestoreDraft}
          onDeleteDraft={onDeleteDraft}
          parkDisabled={parkDisabled}
          busy={draftsBusy}
          canManageDrafts={canManageDrafts}
        />
      ) : null}

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      {mobileInlineScanOpen ? (
        <div
          ref={scanBodyRef}
          className="flex min-h-0 flex-1 flex-col overflow-hidden"
        >
          {showItemsWhileScanning ? (
            <div
              ref={scanItemsRef}
              className={cn(
                "min-h-0 overscroll-y-contain",
                scanZoneExpanded
                  ? "shrink-0 overflow-y-auto"
                  : "flex-1 overflow-y-auto",
              )}
              style={
                scanZoneExpanded && defaultSquarePx > 0
                  ? {
                      maxHeight: `calc(100% - ${defaultSquarePx}px - 0.5rem)`,
                    }
                  : undefined
              }
            >
              <CartItemsList
                cart={cart}
                cartHasItems={cartHasItems}
                locale={locale}
                tr={tr}
                onLineQtyChange={onLineQtyChange}
                onLineUnitPriceChange={onLineUnitPriceChange}
                allowPriceEdit={allowPriceEdit}
              />
            </div>
          ) : null}

          <div
            className={cn(
              "border-sidebar-border flex flex-col border-t py-1",
              scanZoneExpanded ? "min-h-0 flex-1" : "w-full shrink-0 grow-0",
            )}
            style={
              scanZoneExpanded && defaultSquarePx > 0
                ? { minHeight: defaultSquarePx }
                : undefined
            }
          >
            <PosInlineBarcodeScanner
              active
              onScan={onBarcodeScan}
              size="fill"
              fillStretch={scanZoneExpanded}
              className={cn(
                "w-full",
                scanZoneExpanded ? "min-h-0 flex-1" : "shrink-0",
              )}
            />
          </div>
        </div>
      ) : (
        <CartItemsList
          cart={cart}
          cartHasItems={cartHasItems}
          locale={locale}
          tr={tr}
          onLineQtyChange={onLineQtyChange}
          onLineUnitPriceChange={onLineUnitPriceChange}
          allowPriceEdit={allowPriceEdit}
          className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain"
        />
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
        compact
        locale={locale}
        tr={tr}
      />
    </section>
  );
}
