import type { PermissionDefinition, RbacStore, RolePermissionState } from "@/lib/rbac/types";

export const RBAC_PERMISSIONS: PermissionDefinition[] = [
  {
    id: "dashboard.view",
    category: "Rapports",
    label: "Voir le tableau de bord",
    description: "Accéder à la synthèse d'activité",
  },
  {
    id: "sales.view",
    category: "Ventes",
    label: "Voir les ventes",
    description: "Accès à l'historique des transactions",
  },
  {
    id: "sales.create",
    category: "Ventes",
    label: "Créer une vente",
    description: "Effectuer de nouveaux encaissements à la caisse",
  },
  {
    id: "sales.assist_cart",
    category: "Ventes",
    label: "Assister au panier",
    description: "Composer un panier client à la caisse sans encaisser",
  },
  {
    id: "sales.park_cart",
    category: "Ventes",
    label: "Mettre en attente caissier",
    description: "Envoyer le panier en attente pour le caissier",
  },
  {
    id: "sales.cancel",
    category: "Ventes",
    label: "Annuler une vente",
    description: "Rembourser une transaction ou enregistrer un retour (legacy)",
  },
  {
    id: "sales.reopen",
    category: "Ventes",
    label: "Rouvrir une vente",
    description: "Rouvrir une facture clôturée depuis la caisse",
  },
  {
    id: "sales.credit",
    category: "Ventes",
    label: "Vendre à crédit",
    description: "Encaisser une vente en paiement différé à la caisse",
  },
  {
    id: "sales.edit_price",
    category: "Ventes",
    label: "Modifier le prix à la caisse",
    description: "Ajuster le prix unitaire lors d'une vente POS",
  },
  {
    id: "sales.delete",
    category: "Ventes",
    label: "Supprimer une facture",
    description: "Suppression définitive d'une facture (administrateur)",
  },
  {
    id: "returns.view",
    category: "Ventes",
    label: "Voir les retours",
    description: "Consulter l'historique et les brouillons de retours",
  },
  {
    id: "returns.process",
    category: "Ventes",
    label: "Traiter les retours",
    description: "Enregistrer un retour client et rembourser",
  },
  {
    id: "clients.view",
    category: "Clients",
    label: "Voir les clients",
    description: "Consulter les fiches clients",
  },
  {
    id: "clients.manage",
    category: "Clients",
    label: "Gérer les clients",
    description: "Créer et modifier les fiches clients",
  },
  {
    id: "clients.delete",
    category: "Clients",
    label: "Supprimer un client",
    description: "Suppression définitive réservée à l'administrateur",
  },
  {
    id: "stock.view",
    category: "Stock",
    label: "Voir l'inventaire",
    description: "Catalogue, stocks, marges et historique des prix",
  },
  {
    id: "stock.edit_products",
    category: "Stock",
    label: "Gérer le catalogue",
    description: "Créer et modifier produits, prix de vente, coûts et catégories",
  },
  {
    id: "stock.delete_products",
    category: "Stock",
    label: "Supprimer un produit",
    description: "Retirer un produit du catalogue (admin uniquement)",
  },
  {
    id: "stock.adjust",
    category: "Stock",
    label: "Ajuster les quantités",
    description: "Corrections manuelles de stock (hors approvisionnement)",
  },
  {
    id: "stock.replenish",
    category: "Stock",
    label: "Approvisionner le stock",
    description: "Entrées de stock, quantités et prix d'achat / vente",
  },
  {
    id: "procurement.view",
    category: "Stock",
    label: "Voir la liste d'achats",
    description: "Consulter les listes d'approvisionnement et l'historique des prix",
  },
  {
    id: "procurement.manage",
    category: "Stock",
    label: "Gérer la liste d'achats",
    description: "Créer, modifier et publier les listes pour les courses",
  },
  {
    id: "procurement.fulfill",
    category: "Stock",
    label: "Enregistrer les achats",
    description: "Marquer les articles achetés et saisir le prix payé",
  },
  {
    id: "credits.approve",
    category: "Crédits",
    label: "Approuver les crédits",
    description: "Autoriser le paiement différé",
  },
  {
    id: "credits.collect",
    category: "Crédits",
    label: "Collecter les dettes",
    description: "Enregistrer les remboursements client et gérer les plans",
  },
  {
    id: "credits.verify",
    category: "Crédits",
    label: "Vérifier les factures crédit",
    description: "Contrôle secondaire des ventes à crédit (scan code-barres)",
  },
  {
    id: "credits.view",
    category: "Crédits",
    label: "Consulter les crédits",
    description: "Voir soldes, relevés et plans sans encaisser",
  },
  {
    id: "alerts.view",
    category: "Rapports",
    label: "Voir les alertes",
    description: "Consulter les alertes stock, crédit et impayés",
  },
  {
    id: "alerts.manage",
    category: "Rapports",
    label: "Gérer les règles d'alerte",
    description: "Créer et modifier les règles d'alerte personnalisées",
  },
  {
    id: "reports.revenue",
    category: "Rapports",
    label: "Accéder aux revenus",
    description: "Voir les graphiques de chiffre d'affaires",
  },
  {
    id: "reports.export",
    category: "Rapports",
    label: "Exporter les données",
    description: "Générer des exports PDF ou tableur",
  },
  {
    id: "admin.manage_roles",
    category: "Administration",
    label: "Gérer les rôles",
    description: "Créer les rôles et modifier les permissions",
  },
  {
    id: "admin.create_users",
    category: "Administration",
    label: "Créer des comptes",
    description: "Créer des comptes utilisateurs (email + mot de passe + rôle)",
  },
  {
    id: "admin.manage_settings",
    category: "Administration",
    label: "Gérer les paramètres",
    description: "Modifier les informations magasin et les préférences globales",
  },
  {
    id: "admin.manage_devices",
    category: "Administration",
    label: "Gérer les appareils",
    description: "Approuver et révoquer les appareils autorisés à se connecter",
  },
  {
    id: "admin.view_audit",
    category: "Administration",
    label: "Voir l'audit",
    description: "Consulter l'historique des actions et modifications",
  },
];

