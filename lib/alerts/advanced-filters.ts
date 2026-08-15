import type { AlertCategory } from "@/lib/alerts/types";

export type AlertSourceFilter = "all" | "auto" | "rules";

export type AlertAdvancedFilters = {
  showDismissed: boolean;
  source: AlertSourceFilter;
  categories: AlertCategory[];
  whatsappOnly: boolean;
};

const ALL_CATEGORIES: AlertCategory[] = [
  "credit_over",
  "credit_warn",
  "unpaid",
  "installment_missed",
  "stock",
];

export const DEFAULT_ALERT_ADVANCED_FILTERS: AlertAdvancedFilters = {
  showDismissed: false,
  source: "all",
  categories: [...ALL_CATEGORIES],
  whatsappOnly: false,
};

export function isDefaultAlertAdvancedFilters(
  filters: AlertAdvancedFilters,
): boolean {
  return (
    !filters.showDismissed &&
    filters.source === "all" &&
    !filters.whatsappOnly &&
    filters.categories.length === ALL_CATEGORIES.length &&
    ALL_CATEGORIES.every((c) => filters.categories.includes(c))
  );
}

export const ALERT_CATEGORY_OPTIONS: {
  value: AlertCategory;
  labelFr: string;
  labelAr: string;
}[] = [
  { value: "credit_over", labelFr: "Crédit urgent", labelAr: "ائتمان عاجل" },
  { value: "credit_warn", labelFr: "Crédit attention", labelAr: "ائتمان تنبيه" },
  { value: "unpaid", labelFr: "Impayés", labelAr: "غير مدفوع" },
  {
    value: "installment_missed",
    labelFr: "Échéance manquée",
    labelAr: "قسط فائت",
  },
  { value: "stock", labelFr: "Stock", labelAr: "مخزون" },
];
