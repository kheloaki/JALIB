import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";

import { mutation, query } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";

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

type RoleSeed = {
  legacyId: string;
  name: string;
  description: string;
  assignedUsersCount: number;
  badge?: "Plein accès" | "Limité";
  permissions: PermissionKey[];
};

type AuthzCtx = QueryCtx | MutationCtx;

const permissionView = v.object({
  id: v.string(),
  category: v.union(
    v.literal("Ventes"),
    v.literal("Stock"),
    v.literal("Clients"),
    v.literal("Crédits"),
    v.literal("Rapports"),
    v.literal("Administration"),
  ),
  label: v.string(),
  description: v.string(),
});

const roleView = v.object({
  id: v.id("roles"),
  legacyId: v.union(v.string(), v.null()),
  name: v.string(),
  description: v.union(v.string(), v.null()),
  assignedUsersCount: v.number(),
  badge: v.union(v.literal("Plein accès"), v.literal("Limité"), v.null()),
});

const currentUserView = v.object({
  id: v.id("users"),
  name: v.string(),
  email: v.union(v.string(), v.null()),
  image: v.union(v.string(), v.null()),
  role: v.union(roleView, v.null()),
  permissions: v.array(v.string()),
});

const PERMISSIONS: Array<{
  key: PermissionKey;
  category:
    | "Ventes"
    | "Stock"
    | "Clients"
    | "Crédits"
    | "Rapports"
    | "Administration";
  label: string;
  description: string;
}> = [
  {
    key: "dashboard.view",
    category: "Rapports",
    label: "Voir le tableau de bord",
    description: "Accéder à la synthèse d'activité",
  },
  {
    key: "sales.view",
    category: "Ventes",
    label: "Voir les ventes",
    description: "Accès à l'historique des transactions",
  },
  {
    key: "sales.create",
    category: "Ventes",
    label: "Créer une vente",
    description: "Effectuer de nouveaux encaissements",
  },
  {
    key: "sales.assist_cart",
    category: "Ventes",
    label: "Assister au panier",
    description: "Composer un panier client à la caisse sans encaisser",
  },
  {
    key: "sales.park_cart",
    category: "Ventes",
    label: "Mettre en attente caissier",
    description: "Envoyer le panier en attente pour le caissier",
  },
  {
    key: "sales.cancel",
    category: "Ventes",
    label: "Annuler une vente",
    description: "Rembourser une transaction ou enregistrer un retour (legacy)",
  },
  {
    key: "sales.reopen",
    category: "Ventes",
    label: "Rouvrir une vente",
    description: "Rouvrir une facture clôturée depuis la caisse (correction encaissement)",
  },
  {
    key: "sales.credit",
    category: "Ventes",
    label: "Vendre à crédit",
    description: "Encaisser une vente en paiement différé à la caisse",
  },
  {
    key: "sales.edit_price",
    category: "Ventes",
    label: "Modifier le prix à la caisse",
    description: "Ajuster le prix unitaire lors d'une vente POS",
  },
  {
    key: "sales.delete",
    category: "Ventes",
    label: "Supprimer une facture",
    description: "Suppression définitive d'une facture (administrateur)",
  },
  {
    key: "clients.view",
    category: "Clients",
    label: "Voir les clients",
    description: "Consulter les fiches clients",
  },
  {
    key: "clients.manage",
    category: "Clients",
    label: "Gérer les clients",
    description: "Créer et modifier les fiches clients",
  },
  {
    key: "clients.delete",
    category: "Clients",
    label: "Supprimer un client",
    description: "Suppression définitive réservée à l'administrateur",
  },
  {
    key: "stock.view",
    category: "Stock",
    label: "Voir l'inventaire",
    description: "Catalogue, stocks, marges et historique des prix",
  },
  {
    key: "stock.edit_products",
    category: "Stock",
    label: "Gérer le catalogue",
    description: "Créer et modifier produits, prix de vente, coûts et catégories",
  },
  {
    key: "stock.delete_products",
    category: "Stock",
    label: "Supprimer un produit",
    description: "Retirer un produit du catalogue (admin uniquement)",
  },
  {
    key: "stock.adjust",
    category: "Stock",
    label: "Ajuster les quantités",
    description: "Corrections manuelles de stock (hors approvisionnement)",
  },
  {
    key: "stock.replenish",
    category: "Stock",
    label: "Approvisionner le stock",
    description: "Entrées de stock, quantités et prix d'achat / vente",
  },
  {
    key: "procurement.view",
    category: "Stock",
    label: "Voir la liste d'achats",
    description: "Consulter les listes d'approvisionnement et l'historique des prix",
  },
  {
    key: "procurement.manage",
    category: "Stock",
    label: "Gérer la liste d'achats",
    description: "Créer, modifier et publier les listes pour les courses",
  },
  {
    key: "procurement.fulfill",
    category: "Stock",
    label: "Enregistrer les achats",
    description: "Marquer les articles achetés et saisir le prix payé",
  },
  {
    key: "returns.view",
    category: "Ventes",
    label: "Voir les retours",
    description: "Consulter l'historique et les brouillons de retours",
  },
  {
    key: "returns.process",
    category: "Ventes",
    label: "Traiter les retours",
    description: "Enregistrer un retour client et rembourser",
  },
  {
    key: "credits.approve",
    category: "Crédits",
    label: "Approuver les crédits",
    description: "Autoriser le paiement différé",
  },
  {
    key: "credits.collect",
    category: "Crédits",
    label: "Collecter les dettes",
    description: "Enregistrer les remboursements client et gérer les plans",
  },
  {
    key: "credits.verify",
    category: "Crédits",
    label: "Vérifier les factures crédit",
    description: "Contrôle secondaire des ventes à crédit (scan code-barres)",
  },
  {
    key: "credits.view",
    category: "Crédits",
    label: "Consulter les crédits",
    description: "Voir soldes, relevés et plans sans encaisser",
  },
  {
    key: "alerts.view",
    category: "Rapports",
    label: "Voir les alertes",
    description: "Consulter les alertes stock, crédit et impayés",
  },
  {
    key: "alerts.manage",
    category: "Rapports",
    label: "Gérer les règles d'alerte",
    description: "Créer et modifier les règles d'alerte personnalisées",
  },
  {
    key: "reports.revenue",
    category: "Rapports",
    label: "Accéder aux revenus",
    description: "Voir les graphiques de chiffre d'affaires",
  },
  {
    key: "reports.export",
    category: "Rapports",
    label: "Exporter les données",
    description: "Générer des exports PDF ou tableur",
  },
  {
    key: "admin.manage_roles",
    category: "Administration",
    label: "Gérer les rôles",
    description: "Créer les rôles et modifier les permissions",
  },
  {
    key: "admin.create_users",
    category: "Administration",
    label: "Créer des comptes",
    description: "Créer des comptes utilisateurs (email + mot de passe + rôle)",
  },
  {
    key: "admin.manage_settings",
    category: "Administration",
    label: "Gérer les paramètres",
    description: "Modifier les informations magasin et les préférences globales",
  },
  {
    key: "admin.manage_devices",
    category: "Administration",
    label: "Gérer les appareils",
    description: "Approuver et révoquer les appareils autorisés à se connecter",
  },
  {
    key: "admin.view_audit",
    category: "Administration",
    label: "Voir l'audit",
    description: "Consulter l'historique des actions et modifications",
  },
];

