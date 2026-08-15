import {
  type DashboardPeriodPreset,
  type PeriodRange,
  resolvePeriodRange,
} from "@/lib/dashboard/period-range";

export type ClientActivitySegment = "active" | "inactive";

const VALID_PRESETS: DashboardPeriodPreset[] = [
  "all",
  "today",
  "yesterday",
  "this_week",
  "last_week",
  "this_month",
  "last_month",
  "custom",
];

export function isClientActivitySegment(
  value: string | null,
): value is ClientActivitySegment {
  return value === "active" || value === "inactive";
}

export function parseClientSegmentSearchParams(searchParams: URLSearchParams): {
  segment: ClientActivitySegment | null;
  range: PeriodRange | null;
  preset: DashboardPeriodPreset | null;
} {
  const rawSegment = searchParams.get("segment");
  if (!isClientActivitySegment(rawSegment)) {
    return { segment: null, range: null, preset: null };
  }

  const rawPeriod = searchParams.get("period");
  const preset =
    rawPeriod && (VALID_PRESETS as string[]).includes(rawPeriod)
      ? (rawPeriod as DashboardPeriodPreset)
      : null;

  if (preset) {
    const range = resolvePeriodRange(
      preset,
      preset === "custom" ? searchParams.get("startDate") ?? undefined : undefined,
      preset === "custom" ? searchParams.get("endDate") ?? undefined : undefined,
    );
    return { segment: rawSegment, range, preset };
  }

  const startDate = searchParams.get("startDate")?.trim();
  const endDate = searchParams.get("endDate")?.trim();
  if (startDate && endDate) {
    return {
      segment: rawSegment,
      range:
        startDate <= endDate
          ? { startDate, endDate }
          : { startDate: endDate, endDate: startDate },
      preset: "custom",
    };
  }

  return {
    segment: rawSegment,
    range: resolvePeriodRange("today"),
    preset: "today",
  };
}

export function buildClientSegmentHref(
  locale: string,
  segment: ClientActivitySegment,
  preset: DashboardPeriodPreset,
  range: PeriodRange,
  customStart?: string,
  customEnd?: string,
): string {
  const params = new URLSearchParams();
  params.set("segment", segment);
  params.set("period", preset);
  if (preset === "custom") {
    params.set("startDate", customStart ?? range.startDate);
    params.set("endDate", customEnd ?? range.endDate);
  }
  return `/${locale}/clients?${params.toString()}`;
}

export function clearClientSegmentHref(
  locale: string,
  searchParams: URLSearchParams,
): string {
  const params = new URLSearchParams(searchParams.toString());
  params.delete("segment");
  params.delete("period");
  params.delete("startDate");
  params.delete("endDate");
  params.delete("sort");
  const qs = params.toString();
  return `/${locale}/clients${qs ? `?${qs}` : ""}`;
}
