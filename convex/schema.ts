import { defineSchema, defineTable } from "convex/server";
import { authTables } from "@convex-dev/auth/server";
import { v } from "convex/values";

const money = v.number();
const isoDate = v.string();
const timestamp = v.number();

const paymentType = v.union(v.literal("cash"), v.literal("credit"));
const invoiceStatus = v.union(
  v.literal("paid"),
  v.literal("pending"),
  v.literal("returned"),
);
const ledgerKind = v.union(
  v.literal("payment"),
  v.literal("invoice"),
  v.literal("return"),
);
const ledgerStatus = v.union(
  v.literal("valide"),
  v.literal("impayé"),
  v.literal("solde"),
);
const ledgerSource = v.union(
  v.literal("manual"),
  v.literal("pos"),
  v.literal("plan"),
  v.literal("return"),
  v.literal("migration"),
);
const installmentPlanStatus = v.union(
  v.literal("active"),
  v.literal("completed"),
  v.literal("draft"),
  v.literal("cancelled"),
);
const scheduleRule = v.union(
  v.object({ kind: v.literal("manual") }),
  v.object({
    kind: v.literal("recurring"),
    expectedPaymentMadCents: money,
    intervalMonths: v.number(),
    dueDayOfMonth: v.number(),
  }),
);
const scheduleSlot = v.object({
  dueDate: isoDate,
  expectedMadCents: money,
});
const returnReason = v.union(
  v.literal("Endommagé"),
  v.literal("Mauvais article"),
  v.literal("Choix du client"),
  v.literal("Autre"),
);
const stockDisposition = v.union(
  v.literal("Invendable"),
  v.literal("Disponible"),
);
const alertCategory = v.union(
  v.literal("credit_over"),
  v.literal("credit_warn"),
  v.literal("unpaid"),
  v.literal("installment_missed"),
  v.literal("stock"),
);
const alertVariant = v.union(
  v.literal("whatsapp_ignore"),
  v.literal("details"),
  v.literal("phone_mail"),
  v.literal("order"),
);
const permissionCategory = v.union(
  v.literal("Ventes"),
  v.literal("Stock"),
  v.literal("Clients"),
  v.literal("Crédits"),
  v.literal("Rapports"),
  v.literal("Administration"),
);
const roleBadge = v.union(v.literal("Plein accès"), v.literal("Limité"));
const procurementListStatus = v.union(
  v.literal("draft"),
  v.literal("active"),
  v.literal("completed"),
);
const procurementItemStatus = v.union(
  v.literal("pending"),
  v.literal("bought"),
);

