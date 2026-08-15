"use client";

import { useMemo, useState } from "react";
import { useQuery } from "convex/react";
import { useLocale, useTranslations } from "next-intl";
import { useAdminChrome } from "@/components/layout/admin-chrome-context";
import { AdminFilterSummary } from "@/components/layout/admin-filter-summary";
import {
  Banknote,
  CreditCard,
  Package,
  Wallet,
  AlertTriangle,
  ChevronRight,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";

import { api } from "@/convex/_generated/api";
import {
  formatIsoDateLocal,
  resolvePeriodRange,
  type DashboardPeriodPreset,
} from "@/lib/dashboard/period-range";
import { buildClientSegmentHref } from "@/lib/clients/segment-url";
import { formatMad } from "@/lib/money/mad";
import {
  formatChartAxisLabelFr,
  formatChartDayFr,
  formatDateShortFr,
  getChartVisibleLabelIndices,
} from "@/lib/dates/format-date";
import { FrenchDateInput } from "@/components/ui/french-date-input";
import { cn } from "@/lib/utils";

const PRESETS: DashboardPeriodPreset[] = [
  "all",
  "today",
  "yesterday",
  "this_week",
  "last_week",
  "this_month",
  "last_month",
  "custom",
];

type ClientHomeRow = {
  clientId: string | null;
  name: string;
  lastTransactionDate: string;
  cashMad: number;
  creditMad: number;
  collectedMad: number;
  totalMad: number;
  invoiceCount: number;
};

function ClientHomeListCard({
  title,
  hint,
  clients,
  loading,
  emptyLabel,
  locale,
  t,
  seeAllHref,
}: {
  title: string;
  hint: string;
  clients: ClientHomeRow[];
  loading: boolean;
  emptyLabel: string;
  locale: string;
  t: (key: string, values?: Record<string, string | number>) => string;
  seeAllHref: string;
}) {
  return (
    <div className="pf-card p-4 sm:p-5">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h3 className="text-[16px] font-bold tracking-tight">{title}</h3>
          <p className="text-muted-foreground mt-0.5 text-[12px]">{hint}</p>
        </div>
        <Link
          href={seeAllHref}
          className="text-muted-foreground hover:text-primary flex shrink-0 items-center gap-0.5 text-[12px] font-semibold transition-colors"
        >
          {t("seeAll")}
          <ChevronRight className="size-4" aria-hidden />
        </Link>
      </div>
      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-10 animate-pulse rounded-xl bg-[var(--shell-main-muted)]" />
          ))}
        </div>
      ) : clients.length === 0 ? (
        <p className="text-muted-foreground py-6 text-center text-sm">{emptyLabel}</p>
      ) : (
        <div className="rounded-xl border border-[var(--border)]">
          <table className="w-full table-fixed border-collapse text-left text-[11px]">
            <colgroup>
              <col className="w-[2.75rem]" />
              <col className="w-[22%]" />
              <col className="w-[14%]" />
              <col className="w-[8%]" />
              <col className="w-[12%]" />
              <col className="w-[12%]" />
              <col className="w-[12%]" />
              <col className="w-[12%]" />
            </colgroup>
            <thead>
              <tr className="border-b bg-[var(--shell-main-muted)]/60 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
                <th className="px-2 py-2.5">#</th>
                <th className="px-2 py-2.5">{t("clientColClient")}</th>
                <th className="px-2 py-2.5">{t("clientColLastVisit")}</th>
                <th className="px-2 py-2.5">{t("invoiceCountLabel")}</th>
                <th className="px-2 py-2.5 text-right">{t("clientCashTotal")}</th>
                <th className="px-2 py-2.5 text-right">{t("clientCreditTotal")}</th>
                <th className="px-2 py-2.5 text-right">{t("clientCollectedTotal")}</th>
                <th className="px-2 py-2.5 text-right">{t("clientRevenueTotal")}</th>
              </tr>
            </thead>
            <tbody>
              {clients.map((client, index) => (
                <tr
                  key={client.clientId ?? client.name}
                  className="border-b last:border-b-0 hover:bg-[var(--shell-main-muted)]/40"
                >
                  <td className="px-2 py-2">
                    <span className="flex size-7 items-center justify-center rounded-full bg-[var(--shell-main-muted)] text-[11px] font-bold text-primary">
                      {index + 1}
                    </span>
                  </td>
                  <td className="truncate px-2 py-2 font-semibold" title={client.name}>
                    {client.name}
                  </td>
                  <td className="text-muted-foreground truncate px-2 py-2">
                    {formatDateShortFr(client.lastTransactionDate)}
                  </td>
                  <td className="text-muted-foreground px-2 py-2 text-center tabular-nums">
                    {client.invoiceCount}
                  </td>
                  <td className="px-2 py-2 text-right font-semibold tabular-nums">
                    {formatMad(client.cashMad, 0, locale)}
                  </td>
                  <td className="px-2 py-2 text-right font-semibold tabular-nums">
                    {formatMad(client.creditMad, 0, locale)}
                  </td>
                  <td className="px-2 py-2 text-right font-semibold tabular-nums">
                    {formatMad(client.collectedMad, 0, locale)}
                  </td>
                  <td className="px-2 py-2 text-right font-bold tabular-nums">
                    {formatMad(client.totalMad, 0, locale)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function PeriodKpiCard({
  label,
  value,
  icon: Icon,
  tone,
  loading,
  hint,
}: {
  label: string;
  value: string;
  icon: LucideIcon;
  tone: "cash" | "credit" | "collected" | "items";
  loading?: boolean;
  hint?: string;
}) {
  const iconWrap = {
    cash: "bg-emerald-500/10 text-emerald-700",
    credit: "bg-primary/10 text-primary",
    collected: "bg-violet-500/10 text-violet-700",
    items: "bg-amber-500/10 text-amber-800",
  }[tone];

  return (
    <div className="pf-card min-w-[160px] flex-1 p-4 sm:min-w-[180px]">
      <div className="mb-3 flex items-start justify-between gap-2">
        <p className="text-muted-foreground text-[12px] font-medium leading-snug">
          {label}
        </p>
        <span
          className={cn(
            "flex size-9 shrink-0 items-center justify-center rounded-xl",
            iconWrap,
          )}
        >
          <Icon className="size-4 stroke-[1.75]" aria-hidden />
        </span>
      </div>
      {loading ? (
        <div className="bg-[var(--shell-main-muted)] h-8 w-28 animate-pulse rounded-lg" />
      ) : (
        <p className="text-[22px] font-bold tracking-tight tabular-nums sm:text-[24px]">
          {value}
        </p>
      )}
      {hint ? (
        <p className="text-muted-foreground mt-1 text-[11px]">{hint}</p>
      ) : null}
    </div>
  );
}

function formatCompactMad(value: number, locale: string) {
  return `${new Intl.NumberFormat(locale === "ar" ? "ar-MA" : "fr-FR", {
    maximumFractionDigits: 0,
  }).format(value)} MAD`;
}

function DailySalesChart({
  rows,
  loading,
  monthly = false,
}: {
  rows: Array<{
    date: string;
    totalSalesMad: number;
    collectedMad: number;
    cashMad: number;
    creditMad: number;
    itemsSold: number;
    invoiceCount: number;
  }>;
  loading: boolean;
  monthly?: boolean;
}) {
  const locale = useLocale();
  const t = useTranslations("dashboard");
  const max = Math.max(1, ...rows.map((row) => row.totalSalesMad));
  const ticks = [max, max * 0.75, max * 0.5, max * 0.25, 0];
  const hasData = rows.some((row) => row.totalSalesMad > 0);
  const visibleLabelIndices = useMemo(
    () => getChartVisibleLabelIndices(rows.length, monthly ? 6 : 8),
    [monthly, rows.length],
  );
  const useCompactLabels = monthly ? rows.length > 6 : rows.length > 14;
  const barSlotWidth = monthly
    ? rows.length > 18
      ? 48
      : rows.length > 10
        ? 40
        : 32
    : rows.length > 31
      ? 28
      : 24;
  const chartMinWidth = Math.max(320, rows.length * barSlotWidth + 72);

  const formatAxisLabel = (iso: string) =>
    formatChartAxisLabelFr(iso, { monthly, compact: useCompactLabels });

  const formatTooltipLabel = (iso: string) => formatChartDayFr(iso, monthly);

  const PLOT_HEIGHT = 200;

  return (
    <div className="pf-card overflow-hidden p-4 sm:p-5">
      <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3 className="text-[16px] font-bold tracking-tight">
            {t("dailySalesChartTitle")}
          </h3>
          <p className="text-muted-foreground mt-0.5 text-[12px]">
            {t("dailySalesChartHint")}
          </p>
        </div>
        <div className="flex items-center gap-2 rounded-full bg-[var(--shell-main-muted)] px-3 py-1.5 text-[11px] font-semibold text-[#6b5345]">
          <span className="size-2 rounded-full bg-[#bd6b4a]" />
          {t("totalSales")}
        </div>
      </div>

      {loading ? (
        <div className="h-[260px] animate-pulse rounded-2xl bg-[var(--shell-main-muted)]" />
      ) : !hasData ? (
        <div className="flex h-[260px] items-center justify-center rounded-2xl border border-dashed border-[var(--border)] text-center">
          <p className="text-muted-foreground text-sm">{t("noPeriodSales")}</p>
        </div>
      ) : (
        <div className="overflow-x-auto pb-2">
          <div
            className="grid grid-cols-[64px_minmax(0,1fr)] gap-x-3"
            style={{ minWidth: chartMinWidth }}
          >
            {/* Y-axis ticks aligned to the plot height only */}
            <div
              className="flex flex-col justify-between text-right"
              style={{ height: PLOT_HEIGHT }}
            >
              {ticks.map((tick, i) => (
                <span
                  key={i}
                  className="text-muted-foreground text-[10px] leading-none"
                >
                  {formatCompactMad(tick, locale)}
                </span>
              ))}
            </div>

            {/* Plot: grid + bars share the same baseline at 0 */}
            <div className="relative" style={{ height: PLOT_HEIGHT }}>
              <div className="pointer-events-none absolute inset-0 flex flex-col justify-between">
                {ticks.map((_, i) => (
                  <div
                    key={i}
                    className={cn(
                      "border-t border-dashed border-black/10",
                      i === ticks.length - 1 && "border-solid border-black/15",
                    )}
                  />
                ))}
              </div>
              <div
                className="relative z-10 flex h-full items-end gap-1"
                style={{ minWidth: rows.length * barSlotWidth }}
              >
                {rows.map((row) => {
                  const heightPct =
                    row.totalSalesMad > 0
                      ? Math.max(2, (row.totalSalesMad / max) * 100)
                      : 0;
                  return (
                    <div
                      key={row.date}
                      className="group flex h-full min-w-0 items-end justify-center"
                      style={{ width: barSlotWidth, flex: "0 0 auto" }}
                      title={`${formatTooltipLabel(row.date)}: ${formatMad(row.totalSalesMad, 2, locale)}`}
                    >
                      <div
                        className="w-full max-w-[24px] rounded-t-md bg-[#bd6b4a] shadow-[0_8px_16px_rgba(189,107,74,0.18)] transition-all group-hover:bg-primary"
                        style={{ height: `${heightPct}%` }}
                      />
                    </div>
                  );
                })}
              </div>
            </div>

            {/* spacer under Y-axis */}
            <div aria-hidden />

            {/* X-axis labels below the 0 baseline */}
            <div
              className="mt-2 flex gap-1"
              style={{ minWidth: rows.length * barSlotWidth }}
            >
              {rows.map((row, index) => {
                const showLabel = visibleLabelIndices.has(index);
                return (
                  <div
                    key={row.date}
                    className="flex min-w-0 justify-center"
                    style={{ width: barSlotWidth, flex: "0 0 auto" }}
                  >
                    <span
                      className={cn(
                        "text-muted-foreground text-center text-[10px] font-medium whitespace-nowrap",
                        !showLabel && "invisible",
                      )}
                      aria-hidden={!showLabel}
                    >
                      {formatAxisLabel(row.date)}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export function DashboardPeriodKpis({ enabled }: { enabled: boolean }) {
  const locale = useLocale();
  const t = useTranslations("dashboard");
  const { headerSearchQuery, setHeaderSearchQuery } = useAdminChrome();
  const [preset, setPreset] = useState<DashboardPeriodPreset>("today");
  const todayIso = formatIsoDateLocal(new Date());
  const [customStart, setCustomStart] = useState(todayIso);
  const [customEnd, setCustomEnd] = useState(todayIso);

  const range = useMemo(
    () =>
      resolvePeriodRange(
        preset,
        preset === "custom" ? customStart : undefined,
        preset === "custom" ? customEnd : undefined,
      ),
    [customEnd, customStart, preset],
  );

  const clientsSeeAllHref = (
    segment: "active" | "inactive",
  ) =>
    buildClientSegmentHref(
      locale,
      segment,
      preset,
      range,
      customStart,
      customEnd,
    );

  const summary = useQuery(
    api.dashboard.periodSummary,
    enabled
      ? { startDate: range.startDate, endDate: range.endDate }
      : "skip",
  );
  const clientLists = useQuery(
    api.dashboard.clientActivityLists,
    enabled
      ? { startDate: range.startDate, endDate: range.endDate }
      : "skip",
  );
  const lowStock = useQuery(api.dashboard.lowStockProducts, enabled ? {} : "skip");

  const loading = enabled && summary === undefined;
  const clientsLoading = enabled && clientLists === undefined;
  const lowStockLoading = enabled && lowStock === undefined;

  const searchQuery = headerSearchQuery.trim().toLowerCase();

  const filteredActiveClients = useMemo(
    () =>
      (clientLists?.activeClients ?? []).filter((row) => {
        if (!searchQuery) return true;
        return row.name.toLowerCase().includes(searchQuery);
      }),
    [clientLists?.activeClients, searchQuery],
  );
  const filteredInactiveClients = useMemo(
    () =>
      (clientLists?.inactiveClients ?? []).filter((row) => {
        if (!searchQuery) return true;
        return row.name.toLowerCase().includes(searchQuery);
      }),
    [clientLists?.inactiveClients, searchQuery],
  );
  const filteredLowStock = useMemo(
    () =>
      (lowStock?.products ?? []).filter((product) => {
        if (!searchQuery) return true;
        return product.name.toLowerCase().includes(searchQuery);
      }),
    [lowStock?.products, searchQuery],
  );
  const filteredTopProducts = useMemo(
    () =>
      (summary?.topProducts ?? []).filter((product) => {
        if (!searchQuery) return true;
        return product.name.toLowerCase().includes(searchQuery);
      }),
    [searchQuery, summary?.topProducts],
  );

  const dashboardFilterTotal = useMemo(() => {
    return (
      (clientLists?.activeClients.length ?? 0) +
      (clientLists?.inactiveClients.length ?? 0) +
      (lowStock?.products.length ?? 0) +
      (summary?.topProducts.length ?? 0)
    );
  }, [clientLists, lowStock, summary?.topProducts]);

  const dashboardFilterCount = useMemo(() => {
    return (
      filteredActiveClients.length +
      filteredInactiveClients.length +
      filteredLowStock.length +
      filteredTopProducts.length
    );
  }, [
    filteredActiveClients.length,
    filteredInactiveClients.length,
    filteredLowStock.length,
    filteredTopProducts.length,
  ]);

  if (!enabled) return null;

  return (
    <section className="mb-5 space-y-4">
      <div className="flex gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {PRESETS.map((id) => (
          <button
            key={id}
            type="button"
            onClick={() => setPreset(id)}
            className={cn(
              "shrink-0 rounded-full px-4 py-2 text-[12px] font-semibold transition-colors",
              preset === id
                ? "bg-primary text-primary-foreground shadow-sm"
                : "border border-[var(--border)] bg-white text-foreground hover:bg-[var(--shell-main-muted)]",
            )}
          >
            {t(`period.${id}`)}
          </button>
        ))}
      </div>

      {preset === "custom" ? (
        <div className="flex flex-wrap items-end gap-3">
          <label className="space-y-1">
            <span className="text-muted-foreground text-[11px] font-semibold uppercase tracking-wide">
              {t("period.from")}
            </span>
            <FrenchDateInput
              value={customStart}
              onValueChange={setCustomStart}
              className="border border-[var(--border)] h-10 rounded-xl bg-white px-3 text-sm"
            />
          </label>
          <label className="space-y-1">
            <span className="text-muted-foreground text-[11px] font-semibold uppercase tracking-wide">
              {t("period.to")}
            </span>
            <FrenchDateInput
              value={customEnd}
              onValueChange={setCustomEnd}
              className="border border-[var(--border)] h-10 rounded-xl bg-white px-3 text-sm"
            />
          </label>
        </div>
      ) : null}

      {searchQuery ? (
        <AdminFilterSummary
          filteredCount={dashboardFilterCount}
          totalCount={dashboardFilterTotal}
          searchQuery={headerSearchQuery}
          onClearSearch={() => setHeaderSearchQuery("")}
          itemLabel={locale === "ar" ? "عنصر" : "élément"}
          itemLabelPlural={locale === "ar" ? "عناصر" : "éléments"}
        />
      ) : null}

      <div className="flex gap-3 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <PeriodKpiCard
          label={t("kpiCashReceived")}
          value={formatMad(summary?.cashReceivedMad ?? 0, 2, locale)}
          icon={Banknote}
          tone="cash"
          loading={loading}
          hint={t("cashInvoicesCount", { count: summary?.cashInvoiceCount ?? 0 })}
        />
        <PeriodKpiCard
          label={t("kpiCreditSales")}
          value={formatMad(summary?.creditSalesMad ?? 0, 2, locale)}
          icon={CreditCard}
          tone="credit"
          loading={loading}
          hint={t("creditInvoicesCount", { count: summary?.creditInvoiceCount ?? 0 })}
        />
        <PeriodKpiCard
          label={t("kpiCollected")}
          value={formatMad(summary?.creditPaymentsMad ?? 0, 2, locale)}
          icon={Wallet}
          tone="collected"
          loading={loading}
          hint={t("creditPaymentsHint")}
        />
        <PeriodKpiCard
          label={t("kpiItemsSold")}
          value={String(summary?.itemsSold ?? 0)}
          icon={Package}
          tone="items"
          loading={loading}
          hint={t("invoiceCount", { count: summary?.invoiceCount ?? 0 })}
        />
      </div>

      <DailySalesChart
        rows={summary?.daily ?? []}
        loading={loading}
        monthly={summary?.chartGranularity === "month"}
      />

      <div className="pf-card p-4 sm:p-5">
        <h3 className="text-[16px] font-bold tracking-tight">
          {t("topPeriodProducts")}
        </h3>
        <div className="mt-4 space-y-3">
          {loading ? (
            Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-10 animate-pulse rounded-xl bg-[var(--shell-main-muted)]" />
            ))
          ) : (summary?.topProducts.length ?? 0) === 0 ? (
            <p className="text-muted-foreground py-6 text-center text-sm">
              {t("noTopProducts")}
            </p>
          ) : (
            filteredTopProducts.map((product, index) => (
              <div
                key={product.name}
                className="flex items-center justify-between gap-3 rounded-2xl bg-[var(--shell-main-muted)]/70 px-3 py-2.5"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-white text-[12px] font-bold text-primary">
                    {index + 1}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-[13px] font-semibold">{product.name}</p>
                    <p className="text-muted-foreground text-[11px]">
                      {t("soldQty", { count: product.qty })}
                    </p>
                  </div>
                </div>
                <p className="shrink-0 text-right text-[12px] font-bold tabular-nums">
                  {formatMad(product.totalMad, 0, locale)}
                </p>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="flex flex-col gap-4">
        <ClientHomeListCard
          title={t("topActiveClientsTitle")}
          hint={t("topActiveClientsHint")}
          clients={filteredActiveClients}
          loading={clientsLoading}
          emptyLabel={t("noActiveClients")}
          locale={locale}
          t={t}
          seeAllHref={clientsSeeAllHref("active")}
        />
        <ClientHomeListCard
          title={t("topInactiveClientsTitle")}
          hint={t("topInactiveClientsHint")}
          clients={filteredInactiveClients}
          loading={clientsLoading}
          emptyLabel={t("noInactiveClients")}
          locale={locale}
          t={t}
          seeAllHref={clientsSeeAllHref("inactive")}
        />
      </div>

      <div className="pf-card p-4 sm:p-5">
          <div className="mb-4 flex items-start justify-between gap-3">
            <div>
              <h3 className="text-[16px] font-bold tracking-tight">
                {t("lowStockItemsTitle")}
              </h3>
              <p className="text-muted-foreground mt-0.5 text-[12px]">
                {t("lowStockItemsHint", { threshold: lowStock?.threshold ?? 10 })}
              </p>
            </div>
            <Link
              href={`/${locale}/stock?filter=low`}
              className="text-muted-foreground hover:text-primary flex shrink-0 items-center gap-0.5 text-[12px] font-semibold transition-colors"
            >
              {t("seeAll")}
              <ChevronRight className="size-4" aria-hidden />
            </Link>
          </div>
          <div className="space-y-3">
            {lowStockLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="h-10 animate-pulse rounded-xl bg-[var(--shell-main-muted)]" />
              ))
            ) : filteredLowStock.length === 0 ? (
              <p className="text-muted-foreground py-6 text-center text-sm">
                {t("noLowStockItems")}
              </p>
            ) : (
              filteredLowStock.map((product, index) => (
                <div
                  key={product.productId}
                  className="flex items-center justify-between gap-3 rounded-2xl bg-[var(--shell-main-muted)]/70 px-3 py-2.5"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <span
                      className={cn(
                        "flex size-8 shrink-0 items-center justify-center rounded-full text-[12px] font-bold",
                        product.isOutOfStock
                          ? "bg-red-500/10 text-red-700"
                          : "bg-amber-500/10 text-amber-800",
                      )}
                    >
                      {product.isOutOfStock ? (
                        <AlertTriangle className="size-3.5" aria-hidden />
                      ) : (
                        index + 1
                      )}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-[13px] font-semibold">{product.name}</p>
                      <p className="text-muted-foreground truncate text-[11px]">
                        {product.categoryLabel}
                      </p>
                    </div>
                  </div>
                  <div className="shrink-0 text-right">
                    <p
                      className={cn(
                        "text-[12px] font-bold tabular-nums",
                        product.isOutOfStock ? "text-red-700" : "text-amber-800",
                      )}
                    >
                      {product.isOutOfStock
                        ? t("outOfStock")
                        : t("stockRemaining", { count: product.stockQty })}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
    </section>
  );
}
