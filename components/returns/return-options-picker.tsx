"use client";

import { ClipboardList, PackageCheck } from "lucide-react";

import type { ReturnReason, StockDisposition } from "@/lib/returns/types";
import { cn } from "@/lib/utils";

const REASONS: ReturnReason[] = [
  "Endommagé",
  "Mauvais article",
  "Choix du client",
  "Autre",
];

function reasonShortLabel(
  reason: ReturnReason,
  tr: (fr: string, ar: string) => string,
) {
  switch (reason) {
    case "Endommagé":
      return tr("Endommagé", "تالف");
    case "Mauvais article":
      return tr("Mauvais article", "صنف خاطئ");
    case "Choix du client":
      return tr("Choix client", "خيار الزبون");
    case "Autre":
      return tr("Autre", "آخر");
    default:
      return reason;
  }
}

export function returnReasonLabel(
  reason: ReturnReason,
  tr: (fr: string, ar: string) => string,
) {
  return reasonShortLabel(reason, tr);
}

export function stockDispositionLabel(
  disposition: StockDisposition,
  tr: (fr: string, ar: string) => string,
) {
  return disposition === "Disponible"
    ? tr("Stock disponible", "مخزون متاح")
    : tr("Stock invendable", "مخزون غير قابل للبيع");
}

export function ReturnOptionsPicker({
  reason,
  onReasonChange,
  stockDisposition,
  onStockDispositionChange,
  tr,
}: {
  reason: ReturnReason;
  onReasonChange: (reason: ReturnReason) => void;
  stockDisposition: StockDisposition;
  onStockDispositionChange: (value: StockDisposition) => void;
  tr: (fr: string, ar: string) => string;
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <div className="border-sidebar-border bg-surface-container-lowest rounded-xl border p-4">
        <div className="mb-3 flex items-center justify-between gap-2">
          <p className="text-on-surface text-[11px] font-black tracking-widest uppercase">
            {tr("Motif du retour", "سبب الإرجاع")}
          </p>
          <ClipboardList className="text-outline size-4" aria-hidden />
        </div>
        <div className="grid grid-cols-2 gap-2">
          {REASONS.map((option) => {
            const active = reason === option;
            return (
              <button
                key={option}
                type="button"
                onClick={() => onReasonChange(option)}
                className={cn(
                  "border-sidebar-border rounded-xl border px-3 py-2.5 text-left text-sm font-bold transition-colors",
                  active
                    ? "border-primary bg-primary/10 text-primary"
                    : "bg-surface-container-low hover:bg-surface-container-high text-on-surface",
                )}
              >
                {reasonShortLabel(option, tr)}
              </button>
            );
          })}
        </div>
      </div>

      <div className="border-sidebar-border bg-surface-container-lowest rounded-xl border p-4">
        <div className="mb-3 flex items-center justify-between gap-2">
          <p className="text-on-surface text-[11px] font-black tracking-widest uppercase">
            {tr("Gestion du stock", "إدارة المخزون")}
          </p>
          <PackageCheck className="text-outline size-4" aria-hidden />
        </div>
        <div className="grid gap-2">
          {(
            [
              {
                value: "Invendable" as const,
                title: tr("Invendable", "غير قابل للبيع"),
                hint: tr("Article endommagé", "منتج تالف"),
                activeClass: "border-error bg-error/10 text-on-error-container",
              },
              {
                value: "Disponible" as const,
                title: tr("Disponible", "متاح"),
                hint: tr("Remis en rayon", "إعادة للرف"),
                activeClass: "border-secondary bg-secondary/10 text-on-secondary-container",
              },
            ] as const
          ).map((option) => {
            const active = stockDisposition === option.value;
            return (
              <button
                key={option.value}
                type="button"
                onClick={() => onStockDispositionChange(option.value)}
                className={cn(
                  "border-sidebar-border rounded-xl border px-3 py-3 text-left transition-colors",
                  active
                    ? option.activeClass
                    : "bg-surface-container-low hover:bg-surface-container-high",
                )}
              >
                <p className="text-sm font-black">{option.title}</p>
                <p className="text-on-surface-variant mt-0.5 text-xs font-medium">
                  {option.hint}
                </p>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
