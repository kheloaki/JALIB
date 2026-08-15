"use client";

import type { ClientCreditStatus } from "@/lib/pos/client-credit-status";
import { soldeToneClass } from "@/lib/credits/ledger-ui";
import { formatPosDh } from "@/lib/pos/format-pos-dh";
import { cn } from "@/lib/utils";

/** Compact solde line under the caisse client picker (+avoir / −dette). */
export function PosClientBalanceChip({
  status,
  locale,
  tr,
  compact = false,
}: {
  status: ClientCreditStatus;
  locale: string;
  tr: (fr: string, ar: string) => string;
  compact?: boolean;
}) {
  if (!status.visible) return null;

  if (status.isCashOnly) {
    return (
      <div
        className={cn(
          "border-warning/30 bg-warning/10 text-on-surface rounded-lg border font-medium",
          compact
            ? "px-2 py-1 text-[10px] leading-tight"
            : "rounded-xl px-3 py-2 text-xs",
        )}
      >
        {tr(
          "Client comptant uniquement.",
          "عميل نقدي فقط.",
        )}
      </div>
    );
  }

  if (status.loading) {
    return (
      <div
        className={cn(
          "border-sidebar-border bg-surface-container-low text-on-surface-variant rounded-lg border font-medium",
          compact
            ? "px-2 py-1 text-[10px] leading-tight"
            : "rounded-xl px-3 py-2 text-xs",
        )}
      >
        {tr("Chargement du solde…", "جاري تحميل الرصيد…")}
      </div>
    );
  }

  const tone = soldeToneClass(status.soldeMad);
  const kindLabel =
    status.soldeMad > 0.009
      ? tr("Avoir", "رصيد دائن")
      : status.soldeMad < -0.009
        ? tr("Dette", "دين")
        : tr("Soldé", "مسدد");

  return (
    <div
      className={cn(
        "border-primary/20 bg-primary/5 flex items-center justify-between gap-2 border",
        compact
          ? "rounded-lg px-2 py-1 text-[10px] leading-tight"
          : "rounded-xl px-3 py-2 text-xs",
      )}
    >
      <span className="text-on-surface-variant font-medium">
        {tr("Solde", "الرصيد")}
      </span>
      <span className="flex min-w-0 items-center gap-2">
        <span className={cn("font-black tabular-nums", tone)}>
          {formatPosDh(status.soldeMad, 2, locale)}
        </span>
        <span
          className={cn(
            "shrink-0 text-[10px] font-bold tracking-wide uppercase",
            tone,
          )}
        >
          {kindLabel}
        </span>
      </span>
    </div>
  );
}
