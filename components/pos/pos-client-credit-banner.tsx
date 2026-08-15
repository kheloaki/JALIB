"use client";

import type { ClientCreditStatus } from "@/lib/pos/client-credit-status";
import { formatPosDh } from "@/lib/pos/format-pos-dh";
import { cn } from "@/lib/utils";

export function PosClientCreditBanner({
  status,
  cartTotalMad,
  locale,
  tr,
  compact = false,
}: {
  status: ClientCreditStatus;
  cartTotalMad: number;
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
          compact ? "px-2 py-1 text-[10px] leading-tight" : "rounded-xl px-3 py-2.5 text-xs",
        )}
      >
        {tr(
          "Ce client est marqué comptant uniquement.",
          "هذا العميل مخصص للدفع النقدي فقط.",
        )}
      </div>
    );
  }

  if (status.loading) {
    return (
      <div
        className={cn(
          "border-sidebar-border bg-surface-container-low text-on-surface-variant rounded-lg border font-medium",
          compact ? "px-2 py-1 text-[10px] leading-tight" : "rounded-xl px-3 py-2.5 text-xs",
        )}
      >
        {tr("Chargement du crédit client…", "جاري تحميل رصيد العميل…")}
      </div>
    );
  }

  const plafondLabel = status.unlimited
    ? tr("Sans plafond", "بدون سقف")
    : formatPosDh(status.plafondMad ?? 0, 2, locale);

  const resteLabel =
    status.resteApresPanierMad == null
      ? tr("Illimité", "غير محدود")
      : formatPosDh(status.resteApresPanierMad, 2, locale);

  const usageRatio =
    !status.unlimited && status.plafondMad != null && status.plafondMad > 0
      ? Math.min(
          100,
          ((status.encoursMad + Math.max(0, cartTotalMad)) / status.plafondMad) *
            100,
        )
      : 0;

  const shellClass = cn(
    "border",
    compact ? "rounded-lg px-2 py-1" : "rounded-xl px-3 py-2.5",
    status.exceedsLimit
      ? "border-error/40 bg-error-container/20"
      : status.nearLimit
        ? "border-warning/40 bg-warning/10"
        : "border-primary/20 bg-primary/5",
  );

  const barColor = status.exceedsLimit
    ? "bg-error"
    : status.nearLimit
      ? "bg-warning"
      : "bg-primary";

  if (compact) {
    const encoursLabel = formatPosDh(status.encoursMad, 2, locale);
    const panierLabel =
      cartTotalMad > 0 ? formatPosDh(cartTotalMad, 2, locale) : null;

    return (
      <div className={shellClass}>
        <div className="flex items-center justify-between gap-2 text-[10px] leading-tight">
          <span className="text-on-surface-variant min-w-0 truncate">
            {tr("Plafond", "السقف")}{" "}
            <span className="text-on-surface font-bold tabular-nums">
              {plafondLabel}
            </span>
          </span>
          <span
            className={cn(
              "shrink-0 font-bold tabular-nums",
              status.exceedsLimit ? "text-error" : "text-primary",
            )}
          >
            {tr("Reste", "متبقي")} {resteLabel}
          </span>
        </div>

        {!status.unlimited && status.plafondMad != null && status.plafondMad > 0 ? (
          <div className="bg-surface-container-high mt-1 h-1 overflow-hidden rounded-full">
            <div
              className={cn("h-full rounded-full transition-all duration-300", barColor)}
              style={{ width: `${usageRatio}%` }}
            />
          </div>
        ) : null}

        <p className="text-on-surface-variant mt-1 text-[10px] leading-tight">
          {tr("Enc.", "مستحق")}{" "}
          <span className="text-on-surface font-semibold tabular-nums">
            {encoursLabel}
          </span>
          {panierLabel ? (
            <>
              {" · "}
              {tr("Pan.", "سلة")}{" "}
              <span className="text-on-surface font-semibold tabular-nums">
                {panierLabel}
              </span>
            </>
          ) : null}
          {status.exceedsLimit ? (
            <span className="text-error font-semibold">
              {" · "}
              {tr("Plafond dépassé", "تجاوز السقف")}
            </span>
          ) : null}
        </p>
      </div>
    );
  }

  return (
    <div className={shellClass}>
      <div className="grid grid-cols-2 gap-2 text-xs">
        <div>
          <p className="text-outline text-[10px] font-bold tracking-wide uppercase">
            {tr("Plafond", "السقف")}
          </p>
          <p className="text-on-surface mt-0.5 text-sm font-black tabular-nums">
            {plafondLabel}
          </p>
        </div>
        <div className="text-right">
          <p className="text-outline text-[10px] font-bold tracking-wide uppercase">
            {tr("Reste disponible", "المتبقي المتاح")}
          </p>
          <p
            className={cn(
              "mt-0.5 text-sm font-black tabular-nums",
              status.exceedsLimit ? "text-error" : "text-primary",
            )}
          >
            {resteLabel}
          </p>
        </div>
      </div>

      {!status.unlimited && status.plafondMad != null && status.plafondMad > 0 ? (
        <>
          <div className="bg-surface-container-high mt-2.5 h-1.5 overflow-hidden rounded-full">
            <div
              className={cn(
                "h-full rounded-full transition-all duration-300",
                barColor,
              )}
              style={{ width: `${usageRatio}%` }}
            />
          </div>
          <p className="text-on-surface-variant mt-1.5 text-[11px] leading-snug">
            {tr("Encours", "الرصيد المستحق")}:{" "}
            <span className="font-bold tabular-nums">
              {formatPosDh(status.encoursMad, 2, locale)}
            </span>
            {cartTotalMad > 0 ? (
              <>
                {" "}
                · {tr("Panier", "السلة")}:{" "}
                <span className="font-bold tabular-nums">
                  {formatPosDh(cartTotalMad, 2, locale)}
                </span>
              </>
            ) : null}
          </p>
        </>
      ) : null}

      {status.exceedsLimit ? (
        <p className="text-error mt-2 text-[11px] font-semibold">
          {tr(
            "Plafond dépassé — vente à crédit toujours possible.",
            "تجاوز السقف — البيع الآجل ما زال ممكنًا.",
          )}
        </p>
      ) : null}
    </div>
  );
}
