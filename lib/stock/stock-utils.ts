/**
 * Helpers for the stock / margins admin view (quantités + valorisation).
 */

/** Extrait un nombre depuis des libellés du type « STOCK: 42 » ou « STOCK: 12kg ». */
export function parseStockQuantity(stockLabel: string): number | null {
  const m = stockLabel.match(/STOCK:\s*([\d]+(?:[.,]\d+)?)/i);
  if (!m?.[1]) return null;
  const n = Number.parseFloat(m[1].replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

export function marginPercent(costMad: number, sellMad: number): number | null {
  if (!Number.isFinite(costMad) || !Number.isFinite(sellMad) || costMad <= 0) {
    return null;
  }
  return ((sellMad - costMad) / costMad) * 100;
}

export function marginMad(costMad: number, sellMad: number): number | null {
  if (!Number.isFinite(costMad) || !Number.isFinite(sellMad) || costMad <= 0) {
    return null;
  }
  return sellMad - costMad;
}

/** Normalized quantity for sorting (out of stock = 0). */
export function stockQtyForSort(stockQty: number): number {
  return Math.max(0, stockQty);
}

export function compareProductsByStockAsc(
  a: { stockQty: number; name: string },
  b: { stockQty: number; name: string },
): number {
  const byStock = stockQtyForSort(a.stockQty) - stockQtyForSort(b.stockQty);
  if (byStock !== 0) return byStock;
  return a.name.localeCompare(b.name, "fr");
}

export function sortProductsByStockAsc<T extends { stockQty: number; name: string }>(
  products: readonly T[],
): T[] {
  return [...products].sort(compareProductsByStockAsc);
}
