import { clampMadPrice } from "@/lib/money/mad";

const STORAGE_KEY = "matjar_pos_cost_overrides_v1";

export function readCostOverrides(): Record<string, number> {
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


export function writeCostOverrides(map: Record<string, number>): boolean {
  if (typeof window === "undefined") return true;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
    return true;
  } catch {
    return false;
  }
}

export function setCostOverride(productId: string, costMad: number): boolean {
  const all = readCostOverrides();
  const next = { ...all, [productId]: clampMadPrice(costMad) };
  return writeCostOverrides(next);
}

export function mergeProductsWithCostOverrides<T extends { id: string; costMad?: number }>(
  products: readonly T[],
  overrides: Readonly<Record<string, number>>,
): T[] {
  return products.map((p) => {
    const o = overrides[p.id];
    if (typeof o === "number" && Number.isFinite(o) && o > 0) {
      return { ...p, costMad: o };
    }
    return p;
  });
}
