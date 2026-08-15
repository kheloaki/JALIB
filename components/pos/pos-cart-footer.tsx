"use client";

import { useQuery } from "convex/react";
import { Banknote, CheckCircle2, CreditCard, PauseCircle } from "lucide-react";

import { usePosClientCreditStatus } from "@/components/pos/hooks/use-pos-client-credit-status";
import { PosClientBalanceChip } from "@/components/pos/pos-client-balance-chip";
import { PosClientCombobox } from "@/components/pos/pos-client-combobox";
import { PosClientCreditBanner } from "@/components/pos/pos-client-credit-banner";
import type { PaymentMethod } from "@/components/pos/types";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { clientFromConvex } from "@/lib/convex/mappers";
import { formatPosDh } from "@/lib/pos/format-pos-dh";
import { cn } from "@/lib/utils";

type PosCartFooterProps = {
  cartEmpty: boolean;
  totalTtc: number;
  payment: PaymentMethod;
  onPaymentChange: (method: PaymentMethod) => void;
  selectedClientId: string | null;
  onClientChange: (clientId: string | null) => void;
  checkoutDisabledReason: string | null;
  onCheckout: () => void;
  allowCheckout?: boolean;
  onParkDraft?: () => void;
  parkDisabled?: boolean;
  parkBusy?: boolean;
  allowParkDraft?: boolean;
  allowCreditPayment?: boolean;
  compact?: boolean;
  locale: string;
  tr: (fr: string, ar: string) => string;
};

