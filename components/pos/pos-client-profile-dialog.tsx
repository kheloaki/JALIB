"use client";

import { useMemo, useState } from "react";
import { useQuery } from "convex/react";
import { Phone, UserRound } from "lucide-react";
import { useLocale } from "next-intl";

import { PosClientProfileQuickActions } from "@/components/pos/pos-client-profile-quick-actions";
import { PosClientPurchaseHistoryDialog } from "@/components/pos/pos-client-purchase-history-dialog";
import {
  PosDialog,
  PosDialogContent,
  PosDialogDescription,
  PosDialogHeader,
  PosDialogTitle,
} from "@/components/pos/pos-dialog";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import type { Client } from "@/lib/clients/types";
import {
  outstandingWithInitialSolde,
  summarizeLedger,
} from "@/lib/credits/compute";
import { computeClientOutstandingMad } from "@/lib/credits/invoice-settlement";
import { balanceTone } from "@/lib/credits/ledger-ui";
import { ledgerEntryFromConvex } from "@/lib/convex/mappers";
import { formatPosDh } from "@/lib/pos/format-pos-dh";
import { cn } from "@/lib/utils";

type PosClientProfileDialogProps = {
  client: Client | null;
  clients?: Client[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tr: (fr: string, ar: string) => string;
};

function StatCard({
  label,
  value,
  className,
  valueClassName,
}: {
  label: string;
  value: string;
  className?: string;
  valueClassName?: string;
}) {
  return (
    <div className={cn("rounded-xl border px-3 py-2.5", className)}>
      <p className="text-on-surface-variant mb-1 text-[10px] font-bold tracking-wide uppercase">
        {label}
      </p>
      <p className={cn("text-base leading-tight font-black tabular-nums", valueClassName)}>
        {value}
      </p>
    </div>
  );
}

export function PosClientProfileDialog({
  client,
  clients = [],
  open,
  onOpenChange,
  tr,
}: PosClientProfileDialogProps) {
  const locale = useLocale();
  const [historyOpen, setHistoryOpen] = useState(false);
  const ledgerRows = useQuery(
    api.credits.listLedgerByClient,
    client && open ? { clientId: client.id as Id<"clients"> } : "skip",
  );

  const ledgerEntries = useMemo(
    () => (ledgerRows ?? []).map(ledgerEntryFromConvex),
    [ledgerRows],
  );

  const summary = useMemo(
    () => summarizeLedger(ledgerEntries, client?.initialSoldeMad ?? 0),
    [ledgerEntries, client?.initialSoldeMad],
  );

  const encoursMad = outstandingWithInitialSolde(
    computeClientOutstandingMad(ledgerEntries),
    client?.initialSoldeMad ?? 0,
  );
  const loadingLedger = client != null && open && ledgerRows === undefined;

  const plafondMad =
    client && !client.isCashOnly ? client.creditLimitMad : null;

  const resteMad =
    plafondMad != null && plafondMad > 0
      ? Math.max(0, plafondMad - encoursMad)
      : null;

  const tone = balanceTone(encoursMad);
  const nearLimit =
    plafondMad != null &&
    plafondMad > 0 &&
    encoursMad / plafondMad >= 0.75;

  const plafondLabel = !client
    ? "—"
    : client.isCashOnly
      ? tr("Comptant", "نقدي")
      : plafondMad == null
        ? tr("Sans plafond", "بدون سقف")
        : formatPosDh(plafondMad, 2, locale);

  const resteLabel = !client
    ? "—"
    : client.isCashOnly
      ? tr("Non applicable", "غير مطبق")
      : plafondMad == null
        ? tr("Illimité", "غير محدود")
        : formatPosDh(resteMad ?? 0, 2, locale);

  return (
    <>
      <PosDialog open={open} onOpenChange={onOpenChange}>
        <PosDialogContent className="max-w-md gap-0 overflow-hidden rounded-2xl p-0 sm:max-w-lg">
        {client ? (
          <>
            <PosDialogHeader className="border-sidebar-border space-y-3 border-b px-5 pt-5 pb-4 text-start">
              <div className="bg-primary/10 text-primary flex size-12 items-center justify-center rounded-xl">
                <UserRound className="size-6 stroke-[1.75]" aria-hidden />
              </div>
              <div>
                <PosDialogTitle className="text-xl font-black">{client.fullName}</PosDialogTitle>
                <PosDialogDescription className="text-on-surface-variant mt-1.5 inline-flex items-center gap-1.5 text-sm font-medium">
                  <Phone className="size-3.5 shrink-0" aria-hidden />
                  {client.phone}
                </PosDialogDescription>
              </div>
              {nearLimit ? (
                <span className="bg-tertiary-fixed text-on-tertiary-fixed inline-flex rounded-full px-3 py-1 text-[11px] font-bold">
                  {tr("Plafond presque atteint", "السقف على وشك الامتلاء")}
                </span>
              ) : null}
            </PosDialogHeader>

            <div className="space-y-3 px-5 py-4">
              <div className="grid grid-cols-2 gap-2">
                <StatCard
                  label={tr("Plafond", "السقف")}
                  value={loadingLedger && !client.isCashOnly ? "…" : plafondLabel}
                  className="border-sidebar-border/70 bg-surface-container-low/60"
                />
                <StatCard
                  label={tr("Encours", "الرصيد المستحق")}
                  value={loadingLedger ? "…" : formatPosDh(encoursMad, 2, locale)}
                  className="border-sidebar-border/70 bg-surface-container-low/60"
                  valueClassName={cn(
                    tone === "ok" && "text-secondary",
                    tone === "warn" && "text-tertiary",
                    tone === "debt" && "text-error",
                  )}
                />
              </div>

              <StatCard
                label={tr("Reste disponible", "المتبقي من السقف")}
                value={loadingLedger && !client.isCashOnly ? "…" : resteLabel}
                className={cn(
                  "border-primary/20 bg-primary/8",
                  resteMad != null && resteMad <= 0 && "border-error/25 bg-error/8",
                )}
                valueClassName={cn(
                  "text-lg",
                  resteMad != null && resteMad <= 0
                    ? "text-error"
                    : "text-primary",
                )}
              />

              {plafondMad != null && plafondMad > 0 && !loadingLedger ? (
                <div className="space-y-1.5">
                  <div className="bg-surface-container-high h-2 overflow-hidden rounded-full">
                    <div
                      className={cn(
                        "h-full rounded-full transition-all",
                        encoursMad / plafondMad >= 1
                          ? "bg-error"
                          : encoursMad / plafondMad >= 0.75
                            ? "bg-tertiary"
                            : "bg-primary",
                      )}
                      style={{
                        width: `${Math.min(100, (encoursMad / plafondMad) * 100)}%`,
                      }}
                    />
                  </div>
                  <p className="text-on-surface-variant text-[11px] font-medium tabular-nums">
                    {formatPosDh(encoursMad, 2, locale)} / {formatPosDh(plafondMad, 2, locale)}
                  </p>
                </div>
              ) : null}

              {!loadingLedger ? (
                <PosClientProfileQuickActions
                  client={client}
                  entries={ledgerEntries}
                  encoursMad={encoursMad}
                  locale={locale}
                  tr={tr}
                  onOpenHistory={() => setHistoryOpen(true)}
                />
              ) : null}
            </div>
          </>
        ) : null}
        </PosDialogContent>
      </PosDialog>

      <PosClientPurchaseHistoryDialog
        client={client}
        clients={clients}
        open={historyOpen}
        onOpenChange={setHistoryOpen}
        tr={tr}
        onReopenSuccess={() => onOpenChange(false)}
      />
    </>
  );
}
