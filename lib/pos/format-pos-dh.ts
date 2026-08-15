import { posCurrencyLabelForLocale } from "@/lib/money/mad";

/** @deprecated Use posCurrencyLabelForLocale — kept for imports that read the constant. */
export const POS_CURRENCY = "DH" as const;

export function formatPosDh(
  amount: number,
  decimals = 2,
  locale?: string,
): string {
  const currency = posCurrencyLabelForLocale(locale);
  if (!Number.isFinite(amount)) return `— ${currency}`;
  const n = Math.round(amount * 10 ** decimals) / 10 ** decimals;
  return `${n.toFixed(decimals)} ${currency}`;
}
