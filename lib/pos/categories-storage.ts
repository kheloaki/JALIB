/** Extra POS category labels — localStorage for now; replace with Convex when backend ships. */
const STORAGE_KEY = "matjar_pos_categories_extra_v1";

export function readExtraPosCategories(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((x): x is string => typeof x === "string");
  } catch {
    return [];
  }
}

export function writeExtraPosCategories(categories: string[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(categories));
  } catch {
    // ignore
  }
}
