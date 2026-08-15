"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useLocale } from "next-intl";

import { ProductCatalogImage } from "@/components/products/product-catalog-image";
import type { Product } from "@/components/pos/types";
import { formatPosDh } from "@/lib/pos/format-pos-dh";
import { cn } from "@/lib/utils";

type PosProductGridProps = {
  products: Product[];
  onAddToCart: (product: Product) => void;
  /** Right-click / long-press — inventory-style actions. */
  onProductContextMenu?: (
    product: Product,
    clientX: number,
    clientY: number,
  ) => void;
  compact?: boolean;
  /**
   * When this changes (category / brand / search), reset the visible window.
   * Do NOT derive this from the products array — updates while scrolling must
   * keep the scroll position.
   */
  listResetKey?: string;
};

/** First paint only mounts this many cards; more load as the user scrolls. */
const INITIAL_VISIBLE = 60;
const LOAD_MORE_STEP = 48;

export function PosProductGrid({
  products,
  onAddToCart,
  onProductContextMenu,
  compact = false,
  listResetKey = "",
}: PosProductGridProps) {
  const locale = useLocale();
  const isAr = locale === "ar";
  const [visibleCount, setVisibleCount] = useState(INITIAL_VISIBLE);
  const longPressTimer = useRef<number | null>(null);
  /** After a long-press menu opens, ignore the synthetic click that follows. */
  const suppressNextClick = useRef(false);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const savedScrollTop = useRef(0);

  useEffect(() => {
    setVisibleCount(INITIAL_VISIBLE);
    savedScrollTop.current = 0;
    if (scrollRef.current) scrollRef.current.scrollTop = 0;
  }, [listResetKey]);

  useEffect(() => {
    // Clamp if the filtered list shrinks; never reset upward while scrolling.
    setVisibleCount((n) => {
      if (products.length <= 0) return INITIAL_VISIBLE;
      if (n > products.length) return products.length;
      return n;
    });
  }, [products.length]);

  useEffect(() => {
    return () => {
      if (longPressTimer.current != null) {
        window.clearTimeout(longPressTimer.current);
      }
    };
  }, []);

  const visible = products.slice(0, visibleCount);
  const hasMore = visibleCount < products.length;

  function clearLongPress() {
    if (longPressTimer.current != null) {
      window.clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  }

  function growVisibleWindow() {
    const el = scrollRef.current;
    if (el) savedScrollTop.current = el.scrollTop;
    setVisibleCount((n) => Math.min(products.length, n + LOAD_MORE_STEP));
  }

  useLayoutEffect(() => {
    const node = scrollRef.current;
    if (!node) return;
    if (savedScrollTop.current > 0) {
      node.scrollTop = savedScrollTop.current;
    }
  }, [visibleCount]);

  return (
    <div
      ref={scrollRef}
      className={cn(
        "no-scrollbar flex-1 overflow-y-auto",
        compact ? "px-2 py-2" : "px-4 py-4 sm:px-6",
      )}
      onScroll={(e) => {
        savedScrollTop.current = e.currentTarget.scrollTop;
        if (!hasMore) return;
        const el = e.currentTarget;
        if (el.scrollTop + el.clientHeight >= el.scrollHeight - 320) {
          growVisibleWindow();
        }
      }}
    >
      <div
        className={cn(
          "grid",
          compact
            ? "grid-cols-3 gap-2 sm:grid-cols-4"
            : "grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7",
        )}
      >
        {visible.map((p, index) => {
          const qty = Math.max(0, p.stockQty);

          return (
            <div
              key={p.id}
              role="button"
              tabIndex={0}
              onClick={() => {
                if (suppressNextClick.current) {
                  suppressNextClick.current = false;
                  return;
                }
                onAddToCart(p);
              }}
              onContextMenu={(e) => {
                if (!onProductContextMenu) return;
                e.preventDefault();
                onProductContextMenu(p, e.clientX, e.clientY);
              }}
              onTouchStart={(e) => {
                if (!onProductContextMenu) return;
                const touch = e.touches[0];
                if (!touch) return;
                clearLongPress();
                longPressTimer.current = window.setTimeout(() => {
                  longPressTimer.current = null;
                  suppressNextClick.current = true;
                  onProductContextMenu(p, touch.clientX, touch.clientY);
                }, 520);
              }}
              onTouchEnd={clearLongPress}
              onTouchMove={clearLongPress}
              onTouchCancel={clearLongPress}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onAddToCart(p);
                }
              }}
              className="pos-product-card group flex cursor-pointer flex-col overflow-hidden transition-all duration-200 active:scale-[0.99]"
              aria-label={
                isAr ? `إضافة ${p.name} إلى السلة` : `Ajouter ${p.name} au panier`
              }
            >
              <div className="bg-surface-container-low relative aspect-square w-full overflow-hidden">
                <ProductCatalogImage
                  src={p.image}
                  alt={p.imageAlt}
                  fit="contain"
                  priority={index < 12}
                  className="p-2 transition-[filter] group-hover:brightness-[1.02]"
                  sizes="(max-width: 640px) 33vw, (max-width: 1024px) 20vw, 12vw"
                />
                <span
                  className={cn(
                    "absolute top-1.5 right-1.5 z-[1] rounded-md px-2 py-0.5 text-xs font-black tabular-nums shadow-sm",
                    qty <= 0 || p.stockLow
                      ? "bg-error-container text-on-error-container"
                      : "bg-secondary-container text-on-secondary-container",
                  )}
                >
                  {qty > 0 ? qty : "—"}
                </span>
              </div>

              <div className="flex min-h-0 flex-1 flex-col gap-0.5 px-2.5 pt-2 pb-2.5 sm:px-3 sm:pb-3">
                <h3 className="text-on-surface line-clamp-2 min-h-[2.4em] text-[13px] leading-snug font-bold sm:text-sm">
                  {p.name}
                </h3>
                <p className="text-on-surface mt-auto pt-1.5 text-sm font-bold tracking-tight tabular-nums sm:text-base">
                  {formatPosDh(p.price, 2, locale)}
                </p>
              </div>
            </div>
          );
        })}
      </div>
      {hasMore ? (
        <div className="flex justify-center py-4">
          <button
            type="button"
            className="text-on-surface-variant hover:text-primary text-sm font-bold"
            onClick={growVisibleWindow}
          >
            {isAr
              ? `عرض المزيد (${products.length - visibleCount})`
              : `Afficher plus (${products.length - visibleCount})`}
          </button>
        </div>
      ) : null}
    </div>
  );
}