const ADMIN_PERMISSIONS = PERMISSIONS.map((permission) => permission.key);
const MANAGER_PERMISSIONS: PermissionKey[] = [
  "dashboard.view",
  "sales.view",
  "sales.create",
  "sales.cancel",
  "sales.reopen",
  "sales.credit",
  "sales.edit_price",
  "clients.view",
  "clients.manage",
  "stock.view",
  "stock.edit_products",
  "stock.adjust",
  "stock.replenish",
  "procurement.view",
  "procurement.manage",
  "procurement.fulfill",
  "returns.view",
  "returns.process",
  "credits.approve",
  "credits.collect",
  "credits.verify",
  "credits.view",
  "alerts.view",
  "alerts.manage",
  "reports.revenue",
  "reports.export",
];
const CASHIER_PERMISSIONS: PermissionKey[] = [
  "sales.view",
  "sales.create",
  "clients.view",
  "stock.view",
  "returns.view",
  "alerts.view",
];
const STOCKKEEPER_PERMISSIONS: PermissionKey[] = [
  "stock.view",
  "stock.edit_products",
  "stock.adjust",
  "stock.replenish",
  "procurement.view",
  "procurement.fulfill",
  "alerts.view",
];
const CASHIER_ASSIST_PERMISSIONS: PermissionKey[] = [
  "sales.assist_cart",
  "sales.park_cart",
  "clients.view",
];

