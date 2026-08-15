"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useLocale } from "next-intl";
import { useQuery } from "convex/react";

import { useAdminChrome } from "@/components/layout/admin-chrome-context";
import { AdminFilterSummary } from "@/components/layout/admin-filter-summary";
import { CreditsClientFicheSheet } from "@/components/credits/credits-client-fiche-sheet";
import { CreditsClientsTable } from "@/components/credits/credits-clients-table";
import { CreditsCreatePlanDialog } from "@/components/credits/credits-create-plan-dialog";
import {
  CreditsInstallmentPayDialog,
  type InstallmentPayDraft,
} from "@/components/credits/credits-installment-pay-dialog";
import { CreditsLedgerHistoryPanel } from "@/components/credits/credits-ledger-history-panel";
import { CreditsVerificationPanel } from "@/components/credits/credits-verification-panel";
import { CreditsRegisterPaymentDialog } from "@/components/credits/credits-register-payment-dialog";
import {
  CreditsStoreSummaryCard,
  type StoreCreditSummary,
} from "@/components/credits/credits-store-summary-card";
import { InvoiceClientFilter } from "@/components/invoices/invoice-client-filter";
import {
  outstandingWithInitialSolde,
  soldeFromLedgerTotals,
  summarizeLedger,
} from "@/lib/credits/compute";
import { computeClientOutstandingMad } from "@/lib/credits/invoice-settlement";
import type { CreditStore, LedgerEntry } from "@/lib/credits/types";
import { planRemainingForStore } from "@/lib/credits/installments/plan-remaining";
import type { InstallmentPlan } from "@/lib/credits/installments/types";
import type { Client } from "@/lib/clients/types";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { canVerifyCreditInvoices } from "@/lib/auth/permissions";
import { clientFromConvex, ledgerEntryFromConvex } from "@/lib/convex/mappers";
import { AdminPageContent } from "@/components/layout/admin-page-content";
import { useCreditsPageTabs } from "@/hooks/use-credits-page-tabs";
import { CreditsPageSkeleton } from "@/components/skeletons";

export function CreditsPage() {
  return (
    <Suspense fallback={<CreditsPageSkeleton />}>
      <CreditsPageContent />
    </Suspense>
  );
}

