const PAGE_TITLE_KEYS: { match: (pathname: string) => boolean; key: string }[] = [
  { match: (p) => p.includes("/dashboard"), key: "dashboard" },
  { match: (p) => p.includes("/factures"), key: "invoices" },
  { match: (p) => p.includes("/clients"), key: "clients" },
  { match: (p) => p.includes("/alertes"), key: "alerts" },
  { match: (p) => p.includes("/parametres"), key: "settings" },
  { match: (p) => p.includes("/roles"), key: "roles" },
  { match: (p) => p.includes("/retours"), key: "returns" },
  { match: (p) => p.includes("/achats"), key: "procurement" },
  { match: (p) => p.includes("/produits"), key: "products" },
];

export function getAdminHeaderTitleKey(
  pathname: string | null,
): string | null {
  if (!pathname) return null;
  const hit = PAGE_TITLE_KEYS.find((entry) => entry.match(pathname));
  return hit?.key ?? null;
}
