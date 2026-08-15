"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { useLocale } from "next-intl";
import { useQuery } from "convex/react";
import { Phone } from "lucide-react";

import { CreditsClientPlansPanel } from "@/components/credits/credits-client-plans-panel";
import { CreditsLedgerHistoryPanel } from "@/components/credits/credits-ledger-history-panel";
import { CreditStatementActions } from "@/components/credits/credit-statement-actions";
import { summarizeClientLedger } from "@/lib/credits/invoice-settlement";
import { CREDITS_PROFILE_IMAGE_SRC } from "@/lib/credits/mock-seed";
import type { Client } from "@/lib/clients/types";
import type { CreditStore } from "@/lib/credits/types";
import type { InstallmentPlan } from "@/lib/credits/installments/types";
import { planRemainingForStore } from "@/lib/credits/installments/plan-remaining";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { installmentPlanFromConvex, ledgerEntryFromConvex } from "@/lib/convex/mappers";
import { soldeToneClass } from "@/lib/credits/ledger-ui";
import { formatMad } from "@/lib/money/mad";
import { cn } from "@/lib/utils";

export function CreditsClientFicheSheet({
  client,
  clients,
  creditStore,
  open,
  onOpenChange,
  onOpenInstallmentPay,
  tr,
}: {
  client: Client | null;
  clients: Client[];
  creditStore: CreditStore;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onOpenInstallmentPay: (plan: InstallmentPlan) => void;
  tr: (fr: string, ar: string) => string;
}) {
  const locale = useLocale();
  const [historyDateFrom, setHistoryDateFrom] = useState("");
  const [historyDateTo, setHistoryDateTo] = useState("");

  useEffect(() => {
    setHistoryDateFrom("");
    setHistoryDateTo("");
  }, [client?.id]);

  const planRows = useQuery(
    api.installmentPlans.listByClient,
    client ? { clientId: client.id as Id<"clients"> } : "skip",
  );

  const ledgerRows = useQuery(
    api.credits.listLedgerByClient,
    client && open ? { clientId: client.id as Id<"clients"> } : "skip",
  );

  const plans = useMemo(
    () => (planRows ?? []).map(installmentPlanFromConvex),
    [planRows],
  );

  const entries = useMemo(() => {
    if (ledgerRows) return ledgerRows.map(ledgerEntryFromConvex);
    // Fallback while the full client ledger loads.
    return client ? (creditStore.entriesByClient[client.id] ?? []) : [];
  }, [client, creditStore.entriesByClient, ledgerRows]);

  const ficheCreditStore = useMemo<CreditStore>(() => {
    if (!client) return creditStore;
    return {
      entriesByClient: {
        ...creditStore.entriesByClient,
        [client.id]: entries,
      },
    };
  }, [client, creditStore, entries]);

  const summary = useMemo(
    () => summarizeClientLedger(entries, client?.initialSoldeMad ?? 0),
    [entries, client?.initialSoldeMad],
  );
  const outstandingMad = summary.outstandingMad;

  const limitWarning =
    client &&
    !client.isCashOnly &&
    client.creditLimitMad != null &&
    client.creditLimitMad > 0 &&
    outstandingMad / client.creditLimitMad >= 0.75;

  function openInstallmentPay(plan: InstallmentPlan) {
    const remaining = planRemainingForStore(plan, ficheCreditStore.entriesByClient);
    if (remaining <= 0 || plan.status !== "active") return;
    onOpenInstallmentPay(plan);
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        size="wide"
        className="overflow-y-auto"
      >
        {client ? (
          <>
            <SheetHeader className="border-sidebar-border border-b px-6 pt-6 pb-6">
              <div className="flex flex-col gap-6 sm:flex-row sm:items-start">
                <div className="ring-primary-fixed relative size-20 shrink-0 overflow-hidden rounded-2xl ring-4">
                  <Image
                    src={CREDITS_PROFILE_IMAGE_SRC}
                    alt=""
                    fill
                    className="object-cover"
                    sizes="80px"
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <SheetTitle className="text-2xl font-black tracking-tight">
                    {client.fullName}
                  </SheetTitle>
                  <SheetDescription className="mt-2">
                    <span className="inline-flex items-center gap-1 text-sm font-medium">
                      <Phone className="size-3.5" aria-hidden />
                      {client.phone}
                    </span>
                  </SheetDescription>
                  {limitWarning ? (
                    <span className="bg-tertiary-fixed text-on-tertiary-fixed mt-3 inline-flex rounded-full px-4 py-1.5 text-xs font-bold">
                      {tr("Limite de Crédit : Proche", "حد الائتمان: قريب")}
                    </span>
                  ) : null}
                  <CreditStatementActions
                    client={client}
                    tr={tr}
                    className="mt-4 flex flex-wrap gap-2"
                    dateFrom={historyDateFrom}
                    dateTo={historyDateTo}
                  />
                </div>
              </div>
            </SheetHeader>

            <div className="space-y-6 px-6 py-6">
              <div className="bg-surface-container-low rounded-2xl p-5">
                <p className="text-on-surface-variant mb-2 text-[10px] font-bold tracking-widest uppercase">
                  {tr("Solde", "الرصيد")}
                </p>
                <p
                  className={cn(
                    "text-2xl font-black tabular-nums",
                    soldeToneClass(summary.soldeMad),
                  )}
                >
                  {formatMad(summary.soldeMad, 2, locale)}
                </p>
                <p className="text-on-surface-variant mt-1 text-[10px] font-bold uppercase">
                  {summary.soldeMad > 0.009
                    ? tr("Avoir", "رصيد دائن")
                    : summary.soldeMad < -0.009
                      ? tr("Dette", "دين")
                      : tr("Soldé", "مسدد")}
                </p>
                {client && Math.abs(client.initialSoldeMad) > 0.009 ? (
                  <p className="text-on-surface-variant mt-2 text-xs">
                    {tr("Solde initial", "الرصيد الابتدائي")}:{" "}
                    <span
                      className={cn(
                        "font-bold tabular-nums",
                        soldeToneClass(client.initialSoldeMad),
                      )}
                    >
                      {formatMad(client.initialSoldeMad, 2, locale)}
                    </span>
                  </p>
                ) : null}
              </div>

              <CreditsClientPlansPanel
                client={client}
                plans={plans}
                creditStore={ficheCreditStore}
                entries={entries}
                tr={tr}
                onOpenInstallmentPay={openInstallmentPay}
              />

              <CreditsLedgerHistoryPanel
                entries={entries}
                clients={clients}
                scopeAll={false}
                showRunningSolde
                initialSoldeMad={client.initialSoldeMad}
                dateFrom={historyDateFrom}
                dateTo={historyDateTo}
                onDateFromChange={setHistoryDateFrom}
                onDateToChange={setHistoryDateTo}
                tr={tr}
              />
            </div>
          </>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}
