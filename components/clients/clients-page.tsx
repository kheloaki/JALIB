"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useMutation, useQuery } from "convex/react";
import { LayoutGrid, LayoutList, Plus } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";

import { ClientsActivityTable } from "@/components/clients/clients-activity-table";
import { ClientsCreateDialog } from "@/components/clients/clients-create-dialog";
import { ClientsDetailSheet } from "@/components/clients/clients-detail-sheet";
import { ClientsEditDialog } from "@/components/clients/clients-edit-dialog";
import type { ClientEditPayload } from "@/components/clients/clients-edit-dialog";
import { ClientsGrid } from "@/components/clients/clients-grid";
import { ClientsTable } from "@/components/clients/clients-table";
import { useAdminChrome } from "@/components/layout/admin-chrome-context";
import { AdminFilterSummary } from "@/components/layout/admin-filter-summary";
import { Button } from "@/components/ui/button";
import { ConfirmDeleteDialog } from "@/components/ui/confirm-delete-dialog";
import { useToast } from "@/components/ui/toaster";
import {
  ClientsGridSkeleton,
  InlineTableSkeleton,
} from "@/components/skeletons";
import { useTableGridViewMode } from "@/hooks/use-table-grid-view-mode";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { canDeleteClients } from "@/lib/auth/permissions";
import { clientFromConvex, ledgerEntryFromConvex } from "@/lib/convex/mappers";
import type { Client } from "@/lib/clients/types";
import {
  clearClientSegmentHref,
  parseClientSegmentSearchParams,
} from "@/lib/clients/segment-url";
import type { CreditStore } from "@/lib/credits/types";
import { formatPeriodLabel } from "@/lib/dashboard/period-range";
import { cn } from "@/lib/utils";

export function ClientsPage() {
  return (
    <Suspense
      fallback={
        <div className="bg-surface flex min-h-0 flex-1 flex-col px-4 py-6 sm:px-6">
          <InlineTableSkeleton cols={5} rows={8} />
        </div>
      }
    >
      <ClientsPageContent />
    </Suspense>
  );
}

