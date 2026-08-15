import {
  canAccessProcurement,
  canAccessReturns,
  canReplenishStock,
} from "@/lib/auth/permissions";

export type StockPageTab =
  | "catalog"
  | "replenishment"
  | "procurement"
  | "returns"
  | "brands";

export function parseStockTab(raw: string | null): StockPageTab {
  if (raw === "replenishment" || raw === "approvisionnement") {
    return "replenishment";
  }
  if (raw === "procurement" || raw === "achats") return "procurement";
  if (raw === "returns" || raw === "retours") return "returns";
  if (raw === "brands" || raw === "marques") return "brands";
  return "catalog";
}

export function resolveVisibleStockTab(
  tab: StockPageTab,
  permissions: string[],
): StockPageTab {
  const canProcurement = canAccessProcurement(permissions);
  const canReplenish = canReplenishStock(permissions);
  const canCatalog = permissions.includes("stock.view");
  const canManageBrands = permissions.includes("stock.edit_products");
  const canReturns = canAccessReturns(permissions);

  if (tab === "catalog" && !canCatalog) {
    return canReturns
      ? "returns"
      : canProcurement
        ? "procurement"
        : "replenishment";
  }
  if (tab === "procurement" && !canProcurement) return "catalog";
  if (tab === "replenishment" && !canReplenish) return "catalog";
  if (tab === "returns" && !canReturns) return "catalog";
  if (tab === "brands" && !canManageBrands) return "catalog";
  return tab;
}

export function getStockTabVisibility(permissions: string[]) {
  return {
    canCatalog: permissions.includes("stock.view"),
    canManageBrands: permissions.includes("stock.edit_products"),
    canReplenish: canReplenishStock(permissions),
    canProcurement: canAccessProcurement(permissions),
    canReturns: canAccessReturns(permissions),
  };
}
