import type { Id } from "@/convex/_generated/dataModel";
import type { Product } from "@/components/pos/types";
import type { Client } from "@/lib/clients/types";
import type {
  InstallmentPlan,
  InstallmentScheduleRule,
  ScheduleSlotSnapshot,
} from "@/lib/credits/installments/types";
import type {
  LedgerEntry,
  LedgerEntryKind,
  LedgerSource,
  LedgerStatus,
} from "@/lib/credits/types";
import type { Invoice, InvoicePaymentType, InvoiceStatus, InvoiceSummary } from "@/lib/invoices/types";
import type {
  ReturnDetail,
  ReturnItemRow,
  ReturnRecord,
  ReturnReason,
  StockDisposition,
} from "@/lib/returns/types";
import { resolveProductImage } from "@/lib/products/product-placeholder";

export type ConvexClientView = {
  id: Id<"clients">;
  fullName: string;
  phone: string;
  isCashOnly: boolean;
  creditLimitMad: number | null;
  initialSoldeMad: number;
};

export type ConvexProductView = {
  id: Id<"products">;
  category: string;
  name: string;
  price: number;
  costMad: number | null;
  stockQty: number;
  stockLabel: string;
  stockLow: boolean;
  image: string;
  imageAlt: string;
  barcode: string | null;
  soldByWeight: boolean;
  active: boolean;
  brandId: Id<"brands"> | null;
  brandName: string | null;
  brandLogo: string | null;
  createdAt: number;
  updatedAt?: number;
};

export type ConvexPosCatalogSummaryView = {
  id: Id<"products">;
  category: string;
  name: string;
  price: number;
  costMad: number | null;
  stockQty: number;
  stockLabel: string;
  stockLow: boolean;
  image: string;
  imageAlt: string;
  barcode: string | null;
  soldByWeight: boolean;
  brandId: Id<"brands"> | null;
  brandName: string | null;
  brandLogo: string | null;
  createdAt: number;
  updatedAt: number;
};

export type ConvexInvoiceLineView = {
  lineIndex: number;
  nameAr: string;
  qty: number;
  unitPriceMad: number;
  returnedQty?: number;
  productId?: string;
  image?: string;
  imageAlt?: string;
};

export type ConvexInvoicePaymentHistoryItemView = {
  id: string;
  date: string;
  amountMad: number;
  note: string;
  ref: string;
};

export type ConvexInvoiceSummaryView = {
  id: Id<"invoices">;
  number: string;
  barcode: string;
  date: string;
  time: string;
  clientName: string;
  cashierId: string;
  paymentType: InvoicePaymentType;
  totalMad: number;
  status: InvoiceStatus;
};

export type ConvexInvoiceView = {
  id: Id<"invoices">;
  number: string;
  barcode: string;
  date: string;
  time: string;
  clientId: Id<"clients"> | null;
  clientName: string;
  cashierId: string;
  paymentType: InvoicePaymentType;
  totalMad: number;
  paidMad: number;
  remainingMad: number;
  status: InvoiceStatus;
  lines: ConvexInvoiceLineView[];
  paymentHistory: ConvexInvoicePaymentHistoryItemView[];
};

export type ConvexLedgerEntryView = {
  id: Id<"creditLedgerEntries">;
  clientId: Id<"clients">;
  planId: Id<"installmentPlans"> | null;
  invoiceId: Id<"invoices"> | null;
  kind: LedgerEntryKind;
  date: string;
  time: string | null;
  createdAt: number;
  ref: string;
  note: string;
  amountMad: number;
  status: LedgerStatus;
  source: LedgerSource;
  invoiceVerified: boolean | null;
  returnedArticlesQty: number | null;
};

export type ConvexInstallmentPlanView = {
  id: Id<"installmentPlans">;
  clientId: Id<"clients">;
  title: string;
  totalMad: number;
  monthlyMad: number;
  startDate: string;
  nextDueDate: string;
  status: InstallmentPlan["status"];
  invoiceEntryId: Id<"creditLedgerEntries"> | null;
  invoiceId: Id<"invoices"> | null;
  scheduleRule: InstallmentScheduleRule | null;
  scheduleSlots: ScheduleSlotSnapshot[] | null;
};

