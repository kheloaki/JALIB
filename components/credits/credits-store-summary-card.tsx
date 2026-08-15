"use client";

import { useLocale } from "next-intl";
import { Wallet } from "lucide-react";

import { formatMad } from "@/lib/money/mad";

export type StoreCreditSummary = {
  totalInvoicedMad: number;
  totalPaidMad: number;
  totalReturnedMad: number;
  totalOutstandingMad: number;
  clientsWithDebt: number;
};

export function CreditsStoreSummaryCard({
  summary,
  tr,
}: {
  summary: StoreCreditSummary;
  tr: (fr: string, ar: string) => string;
}) {
  const locale = useLocale();

  return (
    <div className="bg-surface-container-lowest border-primary/35 overflow-hidden rounded-xl border shadow-sm">
      <div className="border-primary/25 bg-primary/5 flex items-start justify-between gap-4 border-b p-5">
        <div className="min-w-0">
          <p className="text-primary mb-2 text-[10px] font-black tracking-widest uppercase">
            {tr("Crédit total magasin", "إجمالي ديون المتجر")}
          </p>
          <p className="text-on-surface text-3xl font-black tabular-nums tracking-tight">
            {formatMad(summary.totalOutstandingMad, 2, locale)}
          </p>
          <p className="text-on-surface-variant mt-1 text-xs font-semibold">
            {summary.clientsWithDebt}{" "}
            {tr("client(s) avec dette active", "عميل بدين نشط")}
          </p>
        </div>
        <div className="bg-primary text-on-primary flex size-12 shrink-0 items-center justify-center rounded-2xl shadow-sm">
          <Wallet className="size-6 stroke-[1.75]" aria-hidden />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-px bg-sidebar-border/50 text-center">
        <div className="bg-surface-container-lowest px-3 py-4">
          <p className="text-on-surface-variant mb-1 text-[9px] font-black tracking-wider uppercase">
            {tr("Facturé", "مفوتر")}
          </p>
          <p className="text-on-surface text-sm font-black tabular-nums">
            {formatMad(summary.totalInvoicedMad, 2, locale)}
          </p>
        </div>
        <div className="bg-surface-container-lowest px-3 py-4">
          <p className="text-secondary mb-1 text-[9px] font-black tracking-wider uppercase">
            {tr("Payé", "مدفوع")}
          </p>
          <p className="text-secondary text-sm font-black tabular-nums">
            {formatMad(summary.totalPaidMad, 2, locale)}
          </p>
        </div>
        <div className="bg-surface-container-lowest px-3 py-4">
          <p className="text-primary mb-1 text-[9px] font-black tracking-wider uppercase">
            {tr("Retours", "إرجاعات")}
          </p>
          <p className="text-primary text-sm font-black tabular-nums">
            {formatMad(summary.totalReturnedMad, 2, locale)}
          </p>
        </div>
      </div>
    </div>
  );
}
