export function normalizeCategoryLabel(raw: string): string {
  return raw.trim().replace(/\s+/g, " ");
}

/** Built-in shelf categories first, then custom ones (no duplicate names, case-insensitive). */
export function mergeShelfCategoriesForSelect(
  builtIn: readonly string[],
  extra: string[],
): string[] {
  const norms = new Set(builtIn.map((c) => c.toLowerCase()));
  const out = [...builtIn];
  for (const e of extra) {
    const t = normalizeCategoryLabel(e);
    if (!t) continue;
    const n = t.toLowerCase();
    if (norms.has(n)) continue;
    norms.add(n);
    out.push(t);
  }
  return out;
}

/** Tab row: Tout + every selectable shelf category (built-in + extras). */
export function buildPosCategoryTabs(
  builtIn: readonly string[],
  extra: string[],
): string[] {
  return ["Tout", ...mergeShelfCategoriesForSelect(builtIn, extra)];
}
