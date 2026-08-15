"use client";

import type { MonthInvoicedPaid } from "@/lib/dashboard/aggregate-credits";
import { cn } from "@/lib/utils";

type CreditsTrendChartProps = {
  series: MonthInvoicedPaid[];
  className?: string;
};

function formatAxis(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(n % 1000 === 0 ? 0 : 1)}k`;
  return String(Math.round(n));
}

export function CreditsTrendChart({ series, className }: CreditsTrendChartProps) {
  if (series.length === 0) {
    return (
      <div
        className={cn(
          "border-sidebar-border bg-surface-container-low/40 flex min-h-[220px] items-center justify-center rounded-xl border border-dashed",
          className,
        )}
      >
        <p className="text-on-surface-variant max-w-xs px-4 text-center text-sm">
          Pas encore assez d&apos;écritures pour tracer l&apos;historique.
          Consultez{" "}
          <span className="text-on-surface font-semibold">Crédits</span> après
          des mouvements.
        </p>
      </div>
    );
  }

  const maxVal = Math.max(
    1,
    ...series.flatMap((s) => [s.invoicedMad, s.paidMad]),
  );
  const n = series.length;
  const chartH = 168;
  const chartW = 520;
  const padL = 44;
  const padB = 36;
  const padT = 12;
  const innerW = chartW - padL - 8;
  const innerH = chartH - padB - padT;
  const groupW = innerW / n;
  const barW = Math.min(28, (groupW - 8) / 2);

  return (
    <div className={cn("w-full", className)}>
      <svg
        viewBox={`0 0 ${chartW} ${chartH}`}
        className="text-on-surface h-auto w-full max-w-full"
        role="img"
        aria-label="Histogramme facturation et encaissements par mois, en dirhams"
      >
        <title>Facturé vs encaissé par mois (MAD)</title>
        <desc>
          Barres bleues : factures crédit. Barres vertes : paiements reçus.
        </desc>

        {[0, 0.25, 0.5, 0.75, 1].map((t) => {
          const y = padT + innerH * (1 - t);
          const val = maxVal * t;
          return (
            <g key={t}>
              <line
                x1={padL}
                y1={y}
                x2={chartW - 4}
                y2={y}
                className="stroke-sidebar-border/80"
                strokeWidth={1}
                strokeDasharray={t === 0 ? "0" : "4 4"}
              />
              <text
                x={padL - 6}
                y={y + 4}
                textAnchor="end"
                className="fill-current text-outline text-[10px] font-bold tabular-nums"
              >
                {formatAxis(val)}
              </text>
            </g>
          );
        })}

        {series.map((s, i) => {
          const gx = padL + i * groupW + groupW / 2;
          const hInv = (s.invoicedMad / maxVal) * innerH;
          const hPay = (s.paidMad / maxVal) * innerH;
          const baseY = padT + innerH;
          return (
            <g key={s.monthKey}>
              <rect
                x={gx - barW - 2}
                y={baseY - hInv}
                width={barW}
                height={Math.max(hInv, 0)}
                rx={4}
                className="fill-primary"
              />
              <rect
                x={gx + 2}
                y={baseY - hPay}
                width={barW}
                height={Math.max(hPay, 0)}
                rx={4}
                className="fill-secondary"
              />
              <text
                x={gx}
                y={chartH - 10}
                textAnchor="middle"
                className="fill-current text-on-surface-variant text-[10px] font-bold capitalize"
              >
                {s.label.replace(".", "")}
              </text>
            </g>
          );
        })}
      </svg>

      <div className="mt-2 flex flex-wrap items-center justify-center gap-6 text-xs font-bold">
        <span className="text-on-surface-variant flex items-center gap-2">
          <span className="bg-primary inline-block size-2.5 rounded-sm" />
          Facturé (crédit)
        </span>
        <span className="text-on-surface-variant flex items-center gap-2">
          <span className="bg-secondary inline-block size-2.5 rounded-sm" />
          Encaissé
        </span>
      </div>
    </div>
  );
}
