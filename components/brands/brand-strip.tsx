"use client";

import { useRef, type ReactNode } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { ProductCatalogImage } from "@/components/products/product-catalog-image";
import { cn } from "@/lib/utils";

export type BrandStripItem = {
  id: string;
  name: string;
  logo: string;
  logoAlt: string;
};

type BrandStripProps = {
  brands: BrandStripItem[];
  activeBrandId: string | null;
  onChange: (brandId: string | null) => void;
  allLabel: string;
  className?: string;
};

const brandRectClass =
  "relative block h-11 w-[5rem] shrink-0 overflow-hidden rounded-md border border-slate-300 bg-white shadow-sm sm:h-12 sm:w-[5.75rem]";

function BrandRectFrame({
  children,
  className,
  centered = false,
  logo = false,
}: {
  children: ReactNode;
  className?: string;
  centered?: boolean;
  logo?: boolean;
}) {
  return (
    <span className={cn(brandRectClass, className)}>
      <span
        className={cn(
          "absolute inset-0 bg-white",
          logo && "p-1",
          centered && "flex items-center justify-center",
        )}
      >
        {children}
      </span>
    </span>
  );
}

export function BrandStrip({
  brands,
  activeBrandId,
  onChange,
  allLabel,
  className,
}: BrandStripProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  function scrollBy(delta: number) {
    scrollRef.current?.scrollBy({ left: delta, behavior: "smooth" });
  }

  if (brands.length === 0) return null;

  const scrollStep = 280;

  return (
    <div className={cn("flex items-center gap-1.5 px-3 pb-2 pt-1 sm:px-5", className)}>
      <button
        type="button"
        onClick={() => scrollBy(-scrollStep)}
        className="text-slate-700 hover:border-primary hover:bg-primary/5 hover:text-primary flex size-11 shrink-0 items-center justify-center rounded-full border-2 border-slate-300 bg-white shadow-md transition-colors"
        aria-label="Scroll brands left"
      >
        <ChevronLeft className="size-7 stroke-[2.5]" aria-hidden />
      </button>

      <div
        ref={scrollRef}
        className="no-scrollbar flex min-w-0 flex-1 gap-1 overflow-x-auto py-0.5"
      >
        <button
          type="button"
          onClick={() => onChange(null)}
          title={allLabel}
          aria-label={allLabel}
          className="shrink-0 transition-opacity hover:opacity-90"
        >
          <BrandRectFrame
            centered
            className={cn(
              "bg-[var(--shell-main-muted)] text-[11px] font-bold text-slate-700",
              activeBrandId === null && "ring-primary ring-2 ring-offset-1",
            )}
          >
            {allLabel.slice(0, 3).toUpperCase()}
          </BrandRectFrame>
        </button>

        {brands.map((brand) => {
          const selected = activeBrandId === brand.id;
          return (
            <button
              key={brand.id}
              type="button"
              onClick={() => onChange(selected ? null : brand.id)}
              title={brand.name}
              aria-label={brand.name}
              className="shrink-0 transition-opacity hover:opacity-90"
            >
              <BrandRectFrame
                logo
                className={cn(selected && "ring-primary ring-2 ring-offset-1")}
              >
                <ProductCatalogImage
                  src={brand.logo}
                  alt={brand.logoAlt}
                  fit="contain"
                  sizes="(max-width: 640px) 80px, 92px"
                  wrapperClassName="relative size-full bg-white"
                />
              </BrandRectFrame>
            </button>
          );
        })}
      </div>

      <button
        type="button"
        onClick={() => scrollBy(scrollStep)}
        className="text-slate-700 hover:border-primary hover:bg-primary/5 hover:text-primary flex size-11 shrink-0 items-center justify-center rounded-full border-2 border-slate-300 bg-white shadow-md transition-colors"
        aria-label="Scroll brands right"
      >
        <ChevronRight className="size-7 stroke-[2.5]" aria-hidden />
      </button>
    </div>
  );
}

export function filterProductsByBrand<T extends { brandId?: string }>(
  products: readonly T[],
  brandId: string | null,
): T[] {
  if (!brandId) return [...products];
  return products.filter((product) => product.brandId === brandId);
}
