import { summarizeClientLedger } from "@/lib/credits/invoice-settlement";
import type { LedgerEntry } from "@/lib/credits/types";
import type { Client } from "@/lib/clients/types";

export type ClientCreditStatus = {
  loading: boolean;
  /** True whenever a client is selected (cash or credit). */
  visible: boolean;
  plafondMad: number | null;
  encoursMad: number;
  /** UI solde: +avoir / −dette (same as Crédits fiche). */
  soldeMad: number;
  resteAvantPanierMad: number | null;
  resteApresPanierMad: number | null;
  exceedsLimit: boolean;
  nearLimit: boolean;
  unlimited: boolean;
  isCashOnly: boolean;
};

export function computeClientCreditStatus(
  client: Client | null,
  ledgerEntries: LedgerEntry[] | undefined,
  cartTotalMad: number,
  payment: "cash" | "credit",
): ClientCreditStatus {
  const idle: ClientCreditStatus = {
    loading: false,
    visible: false,
    plafondMad: null,
    encoursMad: 0,
    soldeMad: 0,
    resteAvantPanierMad: null,
    resteApresPanierMad: null,
    exceedsLimit: false,
    nearLimit: false,
    unlimited: false,
    isCashOnly: false,
  };

  if (!client) return idle;

  if (client.isCashOnly) {
    return {
      ...idle,
      visible: true,
      isCashOnly: true,
      loading: ledgerEntries === undefined,
      soldeMad: client.initialSoldeMad ?? 0,
    };
  }

  if (ledgerEntries === undefined) {
    return {
      ...idle,
      loading: true,
      visible: true,
      plafondMad: client.creditLimitMad,
      soldeMad: client.initialSoldeMad ?? 0,
    };
  }

  const summary = summarizeClientLedger(
    ledgerEntries,
    client.initialSoldeMad,
  );
  const encoursMad = summary.outstandingMad;
  const soldeMad = summary.soldeMad;
  const plafondMad = client.creditLimitMad;
  const unlimited = plafondMad == null || plafondMad <= 0;
  const resteAvantPanierMad = unlimited
    ? null
    : Math.max(0, plafondMad - encoursMad);
  const resteApresPanierMad =
    resteAvantPanierMad == null
      ? null
      : Math.max(0, resteAvantPanierMad - Math.max(0, cartTotalMad));
  const exceedsLimit =
    payment === "credit" &&
    resteAvantPanierMad != null &&
    cartTotalMad > resteAvantPanierMad + 1e-9;
  const projectedEncours = encoursMad + Math.max(0, cartTotalMad);
  const nearLimit =
    payment === "credit" &&
    !unlimited &&
    plafondMad != null &&
    plafondMad > 0 &&
    projectedEncours / plafondMad >= 0.75;

  return {
    loading: false,
    visible: true,
    plafondMad: unlimited ? null : plafondMad,
    encoursMad,
    soldeMad,
    resteAvantPanierMad,
    resteApresPanierMad,
    exceedsLimit,
    nearLimit,
    unlimited,
    isCashOnly: false,
  };
}
