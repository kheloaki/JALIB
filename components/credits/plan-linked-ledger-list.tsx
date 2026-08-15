"use client";

import { useState } from "react";
import { useLocale } from "next-intl";
import { ChevronDown } from "lucide-react";

import {
  formatLedgerDate,
  ledgerAmountClass,
  ledgerAmountSign,
  ledgerKindLabel,
  resolveLedgerTime,
  statusBadgeClass,
  statusLabel,
} from "@/lib/credits/ledger-ui";
import type { LedgerEntry } from "@/lib/credits/types";
import { formatMad } from "@/lib/money/mad";
import { statusPillClass } from "@/lib/ui/status-pill";
import { cn } from "@/lib/utils";

export function PlanLinkedLedgerList({
  planId,
  ledgerByPlanId,
}: {
  planId: string;
  ledgerByPlanId: Map<string, LedgerEntry[]>;
}) {
  const locale = useLocale();
  const isAr = locale === "ar";
  const tr = (fr: string, ar: string) => (isAr ? ar : fr);
  const [open, setOpen] = useState(false);
  const lines = ledgerByPlanId.get(planId) ?? [];
  const panelId = `plan-ledger-${planId.replace(/[^a-zA-Z0-9_-]/g, "")}`;
  const triggerId = `${panelId}-trigger`;

  return (
    <div className="border-outline-variant/30 mt-3 border-t pt-1">
      <button
        type="button"
        id={triggerId}
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((v) => !v)}
        className="hover:bg-surface-container-low/70 focus-visible:ring-primary/30 flex w-full items-center justify-between gap-3 rounded-xl px-2 py-2.5 text-left transition-colors focus-visible:ring-2 focus-visible:outline-none"
      >
        <span className="text-on-surface-variant text-[10px] font-bold tracking-widest uppercase">
          {tr("Historique du plan", "سجل الخطة")}
        </span>
        <span className="flex shrink-0 items-center gap-2">
          <span className="bg-surface-container-high text-outline rounded-full px-2 py-0.5 text-[10px] font-bold tabular-nums">
            {lines.length} {tr("écriture", "قيد")}
            {lines.length !== 1 ? tr("s", "") : ""}
          </span>
          <ChevronDown
            className={cn(
              "text-on-surface-variant size-4 shrink-0 stroke-[2] transition-transform duration-200",
              open && "rotate-180",
            )}
            aria-hidden
          />
        </span>
      </button>
      {open ? (
        <div
          id={panelId}
          role="region"
          aria-labelledby={triggerId}
          className="border-outline-variant/20 mt-1 rounded-xl border bg-surface-container-low/30 px-1 pb-2 pt-1"
        >
          {lines.length === 0 ? (
            <p className="text-on-surface-variant px-2 py-3 text-[11px] leading-relaxed">
              {tr(
                "Aucune écriture liée à ce plan (facture ou paiement) dans le livre du client.",
                "لا توجد قيود مرتبطة بهذه الخطة (فاتورة أو دفعة) في سجل العميل.",
              )}
            </p>
          ) : (
            <ul className="no-scrollbar max-h-52 space-y-2 overflow-y-auto overscroll-y-contain px-1 py-1 pr-2">
              {lines.map((e) => (
                <li
                  key={e.id}
                  className="bg-surface-container-lowest flex flex-col gap-2 rounded-xl border border-transparent px-3 py-2.5 shadow-sm sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-on-surface text-xs font-bold">
                      {ledgerKindLabel(e, isAr)}
                    </p>
                    <p className="text-outline truncate text-[11px] font-medium">
                      {e.ref}
                    </p>
                    {e.note ? (
                      <p className="text-on-surface-variant mt-0.5 line-clamp-2 text-[11px]">
                        {e.note}
                      </p>
                    ) : null}
                  </div>
                  <div className="flex shrink-0 flex-row items-center gap-3 sm:flex-col sm:items-end sm:gap-1">
                    <p className="text-on-surface-variant text-[10px] font-medium whitespace-nowrap sm:text-right">
                      {formatLedgerDate(e.date)}
                      {resolveLedgerTime(e)
                        ? ` · ${resolveLedgerTime(e)}`
                        : ""}
                    </p>
                    <p
                      className={cn(
                        "text-sm font-black tabular-nums whitespace-nowrap",
                        ledgerAmountClass(e),
                      )}
                    >
                      {ledgerAmountSign(e)} {formatMad(e.amountMad, 2, locale)}
                    </p>
                    <span
                      className={cn(
                        statusPillClass,
                        "px-2 py-0.5 text-[9px] font-black uppercase",
                        statusBadgeClass(e.status),
                      )}
                    >
                      {statusLabel(e.status, isAr)}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  );
}
