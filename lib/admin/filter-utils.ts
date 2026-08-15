export function foldSearchText(text: string): string {
  return text
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .trim();
}

export function normalizeSearchQuery(query: string): string {
  return foldSearchText(query);
}

export function matchesSearchQuery(
  query: string,
  ...fields: Array<string | null | undefined>
): boolean {
  const normalized = normalizeSearchQuery(query);
  if (!normalized) return true;
  return fields.some((field) =>
    foldSearchText(field ?? "").includes(normalized),
  );
}

export function isFilterActive(
  filteredCount: number,
  totalCount: number,
  searchQuery?: string,
  extraActive = false,
): boolean {
  return (
    extraActive ||
    normalizeSearchQuery(searchQuery ?? "").length > 0 ||
    filteredCount !== totalCount
  );
}
