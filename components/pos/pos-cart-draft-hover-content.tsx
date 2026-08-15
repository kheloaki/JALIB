"use client";

import { ProductCatalogImage } from "@/components/products/product-catalog-image";
import { POS_CUSTOM_PRODUCT_PLACEHOLDER_IMAGE } from "@/components/pos/constants";
import type { PosCartDraftView } from "@/lib/convex/pos-cart-draft";
import { formatPosDh } from "@/lib/pos/format-pos-dh";

type PosCartDraftHoverContentProps = {
  draft: PosCartDraftView;
  locale: string;
  tr: (fr: string, ar: string) => string;
  hideHeader?: boolean;
};

export function PosCartDraftHoverContent({
  draft,
  locale,
  tr,
  hideHeader = false,
}: PosCartDraftHoverContentProps) {
  const assistWithClient =
    draft.parkedByAssist &&
    !!draft.createdByUserName &&
    !!(draft.clientId || draft.clientNameSnapshot);

  return (
    <div className="flex max-h-[min(50vh,18rem)] flex-col">
      {!hideHeader ? (
        <div className="border-border border-b px-3 py-2 text-left">
          <p className="text-on-surface text-sm font-semibold">{draft.label}</p>
          <p className="text-muted-foreground text-[11px]">
            {assistWithClient ? (
              <span className="font-medium text-amber-800/80">
                {draft.createdByUserName}
                {" · "}
              </span>
            ) : null}
            {draft.itemCount} {tr("art.", "صنف")} ·{" "}
            {formatPosDh(draft.totalMad, 2, locale)}
          </p>
        </div>
      ) : null}

      <ul
        className="min-h-0 flex-1 space-y-1 overflow-y-auto px-2 py-2"
        aria-label={tr("Articles du panier", "عناصر السلة")}
      >
        {draft.lines.map((line) => (
          <li
            key={line.productId}
            className="bg-surface-container-low flex items-center gap-2 rounded-lg p-1.5"
          >
            <div className="relative size-9 shrink-0 overflow-hidden rounded-md bg-slate-100">
              <ProductCatalogImage
                src={line.image ?? POS_CUSTOM_PRODUCT_PLACEHOLDER_IMAGE}
                alt={line.imageAlt ?? line.name}
                sizes="36px"
              />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-on-surface line-clamp-2 text-xs font-semibold">
                {line.name}
              </p>
              <p className="text-muted-foreground text-[10px] tabular-nums">
                {line.qty} × {formatPosDh(line.unitPriceMad, 2, locale)}
              </p>
            </div>
            <p className="text-on-surface shrink-0 text-xs font-bold tabular-nums">
              {formatPosDh(line.unitPriceMad * line.qty, 2, locale)}
            </p>
          </li>
        ))}
      </ul>
    </div>
  );
}
