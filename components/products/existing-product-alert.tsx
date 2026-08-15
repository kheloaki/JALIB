"use client";

import Link from "next/link";

import { ProductCatalogImage } from "@/components/products/product-catalog-image";
import { formatMad } from "@/lib/money/mad";
import { cn } from "@/lib/utils";

export type ExistingProductAlertData = {
  name: string;
  category: string;
  price: number;
  image: string;
  imageAlt: string;
  active?: boolean;
};

type ExistingProductAlertProps = {
  product: ExistingProductAlertData;
  locale: string;
  tr: (fr: string, ar: string) => string;
  className?: string;
};

export function ExistingProductAlert({
  product,
  locale,
  tr,
  className,
}: ExistingProductAlertProps) {
  const inactive = product.active === false;
  const stockHref = `/${locale}/stock`;

  return (
    <div
      role="alert"
      className={cn(
        "border-sidebar-border overflow-hidden rounded-2xl border",
        inactive ? "bg-amber-50/80" : "bg-surface-container-low/80",
        className,
      )}
    >
      <p
        className={cn(
          "px-4 py-2 text-center text-[10px] font-black tracking-wider uppercase",
          inactive
            ? "bg-amber-200/60 text-amber-950"
            : "text-primary bg-primary/10",
        )}
      >
        {inactive
          ? tr("Article déjà enregistré (inactif)", "المنتج مسجل مسبقًا (غير نشط)")
          : tr("Article déjà au catalogue", "المنتج موجود بالفعل في الكتالوج")}
      </p>
      <div className="flex gap-4 p-4">
        <div className="relative size-20 shrink-0 overflow-hidden rounded-xl bg-slate-100">
          <ProductCatalogImage
            src={product.image}
            alt={product.imageAlt}
            sizes="80px"
          />
        </div>
        <div className="min-w-0 flex-1 space-y-1">
          <p className="text-tertiary text-[10px] font-bold uppercase">
            {product.category}
          </p>
          <p className="text-on-surface text-sm font-bold leading-snug">
            {product.name}
          </p>
          <p className="text-primary text-lg font-black tabular-nums">
            {formatMad(product.price, 2, locale)}
          </p>
          <Link
            href={inactive ? stockHref : `/${locale}/pos`}
            className="text-primary mt-1 inline-block text-xs font-bold underline-offset-2 hover:underline"
          >
            {inactive
              ? tr("Ouvrir le stock", "فتح المخزون")
              : tr("Ouvrir la caisse", "فتح شاشة الصندوق")}
          </Link>
        </div>
      </div>
    </div>
  );
}
