import { v } from "convex/values";

import type { Id } from "./_generated/dataModel";
import type { QueryCtx } from "./_generated/server";
import { query } from "./_generated/server";
import { requireAnyPermission, requirePermission } from "./authz";
import { centsToMad } from "./money";

const clientHomeRow = v.object({
  clientId: v.union(v.id("clients"), v.null()),
  name: v.string(),
  lastTransactionDate: v.string(),
  cashMad: v.number(),
  creditMad: v.number(),
  collectedMad: v.number(),
  totalMad: v.number(),
  invoiceCount: v.number(),
});

const lowStockProductRow = v.object({
  productId: v.id("products"),
  name: v.string(),
  categoryLabel: v.string(),
  stockQty: v.number(),
  stockLow: v.boolean(),
  isOutOfStock: v.boolean(),
});

async function readLowStockThreshold(ctx: QueryCtx) {
  const settingsDoc = await ctx.db
    .query("settings")
    .withIndex("by_key", (q) => q.eq("key", "app:parameters"))
    .first();
  const settingsValue = settingsDoc?.value as { lowStockThreshold?: number } | undefined;
  return typeof settingsValue?.lowStockThreshold === "number"
    ? settingsValue.lowStockThreshold
    : 10;
}

function isIsoDateInRange(date: string, startDate: string, endDate: string) {
  return date >= startDate && date <= endDate;
}