const ROLES: RoleSeed[] = [
  {
    legacyId: "role:admin",
    name: "Administrateur",
    description: "Accès complet au back-office",
    assignedUsersCount: 1,
    badge: "Plein accès",
    permissions: ADMIN_PERMISSIONS,
  },
  {
    legacyId: "role:manager",
    name: "Gérant",
    description: "Gestion opérationnelle quotidienne",
    assignedUsersCount: 2,
    permissions: MANAGER_PERMISSIONS,
  },
  {
    legacyId: "role:cashier",
    name: "Caissier",
    description: "Encaissements et consultation basique",
    assignedUsersCount: 4,
    badge: "Limité",
    permissions: CASHIER_PERMISSIONS,
  },
  {
    legacyId: "role:stockkeeper",
    name: "Magasinier",
    description: "Inventaire et mise à jour du stock",
    assignedUsersCount: 3,
    badge: "Limité",
    permissions: STOCKKEEPER_PERMISSIONS,
  },
  {
    legacyId: "role:cashier_assist",
    name: "Aide caissier",
    description: "Aide les clients à composer leur panier et l'envoie en attente caissier",
    assignedUsersCount: 0,
    badge: "Limité",
    permissions: CASHIER_ASSIST_PERMISSIONS,
  },
];

function roleToView(role: Doc<"roles">) {
  return {
    id: role._id,
    legacyId: role.legacyId ?? null,
    name: role.name,
    description: role.description ?? null,
    assignedUsersCount: role.assignedUsersCount,
    badge: role.badge ?? null,
  };
}

async function permissionKeyToId(ctx: AuthzCtx, key: string) {
  const permission = await ctx.db
    .query("permissions")
    .withIndex("by_key", (q) => q.eq("key", key))
    .unique();
  return permission?._id ?? null;
}

export async function ensureDefaultRbac(ctx: MutationCtx) {
  const now = Date.now();
  const permissionIds: Partial<Record<PermissionKey, Id<"permissions">>> = {};

  for (const permission of PERMISSIONS) {
    const existing = await ctx.db
      .query("permissions")
      .withIndex("by_key", (q) => q.eq("key", permission.key))
      .unique();
    if (existing) {
      permissionIds[permission.key] = existing._id;
      if (
        existing.label !== permission.label ||
        existing.description !== permission.description ||
        existing.category !== permission.category
      ) {
        await ctx.db.patch(existing._id, {
          label: permission.label,
          description: permission.description,
          category: permission.category,
        });
      }
      continue;
    }
    permissionIds[permission.key] = await ctx.db.insert("permissions", {
      key: permission.key,
      category: permission.category,
      label: permission.label,
      description: permission.description,
    });
  }

  const seedByLegacyId = new Map(ROLES.map((role) => [role.legacyId, role]));
  const roleIds: Record<string, Id<"roles">> = {};

  for (const roleSeed of ROLES) {
    const existing = await ctx.db
      .query("roles")
      .withIndex("by_legacyId", (q) => q.eq("legacyId", roleSeed.legacyId))
      .unique();
    const roleId =
      existing?._id ??
      (await ctx.db.insert("roles", {
        legacyId: roleSeed.legacyId,
        name: roleSeed.name,
        description: roleSeed.description,
        assignedUsersCount: roleSeed.assignedUsersCount,
        ...(roleSeed.badge ? { badge: roleSeed.badge } : {}),
        createdAt: now,
        updatedAt: now,
      }));
    roleIds[roleSeed.legacyId] = roleId;
  }

  const allRoles = await ctx.db.query("roles").take(100);
  for (const role of allRoles) {
    const seed = role.legacyId ? seedByLegacyId.get(role.legacyId) : undefined;
    for (const permission of PERMISSIONS) {
      const permissionId = permissionIds[permission.key]!;
      const existingLink = await ctx.db
        .query("rolePermissions")
        .withIndex("by_roleId_permissionId", (q) =>
          q.eq("roleId", role._id).eq("permissionId", permissionId),
        )
        .unique();
      if (existingLink) continue;
      await ctx.db.insert("rolePermissions", {
        roleId: role._id,
        permissionId,
        enabled: seed?.permissions.includes(permission.key) ?? false,
      });
    }
  }

  return {
    adminRoleId: roleIds["role:admin"]!,
    cashierRoleId: roleIds["role:cashier"]!,
  };
}

