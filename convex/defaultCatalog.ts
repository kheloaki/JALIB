import { CATALOG_CATEGORIES } from "../lib/catalog/categories";

export const DEFAULT_PRODUCT_CATEGORIES = CATALOG_CATEGORIES;

export type DefaultCatalogProduct = {
  legacyId: string;
  name: string;
  categoryLabel: string;
  barcode?: string;
  sellPriceMadCents: number;
  costMadCents: number;
  stockQty: number;
  imageUrl: string;
  imageAlt: string;
};

/** No supermarket seed products — the shop fills its own library catalog. */
export const DEFAULT_PRODUCTS: readonly DefaultCatalogProduct[] = [];
