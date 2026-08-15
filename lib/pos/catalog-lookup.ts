import type { Product } from "@/components/pos/types";

/**
 * Canonical key used to compare scanned codes against catalogue entries.
 *
 * QR codes can carry arbitrary text (URLs, GS1 payloads, alphanumeric SKUs),
 * so we keep letters/digits/symbols and only strip whitespace + uppercase
 * letters for case-insensitive matching. Pure-numeric barcodes (EAN/UPC)
 * remain unchanged and stay backwards compatible.
 */
export function normalizeBarcodeInput(raw: string): string {
  return raw.trim().replace(/\s+/g, "").toUpperCase();
}

export function findProductByBarcode(
  products: readonly Product[],
  raw: string,
): Product | undefined {
  const key = normalizeBarcodeInput(raw);
  if (!key) return undefined;
  return products.find(
    (p) => p.barcode && normalizeBarcodeInput(p.barcode) === key,
  );
}

export function isBarcodeTaken(
  products: readonly Product[],
  raw: string,
  exceptProductId?: string,
): boolean {
  const hit = findProductByBarcode(products, raw);
  if (!hit) return false;
  if (exceptProductId && hit.id === exceptProductId) return false;
  return true;
}
