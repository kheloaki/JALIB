import { clampMadPrice } from "@/lib/money/mad";

const STORAGE_KEY = "matjar_pos_purchase_price_history_v1";

export type PurchasePriceHistoryEntry = {
  /** ISO 8601 */
  at: string;
  costMad: number;
};

type HistoryStore = Record<string, PurchasePriceHistoryEntry[]>;

function readStore(): HistoryStore {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return {};
    return parsed as HistoryStore;
  } catch {
    return {};
  }
}

function writeStore(store: HistoryStore): boolean {
  if (typeof window === "undefined") return true;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
    return true;
  } catch {
    return false;
  }
}

/** Plus récent en premier. */
export function getPurchasePriceHistory(productId: string): PurchasePriceHistoryEntry[] {
  const store = readStore();
  const list = store[productId];
  if (!Array.isArray(list)) return [];
  const out: PurchasePriceHistoryEntry[] = [];
  for (const e of list) {
    if (
      e &&
      typeof e.at === "string" &&
      typeof e.costMad === "number" &&
      Number.isFinite(e.costMad) &&
      e.costMad > 0
    ) {
      out.push({ at: e.at, costMad: clampMadPrice(e.costMad) });
    }
  }
  return out.sort((a, b) => b.at.localeCompare(a.at));
}

/**
 * Enregistre un prix d’achat dans l’historique (création article ou changement).
 * Retourne false si entrée invalide, quota ou écriture impossible.
 */
export function appendPurchasePriceHistoryEntry(
  productId: string,
  costMad: number,
): boolean {
  if (!productId || !Number.isFinite(costMad) || costMad <= 0) return false;
  const cost = clampMadPrice(costMad);
  const store = readStore();
  const prev = store[productId];
  const list = Array.isArray(prev) ? [...prev] : [];
  list.push({ at: new Date().toISOString(), costMad: cost });
  return writeStore({ ...store, [productId]: list });
}
