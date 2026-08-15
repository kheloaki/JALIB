export type Product = {
  id: string;
  category: string;
  name: string;
  /** Prix de vente TTC affiché à la caisse (MAD). */
  price: number;
  /** Prix d’achat / revient (MAD), optionnel — pour marges et inventaire valorisé. */
  costMad?: number;
  /** Quantité numérique en stock (0 si inconnue / non suivie). */
  stockQty: number;
  stockLabel: string;
  stockLow: boolean;
  image: string;
  imageAlt: string;
  /** EAN / UPC / Code 128 — digits (espaces tolérés à la saisie). */
  barcode?: string;
  /** Prix au kg — quantités décimales à la caisse. */
  soldByWeight?: boolean;
  brandId?: string;
  brandName?: string;
  brandLogo?: string;
  createdAt?: number;
  /** Server updatedAt — used for IndexedDB sync. */
  updatedAt?: number;
};

export type CartLine = {
  productId: string;
  name: string;
  unitPrice: number;
  qty: number;
  /** Prix d’achat catalogue (MAD), si connu — affichage caisse uniquement. */
  costMad?: number;
  image?: string;
  imageAlt?: string;
  soldByWeight?: boolean;
};

export type PaymentMethod = "cash" | "credit";
