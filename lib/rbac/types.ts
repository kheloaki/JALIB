export type PermissionCategory =
  | "Ventes"
  | "Stock"
  | "Clients"
  | "Crédits"
  | "Rapports"
  | "Administration";

export type PermissionDefinition = {
  id: string;
  category: PermissionCategory;
  label: string;
  description: string;
};

export type Role = {
  id: string;
  legacyId?: string | null;
  name: string;
  description?: string | null;
  /** purely UI (demo) */
  assignedUsersCount: number;
  /** purely UI */
  badge?: "Plein accès" | "Limité" | null;
};

export type RolePermissionState = Record<string, boolean>;

export type RbacStore = {
  roles: Role[];
  permissions: PermissionDefinition[];
  rolePermissionsByRoleId: Record<string, RolePermissionState>;
};
