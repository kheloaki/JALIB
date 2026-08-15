"use client";

import { Pencil, Trash2, User } from "lucide-react";

import {
  clientInitials,
  clientLedgerSummary,
  creditLimitLabel,
  creditTypeLabel,
  type ClientLedgerStatRow,
  type ClientsTr,
} from "@/components/clients/clients-list-shared";
import { Button } from "@/components/ui/button";
import type { Client } from "@/lib/clients/types";
import type { CreditStore } from "@/lib/credits/types";
import { soldeToneClass } from "@/lib/credits/ledger-ui";
import { formatMad } from "@/lib/money/mad";
import { cn } from "@/lib/utils";

type ClientsGridProps = {
  clients: Client[];
  creditStore: CreditStore;
  ledgerStatsByClientId?: Map<string, ClientLedgerStatRow>;
  ledgerHydrated: boolean;
  tr: ClientsTr;
  locale: string;
  onSelect: (client: Client) => void;
  onEdit: (client: Client) => void;
  onDelete?: (client: Client) => void;
};

export function ClientsGrid({
  clients,
  creditStore,
  ledgerStatsByClientId,
  ledgerHydrated,
  tr,
  locale,
  onSelect,
  onEdit,
  onDelete,
}: ClientsGridProps) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
      {clients.map((client) => {
        const type = creditTypeLabel(client, tr);
        const { soldeMad } = clientLedgerSummary(
          client,
          creditStore,
          ledgerStatsByClientId,
        );
        const initials = clientInitials(client.fullName);

        return (
          <article
            key={client.id}
            role="button"
            tabIndex={0}
            onClick={() => onSelect(client)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onSelect(client);
              }
            }}
            className="border-sidebar-border bg-surface-container-lowest hover:border-primary/25 flex cursor-pointer flex-col overflow-hidden rounded-xl border shadow-sm transition-all hover:shadow-md"
          >
            <div className="border-sidebar-border/60 flex items-start gap-3 border-b px-3 py-3">
              <div
                className={cn(
                  "flex size-11 shrink-0 items-center justify-center rounded-full text-sm font-black",
                  client.isCashOnly
                    ? "bg-error-container text-on-error-container"
                    : "bg-primary/10 text-primary",
                )}
              >
                {initials.length >= 2 ? (
                  initials
                ) : (
                  <User className="size-5 stroke-[1.75]" aria-hidden />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <h2 className="text-on-background truncate text-sm font-bold">
                  {client.fullName}
                </h2>
                <p className="text-on-surface-variant mt-0.5 truncate text-xs font-medium tabular-nums">
                  {client.phone}
                </p>
                <span
                  className={cn(
                    "mt-1.5 inline-block text-[10px] font-bold tracking-wide uppercase",
                    type.className,
                  )}
                >
                  {type.label}
                </span>
              </div>
            </div>

            <div className="flex flex-1 flex-col gap-2 px-3 py-3">
              <dl className="grid grid-cols-2 gap-x-2 gap-y-2 text-xs">
                <div>
                  <dt className="text-on-surface-variant font-medium">
                    {tr("Solde", "الرصيد")}
                  </dt>
                  <dd
                    className={cn(
                      "mt-0.5 text-base font-bold tabular-nums",
                      !ledgerHydrated && "text-on-surface-variant",
                      ledgerHydrated && soldeToneClass(soldeMad),
                    )}
                  >
                    {ledgerHydrated ? formatMad(soldeMad, 2, locale) : "—"}
                  </dd>
                </div>
                <div>
                  <dt className="text-on-surface-variant font-medium">
                    {tr("Plafond crédit", "حد الائتمان")}
                  </dt>
                  <dd className="text-on-surface mt-0.5 font-semibold">
                    {creditLimitLabel(client, tr, locale)}
                  </dd>
                </div>
              </dl>

              <div
                className="mt-auto flex gap-2 pt-1"
                onClick={(e) => e.stopPropagation()}
                onKeyDown={(e) => e.stopPropagation()}
              >
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8 flex-1 gap-1.5 rounded-lg text-xs font-bold"
                  onClick={() => onEdit(client)}
                >
                  <Pencil className="size-3.5 shrink-0" aria-hidden />
                  {tr("Modifier", "تعديل")}
                </Button>
                {onDelete ? (
                  <Button
                    type="button"
                    variant="destructive"
                    size="icon"
                    className="size-8 shrink-0 rounded-lg"
                    title={tr("Supprimer", "حذف")}
                    aria-label={tr("Supprimer", "حذف")}
                    onClick={() => onDelete(client)}
                  >
                    <Trash2 className="size-3.5" aria-hidden />
                  </Button>
                ) : null}
              </div>
            </div>
          </article>
        );
      })}
    </div>
  );
}
