import type { CartLine, Product } from "@/components/pos/types";
import { PRODUCT_PLACEHOLDER_IMAGE } from "@/lib/products/product-placeholder";

export const POS_CATEGORIES = [
  "Tout",
  "Alimentation",
  "Nettoyage",
  "Papeterie",
  "Électronique",
] as const;

export type PosCategory = (typeof POS_CATEGORIES)[number];

/** Catégories assignables à un article (hors « Tout »). */
export const POS_SHELF_CATEGORIES = POS_CATEGORIES.filter(
  (c): c is Exclude<PosCategory, "Tout"> => c !== "Tout",
);

export const POS_PRODUCTS: Product[] = [
  {
    id: "1",
    category: "Alimentation",
    name: "Huile d'Olive Extra Vierge 1L",
    barcode: "3760263500123",
    price: 85.0,
    costMad: 62.0,
    stockQty: 42,
    stockLabel: "STOCK: 42",
    stockLow: false,
    image:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuB3QdAol8oRCoLpDWTENYvXwFojapopQwehWN69XEGxBsPQrkflldZ2bnbKvv4vBPp8LX2Pr_J9uwR9V47F-xVMXBU4-wedgKjTD5J-u6IQxb3umQDBRdstq3Z1QmPDFCHgITScVKqPWIFj2WUiB3xnvmcPnPlgz4IiajiKhvWdadCA45mXEidzTOeHjNagRzm6CD5dgDxhENypS_YPyRvhcjzW5BJtwU0_Aot8KhKEoWg35X5NU9xWtmB3uIht6GtC45ViAEH7SuIk",
    imageAlt: "Bouteille d'huile d'olive extra vierge",
  },
  {
    id: "2",
    category: "Alimentation",
    name: "Baguette Traditionnelle",
    barcode: "3245412567335",
    price: 2.5,
    costMad: 1.55,
    stockQty: 8,
    stockLabel: "STOCK: 08",
    stockLow: true,
    image:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuBdc7ehSHdw5TYAnjvE_yyAJT0L8_R_W2LuFzU0_2G06-gLVTDkM8KBepPUZu39L10Qk80AOijSXq2B8AO5BvLl5OTcNi0GCaYKmqN1IU1_6CneLexjRqLhjz8754X8yQSwlz4AcVbhlAKhUSzDm9EMa5pazmfGI4FLBdF9800BrI5dw9vpaHPMAuvaJJpHdmoS-w7g3nnRt5re8BjOBDDIwsNNS-9x7UskQuGCxexzsj6q3DAH5emk5PxpG4d7HmxgFHMuyRi3WuxM",
    imageAlt: "Baguette traditionnelle",
  },
  {
    id: "3",
    category: "Nettoyage",
    name: "Papier Toilette - Pack de 12",
    barcode: "3560070968886",
    price: 45.0,
    costMad: 31.5,
    stockQty: 120,
    stockLabel: "STOCK: 120",
    stockLow: false,
    image:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuCrsuDqDdB_PzcLpsvDYsx-0TPlKCTerVHqvzzqFmUknayMmmcuVI_Ux9QOzekcRZxR5TgyLFoVYwmYZ_PNbFm1SfHQHG2Wl-QKDluZOR97yRAG9VYQT55nG8QReygtGISvCarf3NgtrWiiJ4z5VDVy5t1dClgX8uyvKmQZTKl1w-MX3qyGxJnJ7JCA-OIYlMY161d56IKfN8lqSiijrZ4Anj9JPXwpJOBCAA7LAiEtg8NG6RMXsh5-EPWSKYBTVNx4nVQyuhP1Uxik",
    imageAlt: "Papier toilette",
  },
  {
    id: "4",
    category: "Électronique",
    name: "Piles AA Duracell x4",
    price: 32.0,
    costMad: 21.5,
    stockQty: 15,
    stockLabel: "STOCK: 15",
    stockLow: true,
    image:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuDxtozHdktVcWjP6ath0HjgO5XsXqh7UFzVPnFdE7lxUHd7hYcjLnwMWuSCNpMXxiaLDtcJt0Z1F-c1jxuEf5KGu9wsZ1SP8PS8vsvAqQQKDPZAI2TwnhaXcNjXvM3PB4TBknICFqs9eabB6RYyOtbVPUHkO26DldiuOccmbDM_Eq0fkY7C-MWVeFl5t-W8j_U_QLEYezBXNTvnLf29fIPb0n5lwecI8q8WkE1LnpA0yy_KhUEeSiEPk1eyYm50v81H4ncThjma10W1",
    imageAlt: "Piles alcalines AA",
  },
  {
    id: "5",
    category: "Alimentation",
    name: "Bananes Importées (kg)",
    price: 14.5,
    costMad: 9.8,
    stockQty: 12,
    stockLabel: "STOCK: 12kg",
    stockLow: false,
    image:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuDha4By3cf6b3xRCUWu3dnX-NQPQduLcBomn5m1vg7qHMJPGMblWDtpenQyZpaVuEneCwNClUgtvVo8I8v0qABvcN-ICaIZYf3OJUx-qeLu5jU8L4iTgINxNJJk9vZwQMl3LxVJ9i9zH4iauhIFxIxFSV8MjNV-eYdzZa3CO7GvdfAdpS-750v848NIhJpriwtVSTGesOtmA9wsFo6xEqXWTFnCfADx9Y7WYwG768aeZ9qwoFPjDAEyVA3iYSeyDPP5KGo9AyKMTE04",
    imageAlt: "Bananes mûres",
  },
  {
    id: "6",
    category: "Nettoyage",
    name: "Lessive Liquide 3L Ariel",
    price: 115.0,
    costMad: 78.0,
    stockQty: 24,
    stockLabel: "STOCK: 24",
    stockLow: false,
    image:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuAkqvA7ZctogiJXxCge46-3B00IA3ziNT0DoCVnouHKh9FZvV3YCqZeGVSFWwUR6HnMdSR7LAD5f4eDpIZM7cxiUnya71IgVWAy_l_p5d9RBvC6QaeVxxmdt8ExrFW03El3fhnYB-_7Lf8DmXhAsadVFm5DeuNaf8TqhgUTLLOnXB73b2wM9jdRaQtdOIxGUhzinTLdpcpjuKvqfEbrWcQoRYrEsY8Ix24NxovujEOwNE8s5xDF225ecnvsmiS-AU9F_8xp0mOWcIs7",
    imageAlt: "Lessive liquide",
  },
];

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

export const POS_INITIAL_CART: CartLine[] = [
  {
    productId: "1",
    name: "Huile d'Olive Extra Vierge 1L",
    unitPrice: 85.0,
    qty: 2,
  },
  {
    productId: "2",
    name: "Baguette Traditionnelle",
    unitPrice: 2.5,
    qty: 4,
  },
];
