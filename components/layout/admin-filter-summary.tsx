"use client";

import { X } from "lucide-react";
import { useLocale } from "next-intl";

import { isFilterActive } from "@/lib/admin/filter-utils";
import { cn } from "@/lib/utils";

type AdminFilterSummaryProps = {
  filteredCount: number;
  totalCount: number;
  searchQuery?: string;
  onClearSearch?: () => void;
  /** e.g. category tab, date filter */
  extraActive?: boolean;
  extraLabel?: string;
  onClearExtra?: () => void;
  className?: string;
  itemLabel?: string;
  itemLabelPlural?: string;
};

export function AdminFilterSummary({
  filteredCount,
  totalCount,
  searchQuery = "",
  onClearSearch,
  extraActive = false,
  extraLabel,
  onClearExtra,
  className,
  itemLabel,
  itemLabelPlural,
}: AdminFilterSummaryProps) {
  const locale = useLocale();
  const isAr = locale === "ar";
  const tr = (fr: string, ar: string) => (isAr ? ar : fr);
  const trimmedSearch = searchQuery.trim();

  if (
    !isFilterActive(filteredCount, totalCount, searchQuery, extraActive)
  ) {
    return (
      <div
        className={cn(
          "text-muted-foreground flex flex-wrap items-center gap-2 text-sm",
          className,
        )}
      >
        <span className="bg-[var(--shell-main-muted)]/80 rounded-full px-3 py-1 font-semibold tabular-nums">
          {totalCount}{" "}
          {totalCount === 1
            ? itemLabel ?? tr("résultat", "نتيجة")
            : itemLabelPlural ?? itemLabel ?? tr("résultats", "نتائج")}
        </span>
      </div>
    );
  }

  const label =
    filteredCount === 1
      ? itemLabel ?? tr("résultat", "نتيجة")
      : itemLabelPlural ?? itemLabel ?? tr("résultats", "نتائج");

  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-2 text-sm",
        className,
      )}
    >
      <span className="bg-primary/10 text-primary rounded-full px-3 py-1 font-semibold tabular-nums">
        {filteredCount} {label}
        {filteredCount !== totalCount ? (
          <span className="text-primary/70 font-medium">
            {" "}
            {tr("sur", "من")} {totalCount}
          </span>
        ) : null}
      </span>

      {trimmedSearch ? (
        <span className="border border-[var(--border)] flex max-w-full items-center gap-1.5 rounded-full bg-white px-3 py-1 text-[12px] font-medium">
          <span className="truncate">
            {tr("Recherche", "بحث")}: « {trimmedSearch} »
          </span>
          {onClearSearch ? (
            <button
              type="button"
              onClick={onClearSearch}
              className="text-muted-foreground hover:text-foreground shrink-0 rounded-full p-0.5 transition-colors"
              aria-label={tr("Effacer la recherche", "مسح البحث")}
            >
              <X className="size-3.5" aria-hidden />
            </button>
          ) : null}
        </span>
      ) : null}

      {extraActive && extraLabel ? (
        <span className="border border-[var(--border)] flex max-w-full items-center gap-1.5 rounded-full bg-white px-3 py-1 text-[12px] font-medium">
          <span className="truncate">{extraLabel}</span>
          {onClearExtra ? (
            <button
              type="button"
              onClick={onClearExtra}
              className="text-muted-foreground hover:text-foreground shrink-0 rounded-full p-0.5 transition-colors"
              aria-label={tr("Effacer le filtre", "مسح الفلتر")}
            >
              <X className="size-3.5" aria-hidden />
            </button>
          ) : null}
        </span>
      ) : null}
    </div>
  );
}
