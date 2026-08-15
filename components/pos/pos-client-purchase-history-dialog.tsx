"use client";

import { useMemo } from "react";
import { useQuery } from "convex/react";
import { History, X } from "lucide-react";

import { PosStoreHistoryPanel } from "@/components/pos/pos-store-history-panel";
import { Button } from "@/components/ui/button";
import {
  PosDialog,
  PosDialogContent,
  PosDialogTitle,
} from "@/components/pos/pos-dialog";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import type { Client } from "@/lib/clients/types";
import { ledgerEntryFromConvex } from "@/lib/convex/mappers";

type PosClientPurchaseHistoryDialogProps = {
  clients?: Client[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tr: (fr: string, ar: string) => string;
  client?: Client | null;
  onReopenSuccess?: () => void;
};

export function PosClientPurchaseHistoryDialog({
  client = null,
  clients = [],
  open,
  onOpenChange,
  tr,
  onReopenSuccess,
}: PosClientPurchaseHistoryDialogProps) {
  const scopeAll = client == null;

  const clientLedgerRows = useQuery(
    api.credits.listLedgerByClient,
    !scopeAll && client && open
      ? { clientId: client.id as Id<"clients"> }
      : "skip",
  );

  const storeLedgerRows = useQuery(
    api.credits.listAllLedgerVisible,
    scopeAll && open ? { limit: 800 } : "skip",
  );

  const ledgerRows = scopeAll ? storeLedgerRows : clientLedgerRows;

  const entries = useMemo(
    () => (ledgerRows ?? []).map(ledgerEntryFromConvex),
    [ledgerRows],
  );

  const title = scopeAll
    ? tr("Historique du magasin", "سجل المتجر")
    : tr("Historique des achats", "سجل المشتريات");

  const subtitle = scopeAll
    ? tr("Factures, paiements et retours — tous clients", "فواتير ومدفوعات وإرجاعات — كل العملاء")
    : `${client!.fullName} · ${client!.phone}`;

  return (
    <PosDialog open={open} onOpenChange={onOpenChange}>
      <PosDialogContent
        showCloseButton={false}
        className="flex max-h-[min(96vh,980px)] w-[calc(100vw-1.5rem)] max-w-7xl flex-col gap-0 overflow-hidden rounded-2xl p-0"
      >
        <div className="border-sidebar-border bg-surface-container-low/40 flex shrink-0 items-start gap-3 border-b px-4 py-4 sm:px-5">
          <div className="bg-primary/10 text-primary flex size-11 shrink-0 items-center justify-center rounded-xl">
            <History className="size-5 stroke-[1.75]" aria-hidden />
          </div>
          <div className="min-w-0 flex-1">
            <PosDialogTitle className="text-lg font-black">{title}</PosDialogTitle>
            <p className="text-on-surface-variant mt-0.5 text-sm font-medium">
              {subtitle}
            </p>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="shrink-0 rounded-xl"
            onClick={() => onOpenChange(false)}
            aria-label={tr("Fermer", "إغلاق")}
          >
            <X className="size-5 stroke-[1.75]" aria-hidden />
          </Button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-5">
          {ledgerRows === undefined ? (
            <p className="text-on-surface-variant py-12 text-center text-sm">
              {tr("Chargement…", "جاري التحميل…")}
            </p>
          ) : (
            <PosStoreHistoryPanel
              entries={entries}
              clients={clients}
              scopeAll={scopeAll}
              tr={tr}
              onReopenSuccess={() => {
                onOpenChange(false);
                onReopenSuccess?.();
              }}
            />
          )}
        </div>
      </PosDialogContent>
    </PosDialog>
  );
}
