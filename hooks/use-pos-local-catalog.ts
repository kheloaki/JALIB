"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useConvex, useQuery } from "convex/react";

import type { BrandStripItem } from "@/components/brands/brand-strip";
import type { Product } from "@/components/pos/types";
import { api } from "@/convex/_generated/api";
import {
  posCatalogSummaryFromConvex,
  type ConvexPosCatalogSummaryView,
} from "@/lib/convex/mappers";
import {
  idbGetAllProducts,
  idbGetMeta,
  idbReplaceAllProducts,
  idbSetMeta,
  idbUpsertProducts,
  POS_CATALOG_SCHEMA_VERSION,
} from "@/lib/pos/catalog-idb";

const PAGE_SIZE = 400;
/** Force a full re-download if the snapshot is older than this. */
const FULL_SYNC_MAX_AGE_MS = 12 * 60 * 60 * 1000;

type PosCatalogPageResult = {
  page: ConvexPosCatalogSummaryView[];
  isDone: boolean;
  continueCursor: string;
};

function mergeById(existing: Product[], incoming: Product[]): Product[] {
  if (incoming.length === 0) return existing;
  const map = new Map(existing.map((p) => [p.id, p]));
  for (const product of incoming) {
    map.set(product.id, product);
  }
  return [...map.values()];
}

/**
 * POS catalog: hydrate from IndexedDB immediately, then sync from Convex in
 * the background (full page walk or updatedAt delta). No permanent live
 * subscription to the full product table.
 */
export function usePosLocalCatalog() {
  const convex = useConvex();
  const categoryRows = useQuery(api.products.listCategories);
  const brandRows = useQuery(api.brands.listActive);

  const [products, setProducts] = useState<Product[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const syncGen = useRef(0);

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

  const runSync = useCallback(async () => {
    const gen = ++syncGen.current;
    setSyncing(true);
    setSyncError(null);
    try {
      const meta = await idbGetMeta();
      const now = Date.now();
      const needsFull =
        !meta ||
        meta.productCount === 0 ||
        (meta.schemaVersion ?? 1) < POS_CATALOG_SCHEMA_VERSION ||
        now - meta.fullSyncAt > FULL_SYNC_MAX_AGE_MS;

      if (needsFull) {
        const collected: Product[] = [];
        let cursor: string | null = null;
        let isDone = false;
        while (!isDone) {
          if (gen !== syncGen.current) return;
          const page: PosCatalogPageResult = await convex.query(
            api.products.listPosCatalogPage,
            {
              paginationOpts: {
                numItems: PAGE_SIZE,
                cursor,
              },
            },
          );
          const mapped = page.page.map((row: ConvexPosCatalogSummaryView) =>
            posCatalogSummaryFromConvex(row),
          );
          collected.push(...mapped);
          // Progressive UI updates during first sync.
          setProducts((prev) =>
            prev.length === 0 ? [...collected] : mergeById(prev, mapped),
          );
          await idbUpsertProducts(mapped);
          isDone = page.isDone;
          cursor = page.continueCursor;
        }
        if (gen !== syncGen.current) return;
        await idbReplaceAllProducts(collected);
        setProducts(collected);
        await idbSetMeta({
          lastSyncAt: now,
          productCount: collected.length,
          fullSyncAt: now,
          schemaVersion: POS_CATALOG_SCHEMA_VERSION,
        });
      } else {
        let cursor: string | null = null;
        let isDone = false;
        let upserted = 0;
        let maxUpdated = meta.lastSyncAt;
        while (!isDone) {
          if (gen !== syncGen.current) return;
          const page: PosCatalogPageResult = await convex.query(
            api.products.listPosCatalogSince,
            {
              sinceUpdatedAt: meta.lastSyncAt,
              paginationOpts: {
                numItems: PAGE_SIZE,
                cursor,
              },
            },
          );
          const mapped = page.page.map((row: ConvexPosCatalogSummaryView) =>
            posCatalogSummaryFromConvex(row),
          );
          if (mapped.length > 0) {
            await idbUpsertProducts(mapped);
            setProducts((prev) => mergeById(prev, mapped));
            upserted += mapped.length;
            for (const p of mapped) {
              if ((p.updatedAt ?? 0) > maxUpdated) maxUpdated = p.updatedAt ?? 0;
            }
          }
          isDone = page.isDone;
          cursor = page.continueCursor;
        }
        if (gen !== syncGen.current) return;
        const all = await idbGetAllProducts();
        await idbSetMeta({
          lastSyncAt: Math.max(maxUpdated, now),
          productCount: all.length,
          fullSyncAt: meta.fullSyncAt,
          schemaVersion: POS_CATALOG_SCHEMA_VERSION,
        });
        if (upserted > 0) setProducts(all);
      }
    } catch (err) {
      if (gen !== syncGen.current) return;
      const message =
        err instanceof Error ? err.message : "Catalog sync failed";
      setSyncError(message);
    } finally {
      if (gen === syncGen.current) setSyncing(false);
    }
  }, [convex]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const local = await idbGetAllProducts();
      if (cancelled) return;
      if (local.length > 0) {
        setProducts(local);
      }
      setHydrated(true);
      void runSync();
    })();
    return () => {
      cancelled = true;
      syncGen.current += 1;
    };
  }, [runSync]);

  const isLoading =
    !hydrated ||
    (products.length === 0 && syncing) ||
    categoryRows === undefined ||
    brandRows === undefined;

  return {
    products,
    categories,
    brands,
    isLoading,
    syncing,
    syncError,
    refreshCatalog: runSync,
  };
}
