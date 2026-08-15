import type { Invoice } from "@/lib/invoices/types";

/** Les factures ne doivent plus être préremplies avec des données fictives. */
export const MOCK_INVOICES: Invoice[] = [];

/**
 * IDs historiques des anciennes factures de démonstration, utilisés pour
 * nettoyer automatiquement le stockage local après suppression du seed.
 */
export const LEGACY_MOCK_INVOICE_IDS = new Set([
  "inv-1024",
  "inv-1023",
  "inv-1022",
  "inv-1021",
  "inv-1020",
  "inv-1019",
  "inv-1018",
  "inv-1017",
]);
