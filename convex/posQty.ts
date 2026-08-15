export const MIN_WEIGHT_QTY = 0.001;

export function clampWeightQty(qty: number): number {
  const n = Math.round(qty * 1000) / 1000;
  return Math.min(9999.999, Math.max(0, n));
}

export function normalizeCheckoutQty(
  qty: number,
  soldByWeight: boolean,
): number {
  if (soldByWeight) {
    const n = clampWeightQty(qty);
    if (n < MIN_WEIGHT_QTY) {
      throw new Error("Weight must be greater than 0.");
    }
    return n;
  }
  const n = Math.max(1, Math.floor(qty));
  if (n < 1) {
    throw new Error("Quantity must be at least 1.");
  }
  return n;
}
