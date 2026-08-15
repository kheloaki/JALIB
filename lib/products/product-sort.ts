export function buildSoldQtyByProductId(
  rows: readonly { productId: string; qty: number }[] | undefined,
): Map<string, number> {
  const map = new Map<string, number>();
  for (const row of rows ?? []) {
    map.set(row.productId, row.qty);
  }
  return map;
}

export function compareProductsByBestSellers(
  a: { id: string; name: string },
  b: { id: string; name: string },
  soldQtyByProductId: Map<string, number>,
): number {
  const bySold =
    (soldQtyByProductId.get(b.id) ?? 0) - (soldQtyByProductId.get(a.id) ?? 0);
  if (bySold !== 0) return bySold;
  return a.name.localeCompare(b.name, "fr");
}

export function sortProductsByBestSellers<T extends { id: string; name: string }>(
  products: readonly T[],
  soldQtyByProductId: Map<string, number>,
): T[] {
  return [...products].sort((a, b) =>
    compareProductsByBestSellers(a, b, soldQtyByProductId),
  );
}
