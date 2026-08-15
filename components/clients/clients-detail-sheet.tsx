"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useMutation, useQuery } from "convex/react";
import { useLocale } from "next-intl";
import { Pencil, Phone, Trash2 } from "lucide-react";

import { CreditsLedgerHistoryPanel } from "@/components/credits/credits-ledger-history-panel";
import { summarizeLedger } from "@/lib/credits/compute";
import { soldeToneClass } from "@/lib/credits/ledger-ui";
import type { Client } from "@/lib/clients/types";
import type { CreditStore } from "@/lib/credits/types";
import { Button, buttonVariants } from "@/components/ui/button";
import { ConfirmDeleteDialog } from "@/components/ui/confirm-delete-dialog";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useToast } from "@/components/ui/toaster";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { canDeleteClients } from "@/lib/auth/permissions";
import { ledgerEntryFromConvex } from "@/lib/convex/mappers";
import { formatMad, formatMadCompact } from "@/lib/money/mad";
import { cn } from "@/lib/utils";

type ClientsDetailSheetProps = {
  client: Client | null;
  clients: Client[];
  creditStore: CreditStore;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEdit: (client: Client) => void;
  onDeleted?: (clientId: string) => void;
  tr: (fr: string, ar: string) => string;
};

function creditTypeLabel(client: Client, tr: ClientsDetailSheetProps["tr"]) {
  if (client.isCashOnly) {
    return { label: tr("Comptant", "نقدي"), className: "text-error" };
  }
  return { label: tr("Crédit", "آجل"), className: "text-primary" };
}

function creditLimitLabel(
  client: Client,
  tr: ClientsDetailSheetProps["tr"],
  locale: string,
) {
  if (client.isCashOnly) return tr("Non applicable", "غير مطبق");
  if (client.creditLimitMad === null) {
    return tr("Sans plafond", "بدون سقف");
  }
  return formatMadCompact(client.creditLimitMad, 0, locale);
}

