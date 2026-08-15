export type LedgerEntryKind = "payment" | "invoice" | "return";

export type LedgerStatus = "valide" | "impayé" | "solde";

export type LedgerSource =
  | "manual"
  | "pos"
  | "plan"
  | "return"
  | "migration";

export type LedgerEntry = {
  id: string;
  clientId: string;
  /** Optional link to an installment plan (paiement échelonné). */
  planId?: string;
  /** Optional link to the invoice that created this credit movement. */
  invoiceId?: string;
  kind: LedgerEntryKind;
  /** ISO date YYYY-MM-DD */
  date: string;
  /** HH:mm when known (invoice sale time or entry createdAt). */
  time?: string | null;
  /** Epoch ms — used to derive time if `time` is missing. */
  createdAt?: number | null;
  ref: string;
  note: string;
  amountMad: number;
  status: LedgerStatus;
  source?: LedgerSource;
  /** Whether the linked invoice was verified (null when no invoice). */
  invoiceVerified?: boolean | null;
  /** Articles returned on the linked invoice (invoice rows only). */
  returnedArticlesQty?: number | null;
};

export type CreditStore = {
  entriesByClient: Record<string, LedgerEntry[]>;
};
