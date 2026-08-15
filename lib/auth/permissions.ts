export type PermissionKey =
  | "dashboard.view"
  | "sales.view"
  | "sales.create"
  | "sales.assist_cart"
  | "sales.park_cart"
  | "sales.cancel"
  | "sales.reopen"
  | "sales.credit"
  | "sales.edit_price"
  | "sales.delete"
  | "clients.view"
  | "clients.manage"
  | "clients.delete"
  | "stock.view"
  | "stock.edit_products"
  | "stock.delete_products"
  | "stock.adjust"
  | "stock.replenish"
  | "procurement.view"
  | "procurement.manage"
  | "procurement.fulfill"
  | "returns.view"
  | "returns.process"
  | "credits.approve"
  | "credits.collect"
  | "credits.view"
  | "credits.verify"
  | "alerts.view"
  | "alerts.manage"
  | "reports.revenue"
  | "reports.export"
  | "admin.manage_roles"
  | "admin.create_users"
  | "admin.manage_settings"
  | "admin.manage_devices"
  | "admin.view_audit";

export function canManageDevices(permissions: readonly string[]) {
  return permissions.includes("admin.manage_devices");
}

export function canCreateUsers(permissions: readonly string[]) {
  return (
    permissions.includes("admin.create_users") ||
    permissions.includes("admin.manage_roles")
  );
}

export function canDeleteClients(permissions: readonly string[]) {
  return permissions.includes("clients.delete");
}

export function canDeleteProducts(permissions: readonly string[]) {
  return permissions.includes("stock.delete_products");
}

export function canDeleteInvoices(permissions: readonly string[]) {
  return permissions.includes("sales.delete");
}

export function requiredPermissionForPath(
  pathname: string | null,
): PermissionKey | null {
  if (!pathname) return null;
  if (pathname.includes("/dashboard")) return "dashboard.view";
  if (pathname.includes("/parametres")) return "admin.manage_settings";
  if (pathname.includes("/audit")) return "admin.view_audit";
  if (pathname.includes("/produits")) return "stock.view";
  if (pathname.includes("/stock")) return "stock.view";
  if (pathname.includes("/achats")) return "procurement.view";
  if (pathname.includes("/pos")) return null;
  if (pathname.includes("/clients")) return "clients.view";
  if (pathname.includes("/factures")) return "sales.view";
  if (pathname.includes("/retours")) return "returns.view";
  if (pathname.includes("/alertes")) return "alerts.view";
  return null;
}

const ACCESS_FALLBACK_PATHS = [
  "/dashboard",
  "/pos",
  "/stock",
  "/factures",
  "/clients",
  "/credits",
  "/alertes",
  "/parametres",
] as const;

export function firstAccessiblePath(permissions: readonly string[]) {
  return (
    ACCESS_FALLBACK_PATHS.find((path) => canAccessPath(path, permissions)) ??
    "/alertes"
  );
}

/** True when the user can navigate somewhere other than the POS screen. */
export function canLeavePos(permissions: readonly string[]) {
  return ACCESS_FALLBACK_PATHS.some(
    (path) => path !== "/pos" && canAccessPath(path, permissions),
  );
}

/** First admin route outside POS (for « Quitter caisse »). */
export function firstAccessiblePathOutsidePos(permissions: readonly string[]) {
  return (
    ACCESS_FALLBACK_PATHS.find(
      (path) => path !== "/pos" && canAccessPath(path, permissions),
    ) ?? "/dashboard"
  );
}

export function canReplenishStock(permissions: readonly string[]) {
  return (
    permissions.includes("stock.replenish") ||
    permissions.includes("stock.edit_products") ||
    permissions.includes("stock.adjust")
  );
}

export function canAccessProcurement(permissions: readonly string[]) {
  return (
    permissions.includes("procurement.view") ||
    permissions.includes("procurement.manage") ||
    permissions.includes("procurement.fulfill") ||
    canReplenishStock(permissions)
  );
}

/** Owner flow: build draft list and publish (Gérant, Admin, or legacy stock editors). */
export function canBuildProcurementList(permissions: readonly string[]) {
  return (
    permissions.includes("procurement.manage") ||
    permissions.includes("stock.edit_products")
  );
}

export function canAccessReturns(permissions: readonly string[]) {
  return (
    permissions.includes("returns.view") ||
    permissions.includes("returns.process") ||
    permissions.includes("sales.view") ||
    permissions.includes("sales.cancel")
  );
}

export function canProcessReturns(permissions: readonly string[]) {
  return (
    permissions.includes("returns.process") ||
    permissions.includes("sales.cancel")
  );
}

export function canAccessCredits(permissions: readonly string[]) {
  return (
    permissions.includes("credits.view") ||
    permissions.includes("credits.collect") ||
    permissions.includes("credits.approve")
  );
}

export function canCollectCredits(permissions: readonly string[]) {
  return permissions.includes("credits.collect");
}

export function canVerifyCreditInvoices(permissions: readonly string[]) {
  return permissions.includes("credits.verify");
}

export function canAccessPos(permissions: readonly string[]) {
  return (
    permissions.includes("sales.create") ||
    permissions.includes("sales.assist_cart")
  );
}

export function canCheckoutSale(permissions: readonly string[]) {
  return permissions.includes("sales.create");
}

export function canParkCartDraft(permissions: readonly string[]) {
  return (
    permissions.includes("sales.park_cart") ||
    permissions.includes("sales.create")
  );
}

export function canManageCartDrafts(permissions: readonly string[]) {
  return permissions.includes("sales.create");
}

export function canSellOnCredit(permissions: readonly string[]) {
  return (
    permissions.includes("sales.credit") ||
    permissions.includes("credits.approve")
  );
}

export function canEditSalePrice(permissions: readonly string[]) {
  return permissions.includes("sales.edit_price");
}

export function canAccessAlerts(permissions: readonly string[]) {
  return (
    permissions.includes("alerts.view") ||
    permissions.includes("alerts.manage") ||
    permissions.includes("credits.collect") ||
    permissions.includes("stock.view") ||
    permissions.includes("reports.revenue")
  );
}

export function canManageAlerts(permissions: readonly string[]) {
  return permissions.includes("alerts.manage");
}

export function canExportReports(permissions: readonly string[]) {
  return permissions.includes("reports.export");
}

export function canDownloadInvoicePdf(permissions: readonly string[]) {
  return (
    permissions.includes("reports.export") ||
    permissions.includes("sales.view")
  );
}

export function canViewRevenue(permissions: readonly string[]) {
  return (
    permissions.includes("reports.revenue") || canAccessCredits(permissions)
  );
}

export function canReopenSale(permissions: readonly string[]) {
  return (
    permissions.includes("sales.reopen") ||
    permissions.includes("sales.cancel")
  );
}

export function canAccessPath(
  pathname: string | null,
  permissions: readonly string[],
) {
  if (pathname?.includes("/achats")) {
    return canAccessProcurement(permissions);
  }
  if (pathname?.includes("/stock")) {
    return (
      permissions.includes("stock.view") ||
      canAccessProcurement(permissions) ||
      canAccessReturns(permissions)
    );
  }
  if (pathname?.includes("/retours")) {
    return canAccessReturns(permissions);
  }
  if (pathname?.includes("/parametres")) {
    return true;
  }
  if (pathname?.includes("/credits")) {
    return canAccessCredits(permissions);
  }
  if (pathname?.includes("/alertes")) {
    return canAccessAlerts(permissions);
  }
  if (pathname?.includes("/pos")) {
    return canAccessPos(permissions);
  }
  const required = requiredPermissionForPath(pathname);
  return !required || permissions.includes(required);
}
