import type { Invoice } from "@/lib/invoices/types";
import { normalizeBarcodeInput } from "@/lib/pos/catalog-lookup";

const EAN13_L_CODES = [
  "0001101",
  "0011001",
  "0010011",
  "0111101",
  "0100011",
  "0110001",
  "0101111",
  "0111011",
  "0110111",
  "0001011",
] as const;

const EAN13_G_CODES = [
  "0100111",
  "0110011",
  "0011011",
  "0100001",
  "0011101",
  "0111001",
  "0000101",
  "0010001",
  "0001001",
  "0010111",
] as const;

const EAN13_R_CODES = [
  "1110010",
  "1100110",
  "1101100",
  "1000010",
  "1011100",
  "1001110",
  "1010000",
  "1000100",
  "1001000",
  "1110100",
] as const;

const EAN13_PARITY = [
  "LLLLLL",
  "LLGLGG",
  "LLGGLG",
  "LLGGGL",
  "LGLLGG",
  "LGGLLG",
  "LGGGLL",
  "LGLGLG",
  "LGLGGL",
  "LGGLGL",
] as const;

export function normalizeInvoiceBarcode(raw: string): string {
  return normalizeBarcodeInput(raw);
}

export function computeEan13CheckDigit(payload12: string): string {
  if (!/^\d{12}$/.test(payload12)) {
    throw new Error("EAN-13 payload must be 12 digits");
  }
  let sum = 0;
  for (let i = 0; i < payload12.length; i += 1) {
    const digit = Number.parseInt(payload12[i]!, 10);
    sum += i % 2 === 0 ? digit : digit * 3;
  }
  return String((10 - (sum % 10)) % 10);
}

export function isValidEan13(raw: string): boolean {
  const value = normalizeInvoiceBarcode(raw);
  if (!/^\d{13}$/.test(value)) return false;
  return computeEan13CheckDigit(value.slice(0, 12)) === value[12];
}

function nextInvoiceBarcodePayload(invoices: Invoice[]): string {
  const maxSeq = invoices.reduce((max, invoice) => {
    const barcode = normalizeInvoiceBarcode(invoice.barcode);
    if (!/^\d{13}$/.test(barcode)) return max;
    const payload = barcode.slice(0, 12);
    if (!payload.startsWith("209")) return max;
    const seq = Number.parseInt(payload.slice(3), 10);
    return Number.isFinite(seq) ? Math.max(max, seq) : max;
  }, 0);
  return `209${String(maxSeq + 1).padStart(9, "0")}`;
}

export function generateInvoiceBarcode(invoices: Invoice[]): string {
  const payload = nextInvoiceBarcodePayload(invoices);
  return `${payload}${computeEan13CheckDigit(payload)}`;
}

export function encodeEan13SvgPattern(raw: string): string | null {
  const value = normalizeInvoiceBarcode(raw);
  if (!isValidEan13(value)) return null;

  const first = Number.parseInt(value[0]!, 10);
  const leftDigits = value.slice(1, 7).split("").map((d) => Number.parseInt(d, 10));
  const rightDigits = value.slice(7, 13).split("").map((d) => Number.parseInt(d, 10));
  const parity = EAN13_PARITY[first]!;

  let pattern = "101";
  for (let i = 0; i < leftDigits.length; i += 1) {
    const digit = leftDigits[i]!;
    pattern += parity[i] === "L" ? EAN13_L_CODES[digit] : EAN13_G_CODES[digit];
  }
  pattern += "01010";
  for (const digit of rightDigits) {
    pattern += EAN13_R_CODES[digit]!;
  }
  pattern += "101";
  return pattern;
}

/** EAN-13 modules: 3 + 42 + 5 + 42 + 3 = 95 */
export const EAN13_MODULE_COUNT = 95;

export function isEan13GuardModule(index: number, patternLength = EAN13_MODULE_COUNT): boolean {
  return (
    index < 3 ||
    (index >= 45 && index < 50) ||
    index >= patternLength - 3
  );
}

export type Ean13BarRun = {
  startModule: number;
  moduleCount: number;
  isGuard: boolean;
};

/** Merge consecutive black modules so SVG/PDF bars stay crisp when scaled. */
export function collectEan13BarRuns(pattern: string): Ean13BarRun[] {
  const runs: Ean13BarRun[] = [];
  let i = 0;
  while (i < pattern.length) {
    if (pattern[i] !== "1") {
      i += 1;
      continue;
    }
    const startModule = i;
    while (i < pattern.length && pattern[i] === "1") i += 1;
    const moduleCount = i - startModule;
    const isGuard = Array.from({ length: moduleCount }, (_, offset) =>
      isEan13GuardModule(startModule + offset, pattern.length),
    ).every(Boolean);
    runs.push({ startModule, moduleCount, isGuard });
  }
  return runs;
}
