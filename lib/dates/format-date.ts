/** French date/time formatting (DD/MM/YYYY) used across the admin platform. */
export const DATE_LOCALE = "fr-FR";

export function parseDisplayDate(iso: string): Date {
  const trimmed = iso.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return new Date(`${trimmed}T12:00:00`);
  }
  return new Date(trimmed);
}

export function formatDateFr(iso: string): string {
  const d = parseDisplayDate(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(DATE_LOCALE, {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export function formatDateShortFr(iso: string): string {
  const d = parseDisplayDate(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(DATE_LOCALE, {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function formatDateLongFr(iso: string): string {
  const d = parseDisplayDate(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(DATE_LOCALE, {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export function formatWeekdayFr(iso: string): string {
  const d = parseDisplayDate(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(DATE_LOCALE, { weekday: "long" });
}

export function formatDateTimeFr(iso: string): string {
  const d = parseDisplayDate(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString(DATE_LOCALE, {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatDateTimeMediumFr(iso: string): string {
  const d = parseDisplayDate(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString(DATE_LOCALE, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export function formatChartDayFr(iso: string, monthly = false): string {
  const d = parseDisplayDate(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(
    DATE_LOCALE,
    monthly
      ? { month: "short", year: "numeric" }
      : { day: "2-digit", month: "short" },
  );
}

/** Compact axis label when many buckets (e.g. monthly “Tout” range). */
export function formatChartAxisLabelFr(
  iso: string,
  options: { monthly?: boolean; compact?: boolean } = {},
): string {
  const d = parseDisplayDate(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const { monthly = false, compact = false } = options;
  if (monthly) {
    return d.toLocaleDateString(
      DATE_LOCALE,
      compact
        ? { month: "short", year: "2-digit" }
        : { month: "short", year: "numeric" },
    );
  }
  return d.toLocaleDateString(
    DATE_LOCALE,
    compact
      ? { day: "2-digit", month: "2-digit" }
      : { day: "2-digit", month: "short" },
  );
}

/** Pick evenly spaced x-axis indices so labels never overlap. */
export function getChartVisibleLabelIndices(
  count: number,
  maxLabels = 6,
): Set<number> {
  if (count <= 0) return new Set();
  if (count <= maxLabels) {
    return new Set(Array.from({ length: count }, (_, i) => i));
  }
  const indices = new Set<number>([0, count - 1]);
  const innerSlots = maxLabels - 2;
  const step = (count - 1) / (innerSlots + 1);
  for (let k = 1; k <= innerSlots; k++) {
    indices.add(Math.round(k * step));
  }
  return indices;
}

export function formatMonthYearFr(iso: string): string {
  const d = parseDisplayDate(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(DATE_LOCALE, {
    month: "short",
    year: "2-digit",
  });
}

export function formatTodayDateFr(): string {
  return formatDateFr(new Date().toISOString().slice(0, 10));
}

export function formatNowDateTimeFr(): string {
  return new Date().toLocaleString(DATE_LOCALE, {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