export function ClientsDetailSheet({
  client,
  clients,
  creditStore,
  open,
  onOpenChange,
  onEdit,
  onDeleted,
  tr,
}: ClientsDetailSheetProps) {
  const locale = useLocale();
  const toast = useToast();
  const currentUser = useQuery(api.authz.currentUser);
  const canDelete = canDeleteClients(currentUser?.permissions ?? []);
  const removeClient = useMutation(api.clients.remove);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const ledgerRows = useQuery(
    api.credits.listLedgerByClient,
    client && open ? { clientId: client.id as Id<"clients"> } : "skip",
  );

  const entries = useMemo(() => {
    if (ledgerRows) return ledgerRows.map(ledgerEntryFromConvex);
    return client ? (creditStore.entriesByClient[client.id] ?? []) : [];
  }, [client, creditStore.entriesByClient, ledgerRows]);

  const summary = useMemo(
    () => summarizeLedger(entries, client?.initialSoldeMad ?? 0),
    [entries, client?.initialSoldeMad],
  );
  const invoiceCount = useMemo(
    () => entries.filter((e) => e.kind === "invoice").length,
    [entries],
  );
  const soldeMad = summary.soldeMad;

  async function handleDeleteConfirm() {
    if (!client) return;
    setDeleting(true);
    try {
      await removeClient({ clientId: client.id as Id<"clients"> });
      toast.success(tr("Client supprimé", "تم حذف العميل"), client.fullName);
      setDeleteOpen(false);
      onOpenChange(false);
      onDeleted?.(client.id);
    } catch (error) {
      toast.error(
        tr("Suppression impossible", "تعذر الحذف"),
        error instanceof Error ? error.message : "DELETE_FAILED",
      );
    } finally {
      setDeleting(false);
    }
  }

  return (
    <>
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" size="wide" className="overflow-y-auto">
        {client ? (
          <>
            <SheetHeader className="border-sidebar-border border-b px-6 pt-6 pb-6">
              <SheetTitle className="text-2xl font-black tracking-tight">
                {client.fullName}
              </SheetTitle>
              <SheetDescription className="mt-2 space-y-3">
                <span className="text-on-surface-variant inline-flex items-center gap-1.5 text-sm font-medium">
                  <Phone className="size-3.5" aria-hidden />
                  {client.phone}
                </span>
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={cn(
                      "rounded-full px-3 py-1 text-[10px] font-bold tracking-wide uppercase",
                      creditTypeLabel(client, tr).className,
                      "bg-surface-container-low",
                    )}
                  >
                    {creditTypeLabel(client, tr).label}
                  </span>
                  <span className="text-on-surface-variant text-xs font-medium">
                    {tr("Plafond", "السقف")}: {creditLimitLabel(client, tr, locale)}
                  </span>
                  <span className="text-on-surface-variant text-xs font-medium tabular-nums">
                    {invoiceCount}{" "}
                    {tr(
                      invoiceCount === 1 ? "facture" : "factures",
                      invoiceCount === 1 ? "فاتورة" : "فواتير",
                    )}
                  </span>
                </div>
              </SheetDescription>
            </SheetHeader>

            <div className="space-y-6 px-6 py-6">
              <div className="bg-surface-container-low rounded-2xl p-5">
                <p className="text-on-surface-variant mb-2 text-[10px] font-bold tracking-widest uppercase">
                  {tr("Solde", "الرصيد")}
                </p>
                <p
                  className={cn(
                    "text-2xl font-black tabular-nums",
                    soldeToneClass(soldeMad),
                  )}
                >
                  {formatMad(soldeMad, 2, locale)}
                </p>
                <p className="text-on-surface-variant mt-1 text-[10px] font-bold uppercase">
                  {soldeMad > 0.009
                    ? tr("Avoir client", "رصيد دائن")
                    : soldeMad < -0.009
                      ? tr("Dette client", "دين على العميل")
                      : tr("Soldé", "مسدد")}
                </p>
                {Math.abs(client.initialSoldeMad) > 0.009 ? (
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

              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  className="rounded-xl font-bold"
                  onClick={() => {
                    onOpenChange(false);
                    onEdit(client);
                  }}
                >
                  <Pencil className="size-4 stroke-[1.75]" aria-hidden />
                  {tr("Modifier", "تعديل")}
                </Button>
                <Link
                  href={`/${locale}/credits`}
                  className={cn(
                    buttonVariants({ variant: "outline" }),
                    "inline-flex h-10 items-center rounded-xl px-4 font-bold",
                  )}
                >
                  {tr("Ouvrir Crédits", "فتح الائتمان")}
                </Link>
                {canDelete ? (
                  <Button
                    type="button"
                    variant="destructive"
                    className="rounded-xl font-bold"
                    onClick={() => setDeleteOpen(true)}
                  >
                    <Trash2 className="size-4 stroke-[1.75]" aria-hidden />
                    {tr("Supprimer", "حذف")}
                  </Button>
                ) : null}
              </div>

              <CreditsLedgerHistoryPanel
                entries={entries}
                clients={clients}
                scopeAll={false}
                tr={tr}
              />
            </div>
          </>
        ) : null}
      </SheetContent>
    </Sheet>

      <ConfirmDeleteDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        entityName={client?.fullName ?? ""}
        confirmText={client?.fullName ?? ""}
        title={tr("Supprimer ce client ?", "حذف هذا العميل؟")}
        description={tr(
          "Le client et ses factures / crédits liés seront définitivement supprimés. Réservé à l'administrateur. Tapez le nom exact pour confirmer.",
          "سيتم حذف العميل وفواتيره واعتماده نهائيًا. مخصص للمسؤول. اكتب الاسم تمامًا للتأكيد.",
        )}
        typePrompt={tr(
          `Tapez « ${client?.fullName ?? ""} » pour confirmer`,
          `اكتب « ${client?.fullName ?? ""} » للتأكيد`,
        )}
        confirmLabel={tr("Supprimer définitivement", "حذف نهائي")}
        cancelLabel={tr("Annuler", "إلغاء")}
        busy={deleting}
        onConfirm={handleDeleteConfirm}
      />
    </>
  );
}
