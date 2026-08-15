export type AdminNavItem = {
  icon: string;
  label: string;
  /** Use `#` for routes not built yet */
  href: string;
};

export const ADMIN_MAIN_NAV: AdminNavItem[] = [
  { icon: "dashboard", label: "Tableau de Bord", href: "/dashboard" },
  { icon: "inventory_2", label: "Inventaire", href: "/stock" },
  { icon: "point_of_sale", label: "Point de Vente", href: "/pos" },
  { icon: "payments", label: "Crédits", href: "/credits" },
  { icon: "description", label: "Factures", href: "/factures" },
  { icon: "group", label: "Clients", href: "/clients" },
  { icon: "history", label: "Audit", href: "/audit" },
];

function stripLocalePrefix(pathname: string): string {
  const match = pathname.match(/^\/(fr|ar)(?=\/|$)/);
  if (!match) return pathname;
  const rest = pathname.slice(match[0].length);
  return rest.length > 0 ? rest : "/";
}

/** Active when `href` matches the current path (ignores `#` placeholders). */
export function isAdminNavItemActive(pathname: string, href: string) {
  const path = stripLocalePrefix(pathname);
  const target = stripLocalePrefix(href);

  if (target === "#") return false;
  if (target === "/") return path === "/";
  if (target === "/clients") return path.startsWith("/clients");
  if (target === "/alertes") return path.startsWith("/alertes");
  if (target === "/credits") return path.startsWith("/credits");
  if (target === "/factures") return path.startsWith("/factures");
  if (target === "/audit") return path.startsWith("/audit");
  if (target === "/dashboard") return path.startsWith("/dashboard");
  if (target === "/stock") {
    return (
      path.startsWith("/stock") ||
      path.startsWith("/achats") ||
      path.startsWith("/retours")
    );
  }
  return path === target || path.startsWith(`${target}/`);
}
