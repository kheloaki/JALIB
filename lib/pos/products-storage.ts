import type { Product } from "@/components/pos/types";
import { parseStockQuantity } from "@/lib/stock/stock-utils";

const STORAGE_KEY = "matjar_pos_catalog_extras_v1";

function reviveProduct(x: unknown): Product | null {
  if (!x || typeof x !== "object") return null;
  const o = x as Record<string, unknown>;
  if (typeof o.id !== "string" || typeof o.name !== "string") return null;
  if (typeof o.category !== "string") return null;
  if (typeof o.price !== "number" || !Number.isFinite(o.price)) return null;
  const costRaw = o.costMad;
  const costMad =
    typeof costRaw === "number" &&
    Number.isFinite(costRaw) &&
    costRaw > 0
      ? costRaw
      : undefined;
  if (typeof o.stockLabel !== "string" || typeof o.stockLow !== "boolean")
    return null;
  const stockQtyRaw = o.stockQty;
  const stockQty =
    typeof stockQtyRaw === "number" && Number.isFinite(stockQtyRaw)
      ? Math.max(0, stockQtyRaw)
      : Math.max(0, parseStockQuantity(o.stockLabel) ?? 0);
  if (typeof o.image !== "string" || typeof o.imageAlt !== "string")
    return null;
  const barcode =
    typeof o.barcode === "string" && o.barcode.trim().length > 0
      ? o.barcode.trim()
      : undefined;
  return {
    id: o.id,
    name: o.name,
    category: o.category,
    price: o.price,
    stockQty,
    stockLabel: o.stockLabel,
    stockLow: o.stockLow,
    image: o.image,
    imageAlt: o.imageAlt,
    ...(costMad !== undefined ? { costMad } : {}),
    ...(barcode ? { barcode } : {}),
  };
}

export function readPosCatalogExtras(): Product[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const out: Product[] = [];
    for (const item of parsed) {
      const p = reviveProduct(item);
      if (p) out.push(p);
    }
    return out;
  } catch {
    return [];
  }
}

/** Retourne false si quota / mode privé (écriture impossible). */
export function writePosCatalogExtras(products: Product[]): boolean {
  if (typeof window === "undefined") return true;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(products));
    return true;
  } catch {
    return false;
  }
}
