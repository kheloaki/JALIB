"use client";

import Image from "next/image";

import { cn } from "@/lib/utils";

export type ProductCatalogImageProps = {
  src: string;
  alt: string;
  /** Classes on the inner image (object-fit, padding, filters). */
  className?: string;
  /**
   * Classes on the `relative` wrapper (size, rounded, shrink).
   * Required when this component is not inside another sized `relative` parent.
   */
  wrapperClassName?: string;
  /**
   * `contain` = image entière visible (bandes si ratio ≠ du cadre).
   * `cover` = remplit le cadre (peut rogner).
   */
  fit?: "contain" | "cover";
  /** Pour next/image uniquement (URLs distantes). */
  sizes?: string;
  priority?: boolean;
};

export function isProductImageDataUrl(src: string): boolean {
  return src.startsWith("data:image/");
}

/**
 * Affiche une image produit : `next/image` pour URLs, `<img>` pour data URLs (photos locales).
 * Wraps `fill` images in a `relative` container (required by Next.js).
 */
export function ProductCatalogImage(props: ProductCatalogImageProps) {
  const {
    src,
    alt,
    className,
    wrapperClassName,
    fit = "contain",
    sizes = "(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw",
    priority,
  } = props;
  const objectFit = fit === "cover" ? "object-cover" : "object-contain";

  return (
    <span
      className={cn(
        "relative block overflow-hidden",
        wrapperClassName ?? "size-full",
      )}
    >
      {isProductImageDataUrl(src) ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt={alt}
          className={cn("absolute inset-0 size-full", objectFit, className)}
          decoding="async"
        />
      ) : (
        <Image
          src={src}
          alt={alt}
          fill
          priority={priority}
          sizes={sizes}
          className={cn(objectFit, className)}
        />
      )}
    </span>
  );
}