export function allPermissionsEnabled(): RolePermissionState {
  return Object.fromEntries(RBAC_PERMISSIONS.map((p) => [p.id, true]));
}

export function minimalCashierPermissions(): RolePermissionState {
  const enabled = new Set<string>([
    "sales.view",
    "sales.create",
    "clients.view",
    "stock.view",
    "returns.view",
    "alerts.view",
  ]);
  return Object.fromEntries(RBAC_PERMISSIONS.map((p) => [p.id, enabled.has(p.id)]));
}

export function managerPermissions(): RolePermissionState {
  const enabled = new Set<string>([
    "dashboard.view",
    "sales.view",
    "sales.create",
    "sales.cancel",
    "sales.reopen",
    "sales.credit",
    "sales.edit_price",
    "returns.view",
    "returns.process",
    "clients.view",
    "clients.manage",
    "stock.view",
    "stock.edit_products",
    "stock.adjust",
    "stock.replenish",
    "procurement.view",
    "procurement.manage",
    "procurement.fulfill",
    "credits.approve",
    "credits.collect",
    "credits.verify",
    "credits.view",
    "alerts.view",
    "alerts.manage",
    "reports.revenue",
    "reports.export",
  ]);
  return Object.fromEntries(RBAC_PERMISSIONS.map((p) => [p.id, enabled.has(p.id)]));
}

export function stockkeeperPermissions(): RolePermissionState {
  const enabled = new Set<string>([
    "stock.view",
    "stock.edit_products",
    "stock.adjust",
    "stock.replenish",
    "procurement.view",
    "procurement.fulfill",
    "alerts.view",
  ]);
  return Object.fromEntries(RBAC_PERMISSIONS.map((p) => [p.id, enabled.has(p.id)]));
}

export function cashierAssistPermissions(): RolePermissionState {
  const enabled = new Set<string>([
    "sales.assist_cart",
    "sales.park_cart",
    "clients.view",
  ]);
  return Object.fromEntries(RBAC_PERMISSIONS.map((p) => [p.id, enabled.has(p.id)]));
}

export function createDefaultRbacStore(): RbacStore {
  const adminId = "role:admin";
  const managerId = "role:manager";
  const cashierId = "role:cashier";
  const stockkeeperId = "role:stockkeeper";
  const cashierAssistId = "role:cashier_assist";

  return {
    permissions: RBAC_PERMISSIONS,
    roles: [
      {
        id: adminId,
        legacyId: adminId,
        name: "Administrateur",
        description: "Accès complet au back-office",
        assignedUsersCount: 1,
        badge: "Plein accès",
      },
      {
        id: managerId,
        legacyId: managerId,
        name: "Gérant",
        description: "Gestion opérationnelle quotidienne",
        assignedUsersCount: 2,
      },
      {
        id: cashierId,
        legacyId: cashierId,
        name: "Caissier",
        description: "Encaissements et consultation basique",
        assignedUsersCount: 4,
        badge: "Limité",
      },
      {
        id: stockkeeperId,
        legacyId: stockkeeperId,
        name: "Magasinier",
        description: "Inventaire et mise à jour du stock",
        assignedUsersCount: 3,
        badge: "Limité",
      },
      {
        id: cashierAssistId,
        legacyId: cashierAssistId,
        name: "Aide caissier",
        description: "Aide les clients à composer leur panier et l'envoie en attente caissier",
        assignedUsersCount: 0,
        badge: "Limité",
      },
    ],
    rolePermissionsByRoleId: {
      [adminId]: allPermissionsEnabled(),
      [managerId]: managerPermissions(),
      [cashierId]: minimalCashierPermissions(),
      [stockkeeperId]: stockkeeperPermissions(),
      [cashierAssistId]: cashierAssistPermissions(),
    },
  };
}
