"use client";

import { useMemo } from "react";
import { useQuery } from "convex/react";

import type { PaymentMethod } from "@/components/pos/types";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import type { Client } from "@/lib/clients/types";
import { ledgerEntryFromConvex } from "@/lib/convex/mappers";
import {
  computeClientCreditStatus,
  type ClientCreditStatus,
} from "@/lib/pos/client-credit-status";

export function usePosClientCreditStatus({
  client,
  payment,
  cartTotalMad,
}: {
  client: Client | null;
  payment: PaymentMethod;
  cartTotalMad: number;
}): ClientCreditStatus {
  // Always load ledger when a client is selected so cash mode can show solde.
  const ledgerRows = useQuery(
    api.credits.listLedgerByClient,
    client ? { clientId: client.id as Id<"clients"> } : "skip",
  );

  const ledgerEntries = useMemo(
    () =>
      ledgerRows === undefined ? undefined : ledgerRows.map(ledgerEntryFromConvex),
    [ledgerRows],
  );

  return useMemo(
    () => computeClientCreditStatus(client, ledgerEntries, cartTotalMad, payment),
    [cartTotalMad, client, ledgerEntries, payment],
  );
}
