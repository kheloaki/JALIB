import { clampMadPrice } from "@/lib/money/mad";

const STORAGE_KEY = "matjar_pos_sell_price_overrides_v1";

export function readSellPriceOverrides(): Record<string, number> {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return {};
    const out: Record<string, number> = {};
    for (const [k, v] of Object.entries(parsed as Record<string, unknown>)) {
      if (typeof v === "number" && Number.isFinite(v) && v > 0) {
        out[k] = clampMadPrice(v);
      }
    }
    return out;
  } catch {
    return {};
  }
}

export function writeSellPriceOverrides(map: Record<string, number>): boolean {
  if (typeof window === "undefined") return true;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
    return true;
  } catch {
    return false;
  }
}

export function setSellPriceOverride(
  productId: string,
  priceMad: number,
): boolean {
  const all = readSellPriceOverrides();
  const next = { ...all, [productId]: clampMadPrice(priceMad) };
  return writeSellPriceOverrides(next);
}

export function mergeProductsWithSellPriceOverrides<
  T extends { id: string; price: number },
>(products: readonly T[], overrides: Readonly<Record<string, number>>): T[] {
  return products.map((p) => {
    const o = overrides[p.id];
    if (typeof o === "number" && Number.isFinite(o) && o > 0) {
      return { ...p, price: clampMadPrice(o) };
    }
    return p;
  });
}
