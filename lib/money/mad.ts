/**
 * Moroccan dirham (MAD) — use this module anywhere prices are shown or edited.
 */

export const CURRENCY_CODE_MAD = "MAD" as const;
export const CURRENCY_LABEL_AR = "درهم" as const;
/** POS / receipt shorthand in French UI */
export const POS_CURRENCY_LABEL_FR = "DH" as const;

export function currencyLabelForLocale(locale?: string): string {
  return locale?.toLowerCase().startsWith("ar")
    ? CURRENCY_LABEL_AR
    : CURRENCY_CODE_MAD;
}

export function posCurrencyLabelForLocale(locale?: string): string {
  return locale?.toLowerCase().startsWith("ar")
    ? CURRENCY_LABEL_AR
    : POS_CURRENCY_LABEL_FR;
}

export function formatMad(amount: number, decimals = 2, locale?: string): string {
  const currencyLabel = currencyLabelForLocale(locale);
  if (!Number.isFinite(amount)) return `— ${currencyLabel}`;
  return `${amount.toFixed(decimals)} ${currencyLabel}`;
}

/** Compact label for tables, badges */
export function formatMadCompact(
  amount: number,
  decimals = 2,
  locale?: string,
): string {
  if (!Number.isFinite(amount)) return "—";
  return `${amount.toFixed(decimals)} ${currencyLabelForLocale(locale)}`;
}

/**
 * Parse user input: strips MAD, spaces, supports comma decimal.
 * Returns null if not a finite number.
 */
export function parseMadToNumber(raw: string): number | null {
  const cleaned = raw
    .trim()
    .replace(/\s/g, "")
    .replace(/mad/gi, "")
    .replace(/درهم/g, "")
    .replace(/dh/gi, "")
    .replace(",", ".")
    .replace(/[^\d.-]/g, "");
  if (cleaned === "" || cleaned === "-" || cleaned === ".") return null;
  const n = Number.parseFloat(cleaned);
  return Number.isFinite(n) ? n : null;
}

/** Clamp amount to [min, max], rounded to 2 decimals. Supports negatives. */
export function clampMadAmount(
  n: number,
  min = 0,
  max = 999_999.99,
): number {
  if (!Number.isFinite(n)) return 0;
  return Math.min(max, Math.max(min, Math.round(n * 100) / 100));
}

/** Clamp price to a sensible non-negative retail range */
export function clampMadPrice(n: number, max = 999_999.99): number {
  return clampMadAmount(n, 0, max);
}