export default defineSchema({
  ...authTables,

  users: defineTable({
    name: v.optional(v.string()),
    image: v.optional(v.string()),
    email: v.optional(v.string()),
    emailVerificationTime: v.optional(v.number()),
    phone: v.optional(v.string()),
    phoneVerificationTime: v.optional(v.number()),
    isAnonymous: v.optional(v.boolean()),
    roleId: v.optional(v.id("roles")),
    updatedAt: v.optional(timestamp),
  })
    .index("email", ["email"])
    .index("phone", ["phone"])
    .index("by_roleId", ["roleId"]),

  clients: defineTable({
    legacyId: v.optional(v.string()),
    fullName: v.string(),
    phone: v.string(),
    isCashOnly: v.boolean(),
    creditLimitMadCents: v.union(money, v.null()),
    /**
     * Opening client solde in MAD cents (same sign as UI solde).
     * Positive = avoir; negative = dette; omitted/0 = none.
     */
    initialSoldeMadCents: v.optional(money),
    createdAt: timestamp,
    updatedAt: timestamp,
  })
    .index("by_legacyId", ["legacyId"])
    .index("by_phone", ["phone"])
    .index("by_fullName", ["fullName"])
    .index("by_updatedAt", ["updatedAt"])
    .searchIndex("search_fullName", {
      searchField: "fullName",
    })
    .searchIndex("search_phone", {
      searchField: "phone",
    }),

  productCategories: defineTable({
    label: v.string(),
    normalizedLabel: v.string(),
    kind: v.union(v.literal("builtIn"), v.literal("custom")),
    createdAt: timestamp,
  }).index("by_normalizedLabel", ["normalizedLabel"]),

  brands: defineTable({
    name: v.string(),
    normalizedName: v.string(),
    logoUrl: v.string(),
    logoAlt: v.string(),
    sortOrder: v.number(),
    active: v.boolean(),
    createdAt: timestamp,
    updatedAt: timestamp,
  })
    .index("by_normalizedName", ["normalizedName"])
    .index("by_active_sortOrder", ["active", "sortOrder"]),

  products: defineTable({
    legacyId: v.optional(v.string()),
    name: v.string(),
    categoryLabel: v.string(),
    brandId: v.optional(v.id("brands")),
    barcode: v.optional(v.string()),
    sellPriceMadCents: money,
    costMadCents: v.union(money, v.null()),
    stockQty: v.number(),
    stockLow: v.boolean(),
    imageUrl: v.string(),
    imageAlt: v.string(),
    imageStorageId: v.optional(v.string()),
    active: v.boolean(),
    /** Vendu au poids (kg) à la caisse — quantités décimales autorisées. */
    soldByWeight: v.optional(v.boolean()),
    createdAt: timestamp,
    updatedAt: timestamp,
  })
    .index("by_legacyId", ["legacyId"])
    .index("by_barcode", ["barcode"])
    .index("by_categoryLabel", ["categoryLabel"])
    .index("by_active", ["active"])
    .index("by_brandId", ["brandId"])
    .index("by_active_and_stockQty", ["active", "stockQty"])
    .index("by_active_and_updatedAt", ["active", "updatedAt"])
    .index("by_active_and_categoryLabel", ["active", "categoryLabel"])
    .index("by_active_and_brandId", ["active", "brandId"])
    .searchIndex("search_name", {
      searchField: "name",
      filterFields: ["active"],
    }),

  productPriceHistory: defineTable({
    productId: v.id("products"),
    kind: v.union(v.literal("purchase"), v.literal("sell")),
    amountMadCents: money,
    recordedAt: timestamp,
    recordedByUserId: v.optional(v.id("users")),
    source: v.optional(v.string()),
    quantity: v.optional(v.number()),
  })
    .index("by_productId_recordedAt", ["productId", "recordedAt"])
    .index("by_productId_kind_recordedAt", [
      "productId",
      "kind",
      "recordedAt",
    ])
    .index("by_kind_recordedAt", ["kind", "recordedAt"]),

  invoices: defineTable({
    legacyId: v.optional(v.string()),
    number: v.string(),
    barcode: v.string(),
    date: isoDate,
    time: v.string(),
    clientId: v.optional(v.id("clients")),
    clientNameSnapshot: v.string(),
    paymentType,
    status: invoiceStatus,
    totalMadCents: money,
    cashierId: v.optional(v.id("users")),
    cashierNameSnapshot: v.string(),
    verifiedAt: v.optional(timestamp),
    verifiedByUserId: v.optional(v.id("users")),
    verifiedByUserNameSnapshot: v.optional(v.string()),
    verificationMethod: v.optional(
      v.union(v.literal("barcode_scan"), v.literal("manual")),
    ),
    createdAt: timestamp,
    updatedAt: timestamp,
  })
    .index("by_legacyId", ["legacyId"])
    .index("by_number", ["number"])
    .index("by_barcode", ["barcode"])
    .index("by_date", ["date"])
    .index("by_clientId_date", ["clientId", "date"])
    .index("by_paymentType_date", ["paymentType", "date"])
    .index("by_status_date", ["status", "date"]),

  invoiceLines: defineTable({
    invoiceId: v.id("invoices"),
    productId: v.optional(v.id("products")),
    productNameSnapshot: v.string(),
    lineIndex: v.number(),
    qty: v.number(),
    unitPriceMadCents: money,
    returnedQty: v.number(),
  })
    .index("by_invoiceId", ["invoiceId"])
    .index("by_productId", ["productId"]),

  invoicePayments: defineTable({
    invoiceId: v.id("invoices"),
    ledgerEntryId: v.optional(v.id("creditLedgerEntries")),
    date: isoDate,
    amountMadCents: money,
    note: v.string(),
    ref: v.string(),
    createdAt: timestamp,
  })
    .index("by_invoiceId_date", ["invoiceId", "date"])
    .index("by_ledgerEntryId", ["ledgerEntryId"]),

  creditLedgerEntries: defineTable({
    legacyId: v.optional(v.string()),
    clientId: v.id("clients"),
    planId: v.optional(v.id("installmentPlans")),
    invoiceId: v.optional(v.id("invoices")),
    kind: ledgerKind,
    date: isoDate,
    ref: v.string(),
    note: v.string(),
    amountMadCents: money,
    status: ledgerStatus,
    source: ledgerSource,
    createdAt: timestamp,
  })
    .index("by_legacyId", ["legacyId"])
    .index("by_clientId_date", ["clientId", "date"])
    .index("by_planId_date", ["planId", "date"])
    .index("by_invoiceId", ["invoiceId"])
    .index("by_date", ["date"])
    .index("by_kind_date", ["kind", "date"]),

  creditLedgerUpdateRequests: defineTable({
    ledgerEntryId: v.id("creditLedgerEntries"),
    clientId: v.id("clients"),
    invoiceId: v.optional(v.id("invoices")),
    updateType: v.union(
      v.literal("return"),
      v.literal("replacement"),
      v.literal("price_change"),
      v.literal("reopen_in_caisse"),
    ),
    reason: v.string(),
    payloadJson: v.string(),
    responsibleConfirmed: v.boolean(),
    requestedByUserId: v.id("users"),
    requestedByUserName: v.string(),
    status: v.union(
      v.literal("pending"),
      v.literal("approved"),
      v.literal("rejected"),
    ),
    createdAt: timestamp,
  })
    .index("by_ledgerEntryId", ["ledgerEntryId"])
    .index("by_status_createdAt", ["status", "createdAt"]),

  installmentPlans: defineTable({
    legacyId: v.optional(v.string()),
    clientId: v.id("clients"),
    invoiceId: v.optional(v.id("invoices")),
    invoiceEntryId: v.optional(v.id("creditLedgerEntries")),
    title: v.string(),
    totalMadCents: money,
    monthlyMadCents: money,
    startDate: isoDate,
    nextDueDate: isoDate,
    status: installmentPlanStatus,
    scheduleRule: v.optional(scheduleRule),
    scheduleSlots: v.optional(v.array(scheduleSlot)),
    createdAt: timestamp,
    updatedAt: timestamp,
  })
    .index("by_legacyId", ["legacyId"])
    .index("by_clientId_status", ["clientId", "status"])
    .index("by_nextDueDate_status", ["nextDueDate", "status"])
    .index("by_status_and_nextDueDate", ["status", "nextDueDate"]),

  returns: defineTable({
    legacyId: v.optional(v.string()),
    invoiceId: v.id("invoices"),
    createdAtIso: v.string(),
    reason: returnReason,
    stockDisposition,
    refundTotalMadCents: money,
    note: v.optional(v.string()),
    createdByUserId: v.optional(v.id("users")),
  })
    .index("by_legacyId", ["legacyId"])
    .index("by_invoiceId", ["invoiceId"])
    .index("by_createdAtIso", ["createdAtIso"]),

  returnLines: defineTable({
    returnId: v.id("returns"),
    invoiceLineId: v.optional(v.id("invoiceLines")),
    lineIndex: v.number(),
    qtyReturned: v.number(),
  })
    .index("by_returnId", ["returnId"])
    .index("by_invoiceLineId", ["invoiceLineId"]),

  alerts: defineTable({
    alertKey: v.string(),
    category: alertCategory,
    variant: alertVariant,
    badge: v.string(),
    timeLabel: v.string(),
    title: v.string(),
    detail: v.string(),
    clientId: v.optional(v.id("clients")),
    clientName: v.optional(v.string()),
    whatsappPhone: v.optional(v.string()),
    createdAt: timestamp,
    expiresAt: v.optional(timestamp),
  })
    .index("by_alertKey", ["alertKey"])
    .index("by_category_createdAt", ["category", "createdAt"])
    .index("by_clientId", ["clientId"]),

  alertDismissals: defineTable({
    alertKey: v.string(),
    userId: v.optional(v.id("users")),
    dismissedAt: timestamp,
  })
    .index("by_alertKey", ["alertKey"])
    .index("by_userId_alertKey", ["userId", "alertKey"]),

  permissions: defineTable({
    key: v.string(),
    category: permissionCategory,
    label: v.string(),
    description: v.string(),
  }).index("by_key", ["key"]),

  roles: defineTable({
    legacyId: v.optional(v.string()),
    name: v.string(),
    description: v.optional(v.string()),
    assignedUsersCount: v.number(),
    badge: v.optional(roleBadge),
    createdAt: timestamp,
    updatedAt: timestamp,
  })
    .index("by_legacyId", ["legacyId"])
    .index("by_name", ["name"]),

  rolePermissions: defineTable({
    roleId: v.id("roles"),
    permissionId: v.id("permissions"),
    enabled: v.boolean(),
  })
    .index("by_roleId", ["roleId"])
    .index("by_permissionId", ["permissionId"])
    .index("by_roleId_permissionId", ["roleId", "permissionId"]),

  settings: defineTable({
    key: v.string(),
    value: v.any(),
    updatedAt: timestamp,
  }).index("by_key", ["key"]),

  procurementLists: defineTable({
    status: procurementListStatus,
    title: v.optional(v.string()),
    createdByUserId: v.id("users"),
    createdAt: timestamp,
    publishedAt: v.optional(timestamp),
    completedAt: v.optional(timestamp),
  }).index("by_status", ["status"]),

  procurementListItems: defineTable({
    listId: v.id("procurementLists"),
    productId: v.id("products"),
    quantity: v.number(),
    status: procurementItemStatus,
    plannedCostMadCents: v.optional(money),
    paidCostMadCents: v.optional(money),
    boughtAt: v.optional(timestamp),
    boughtByUserId: v.optional(v.id("users")),
  })
    .index("by_listId", ["listId"])
    .index("by_listId_productId", ["listId", "productId"]),

  /** Panier POS mis en attente (client reviendra plus tard). */
  posCartDrafts: defineTable({
    createdByUserId: v.id("users"),
    createdByUserName: v.optional(v.string()),
    parkedByAssist: v.optional(v.boolean()),
    label: v.string(),
    payment: paymentType,
    clientId: v.optional(v.id("clients")),
    clientNameSnapshot: v.optional(v.string()),
    lines: v.array(
      v.object({
        productId: v.optional(v.id("products")),
        name: v.string(),
        unitPriceMadCents: money,
        qty: v.number(),
        image: v.optional(v.string()),
        imageAlt: v.optional(v.string()),
        soldByWeight: v.optional(v.boolean()),
      }),
    ),
    totalMadCents: money,
    itemCount: v.number(),
    createdAt: timestamp,
    updatedAt: timestamp,
  }).index("by_updatedAt", ["updatedAt"]),

  pushSubscriptions: defineTable({
    userId: v.id("users"),
    endpoint: v.string(),
    expirationTime: v.optional(v.number()),
    p256dh: v.string(),
    auth: v.string(),
    locale: v.optional(v.union(v.literal("fr"), v.literal("ar"))),
    lastAlertCount: v.optional(v.number()),
    createdAt: timestamp,
    updatedAt: timestamp,
  })
    .index("by_userId", ["userId"])
    .index("by_endpoint", ["endpoint"]),

  pdfShareLinks: defineTable({
    token: v.string(),
    storageId: v.id("_storage"),
    filename: v.string(),
    expiresAt: timestamp,
    createdBy: v.id("users"),
    createdAt: timestamp,
  }).index("by_token", ["token"]),

  trustedDevices: defineTable({
    userId: v.id("users"),
    deviceId: v.string(),
    label: v.optional(v.string()),
    status: v.union(
      v.literal("pending"),
      v.literal("approved"),
      v.literal("revoked"),
    ),
    challengeToken: v.optional(v.string()),
    challengeExpiresAt: v.optional(timestamp),
    approvedAt: v.optional(timestamp),
    approvedByUserId: v.optional(v.id("users")),
    revokedAt: v.optional(timestamp),
    revokedByUserId: v.optional(v.id("users")),
    lastSeenAt: timestamp,
    authSessionId: v.optional(v.id("authSessions")),
    createdAt: timestamp,
  })
    .index("by_userId", ["userId"])
    .index("by_userId_and_deviceId", ["userId", "deviceId"])
    .index("by_challengeToken", ["challengeToken"])
    .index("by_status", ["status"]),

  auditEvents: defineTable({
    createdAt: timestamp,
    actorUserId: v.optional(v.id("users")),
    actorUserName: v.string(),
    action: v.string(),
    entityType: v.string(),
    entityId: v.optional(v.string()),
    summary: v.string(),
    payloadJson: v.optional(v.string()),
    source: v.optional(v.string()),
  })
    .index("by_createdAt", ["createdAt"])
    .index("by_actorUserId_createdAt", ["actorUserId", "createdAt"])
    .index("by_entityType_entityId_createdAt", [
      "entityType",
      "entityId",
      "createdAt",
    ])
    .index("by_action_createdAt", ["action", "createdAt"]),
});