async function getEnabledPermissionKeys(ctx: AuthzCtx, roleId: Id<"roles">) {
  const links = await ctx.db
    .query("rolePermissions")
    .withIndex("by_roleId", (q) => q.eq("roleId", roleId))
    .take(300);
  const enabled: string[] = [];
  for (const link of links) {
    if (!link.enabled) continue;
    const permission = await ctx.db.get(link.permissionId);
    if (permission) enabled.push(permission.key);
  }
  return enabled;
}

async function getCurrentUserView(ctx: AuthzCtx, userId: Id<"users">) {
  const user = await ctx.db.get(userId);
  if (!user) return null;
  const role = user.roleId ? await ctx.db.get(user.roleId) : null;
  const permissions = role ? await getEnabledPermissionKeys(ctx, role._id) : [];
  return {
    id: user._id,
    name: user.name ?? user.email ?? "User",
    email: user.email ?? null,
    image: user.image ?? null,
    role: role ? roleToView(role) : null,
    permissions,
  };
}

export async function requireAuthenticatedUser(ctx: AuthzCtx) {
  const userId = await getAuthUserId(ctx);
  if (!userId) throw new Error("Not authenticated");
  const user = await ctx.db.get(userId);
  if (!user) throw new Error("Not authenticated");
  return { userId, user };
}

export async function requirePermission(
  ctx: AuthzCtx,
  permissionKey: PermissionKey,
) {
  const { userId, user } = await requireAuthenticatedUser(ctx);
  if (!user.roleId) throw new Error("Unauthorized");
  const permissionId = await permissionKeyToId(ctx, permissionKey);
  if (!permissionId) throw new Error("Unauthorized");
  const link = await ctx.db
    .query("rolePermissions")
    .withIndex("by_roleId_permissionId", (q) =>
      q.eq("roleId", user.roleId!).eq("permissionId", permissionId),
    )
    .unique();
  if (!link?.enabled) throw new Error("Unauthorized");
  return { userId, user };
}

export async function requireAnyPermission(
  ctx: AuthzCtx,
  permissionKeys: PermissionKey[],
) {
  const { userId, user } = await requireAuthenticatedUser(ctx);
  if (!user.roleId) throw new Error("Unauthorized");
  for (const permissionKey of permissionKeys) {
    const permissionId = await permissionKeyToId(ctx, permissionKey);
    if (!permissionId) continue;
    const link = await ctx.db
      .query("rolePermissions")
      .withIndex("by_roleId_permissionId", (q) =>
        q.eq("roleId", user.roleId!).eq("permissionId", permissionId),
      )
      .unique();
    if (link?.enabled) return { userId, user };
  }
  throw new Error("Unauthorized");
}

export async function hasAnyPermission(
  ctx: AuthzCtx,
  permissionKeys: PermissionKey[],
) {
  const userId = await getAuthUserId(ctx);
  if (!userId) return false;
  const user = await ctx.db.get(userId);
  if (!user?.roleId) return false;
  for (const permissionKey of permissionKeys) {
    const permissionId = await permissionKeyToId(ctx, permissionKey);
    if (!permissionId) continue;
    const link = await ctx.db
      .query("rolePermissions")
      .withIndex("by_roleId_permissionId", (q) =>
        q.eq("roleId", user.roleId!).eq("permissionId", permissionId),
      )
      .unique();
    if (link?.enabled) return true;
  }
  return false;
}

export const ensureCurrentUser = mutation({
  args: {},
  returns: currentUserView,
  handler: async (ctx) => {
    const { userId, user } = await requireAuthenticatedUser(ctx);
    const { adminRoleId, cashierRoleId } = await ensureDefaultRbac(ctx);

    if (!user.roleId) {
      const existingAdmin = await ctx.db
        .query("users")
        .withIndex("by_roleId", (q) => q.eq("roleId", adminRoleId))
        .first();
      await ctx.db.patch(userId, {
        roleId: existingAdmin ? cashierRoleId : adminRoleId,
        updatedAt: Date.now(),
      });
    }

    const view = await getCurrentUserView(ctx, userId);
    if (!view) throw new Error("Not authenticated");
    return view;
  },
});

export const currentUser = query({
  args: {},
  returns: v.union(currentUserView, v.null()),
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;
    return await getCurrentUserView(ctx, userId);
  },
});

export const listPermissionDefinitions = query({
  args: {},
  returns: v.array(permissionView),
  handler: async (ctx) => {
    await requirePermission(ctx, "admin.manage_roles");
    const permissions = await ctx.db.query("permissions").take(300);
    return permissions.map((permission) => ({
      id: permission.key,
      category: permission.category,
      label: permission.label,
      description: permission.description,
    }));
  },
});
