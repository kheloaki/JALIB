export function madToCents(amountMad: number): number {
  if (!Number.isFinite(amountMad)) return 0;
  return Math.round(amountMad * 100);
}

export function centsToMad(amountMadCents: number): number {
  if (!Number.isFinite(amountMadCents)) return 0;
  return Math.round(amountMadCents) / 100;
}

export function clampPositiveCents(amountMad: number): number {
  return Math.max(1, madToCents(amountMad));
}
