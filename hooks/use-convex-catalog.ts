"use client";

import { useMemo } from "react";
import { useQuery } from "convex/react";

import type { BrandStripItem } from "@/components/brands/brand-strip";
import { api } from "@/convex/_generated/api";
import { productFromConvex } from "@/lib/convex/mappers";

/**
 * Categories + brands only — cheap meta for filters/tabs.
 * Prefer paginated / IndexedDB product loaders for large catalogs.
 */
export function useConvexCatalogMeta() {
  const categoryRows = useQuery(api.products.listCategories);
  const brandRows = useQuery(api.brands.listActive);

  const categories = useMemo(() => categoryRows ?? [], [categoryRows]);
  const brands = useMemo<BrandStripItem[]>(
    () =>
      (brandRows ?? []).map((brand) => ({
        id: brand.id,
        name: brand.name,
        logo: brand.logo,
        logoAlt: brand.logoAlt,
      })),
    [brandRows],
  );

  return {
    categories,
    brands,
    isLoading: categoryRows === undefined || brandRows === undefined,
  };
}

/**
 * @deprecated Full-catalog live subscription. Prefer `listSummaries` /
 * `usePosLocalCatalog` for stock / POS. Kept for procurement & dialogs
 * until those migrate.
 */
export function useConvexCatalog() {
  const productRows = useQuery(api.products.listActive);
  const { categories, brands, isLoading: metaLoading } = useConvexCatalogMeta();

  const products = useMemo(
    () => (productRows ?? []).map(productFromConvex),
    [productRows],
  );

  return {
    products,
    categories,
    brands,
    isLoading: productRows === undefined || metaLoading,
  };
}