export type ConvexReturnView = {
  id: Id<"returns">;
  invoiceId: Id<"invoices">;
  invoiceNumber: string;
  clientName: string;
  createdAtIso: string;
  reason: ReturnReason;
  stockDisposition: StockDisposition;
  refundTotalMad: number;
  note: string | null;
  lines: Array<{
    invoiceLineId: Id<"invoiceLines"> | null;
    lineIndex: number;
    qtyReturned: number;
  }>;
};

export type ConvexReturnItemView = {
  returnId: Id<"returns">;
  invoiceId: Id<"invoices">;
  invoiceNumber: string;
  clientName: string;
  productName: string;
  qtyReturned: number;
  unitPriceMad: number;
  lineRefundMad: number;
  reason: ReturnReason;
  stockDisposition: StockDisposition;
  createdAtIso: string;
  note: string | null;
};

export type ConvexReturnDetailView = {
  id: Id<"returns">;
  invoiceId: Id<"invoices">;
  invoiceNumber: string;
  clientId: Id<"clients"> | null;
  clientName: string;
  createdAtIso: string;
  reason: ReturnReason;
  stockDisposition: StockDisposition;
  refundTotalMad: number;
  note: string | null;
  lines: Array<{
    lineIndex: number;
    qtyReturned: number;
    productName: string;
    unitPriceMad: number;
    lineRefundMad: number;
  }>;
};

export function clientFromConvex(client: ConvexClientView): Client {
  return {
    id: client.id,
    fullName: client.fullName,
    phone: client.phone,
    isCashOnly: client.isCashOnly,
    creditLimitMad: client.creditLimitMad,
    initialSoldeMad: client.initialSoldeMad ?? 0,
  };
}

export function productFromConvex(product: ConvexProductView): Product {
  return {
    id: product.id,
    category: product.category,
    name: product.name,
    price: product.price,
    stockQty: product.stockQty,
    stockLabel: product.stockLabel,
    stockLow: product.stockLow,
    image: resolveProductImage(product.image),
    imageAlt: product.imageAlt,
    ...(product.costMad !== null ? { costMad: product.costMad } : {}),
    ...(product.barcode !== null ? { barcode: product.barcode } : {}),
    ...(product.soldByWeight ? { soldByWeight: true } : {}),
    ...(product.brandId !== null ? { brandId: product.brandId } : {}),
    ...(product.brandName !== null ? { brandName: product.brandName } : {}),
    ...(product.brandLogo !== null ? { brandLogo: product.brandLogo } : {}),
    createdAt: product.createdAt,
    ...(product.updatedAt != null ? { updatedAt: product.updatedAt } : {}),
  };
}

export function posCatalogSummaryFromConvex(
  product: ConvexPosCatalogSummaryView,
): Product {
  return {
    id: product.id,
    category: product.category,
    name: product.name,
    price: product.price,
    stockQty: product.stockQty,
    stockLabel: product.stockLabel,
    stockLow: product.stockLow,
    image: resolveProductImage(product.image),
    imageAlt: product.imageAlt,
    ...(product.costMad !== null ? { costMad: product.costMad } : {}),
    ...(product.barcode !== null ? { barcode: product.barcode } : {}),
    ...(product.soldByWeight ? { soldByWeight: true } : {}),
    ...(product.brandId !== null ? { brandId: product.brandId } : {}),
    ...(product.brandName !== null ? { brandName: product.brandName } : {}),
    ...(product.brandLogo !== null ? { brandLogo: product.brandLogo } : {}),
    createdAt: product.createdAt,
    updatedAt: product.updatedAt,
  };
}

export function invoiceSummaryFromConvex(
  invoice: ConvexInvoiceSummaryView,
): InvoiceSummary {
  return {
    id: invoice.id,
    number: invoice.number,
    barcode: invoice.barcode,
    date: invoice.date,
    time: invoice.time,
    clientName: invoice.clientName,
    cashierId: invoice.cashierId,
    paymentType: invoice.paymentType,
    totalMad: invoice.totalMad,
    status: invoice.status,
  };
}

