export const MIN_WEIGHT_QTY = 0.001;
export const MAX_WEIGHT_QTY = 9999.999;

export function clampWeightQty(qty: number): number {
  const n = Math.round(qty * 1000) / 1000;
  return Math.min(MAX_WEIGHT_QTY, Math.max(0, n));
}

export function normalizePieceQty(qty: number): number {
  return Math.max(1, Math.floor(qty));
}

export function normalizeCartQty(qty: number, soldByWeight: boolean): number {
  if (soldByWeight) {
    const n = clampWeightQty(qty);
    if (n < MIN_WEIGHT_QTY) {
      throw new Error("Weight must be greater than 0.");
    }
    return n;
  }
  const n = normalizePieceQty(qty);
  if (n < 1) {
    throw new Error("Quantity must be at least 1.");
  }
  return n;
}

export function formatCartQtyDisplay(
  qty: number,
  soldByWeight: boolean,
  locale?: string,
): string {
  if (!soldByWeight) return String(normalizePieceQty(qty));
  const trimmed = qty
    .toFixed(3)
    .replace(/(\.\d*?)0+$/, "$1")
    .replace(/\.$/, "");
  return locale?.startsWith("ar") ? `${trimmed} كغ` : `${trimmed} kg`;
}

export function cartLineTotalMad(line: {
  unitPrice: number;
  qty: number;
}): number {
  return Math.round(line.unitPrice * line.qty * 100) / 100;
}

export function weightToDraft(weight: number, locale?: string): string {
  if (weight <= 0) return "";
  const fixed = clampWeightQty(weight).toFixed(3).replace(/\.?0+$/, "");
  return locale?.startsWith("ar") ? fixed : fixed.replace(".", ",");
}

export function parseWeightDraft(draft: string, fallback: number): number {
  const cleaned = draft
    .trim()
    .replace(/\s/g, "")
    .replace(/kg/gi, "")
    .replace(/كغ/g, "")
    .replace(/g(?!ram)/gi, "")
    .replace(/غرام/g, "")
    .replace(/غ/g, "")
    .replace(",", ".")
    .replace(/[^\d.-]/g, "");
  if (cleaned === "" || cleaned === "-" || cleaned === ".") {
    return fallback;
  }
  const n = Number.parseFloat(cleaned);
  if (!Number.isFinite(n)) return fallback;
  return clampWeightQty(n);
}

export function weightToGramDraft(weightKg: number): string {
  if (weightKg <= 0) return "";
  return String(Math.round(clampWeightQty(weightKg) * 1000));
}

export function parseGramDraft(draft: string, fallbackGrams: number): number {
  const cleaned = draft.trim().replace(/\D/g, "");
  if (!cleaned) return fallbackGrams;
  const grams = Number.parseInt(cleaned, 10);
  if (!Number.isFinite(grams)) return fallbackGrams;
  return Math.min(9_999_999, Math.max(0, grams));
}

export function gramsToKg(grams: number): number {
  return clampWeightQty(grams / 1000);
}

export function formatWeightGrams(grams: number, locale?: string): string {
  const label = locale?.startsWith("ar") ? "غ" : "g";
  return `${grams} ${label}`;
}

export type WeightInputUnit = "kg" | "g";

export function defaultWeightInputUnit(weightKg: number): WeightInputUnit {
  if (weightKg > 0 && weightKg < 1) return "g";
  return "kg";
}
