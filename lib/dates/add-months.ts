function pad2(n: number) {
  return String(n).padStart(2, "0");
}

/**
 * Adds months to an ISO date (YYYY-MM-DD) using a "clamp to month end" policy.
 * Example: 2026-01-31 + 1 month => 2026-02-28
 */
export function addMonthsIso(dateIso: string, months: number): string {
  const [yRaw, mRaw, dRaw] = dateIso.split("-");
  const y = Number(yRaw);
  const m = Number(mRaw);
  const d = Number(dRaw);
  if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) {
    return dateIso;
  }

  const targetMonthIndex = (y * 12 + (m - 1)) + months;
  const ty = Math.floor(targetMonthIndex / 12);
  const tm0 = targetMonthIndex % 12; // 0..11
  const tm = tm0 + 1; // 1..12

  const lastDay = new Date(ty, tm, 0).getDate();
  const day = Math.min(d, lastDay);

  return `${ty}-${pad2(tm)}-${pad2(day)}`;
}