function ClientsPageContent() {
  const locale = useLocale();
  const isAr = locale === "ar";
  const tr = (fr: string, ar: string) => (isAr ? ar : fr);
  const tClients = useTranslations("clients");
  const tDashboard = useTranslations("dashboard");
  const toast = useToast();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { headerSearchQuery, setHeaderSearchQuery } = useAdminChrome();
  const trimmedSearch = headerSearchQuery.trim();
  const hasSearch = trimmedSearch.length >= 2;

  const segmentFilter = useMemo(
    () => parseClientSegmentSearchParams(searchParams),
    [searchParams],
  );
  const { segment, range, preset } = segmentFilter;
  const segmentActive = segment !== null && range !== null;

  /** Full list so header sort applies to every client, not only one page. */
  const allSummaryRows = useQuery(
    api.clients.listAllSummaries,
    hasSearch || segmentActive ? "skip" : { limit: 8000 },
  );
  const searchRows = useQuery(
    api.clients.searchSummaries,
    hasSearch && !segmentActive ? { query: trimmedSearch, limit: 80 } : "skip",
  );
  const clientTotal = useQuery(
    api.clients.countAll,
    segmentActive ? "skip" : {},
  );
  const deepLinkClientId = searchParams.get("clientId");
  const detailById = useQuery(
    api.clients.get,
    deepLinkClientId
      ? { clientId: deepLinkClientId as Id<"clients"> }
      : "skip",
  );

  const ledgerRows = useQuery(api.credits.listAllLedger, { limit: 800 });
  const ledgerStatsRows = useQuery(api.credits.listClientLedgerStats);
  const createClient = useMutation(api.clients.create);
  const updateClient = useMutation(api.clients.update);
  const removeClient = useMutation(api.clients.remove);
  const currentUser = useQuery(api.authz.currentUser);
  const canDelete = canDeleteClients(currentUser?.permissions ?? []);

  const clients = useMemo(() => {
    if (hasSearch) return (searchRows ?? []).map(clientFromConvex);
    return (allSummaryRows ?? []).map(clientFromConvex);
  }, [allSummaryRows, hasSearch, searchRows]);

  const isLoadingList = hasSearch
    ? searchRows === undefined
    : allSummaryRows === undefined;
  const hydrated = !isLoadingList && ledgerStatsRows !== undefined;
  const ledgerHydrated = ledgerStatsRows !== undefined;

  const creditStore = useMemo<CreditStore>(() => {
    const entriesByClient: CreditStore["entriesByClient"] = {};
    for (const row of ledgerRows ?? []) {
      const entry = ledgerEntryFromConvex(row);
      const list = entriesByClient[entry.clientId];
      if (list) list.push(entry);
      else entriesByClient[entry.clientId] = [entry];
    }
    return { entriesByClient };
  }, [ledgerRows]);

  const ledgerStatsByClientId = useMemo(() => {
    const map = new Map<
      string,
      {
        totalInvoicedMad: number;
        totalPaidMad: number;
        totalReturnedMad: number;
        lastPaymentDate: string | null;
        lastPaymentAmountMad: number | null;
      }
    >();
    for (const row of ledgerStatsRows ?? []) {
      map.set(row.clientId, {
        totalInvoicedMad: row.totalInvoicedMad,
        totalPaidMad: row.totalPaidMad,
        totalReturnedMad: row.totalReturnedMad,
        lastPaymentDate: row.lastPaymentDate,
        lastPaymentAmountMad: row.lastPaymentAmountMad,
      });
    }
    return map;
  }, [ledgerStatsRows]);

  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [detailClient, setDetailClient] = useState<Client | null>(null);
  const [deleteClient, setDeleteClient] = useState<Client | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [viewMode, setViewMode] = useTableGridViewMode();

  const activityRows = useQuery(
    api.dashboard.clientActivitySegment,
    segmentActive
      ? {
          startDate: range.startDate,
          endDate: range.endDate,
          segment,
        }
      : "skip",
  );
  const activityHydrated = !segmentActive || activityRows !== undefined;

  useEffect(() => {
    if (!deepLinkClientId) return;
    const match =
      clients.find((c) => c.id === deepLinkClientId) ??
      (detailById ? clientFromConvex(detailById) : null);
    if (match) setDetailClient(match);
  }, [clients, deepLinkClientId, detailById]);

  const visibleClients = clients;

  const visibleActivityRows = useMemo(() => {
    const rows = activityRows ?? [];
    const q = headerSearchQuery.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((row) => row.name.toLowerCase().includes(q));
  }, [activityRows, headerSearchQuery]);

  const segmentExtraLabel = useMemo(() => {
    if (!segmentActive || !range) return undefined;
    const segmentLabel =
      segment === "active"
        ? tClients("segmentActive")
        : tClients("segmentInactive");
    const periodLabel = preset
      ? tDashboard(`period.${preset}`)
      : formatPeriodLabel(range, locale, preset ?? undefined);
    return tClients("segmentFilterWithPeriod", {
      segment: segmentLabel,
      period: periodLabel,
    });
  }, [locale, preset, range, segment, segmentActive, tClients, tDashboard]);

  function clearSegmentFilter() {
    router.replace(clearClientSegmentHref(locale, searchParams), {
      scroll: false,
    });
  }

  const handleActivitySelect = useCallback(
    async (clientId: string) => {
      const match = clients.find((c) => c.id === clientId);
      if (match) {
        setDetailClient(match);
        return;
      }
      toast.info(
        tr("Client introuvable", "العميل غير موجود"),
        tr(
          "Ce client n'est plus enregistré dans la liste.",
          "هذا العميل لم يعد مسجلاً في القائمة.",
        ),
      );
    },
    [clients, toast, tr],
  );

  async function handleCreate(payload: ClientEditPayload) {
    try {
      const created = await createClient({
        fullName: payload.fullName,
        phone: payload.phone,
        isCashOnly: payload.isCashOnly,
        creditLimitMad: payload.creditLimitMad,
        initialSoldeMad: payload.initialSoldeMad,
      });
      toast.success(
        tr("Client ajouté", "تمت إضافة العميل"),
        created.fullName,
      );
    } catch (error) {
      toast.error(
        tr("Échec de l'ajout", "فشل الإضافة"),
        error instanceof Error
          ? error.message
          : tr("Impossible de créer le client.", "تعذر إنشاء العميل."),
      );
      throw error;
    }
  }

  async function handleSaveEdit(clientId: string, payload: ClientEditPayload) {
    await updateClient({
      clientId: clientId as Id<"clients">,
      fullName: payload.fullName,
      phone: payload.phone,
      isCashOnly: payload.isCashOnly,
      creditLimitMad: payload.creditLimitMad,
      initialSoldeMad: payload.initialSoldeMad,
    });
  }

  async function handleConfirmDelete() {
    if (!deleteClient) return;
    setDeleting(true);
    try {
      await removeClient({ clientId: deleteClient.id as Id<"clients"> });
      toast.success(tr("Client supprimé", "تم حذف العميل"), deleteClient.fullName);
      if (detailClient?.id === deleteClient.id) setDetailClient(null);
      setDeleteClient(null);
    } catch (error) {
      toast.error(
        tr("Suppression impossible", "تعذر الحذف"),
        error instanceof Error ? error.message : "DELETE_FAILED",
      );
    } finally {
      setDeleting(false);
    }
  }

  const listTitle = segmentActive
    ? segment === "active"
      ? tClients("segmentActiveListTitle")
      : tClients("segmentInactiveListTitle")
    : tr("Liste des clients", "قائمة العملاء");

  const totalCount = segmentActive
    ? (activityRows?.length ?? 0)
    : (clientTotal ?? clients.length);
  const filteredCount = segmentActive
    ? visibleActivityRows.length
    : hasSearch
      ? clients.length
      : totalCount;
  const listHydrated = segmentActive ? activityHydrated : hydrated;
  const hasRows = segmentActive
    ? visibleActivityRows.length > 0
    : visibleClients.length > 0;

  return (
    <div className="bg-surface text-on-background flex min-h-0 flex-1 flex-col">
      <main className="w-full flex-1 overflow-auto px-4 py-4 sm:px-6 sm:py-5">
        <div className="border-sidebar-border bg-surface-container-lowest overflow-hidden rounded-xl border shadow-sm">
          <div className="border-sidebar-border flex flex-col gap-3 border-b px-4 py-3 sm:px-6 sm:py-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-lg font-bold tracking-tight">{listTitle}</h2>
              <div className="flex flex-wrap items-center gap-2">
                {!segmentActive ? (
                  <div
                    className="bg-surface-container-low flex w-fit shrink-0 items-center gap-1 rounded-xl p-1"
                    role="group"
                    aria-label={tr("Mode d'affichage", "وضع العرض")}
                  >
                    <button
                      type="button"
                      onClick={() => setViewMode("table")}
                      className={cn(
                        "flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold transition-colors",
                        viewMode === "table"
                          ? "bg-surface-container-lowest text-primary shadow-sm"
                          : "text-on-surface-variant hover:text-on-surface",
                      )}
                      aria-pressed={viewMode === "table"}
                    >
                      <LayoutList className="size-4" aria-hidden />
                      {tr("Tableau", "جدول")}
                    </button>
                    <button
                      type="button"
                      onClick={() => setViewMode("grid")}
                      className={cn(
                        "flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold transition-colors",
                        viewMode === "grid"
                          ? "bg-surface-container-lowest text-primary shadow-sm"
                          : "text-on-surface-variant hover:text-on-surface",
                      )}
                      aria-pressed={viewMode === "grid"}
                    >
                      <LayoutGrid className="size-4" aria-hidden />
                      {tr("Grille", "شبكة")}
                    </button>
                  </div>
                ) : null}
                <Button
                  type="button"
                  size="icon"
                  className="size-10 shrink-0 rounded-xl"
                  onClick={() => setCreateOpen(true)}
                  aria-label={tr("Ajouter un client", "إضافة عميل")}
                  title={tr("Ajouter un client", "إضافة عميل")}
                >
                  <Plus className="size-5 stroke-[1.75]" aria-hidden />
                </Button>
              </div>
            </div>
            <AdminFilterSummary
              filteredCount={listHydrated ? filteredCount : 0}
              totalCount={listHydrated ? totalCount : 0}
              searchQuery={headerSearchQuery}
              onClearSearch={() => setHeaderSearchQuery("")}
              extraActive={segmentActive}
              extraLabel={segmentExtraLabel}
              onClearExtra={clearSegmentFilter}
              itemLabel={tr("client", "عميل")}
              itemLabelPlural={tr("clients", "عملاء")}
            />
          </div>

          {!listHydrated ? (
            viewMode === "grid" && !segmentActive ? (
              <ClientsGridSkeleton />
            ) : (
              <InlineTableSkeleton cols={segmentActive ? 8 : 5} rows={8} />
            )
          ) : !hasRows ? (
            <p className="text-on-surface-variant px-6 py-10 text-center text-sm">
              {segmentActive
                ? headerSearchQuery.trim()
                  ? tr(
                      "Aucun client ne correspond à la recherche.",
                      "لا يوجد عميل مطابق للبحث.",
                    )
                  : tr(
                      "Aucun client pour ce filtre.",
                      "لا يوجد عميل لهذا الفلتر.",
                    )
                : (clientTotal ?? 0) === 0
                  ? tr("Aucun client enregistré.", "لا يوجد أي عميل.")
                  : tr(
                      "Aucun client ne correspond à la recherche.",
                      "لا يوجد عميل مطابق للبحث.",
                    )}
            </p>
          ) : segmentActive ? (
            <ClientsActivityTable
              rows={visibleActivityRows}
              locale={locale}
              onSelect={handleActivitySelect}
            />
          ) : viewMode === "table" ? (
            <ClientsTable
              clients={visibleClients}
              creditStore={creditStore}
              ledgerStatsByClientId={ledgerStatsByClientId}
              ledgerHydrated={ledgerHydrated}
              tr={tr}
              locale={locale}
              onSelect={setDetailClient}
              onEdit={setEditingClient}
              onDelete={canDelete ? setDeleteClient : undefined}
              disableWindowing={hasSearch}
            />
          ) : (
            <div className="p-4 sm:p-6">
              <ClientsGrid
                clients={visibleClients}
                creditStore={creditStore}
                ledgerStatsByClientId={ledgerStatsByClientId}
                ledgerHydrated={ledgerHydrated}
                tr={tr}
                locale={locale}
                onSelect={setDetailClient}
                onEdit={setEditingClient}
                onDelete={canDelete ? setDeleteClient : undefined}
              />
            </div>
          )}
        </div>
      </main>

      <ClientsDetailSheet
        client={detailClient}
        clients={clients}
        creditStore={creditStore}
        open={detailClient !== null}
        onOpenChange={(open) => {
          if (!open) setDetailClient(null);
        }}
        onEdit={setEditingClient}
        onDeleted={() => setDetailClient(null)}
        tr={tr}
      />

      <ConfirmDeleteDialog
        open={deleteClient !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteClient(null);
        }}
        entityName={deleteClient?.fullName ?? ""}
        confirmText={deleteClient?.fullName ?? ""}
        title={tr("Supprimer ce client ?", "حذف هذا العميل؟")}
        description={tr(
          "Le client et ses factures / crédits liés seront définitivement supprimés. Tapez le nom exact pour confirmer.",
          "سيتم حذف العميل وفواتيره واعتماده نهائيًا. اكتب الاسم تمامًا للتأكيد.",
        )}
        typePrompt={tr(
          `Tapez « ${deleteClient?.fullName ?? ""} » pour confirmer`,
          `اكتب « ${deleteClient?.fullName ?? ""} » للتأكيد`,
        )}
        confirmLabel={tr("Supprimer définitivement", "حذف نهائي")}
        cancelLabel={tr("Annuler", "إلغاء")}
        busy={deleting}
        onConfirm={handleConfirmDelete}
      />

      <ClientsCreateDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreate={handleCreate}
        tr={tr}
      />

      <ClientsEditDialog
        client={editingClient}
        open={editingClient !== null}
        onOpenChange={(open) => {
          if (!open) setEditingClient(null);
        }}
        onSave={handleSaveEdit}
        tr={tr}
      />
    </div>
  );
}
