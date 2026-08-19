import type { CartLine, Product } from "@/components/pos/types";
import { CATALOG_CATEGORIES } from "@/lib/catalog/categories";
import { PRODUCT_PLACEHOLDER_IMAGE } from "@/lib/products/product-placeholder";

export const POS_CATEGORIES = ["Tout", ...CATALOG_CATEGORIES] as const;

export type PosCategory = (typeof POS_CATEGORIES)[number];

/** Catégories assignables à un article (hors « Tout »). */
export const POS_SHELF_CATEGORIES = POS_CATEGORIES.filter(
  (c): c is Exclude<PosCategory, "Tout"> => c !== "Tout",
);

export const POS_PRODUCTS: Product[] = [];

/** Image grille pour articles ajoutés depuis la caisse (même domaine que le catalogue). */
export const POS_CUSTOM_PRODUCT_PLACEHOLDER_IMAGE = PRODUCT_PLACEHOLDER_IMAGE;

/** Local cart line id for unlisted / montant libre amounts (not a catalog product). */
export const POS_MISC_LINE_PREFIX = "misc:";

export function isPosMiscLineId(id: string): boolean {
  return id.startsWith(POS_MISC_LINE_PREFIX);
}

export function createPosMiscLineId(): string {
  return `${POS_MISC_LINE_PREFIX}${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export const POS_CASHIER_AVATAR_SRC =
  "https://lh3.googleusercontent.com/aida-public/AB6AXuCcq31DMIoDyse_m0IVYVv_mF1vFmdaSBbvcwMd5R6d2hFLCiOHHj1e7Vqg60K3FxgfFvwYYR0XypNOWgb5EDCSoi-GQJWiiIO7wLTA8H8GLDkoeUqLvrsfKChJULYozrcGfKwtVoCjj91RnXI_7oNo_NnRP6cgAVRb4n08zOSzS0kVwzcKsFNIMSG9WUGWWc0-R8_RCXshrgPbIfu4jpP8douwwQUFyMORtB-9H2wHSArDiOyQEMYo0GzjrUAWlKz05iLIw3Dtwl4l";

/** Default square scanner size on mobile caisse when the cart has many items. */
export const POS_MOBILE_SCAN_SQUARE_SIZE = "8.75rem";

/** Minimum scanner zone height (square + status line) while scanning on mobile. */
export const POS_MOBILE_SCAN_MIN_ZONE_HEIGHT = "10.5rem";

export const POS_INITIAL_CART: CartLine[] = [];