export function PosCartFooter({
  cartEmpty,
  totalTtc,
  payment,
  onPaymentChange,
  selectedClientId,
  onClientChange,
  checkoutDisabledReason,
  onCheckout,
  allowCheckout = true,
  onParkDraft,
  parkDisabled,
  parkBusy,
  allowParkDraft = false,
  allowCreditPayment = true,
  compact = false,
  locale,
  tr,
}: PosCartFooterProps) {
  const selectedClientRow = useQuery(
    api.clients.get,
    selectedClientId
      ? { clientId: selectedClientId as Id<"clients"> }
      : "skip",
  );
  const selectedClient = selectedClientRow
    ? clientFromConvex(selectedClientRow)
    : null;
  const clientCreditStatus = usePosClientCreditStatus({
    client: selectedClient,
    payment,
    cartTotalMad: totalTtc,
  });
  const checkoutDisabled = cartEmpty || !!checkoutDisabledReason;
  const parkActionDisabled = cartEmpty || parkDisabled || parkBusy;
  const creditClientMissing =
    payment === "credit" && !selectedClientId;
  const showCheckoutReason =
    checkoutDisabledReason &&
    !(compact && creditClientMissing);

  return (
    <div
      className={cn(
        "pos-cart-footer relative z-20 mt-auto flex shrink-0 flex-col",
        compact
          ? "gap-2 p-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]"
          : "gap-3 p-3 sm:p-4",
      )}
    >
      {!compact ? (
        <div className="flex items-center justify-between gap-2">
          <span className="text-on-surface text-sm font-bold">
            {tr("Total TTC", "الإجمالي شامل الضريبة")}
          </span>
          <span className="text-primary text-xl font-black tabular-nums">
            {formatPosDh(totalTtc, 2, locale)}
          </span>
        </div>
      ) : null}

      <div className={compact ? "space-y-1" : "space-y-1.5"}>
        {!compact ? (
          <p className="text-outline text-[10px] font-bold tracking-widest uppercase">
            {tr("Mode de Paiement", "طريقة الدفع")}
          </p>
        ) : null}
        <div className={cn("grid gap-2", allowCreditPayment ? "grid-cols-2" : "grid-cols-1")}>
          <button
            type="button"
            onClick={() => onPaymentChange("cash")}
            className={cn(
              "flex items-center justify-center gap-1.5 rounded-xl border-2 font-bold transition-all",
              compact ? "py-1.5 text-xs" : "py-2.5 text-sm",
              payment === "cash" ? "pos-btn-cash-active shadow-sm" : "pos-btn-cash",
            )}
          >
            <Banknote
              className={cn(
                "shrink-0 stroke-[1.75]",
                compact ? "size-3.5" : "size-4",
              )}
              aria-hidden
            />
            {tr("Espèces", "نقدًا")}
          </button>
          {allowCreditPayment ? (
            <button
              type="button"
              onClick={() => onPaymentChange("credit")}
              className={cn(
                "flex items-center justify-center gap-1.5 rounded-xl border-2 font-bold transition-all",
                compact ? "py-1.5 text-xs" : "py-2.5 text-sm",
                payment === "credit"
                  ? "pos-btn-credit-active shadow-sm"
                  : "pos-btn-credit",
              )}
            >
              <CreditCard
                className={cn(
                  "shrink-0 stroke-[1.75]",
                  compact ? "size-3.5" : "size-4",
                )}
                aria-hidden
              />
              {tr("Crédit", "آجل")}
            </button>
          ) : null}
        </div>
      </div>

      <div className={compact ? "space-y-1" : "space-y-1.5"}>
        {!compact ? (
          <p className="text-outline text-[10px] font-bold tracking-widest uppercase">
            {tr("Client", "العميل")}
          </p>
        ) : null}
        <PosClientCombobox
          selectedClientId={selectedClientId}
          onClientChange={onClientChange}
          payment={payment}
          tr={tr}
          compact={compact}
        />
        {creditClientMissing ? (
          <p className="text-error text-[11px] font-medium">
            {tr("Sélection client requise.", "يجب اختيار عميل.")}
          </p>
        ) : null}
        {selectedClientId ? (
          <PosClientBalanceChip
            status={clientCreditStatus}
            locale={locale}
            tr={tr}
            compact={compact}
          />
        ) : null}
        {payment === "credit" && selectedClientId && !clientCreditStatus.isCashOnly ? (
          <PosClientCreditBanner
            status={clientCreditStatus}
            cartTotalMad={totalTtc}
            locale={locale}
            tr={tr}
            compact={compact}
          />
        ) : null}
      </div>

      {allowCheckout && allowParkDraft && onParkDraft ? (
        <div className="grid w-full grid-cols-2 gap-2">
          <button
            type="button"
            onClick={onParkDraft}
            disabled={parkActionDisabled}
            className={cn(
              "pos-btn-attente flex w-full items-center justify-center gap-1.5 rounded-xl font-bold shadow-sm transition-all active:scale-[0.98]",
              compact ? "px-2 py-2 text-xs" : "px-3 py-3 text-sm",
              parkActionDisabled && "opacity-50 active:scale-100",
            )}
          >
            <PauseCircle
              className={cn(
                "shrink-0 stroke-[1.75]",
                compact ? "size-4" : "size-5",
              )}
              aria-hidden
            />
            <span className="truncate">
              {tr("Attente", "تعليق")}
            </span>
          </button>
          <button
            type="button"
            onClick={onCheckout}
            disabled={checkoutDisabled}
            className={cn(
              "pos-btn-valider flex w-full items-center justify-center gap-1.5 rounded-xl font-bold shadow-sm transition-all active:scale-[0.98]",
              compact ? "px-2 py-2 text-xs" : "px-3 py-3 text-sm",
              checkoutDisabled && "opacity-50 active:scale-100",
            )}
          >
            <CheckCircle2
              className={cn(
                "shrink-0 stroke-[1.75]",
                compact ? "size-4" : "size-5",
              )}
              aria-hidden
            />
            <span className="truncate">
              {tr("Valider", "تأكيد")}
            </span>
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={allowCheckout ? onCheckout : onParkDraft}
          disabled={allowCheckout ? checkoutDisabled : parkActionDisabled}
          className={cn(
            "flex w-full items-center rounded-xl font-bold shadow-sm transition-all active:scale-[0.98]",
            allowCheckout ? "pos-btn-valider" : "pos-btn-attente",
            compact ? "gap-2 px-3 py-2" : "justify-center gap-2 py-3 text-sm",
            (allowCheckout ? checkoutDisabled : parkActionDisabled) &&
              "opacity-50 active:scale-100",
          )}
        >
          {allowCheckout ? (
            <CheckCircle2
              className={cn(
                "shrink-0 stroke-[1.75]",
                compact ? "size-4" : "size-5",
              )}
              aria-hidden
            />
          ) : (
            <PauseCircle
              className={cn(
                "shrink-0 stroke-[1.75]",
                compact ? "size-4" : "size-5",
              )}
              aria-hidden
            />
          )}
          <span
            className={cn(compact ? "min-w-0 flex-1 text-left text-xs" : "text-sm")}
          >
            {allowCheckout
              ? tr("VALIDER LA VENTE", "تأكيد البيع")
              : tr("EN ATTENTE CAISSIER", "بانتظار الصندوق")}
          </span>
          {compact ? (
            <span className="shrink-0 text-sm font-black tabular-nums">
              {formatPosDh(totalTtc, 2, locale)}
            </span>
          ) : null}
        </button>
      )}
      {allowCheckout && showCheckoutReason ? (
        <p className="text-error text-center text-[11px] font-semibold">
          {checkoutDisabledReason}
        </p>
      ) : null}
    </div>
  );
}