function CreditsPageContent() {
  const locale = useLocale();
  const isAr = locale === "ar";
  const tr = (fr: string, ar: string) => (isAr ? ar : fr);
  const router = useRouter();
  const searchParams = useSearchParams();
  const { headerSearchQuery, setHeaderSearchQuery } = useAdminChrome();
  const { visibleTab: pageTab } = useCreditsPageTabs();

  const [ficheClientId, setFicheClientId] = useState<string | null>(null);
  const [planDialogClientId, setPlanDialogClientId] = useState<string | null>(
    null,
  );
  const [paymentDialogClientId, setPaymentDialogClientId] = useState<
    string | null
  >(null);
  const [filterClientId, setFilterClientId] = useState<string | null>(() =>
    searchParams.get("clientId"),
  );
  const [installmentPayDraft, setInstallmentPayDraft] =
    useState<InstallmentPayDraft | null>(null);
  const [installmentPayError, setInstallmentPayError] = useState<string | null>(
    null,
  );

  // Stale header search (e.g. from another page) hides most clients — start clean.
  useEffect(() => {
    setHeaderSearchQuery("");
  }, [setHeaderSearchQuery]);

  useEffect(() => {
    setFilterClientId(searchParams.get("clientId"));
  }, [searchParams]);

  const handleFilterClientChange = useCallback(
    (clientId: string | null) => {
      setFilterClientId(clientId);
      const params = new URLSearchParams(searchParams.toString());
      if (clientId) params.set("clientId", clientId);
      else params.delete("clientId");
      const qs = params.toString();
      router.replace(qs ? `?${qs}` : "?", { scroll: false });
    },
    [router, searchParams],
  );

  const ledgerRows = useQuery(api.credits.listAllLedger, { limit: 800 });
  const ledgerStatsRows = useQuery(api.credits.listClientLedgerStats);
  const focusedLedgerClientId =
    ficheClientId ??
    planDialogClientId ??
    paymentDialogClientId ??
    filterClientId ??
    installmentPayDraft?.plan.clientId ??
    null;
  const focusedLedgerRows = useQuery(
    api.credits.listLedgerByClient,
    focusedLedgerClientId
      ? { clientId: focusedLedgerClientId as Id<"clients"> }
      : "skip",
  );

  const ledgerClientIds = useMemo(() => {
    const ids = new Set<string>();
    for (const row of ledgerRows ?? []) ids.add(row.clientId);
    if (focusedLedgerClientId) ids.add(focusedLedgerClientId);
    return [...ids].slice(0, 500) as Id<"clients">[];
  }, [focusedLedgerClientId, ledgerRows]);

  const trimmedSearch = headerSearchQuery.trim();
  const hasSearch = trimmedSearch.length >= 2;

  /** Always load every client — search only filters the table, never hides the rest. */
  const allClientRows = useQuery(api.clients.listAllSummaries, {
    limit: 8000,
  });
  const ledgerClientRows = useQuery(
    api.clients.getMany,
    ledgerClientIds.length > 0 ? { clientIds: ledgerClientIds } : "skip",
  );

  const dialogClientId =
    ficheClientId ??
    planDialogClientId ??
    paymentDialogClientId ??
    filterClientId;
  const dialogClientRow = useQuery(
    api.clients.get,
    dialogClientId ? { clientId: dialogClientId as Id<"clients"> } : "skip",
  );

  const currentUser = useQuery(api.authz.currentUser);
  const canVerify = canVerifyCreditInvoices(currentUser?.permissions ?? []);

  const creditStore = useMemo<CreditStore>(() => {
    const entriesByClient: CreditStore["entriesByClient"] = {};
    for (const row of ledgerRows ?? []) {
      const entry = ledgerEntryFromConvex(row);
      const list = entriesByClient[entry.clientId];
      if (list) list.push(entry);
      else entriesByClient[entry.clientId] = [entry];
    }
    // Prefer full per-client history when viewing / filtering one client.
    if (focusedLedgerClientId && focusedLedgerRows) {
      entriesByClient[focusedLedgerClientId] = focusedLedgerRows.map(
        ledgerEntryFromConvex,
      );
    }
    for (const list of Object.values(entriesByClient)) {
      list.sort((a, b) => b.date.localeCompare(a.date));
    }
    return { entriesByClient };
  }, [focusedLedgerClientId, focusedLedgerRows, ledgerRows]);

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

  const clientsById = useMemo(() => {
    const map = new Map<string, Client>();
    for (const row of allClientRows ?? []) {
      map.set(row.id, clientFromConvex(row));
    }
    for (const row of ledgerClientRows ?? []) {
      map.set(row.id, clientFromConvex(row));
    }
    if (dialogClientRow) {
      map.set(dialogClientRow.id, clientFromConvex(dialogClientRow));
    }
    return map;
  }, [allClientRows, dialogClientRow, ledgerClientRows]);

  const historyClients = useMemo(
    () => [...clientsById.values()],
    [clientsById],
  );

  /** All clients by default; client picker / header search narrow the table. */
  const filteredClients = useMemo(() => {
    let all = [...clientsById.values()];
    if (filterClientId) {
      all = all.filter((client) => client.id === filterClientId);
    }
    if (!hasSearch) return all;
    const q = trimmedSearch.toLowerCase();
    const digits = trimmedSearch.replace(/\D/g, "");
    return all.filter((client) => {
      if (client.fullName.toLowerCase().includes(q)) return true;
      if (client.phone.toLowerCase().includes(q)) return true;
      if (digits.length >= 2) {
        const phoneDigits = client.phone.replace(/\D/g, "");
        if (phoneDigits.includes(digits)) return true;
      }
      return false;
    });
  }, [clientsById, filterClientId, hasSearch, trimmedSearch]);
  const resolveClient = useCallback(
    (clientId: string | null) => {
      if (!clientId) return null;
      return clientsById.get(clientId) ?? null;
    },
    [clientsById],
  );

  const ficheClient = resolveClient(ficheClientId);
  const planDialogClient = resolveClient(planDialogClientId);
  const paymentDialogClient = resolveClient(paymentDialogClientId);

  const clientsHydrated =
    allClientRows !== undefined &&
    (ledgerClientIds.length === 0 || ledgerClientRows !== undefined);
  const hydrated =
    clientsHydrated &&
    ledgerRows !== undefined &&
    ledgerStatsRows !== undefined;

  const storeCreditSummary = useMemo<StoreCreditSummary>(() => {
    const clientIds = new Set([
      ...clientsById.keys(),
      ...ledgerStatsByClientId.keys(),
    ]);
    let totalInvoicedMad = 0;
    let totalPaidMad = 0;
    let totalReturnedMad = 0;
    let totalOutstandingMad = 0;
    let clientsWithDebt = 0;

    for (const clientId of clientIds) {
      const initialSoldeMad = clientsById.get(clientId)?.initialSoldeMad ?? 0;
      const stats = ledgerStatsByClientId.get(clientId);
      if (stats) {
        totalInvoicedMad += stats.totalInvoicedMad;
        totalPaidMad += stats.totalPaidMad;
        totalReturnedMad += stats.totalReturnedMad;
        const soldeMad = soldeFromLedgerTotals(stats, initialSoldeMad);
        // Accounting debt (full ledger). FIFO outstanding needs every line;
        // max(0, −solde) matches store totals without the truncated feed.
        const outstanding = Math.max(0, Math.round(-soldeMad * 100) / 100);
        if (outstanding > 0.009) {
          totalOutstandingMad += outstanding;
          clientsWithDebt += 1;
        }
        continue;
      }
      const entries = creditStore.entriesByClient[clientId] ?? [];
      const clientSummary = summarizeLedger(entries, initialSoldeMad);
      totalInvoicedMad += clientSummary.totalInvoicedMad;
      totalPaidMad += clientSummary.totalPaidMad;
      totalReturnedMad += clientSummary.totalReturnedMad;
      const outstanding = outstandingWithInitialSolde(
        computeClientOutstandingMad(entries),
        initialSoldeMad,
      );
      if (outstanding > 0) {
        totalOutstandingMad += outstanding;
        clientsWithDebt += 1;
      }
    }

    return {
      totalInvoicedMad,
      totalPaidMad,
      totalReturnedMad,
      totalOutstandingMad,
      clientsWithDebt,
    };
  }, [clientsById, creditStore.entriesByClient, ledgerStatsByClientId]);

  const allEntriesSorted = useMemo(() => {
    const flat: LedgerEntry[] = [];
    for (const list of Object.values(creditStore.entriesByClient)) {
      flat.push(...list);
    }
    return flat.sort((a, b) => b.date.localeCompare(a.date));
  }, [creditStore]);

  const filteredAllEntries = useMemo(() => {
    let rows = allEntriesSorted;
    if (filterClientId) {
      rows = rows.filter((entry) => entry.clientId === filterClientId);
    }
    const q = headerSearchQuery.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((entry) => {
      const client = clientsById.get(entry.clientId);
      const hay = [
        entry.ref,
        entry.note ?? "",
        entry.kind,
        client?.fullName,
        client?.phone,
      ]
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [allEntriesSorted, clientsById, filterClientId, headerSearchQuery]);

  const filterSummary = useMemo(() => {
    if (pageTab === "clients") {
      const totalClients = allClientRows?.length ?? filteredClients.length;
      return {
        filtered: filteredClients.length,
        total: totalClients,
        item: tr("client", "عميل"),
        itemPlural: tr("clients", "عملاء"),
      };
    }
    if (pageTab === "verification") {
      return null;
    }
    return {
      filtered: filteredAllEntries.length,
      total: allEntriesSorted.length,
      item: tr("ligne", "سطر"),
      itemPlural: tr("lignes", "أسطر"),
    };
  }, [
    allEntriesSorted.length,
    filteredAllEntries.length,
    filteredClients.length,
    pageTab,
    tr,
    hasSearch,
    allClientRows?.length,
    storeCreditSummary.clientsWithDebt,
  ]);

  function openInstallmentPayDialog(plan: InstallmentPlan) {
    const remaining = planRemainingForStore(plan, creditStore.entriesByClient);
    if (remaining <= 0 || plan.status !== "active") return;
    setInstallmentPayError(null);
    setInstallmentPayDraft({
      plan,
      amount: String(remaining),
      date: plan.nextDueDate,
      note: "",
    });
  }

  return (
    <AdminPageContent>
      {!hydrated ? (
        <CreditsPageSkeleton />
      ) : (
        <>
          {filterSummary ? (
            <AdminFilterSummary
              filteredCount={filterSummary.filtered}
              totalCount={filterSummary.total}
              searchQuery={headerSearchQuery}
              onClearSearch={() => setHeaderSearchQuery("")}
              itemLabel={filterSummary.item}
              itemLabelPlural={filterSummary.itemPlural}
            />
          ) : null}

          {pageTab === "clients" ? (
            <div className="flex flex-col gap-6">
              <CreditsStoreSummaryCard summary={storeCreditSummary} tr={tr} />
              <div className="border-sidebar-border bg-surface-container-lowest rounded-2xl border p-4 shadow-sm sm:p-5">
                <InvoiceClientFilter
                  selectedClientId={filterClientId}
                  onClientChange={handleFilterClientChange}
                  tr={tr}
                  className="max-w-md"
                />
              </div>
              {hasSearch && !filterClientId ? (
                <div className="border-primary/30 bg-primary/5 flex flex-col gap-3 rounded-2xl border px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-on-surface text-sm font-semibold">
                    {tr(
                      `Recherche « ${trimmedSearch} » — ${filteredClients.length} client(s). Effacez pour voir tout le magasin.`,
                      `البحث « ${trimmedSearch} » — ${filteredClients.length} عميل. امسح لعرض كل العملاء.`,
                    )}
                  </p>
                  <button
                    type="button"
                    onClick={() => setHeaderSearchQuery("")}
                    className="bg-primary text-on-primary hover:brightness-95 h-10 shrink-0 rounded-xl px-4 text-sm font-bold"
                  >
                    {tr("Voir tous les clients", "عرض كل العملاء")}
                  </button>
                </div>
              ) : null}
              <CreditsClientsTable
                clients={filteredClients}
                creditStore={creditStore}
                ledgerStatsByClientId={ledgerStatsByClientId}
                hydrated={hydrated}
                tr={tr}
                title={
                  filterClientId
                    ? tr("Client sélectionné", "العميل المحدد")
                    : hasSearch
                      ? tr(
                          "Résultats — paiement possible",
                          "نتائج — يمكن التسجيل",
                        )
                      : tr("Tous les clients", "كل العملاء")
                }
                totalCount={filteredClients.length}
                disableWindowing={hasSearch || Boolean(filterClientId)}
                emptyHint={
                  filterClientId
                    ? tr(
                        "Client introuvable. Effacez le filtre pour voir tous les clients.",
                        "العميل غير موجود. امسح التصفية لعرض كل العملاء.",
                      )
                    : hasSearch
                      ? tr(
                          "Aucun client trouvé. Cliquez « Voir tous les clients ».",
                          "لم يُعثر على عميل. اضغط « عرض كل العملاء ».",
                        )
                      : tr(
                          "Aucun client. Importez ou créez des clients pour enregistrer des paiements.",
                          "لا يوجد عملاء. أضف عملاء لتسجيل الدفعات.",
                        )
                }
                onOpenFiche={setFicheClientId}
                onOpenPlanDialog={setPlanDialogClientId}
                onOpenPaymentDialog={setPaymentDialogClientId}
              />
            </div>
          ) : pageTab === "verification" ? (
            <CreditsVerificationPanel
              tr={tr}
              headerSearchQuery={headerSearchQuery}
              onOpenClientFiche={setFicheClientId}
            />
          ) : pageTab === "invoices" ? (
            <CreditsLedgerHistoryPanel
              entries={filteredAllEntries}
              clients={historyClients}
              scopeAll
              fixedKind="invoice"
              showVerificationColumn
              showClientFilter
              filterClientId={filterClientId}
              onFilterClientChange={handleFilterClientChange}
              title={tr("Factures à crédit", "فواتير الائتمان")}
              onOpenClientFiche={setFicheClientId}
              tr={tr}
            />
          ) : pageTab === "payments" ? (
            <CreditsLedgerHistoryPanel
              entries={filteredAllEntries}
              clients={historyClients}
              scopeAll
              fixedKind="payment"
              showClientFilter
              filterClientId={filterClientId}
              onFilterClientChange={handleFilterClientChange}
              title={tr("Paiements reçus", "المدفوعات المستلمة")}
              onOpenClientFiche={setFicheClientId}
              tr={tr}
            />
          ) : pageTab === "returns" ? (
            <CreditsLedgerHistoryPanel
              entries={filteredAllEntries}
              clients={historyClients}
              scopeAll
              fixedKind="return"
              showClientFilter
              filterClientId={filterClientId}
              onFilterClientChange={handleFilterClientChange}
              title={tr("Retours crédit", "إرجاعات الائتمان")}
              onOpenClientFiche={setFicheClientId}
              tr={tr}
            />
          ) : null}
        </>
      )}

      <CreditsClientFicheSheet
        client={ficheClient}
        clients={historyClients}
        creditStore={creditStore}
        open={Boolean(ficheClientId)}
        onOpenChange={(open) => {
          if (!open) setFicheClientId(null);
        }}
        onOpenInstallmentPay={openInstallmentPayDialog}
        tr={tr}
      />

      <CreditsCreatePlanDialog
        client={planDialogClient}
        open={Boolean(planDialogClientId)}
        onOpenChange={(open) => {
          if (!open) setPlanDialogClientId(null);
        }}
        tr={tr}
      />

      <CreditsRegisterPaymentDialog
        client={paymentDialogClient}
        creditStore={creditStore}
        open={Boolean(paymentDialogClientId)}
        onOpenChange={(open) => {
          if (!open) setPaymentDialogClientId(null);
        }}
        tr={tr}
      />

      <CreditsInstallmentPayDialog
        draft={installmentPayDraft}
        creditStore={creditStore}
        error={installmentPayError}
        onDraftChange={setInstallmentPayDraft}
        onErrorChange={setInstallmentPayError}
        onClose={() => {
          setInstallmentPayDraft(null);
          setInstallmentPayError(null);
        }}
        tr={tr}
      />
    </AdminPageContent>
  );
}
