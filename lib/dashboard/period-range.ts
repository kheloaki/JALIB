import { formatDateShortFr } from "@/lib/dates/format-date";

export type DashboardPeriodPreset =
  | "all"
  | "today"
  | "yesterday"
  | "this_week"
  | "last_week"
  | "this_month"
  | "last_month"
  | "custom";

/** Inclusive start date for the “all time” dashboard filter. */
export const ALL_TIME_START_DATE = "2000-01-01";

export type PeriodRange = {
  startDate: string;
  endDate: string;
};

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

export function formatIsoDateLocal(date: Date): string {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

function startOfLocalDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

/** Monday as week start (fr-MA business week). */
function mondayOfWeek(date: Date): Date {
  const d = startOfLocalDay(date);
  const weekday = d.getDay();
  const diff = weekday === 0 ? -6 : 1 - weekday;
  d.setDate(d.getDate() + diff);
  return d;
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function endOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0);
}

export function resolvePeriodRange(
  preset: DashboardPeriodPreset,
  customStart?: string,
  customEnd?: string,
  now: Date = new Date(),
): PeriodRange {
  const today = startOfLocalDay(now);

  switch (preset) {
    case "all":
      return {
        startDate: ALL_TIME_START_DATE,
        endDate: formatIsoDateLocal(today),
      };
    case "today":
      return {
        startDate: formatIsoDateLocal(today),
        endDate: formatIsoDateLocal(today),
      };
    case "yesterday": {
      const y = addDays(today, -1);
      return { startDate: formatIsoDateLocal(y), endDate: formatIsoDateLocal(y) };
    }
    case "this_week": {
      const start = mondayOfWeek(today);
      return {
        startDate: formatIsoDateLocal(start),
        endDate: formatIsoDateLocal(today),
      };
    }
    case "last_week": {
      const thisMonday = mondayOfWeek(today);
      const lastMonday = addDays(thisMonday, -7);
      const lastSunday = addDays(thisMonday, -1);
      return {
        startDate: formatIsoDateLocal(lastMonday),
        endDate: formatIsoDateLocal(lastSunday),
      };
    }
    case "this_month": {
      const start = startOfMonth(today);
      return {
        startDate: formatIsoDateLocal(start),
        endDate: formatIsoDateLocal(today),
      };
    }
    case "last_month": {
      const prev = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      const start = startOfMonth(prev);
      const end = endOfMonth(prev);
      return {
        startDate: formatIsoDateLocal(start),
        endDate: formatIsoDateLocal(end),
      };
    }
    case "custom": {
      const startDate = customStart?.trim() || formatIsoDateLocal(today);
      const endDate = customEnd?.trim() || startDate;
      return startDate <= endDate
        ? { startDate, endDate }
        : { startDate: endDate, endDate: startDate };
    }
    default:
      return {
        startDate: formatIsoDateLocal(today),
        endDate: formatIsoDateLocal(today),
      };
  }
}

export function periodDaySpan(range: PeriodRange): number {
  const start = new Date(`${range.startDate}T12:00:00`);
  const end = new Date(`${range.endDate}T12:00:00`);
  return Math.floor((end.getTime() - start.getTime()) / 86400000) + 1;
}

export function formatPeriodLabel(
  range: PeriodRange,
  locale: string,
  preset?: DashboardPeriodPreset,
): string {
  if (preset === "all" || range.startDate === ALL_TIME_START_DATE) {
    return locale === "ar" ? "الكل" : "Tout";
  }
  const fmt = (iso: string) => formatDateShortFr(iso);
  if (range.startDate === range.endDate) return fmt(range.startDate);
  return `${fmt(range.startDate)} – ${fmt(range.endDate)}`;
}