function addDaysIso(iso: string, days: number) {
  const date = new Date(`${iso}T12:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function daySpan(startDate: string, endDate: string) {
  const start = new Date(`${startDate}T12:00:00`);
  const end = new Date(`${endDate}T12:00:00`);
  return Math.floor((end.getTime() - start.getTime()) / 86400000) + 1;
}

function eachDateInRange(startDate: string, endDate: string) {
  const dates: string[] = [];
  for (let date = startDate; date <= endDate; date = addDaysIso(date, 1)) {
    dates.push(date);
    if (dates.length > 62) break;
  }
  return dates;
}

function eachMonthInRange(startDate: string, endDate: string) {
  const months: string[] = [];
  const [sy, sm] = startDate.split("-").map(Number);
  const [ey, em] = endDate.split("-").map(Number);
  let y = sy;
  let m = sm;
  while (y < ey || (y === ey && m <= em)) {
    months.push(`${y}-${String(m).padStart(2, "0")}-01`);
    m += 1;
    if (m > 12) {
      m = 1;
      y += 1;
    }
  }
  if (months.length > 36) return months.slice(-36);
  return months;
}

function bucketKeyForDate(date: string, monthly: boolean) {
  return monthly ? `${date.slice(0, 7)}-01` : date;
}

export const periodSummary = query({
  args: {
    startDate: v.string(),
    endDate: v.string(),
  },
  returns: v.object({
    cashReceivedMad: v.number(),
    creditSalesMad: v.number(),
    creditPaymentsMad: v.number(),
    collectedMad: v.number(),
    itemsSold: v.number(),
    invoiceCount: v.number(),
    cashInvoiceCount: v.number(),
    creditInvoiceCount: v.number(),
    averageTicketMad: v.number(),
    daily: v.array(
      v.object({
        date: v.string(),
        cashMad: v.number(),
        creditMad: v.number(),
        collectedMad: v.number(),
        totalSalesMad: v.number(),
        itemsSold: v.number(),
        invoiceCount: v.number(),
      }),
    ),
    topProducts: v.array(
      v.object({
        name: v.string(),
        qty: v.number(),
        totalMad: v.number(),
      }),
    ),
    chartGranularity: v.union(v.literal("day"), v.literal("month")),
  }),
  handler: async (ctx, args) => {
    await requirePermission(ctx, "reports.revenue");

    const { startDate, endDate } = args;
    const monthlyBuckets = daySpan(startDate, endDate) > 62;
    const bucketDates = monthlyBuckets
      ? eachMonthInRange(startDate, endDate)
      : eachDateInRange(startDate, endDate);
    let cashReceivedMad = 0;
    let creditSalesMad = 0;
    let creditPaymentsMad = 0;
    let itemsSold = 0;
    let invoiceCount = 0;
    let cashInvoiceCount = 0;
    let creditInvoiceCount = 0;

    const dailyByDate = new Map(
      bucketDates.map((date) => [
        date,
        {
          date,
          cashMad: 0,
          creditMad: 0,
          collectedMad: 0,
          totalSalesMad: 0,
          itemsSold: 0,
          invoiceCount: 0,
        },
      ]),
    );
    const topProducts = new Map<string, { name: string; qty: number; totalMad: number }>();

    const invoices = await ctx.db
      .query("invoices")
      .withIndex("by_date", (q) => q.gte("date", startDate).lte("date", endDate))
      .collect();
    for (const invoice of invoices) {
      const totalMad = centsToMad(invoice.totalMadCents);
      invoiceCount += 1;
      const daily = dailyByDate.get(bucketKeyForDate(invoice.date, monthlyBuckets));

      if (invoice.paymentType === "cash") {
        cashReceivedMad += totalMad;
        cashInvoiceCount += 1;
        if (daily) {
          daily.cashMad += totalMad;
          daily.collectedMad += totalMad;
        }
      } else {
        creditSalesMad += totalMad;
        creditInvoiceCount += 1;
        if (daily) daily.creditMad += totalMad;
      }
      if (daily) {
        daily.totalSalesMad += totalMad;
        daily.invoiceCount += 1;
      }

      const lines = await ctx.db
        .query("invoiceLines")
        .withIndex("by_invoiceId", (q) => q.eq("invoiceId", invoice._id))
        .collect();
      for (const line of lines) {
        const netQty = Math.max(0, line.qty - line.returnedQty);
        const lineTotalMad = centsToMad(Math.round(line.unitPriceMadCents * netQty));
        itemsSold += netQty;
        if (daily) daily.itemsSold += netQty;

        const product = topProducts.get(line.productNameSnapshot) ?? {
          name: line.productNameSnapshot,
          qty: 0,
          totalMad: 0,
        };
        product.qty += netQty;
        product.totalMad += lineTotalMad;
        topProducts.set(line.productNameSnapshot, product);
      }
    }

    let collectedMad = cashReceivedMad;
    const ledgerEntries = await ctx.db
      .query("creditLedgerEntries")
      .withIndex("by_kind_date", (q) =>
        q
          .eq("kind", "payment")
          .gte("date", startDate)
          .lte("date", endDate),
      )
      .collect();
    for (const entry of ledgerEntries) {
      if (entry.source === "return") continue;
      const paymentMad = centsToMad(entry.amountMadCents);
      creditPaymentsMad += paymentMad;
      collectedMad += paymentMad;
      const daily = dailyByDate.get(bucketKeyForDate(entry.date, monthlyBuckets));
      if (daily) daily.collectedMad += paymentMad;
    }

    return {
      cashReceivedMad,
      creditSalesMad,
      creditPaymentsMad,
      collectedMad,
      itemsSold,
      invoiceCount,
      cashInvoiceCount,
      creditInvoiceCount,
      averageTicketMad: invoiceCount > 0 ? (cashReceivedMad + creditSalesMad) / invoiceCount : 0,
      daily: Array.from(dailyByDate.values()),
      topProducts: Array.from(topProducts.values())
        .sort((a, b) => b.qty - a.qty || b.totalMad - a.totalMad)
        .slice(0, 5),
      chartGranularity: monthlyBuckets ? ("month" as const) : ("day" as const),
    };
  },
});

type ClientAgg = {
  clientId: Id<"clients"> | null;
  name: string;
  lastTransactionDate: string;
  lifetimeCashMad: number;
  lifetimeCreditMad: number;
  lifetimeCollectedMad: number;
  periodCashMad: number;
  periodCreditMad: number;
  periodCollectedMad: number;
  lifetimeInvoices: number;
  periodInvoices: number;
};

function clientInvoiceKey(invoice: {
  clientId?: Id<"clients">;
  clientNameSnapshot: string;
}) {
  return invoice.clientId ?? `name:${invoice.clientNameSnapshot.trim().toLowerCase()}`;
}

function toClientHomeRow(
  row: ClientAgg,
  mode: "period" | "lifetime",
): {
  clientId: Id<"clients"> | null;
  name: string;
  lastTransactionDate: string;
  cashMad: number;
  creditMad: number;
  collectedMad: number;
  totalMad: number;
  invoiceCount: number;
} {
  const cashMad = mode === "period" ? row.periodCashMad : row.lifetimeCashMad;
  const creditMad = mode === "period" ? row.periodCreditMad : row.lifetimeCreditMad;
  const collectedMad =
    mode === "period" ? row.periodCollectedMad : row.lifetimeCollectedMad;
  return {
    clientId: row.clientId,
    name: row.name,
    lastTransactionDate: row.lastTransactionDate,
    cashMad,
    creditMad,
    collectedMad,
    totalMad: cashMad + creditMad,
    invoiceCount: mode === "period" ? row.periodInvoices : row.lifetimeInvoices,
  };
}

function sortClientsByLastTransaction<
  T extends { lastTransactionDate: string; name: string },
>(rows: T[]): T[] {
  return rows.sort(
    (a, b) =>
      a.lastTransactionDate.localeCompare(b.lastTransactionDate) ||
      a.name.localeCompare(b.name, "fr"),
  );
}

async function aggregateClientActivity(
  ctx: QueryCtx,
  startDate: string,
  endDate: string,
): Promise<Map<string, ClientAgg>> {
  const aggs = new Map<string, ClientAgg>();
  const clientIdToKey = new Map<string, string>();

  function ensureFromInvoice(invoice: {
    clientId?: Id<"clients">;
    clientNameSnapshot: string;
    date: string;
  }): ClientAgg {
    const key = clientInvoiceKey(invoice);
    let row = aggs.get(key);
    if (!row) {
      row = {
        clientId: invoice.clientId ?? null,
        name: invoice.clientNameSnapshot,
        lastTransactionDate: invoice.date,
        lifetimeCashMad: 0,
        lifetimeCreditMad: 0,
        lifetimeCollectedMad: 0,
        periodCashMad: 0,
        periodCreditMad: 0,
        periodCollectedMad: 0,
        lifetimeInvoices: 0,
        periodInvoices: 0,
      };
      aggs.set(key, row);
      if (invoice.clientId) {
        clientIdToKey.set(invoice.clientId, key);
      }
    }
    if (invoice.date > row.lastTransactionDate) {
      row.lastTransactionDate = invoice.date;
    }
    return row;
  }

  const invoices = await ctx.db.query("invoices").collect();
  for (const invoice of invoices) {
    const row = ensureFromInvoice(invoice);
    const totalMad = centsToMad(invoice.totalMadCents);
    row.lifetimeInvoices += 1;

    if (invoice.paymentType === "cash") {
      row.lifetimeCashMad += totalMad;
      row.lifetimeCollectedMad += totalMad;
    } else {
      row.lifetimeCreditMad += totalMad;
    }

    if (isIsoDateInRange(invoice.date, startDate, endDate)) {
      row.periodInvoices += 1;
      if (invoice.paymentType === "cash") {
        row.periodCashMad += totalMad;
        row.periodCollectedMad += totalMad;
      } else {
        row.periodCreditMad += totalMad;
      }
    }
  }

  const ledgerEntries = await ctx.db.query("creditLedgerEntries").collect();
  for (const entry of ledgerEntries) {
    if (entry.kind !== "payment") continue;
    if (entry.source === "return") continue;

    const paymentMad = centsToMad(entry.amountMadCents);
    const key = clientIdToKey.get(entry.clientId);
    if (!key) continue;
    const row = aggs.get(key);
    if (!row) continue;

    row.lifetimeCollectedMad += paymentMad;
    if (isIsoDateInRange(entry.date, startDate, endDate)) {
      row.periodCollectedMad += paymentMad;
    }
  }

  return aggs;
}

function buildClientSegmentRows(
  aggs: Map<string, ClientAgg>,
  segment: "active" | "inactive",
) {
  const active: ClientAgg[] = [];
  const inactive: ClientAgg[] = [];
  for (const row of aggs.values()) {
    if (row.lifetimeInvoices === 0) continue;
    if (row.periodInvoices > 0) active.push(row);
    else inactive.push(row);
  }

  const list = segment === "active" ? active : inactive;
  const mode = segment === "active" ? ("period" as const) : ("lifetime" as const);
  return sortClientsByLastTransaction(list.map((row) => toClientHomeRow(row, mode)));
}

export const clientActivityLists = query({
  args: {
    startDate: v.string(),
    endDate: v.string(),
  },
  returns: v.object({
    activeClients: v.array(clientHomeRow),
    inactiveClients: v.array(clientHomeRow),
  }),
  handler: async (ctx, args) => {
    await requirePermission(ctx, "reports.revenue");

    const aggs = await aggregateClientActivity(ctx, args.startDate, args.endDate);

    return {
      activeClients: buildClientSegmentRows(aggs, "active").slice(0, 10),
      inactiveClients: buildClientSegmentRows(aggs, "inactive").slice(0, 10),
    };
  },
});

export const clientActivitySegment = query({
  args: {
    startDate: v.string(),
    endDate: v.string(),
    segment: v.union(v.literal("active"), v.literal("inactive")),
  },
  returns: v.array(clientHomeRow),
  handler: async (ctx, args) => {
    await requirePermission(ctx, "reports.revenue");

    const aggs = await aggregateClientActivity(ctx, args.startDate, args.endDate);
    return buildClientSegmentRows(aggs, args.segment);
  },
});

export const lowStockProducts = query({
  args: {},
  returns: v.object({
    threshold: v.number(),
    products: v.array(lowStockProductRow),
  }),
  handler: async (ctx) => {
    await requireAnyPermission(ctx, ["stock.view", "reports.revenue"]);

    const threshold = await readLowStockThreshold(ctx);
    // Indexed range — do not .collect() the full active catalog.
    const products = await ctx.db
      .query("products")
      .withIndex("by_active_and_stockQty", (q) =>
        q.eq("active", true).lte("stockQty", threshold),
      )
      .order("asc")
      .take(40);

    const rows = products
      .map((product) => ({
        productId: product._id,
        name: product.name,
        categoryLabel: product.categoryLabel,
        stockQty: product.stockQty,
        stockLow: product.stockLow,
        isOutOfStock: product.stockQty <= 0,
      }))
      .sort(
        (a, b) =>
          Number(b.isOutOfStock) - Number(a.isOutOfStock) ||
          a.stockQty - b.stockQty ||
          a.name.localeCompare(b.name, "fr"),
      )
      .slice(0, 10);

    return { threshold, products: rows };
  },
});