export function invoiceFromConvex(invoice: ConvexInvoiceView): Invoice {
  return {
    id: invoice.id,
    number: invoice.number,
    barcode: invoice.barcode,
    date: invoice.date,
    time: invoice.time,
    clientId: invoice.clientId,
    clientName: invoice.clientName,
    cashierId: invoice.cashierId,
    paymentType: invoice.paymentType,
    totalMad: invoice.totalMad,
    paidMad: invoice.paidMad,
    remainingMad: invoice.remainingMad,
    status: invoice.status,
    lines: invoice.lines.map((line) => ({
      lineIndex: line.lineIndex,
      nameAr: line.nameAr,
      qty: line.qty,
      unitPriceMad: line.unitPriceMad,
      ...(line.returnedQty ? { returnedQty: line.returnedQty } : {}),
      ...(line.productId ? { productId: line.productId } : {}),
      ...(line.image ? { image: line.image } : {}),
      ...(line.imageAlt ? { imageAlt: line.imageAlt } : {}),
    })),
    paymentHistory: invoice.paymentHistory.map((payment) => ({
      id: payment.id,
      date: payment.date,
      amountMad: payment.amountMad,
      note: payment.note,
      ref: payment.ref,
    })),
  } as Invoice;
}

export function ledgerEntryFromConvex(entry: ConvexLedgerEntryView): LedgerEntry {
  return {
    id: entry.id,
    clientId: entry.clientId,
    kind: entry.kind,
    date: entry.date,
    time: entry.time,
    createdAt: entry.createdAt,
    ref: entry.ref,
    note: entry.note,
    amountMad: entry.amountMad,
    status: entry.status,
    source: entry.source,
    ...(entry.planId ? { planId: entry.planId } : {}),
    ...(entry.invoiceId ? { invoiceId: entry.invoiceId } : {}),
    invoiceVerified: entry.invoiceVerified,
    returnedArticlesQty: entry.returnedArticlesQty,
  };
}

export function installmentPlanFromConvex(
  plan: ConvexInstallmentPlanView,
): InstallmentPlan {
  return {
    id: plan.id,
    clientId: plan.clientId,
    title: plan.title,
    totalMad: plan.totalMad,
    monthlyMad: plan.monthlyMad,
    startDate: plan.startDate,
    nextDueDate: plan.nextDueDate,
    status: plan.status,
    invoiceEntryId: plan.invoiceEntryId ?? "",
    ...(plan.invoiceId ? { invoiceId: plan.invoiceId } : {}),
    ...(plan.scheduleRule && plan.scheduleSlots?.length
      ? { scheduleRule: plan.scheduleRule, scheduleSlots: plan.scheduleSlots }
      : {}),
  };
}

export function returnFromConvex(returnRecord: ConvexReturnView): ReturnRecord {
  return {
    id: returnRecord.id,
    invoiceId: returnRecord.invoiceId,
    createdAtIso: returnRecord.createdAtIso,
    reason: returnRecord.reason,
    stockDisposition: returnRecord.stockDisposition,
    lines: returnRecord.lines.map((line) => ({
      lineIndex: line.lineIndex,
      qtyReturned: line.qtyReturned,
    })),
    refundTotalMad: returnRecord.refundTotalMad,
    ...(returnRecord.note ? { note: returnRecord.note } : {}),
  };
}

export function returnItemFromConvex(item: ConvexReturnItemView): ReturnItemRow {
  return {
    returnId: item.returnId,
    invoiceId: item.invoiceId,
    invoiceNumber: item.invoiceNumber,
    clientName: item.clientName,
    productName: item.productName,
    qtyReturned: item.qtyReturned,
    unitPriceMad: item.unitPriceMad,
    lineRefundMad: item.lineRefundMad,
    reason: item.reason,
    stockDisposition: item.stockDisposition,
    createdAtIso: item.createdAtIso,
    note: item.note,
  };
}

export function returnDetailFromConvex(detail: ConvexReturnDetailView): ReturnDetail {
  return {
    id: detail.id,
    invoiceId: detail.invoiceId,
    invoiceNumber: detail.invoiceNumber,
    clientId: detail.clientId,
    clientName: detail.clientName,
    createdAtIso: detail.createdAtIso,
    reason: detail.reason,
    stockDisposition: detail.stockDisposition,
    refundTotalMad: detail.refundTotalMad,
    note: detail.note,
    lines: detail.lines.map((line) => ({
      lineIndex: line.lineIndex,
      qtyReturned: line.qtyReturned,
      productName: line.productName,
      unitPriceMad: line.unitPriceMad,
      lineRefundMad: line.lineRefundMad,
    })),
  };
}
