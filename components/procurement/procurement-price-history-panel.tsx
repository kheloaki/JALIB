"use client";

import { useQuery } from "convex/react";

import { ProductCatalogImage } from "@/components/products/product-catalog-image";
import { InlineCardSkeleton } from "@/components/skeletons";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { formatMadCompact } from "@/lib/money/mad";

type ProductPreview = {
  name: string;
  category: string;
  image: string;
  imageAlt: string;
};

type ProcurementPriceHistoryPanelProps = {
  productId: Id<"products"> | null;
  productPreview?: ProductPreview | null;
  locale: string;
  tr: (key: string) => string;
  formatDate: (iso: string) => string;
};

export function ProcurementPriceHistoryPanel({
  productId,
  productPreview,
  locale,
  tr,
  formatDate,
}: ProcurementPriceHistoryPanelProps) {
  const priceSummary = useQuery(
    api.products.purchasePriceSummary,
    productId ? { productId } : "skip",
  );

  if (!productId) {
    return (
      <p className="text-muted-foreground text-sm">{tr("selectProductHint")}</p>
    );
  }

  if (!productPreview) {
    return (
      <p className="text-muted-foreground text-sm">{tr("selectProductHint")}</p>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <ProductCatalogImage
          src={productPreview.image}
          alt={productPreview.imageAlt}
          wrapperClassName="size-14 shrink-0 rounded-lg bg-slate-100"
          sizes="56px"
        />
        <div className="min-w-0">
          <p className="font-semibold leading-snug">{productPreview.name}</p>
          <p className="text-muted-foreground text-xs">{productPreview.category}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="bg-surface rounded-xl p-3">
          <p className="text-muted-foreground text-[10px] font-semibold tracking-wide uppercase">
            {tr("lastPrice")}
          </p>
          <p className="text-primary mt-1 text-lg font-black">
            {priceSummary?.lastCostMad != null
              ? formatMadCompact(priceSummary.lastCostMad, 2, locale)
              : "—"}
          </p>
          {priceSummary?.lastAt ? (
            <p className="text-muted-foreground mt-0.5 text-[10px]">
              {formatDate(priceSummary.lastAt)}
            </p>
          ) : null}
        </div>
        <div className="bg-surface rounded-xl p-3">
          <p className="text-muted-foreground text-[10px] font-semibold tracking-wide uppercase">
            {tr("lowestPrice")}
          </p>
          <p className="text-tertiary mt-1 text-lg font-black">
            {priceSummary?.minCostMad != null
              ? formatMadCompact(priceSummary.minCostMad, 2, locale)
              : "—"}
          </p>
        </div>
      </div>

      <div>
        <p className="text-muted-foreground mb-2 text-xs font-semibold">
          {tr("recentHistory")}
        </p>
        {priceSummary === undefined ? (
          <InlineCardSkeleton lines={3} />
        ) : priceSummary.recent.length === 0 ? (
          <p className="text-muted-foreground text-sm">{tr("noHistory")}</p>
        ) : (
          <ul className="flex flex-col gap-1.5">
            {priceSummary.recent.map((entry) => (
              <li
                key={entry.at}
                className="bg-surface flex items-center justify-between rounded-lg px-3 py-2 text-sm"
              >
                <span className="text-muted-foreground text-xs">
                  {formatDate(entry.at)}
                </span>
                <span className="font-semibold tabular-nums">
                  {formatMadCompact(entry.costMad, 2, locale)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
