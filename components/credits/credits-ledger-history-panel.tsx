"use client";

import { useCallback, useMemo, useState } from "react";
import Link from "next/link";
import { useLocale } from "next-intl";
import { useMutation, useQuery } from "convex/react";
import {
  Banknote,
  FileText,
  RotateCcw,
  Search,
  Trash2,
} from "lucide-react";

import {
  isLedgerPayment,
  isLedgerReturn,
  runningSoldeAfterByEntryId,
} from "@/lib/credits/compute";
import {
  computeAllClientsInvoiceSettlementStatuses,
  resolveInvoiceRowStatus,
} from "@/lib/credits/invoice-settlement";
import {
  filterLedgerEntries,
  formatLedgerDate,
  formatWeekday,
  ledgerAmountClass,
  ledgerAmountSign,
  ledgerIconClass,
  ledgerRowClass,
  ledgerKindLabel,
  ledgerBadgeBaseClass,
  ledgerSourceLabel,
  resolveLedgerTime,
  soldeToneClass,
  statusBadgeClass,
  statusLabel,
  verificationBadgeClass,
  verificationLabel,
  type HistoryKindFilter,
  type HistorySourceFilter,
  type HistoryStatusFilter,
  type HistoryVerificationFilter,
} from "@/lib/credits/ledger-ui";
import type { Client } from "@/lib/clients/types";
import type { LedgerEntry } from "@/lib/credits/types";
import { InvoiceClientFilter } from "@/components/invoices/invoice-client-filter";
import { Button } from "@/components/ui/button";
import { ConfirmDeleteDialog } from "@/components/ui/confirm-delete-dialog";
import { Input } from "@/components/ui/input";
import { FrenchDateInput } from "@/components/ui/french-date-input";
import { SortableTh } from "@/components/ui/sortable-th";
import { useToast } from "@/components/ui/toaster";
import { useClientTableSort } from "@/hooks/use-client-table-sort";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { canDeleteCreditPayments } from "@/lib/auth/permissions";
import { formatMad } from "@/lib/money/mad";
import { cn } from "@/lib/utils";

type LedgerSortColumn =
  | "date"
  | "client"
  | "montant"
  | "type"
  | "statut"
  | "source";

type LedgerRow = LedgerEntry & { status: LedgerEntry["status"] };

const filterSelectClass =
  "bg-surface-container-lowest border-outline-variant/30 text-on-surface h-11 w-full rounded-xl border px-3 text-sm font-medium";

export function CreditsLedgerHistoryPanel({
  entries,
  clients,
  scopeAll,
  showScopeToggle = false,
  scope,
  onScopeChange,
  fixedKind,
  showVerificationColumn = false,
  showRunningSolde = false,
  initialSoldeMad = 0,
  showClientFilter = false,
  filterClientId: controlledFilterClientId,
  onFilterClientChange,
  title,
  onOpenClientFiche,
  dateFrom: controlledDateFrom,
  dateTo: controlledDateTo,
  onDateFromChange,
  onDateToChange,
  tr,
}: {
  entries: LedgerEntry[];
  clients: Client[];
  scopeAll: boolean;
  showScopeToggle?: boolean;
  scope?: "client" | "all";
  onScopeChange?: (scope: "client" | "all") => void;
  /** When set, kind is fixed by the parent tab and kind tabs are hidden. */
  fixedKind?: Exclude<HistoryKindFilter, "all">;
  showVerificationColumn?: boolean;
  /** Client fiche — continuing solde after each row (+avoir / −dette). */
  showRunningSolde?: boolean;
  initialSoldeMad?: number;
  /** Searchable client picker (Factures / Paiements / Retours). */
  showClientFilter?: boolean;
  filterClientId?: string | null;
  onFilterClientChange?: (clientId: string | null) => void;
  title?: string;
  onOpenClientFiche?: (clientId: string) => void;
  /** Controlled Du/Au filters (e.g. client fiche PDF range). */
  dateFrom?: string;
  dateTo?: string;
  onDateFromChange?: (value: string) => void;
  onDateToChange?: (value: string) => void;
  tr: (fr: string, ar: string) => string;
}) {
  const locale = useLocale();
  const isAr = locale === "ar";
  const toast = useToast();
  const currentUser = useQuery(api.authz.currentUser);
  const canDeletePayment = canDeleteCreditPayments(
    currentUser?.permissions ?? [],
  );
  const removePayment = useMutation(api.credits.removePayment);
  const [paymentToDelete, setPaymentToDelete] = useState<LedgerRow | null>(
    null,
  );
  const [deletingPayment, setDeletingPayment] = useState(false);
  const [historyKindFilter, setHistoryKindFilter] =
    useState<HistoryKindFilter>(fixedKind ?? "all");
  const [historyStatusFilter, setHistoryStatusFilter] =
    useState<HistoryStatusFilter>("all");
  const [historyVerificationFilter, setHistoryVerificationFilter] =
    useState<HistoryVerificationFilter>("all");
  const [historySearch, setHistorySearch] = useState("");
  const [internalDateFrom, setInternalDateFrom] = useState("");
  const [internalDateTo, setInternalDateTo] = useState("");
  const [internalFilterClientId, setInternalFilterClientId] = useState<
    string | null
  >(null);
  const historyDateFrom = controlledDateFrom ?? internalDateFrom;
  const historyDateTo = controlledDateTo ?? internalDateTo;
  const setHistoryDateFrom = onDateFromChange ?? setInternalDateFrom;
  const setHistoryDateTo = onDateToChange ?? setInternalDateTo;
  const filterClientId =
    controlledFilterClientId !== undefined
      ? controlledFilterClientId
      : internalFilterClientId;
  const setFilterClientId = onFilterClientChange ?? setInternalFilterClientId;
  const [historySourceFilter, setHistorySourceFilter] =
    useState<HistorySourceFilter>("all");

  const effectiveKind = fixedKind ?? historyKindFilter;
  const showVerification =
    showVerificationColumn || effectiveKind === "invoice";

  const settlementByInvoiceId = useMemo(
    () => computeAllClientsInvoiceSettlementStatuses(entries),
    [entries],
  );

  const entriesWithResolvedStatus = useMemo(
    () =>
      entries.map((entry) => ({
        ...entry,
        status: resolveInvoiceRowStatus(entry, settlementByInvoiceId),
      })),
    [entries, settlementByInvoiceId],
  );

  const clientNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const client of clients) {
      map.set(client.id, client.fullName);
    }
    return map;
  }, [clients]);

  const historyFilteredEntries = useMemo(() => {
    const scoped = filterClientId
      ? entriesWithResolvedStatus.filter(
          (entry) => entry.clientId === filterClientId,
        )
      : entriesWithResolvedStatus;
    return filterLedgerEntries(scoped, {
      kind: effectiveKind,
      status: historyStatusFilter,
      source: historySourceFilter,
      verification: showVerification
        ? historyVerificationFilter
        : undefined,
      search: historySearch,
      dateFrom: historyDateFrom,
      dateTo: historyDateTo,
      scopeAll,
      clients: clients.map((c) => ({
        id: c.id,
        fullName: c.fullName,
        phone: c.phone,
      })),
    });
  }, [
    entriesWithResolvedStatus,
    effectiveKind,
    filterClientId,
    historyStatusFilter,
    historySourceFilter,
    historyVerificationFilter,
    showVerification,
    historySearch,
    historyDateFrom,
    historyDateTo,
    scopeAll,
    clients,
  ]);

  const compareLedger = useCallback(
    (a: LedgerRow, b: LedgerRow, column: LedgerSortColumn) => {
      switch (column) {
        case "date":
          return a.date.localeCompare(b.date);
        case "client": {
          const na = clientNameById.get(a.clientId) ?? "";
          const nb = clientNameById.get(b.clientId) ?? "";
          return na.localeCompare(nb, "fr");
        }
        case "montant":
          return a.amountMad - b.amountMad;
        case "type":
          return a.kind.localeCompare(b.kind);
        case "statut":
          return a.status.localeCompare(b.status);
        case "source":
          return (a.source ?? "").localeCompare(b.source ?? "");
        default:
          return 0;
      }
    },
    [clientNameById],
  );

  const {
    sortColumn,
    sortDirection,
    handleSort,
    sortedRows: sortedLedgerEntries,
  } = useClientTableSort({
    rows: historyFilteredEntries as LedgerRow[],
    initialColumn: "date" as LedgerSortColumn,
    initialDirection: "desc",
    compare: compareLedger,
  });

  const tableEntries = entriesWithResolvedStatus;

  const runningSoldeEnabled = showRunningSolde && !scopeAll;
  const runningSoldeByEntryId = useMemo(
    () =>
      runningSoldeEnabled
        ? runningSoldeAfterByEntryId(entries, initialSoldeMad)
        : null,
    [entries, initialSoldeMad, runningSoldeEnabled],
  );

  const historyFiltersActive =
    (!fixedKind && effectiveKind !== "all") ||
    historyStatusFilter !== "all" ||
    historySourceFilter !== "all" ||
    historyVerificationFilter !== "all" ||
    historySearch.trim() !== "" ||
    historyDateFrom.trim() !== "" ||
    historyDateTo.trim() !== "" ||
    Boolean(showClientFilter && filterClientId);

  function resetHistoryFilters() {
    if (!fixedKind) setHistoryKindFilter("all");
    setHistoryStatusFilter("all");
    setHistorySourceFilter("all");
    setHistoryVerificationFilter("all");
    setHistorySearch("");
    setHistoryDateFrom("");
    setHistoryDateTo("");
    if (showClientFilter) setFilterClientId(null);
  }

  const panelTitle =
    title ??
    tr("Historique des Paiements & Crédits", "سجل المدفوعات والاعتمادات");

  const colCount =
    (scopeAll ? 1 : 0) +
    6 +
    (showVerification ? 1 : 0) +
    (runningSoldeEnabled ? 1 : 0) +
    (canDeletePayment ? 1 : 0);

  async function handleConfirmDeletePayment() {
    if (!paymentToDelete) return;
    setDeletingPayment(true);
    try {
      await removePayment({
        ledgerEntryId: paymentToDelete.id as Id<"creditLedgerEntries">,
        confirmRef: paymentToDelete.ref,
      });
      toast.success(
        tr("Paiement supprimé", "تم حذف الدفعة"),
        tr(
          "Le solde, les factures et le plan ont été remis comme avant ce paiement.",
          "تمت إعادة الرصيد والفواتير والخطة كما كانت قبل هذه الدفعة.",
        ),
      );
      setPaymentToDelete(null);
    } catch (error) {
      toast.error(
        tr("Suppression impossible", "تعذر الحذف"),
        error instanceof Error
          ? error.message
          : tr("Réessayez dans un instant.", "حاول مرة أخرى."),
      );
    } finally {
      setDeletingPayment(false);
    }
  }

  return (
    <div className="bg-surface-container-lowest border-sidebar-border overflow-hidden rounded-xl border shadow-sm">
      <div className="border-sidebar-border flex flex-col gap-4 border-b px-6 py-6 sm:flex-row sm:items-center sm:justify-between">
        <h3 className="text-lg font-bold">{panelTitle}</h3>
        {showScopeToggle && scope && onScopeChange ? (
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => onScopeChange("client")}
              className={cn(
                "rounded-full px-4 py-1.5 text-xs font-bold transition-colors",
                scope === "client"
                  ? "bg-primary text-on-primary"
                  : "bg-surface-container-low text-on-surface-variant hover:bg-surface-container-high",
              )}
            >
              {tr("Ce client", "هذا العميل")}
            </button>
            <button
              type="button"
              onClick={() => onScopeChange("all")}
              className={cn(
                "rounded-full px-4 py-1.5 text-xs font-bold transition-colors",
                scope === "all"
                  ? "bg-primary text-on-primary"
                  : "bg-surface-container-low text-on-surface-variant hover:bg-surface-container-high",
              )}
            >
              {tr("Tout le magasin", "كل المتجر")}
            </button>
          </div>
        ) : null}
      </div>

      <div className="border-sidebar-border bg-surface-container-low/40 space-y-4 border-b px-6 py-4">
        {!fixedKind ? (
          <div
            className="bg-surface-container-low flex w-full max-w-xl gap-1 rounded-xl p-1"
            role="tablist"
            aria-label={tr("Type d'écriture", "نوع القيد")}
          >
            {(
              [
                ["all", tr("Tous", "الكل")],
                ["invoice", tr("Factures", "الفواتير")],
                ["payment", tr("Paiements", "المدفوعات")],
                ["return", tr("Retours", "الإرجاعات")],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                role="tab"
                aria-selected={historyKindFilter === value}
                onClick={() => setHistoryKindFilter(value)}
                className={cn(
                  "flex-1 rounded-lg px-2 py-2 text-xs font-bold transition-colors sm:px-3",
                  historyKindFilter === value
                    ? "bg-primary text-on-primary shadow-sm"
                    : "text-on-surface-variant hover:bg-surface-container-high",
                )}
              >
                {label}
              </button>
            ))}
          </div>
        ) : null}

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {showClientFilter ? (
            <InvoiceClientFilter
              selectedClientId={filterClientId}
              onClientChange={setFilterClientId}
              tr={tr}
              className="sm:col-span-2 lg:col-span-1"
            />
          ) : null}
          <div>
            <label className="text-on-surface-variant mb-2 ml-1 block text-[10px] font-bold uppercase">
              {tr("Statut", "الحالة")}
            </label>
            <select
              value={historyStatusFilter}
              onChange={(e) =>
                setHistoryStatusFilter(e.target.value as HistoryStatusFilter)
              }
              className={filterSelectClass}
            >
              <option value="all">{tr("Tous", "الكل")}</option>
              {fixedKind === "invoice" ? (
                <>
                  <option value="impayé">{tr("Impayée", "غير مدفوعة")}</option>
                  <option value="solde">{tr("Soldée", "مسددة")}</option>
                </>
              ) : fixedKind === "payment" || fixedKind === "return" ? (
                <option value="valide">{tr("Validé", "مؤكد")}</option>
              ) : (
                <>
                  <option value="valide">{tr("Validé", "مؤكد")}</option>
                  <option value="impayé">{tr("Impayée", "غير مدفوعة")}</option>
                  <option value="solde">{tr("Soldé", "مسدد")}</option>
                </>
              )}
            </select>
          </div>
          <div>
            <label className="text-on-surface-variant mb-2 ml-1 block text-[10px] font-bold uppercase">
              {tr("Origine", "المصدر")}
            </label>
            <select
              value={historySourceFilter}
              onChange={(e) =>
                setHistorySourceFilter(e.target.value as HistorySourceFilter)
              }
              className={filterSelectClass}
            >
              <option value="all">{tr("Toutes", "الكل")}</option>
              <option value="plan">{tr("Plan", "خطة")}</option>
              <option value="pos">{tr("Caisse POS", "نقطة البيع")}</option>
              <option value="return">{tr("Retours", "الإرجاعات")}</option>
              <option value="other">{tr("Autre", "أخرى")}</option>
            </select>
          </div>
          {showVerification ? (
            <div>
              <label className="text-on-surface-variant mb-2 ml-1 block text-[10px] font-bold uppercase">
                {tr("Vérification", "التحقق")}
              </label>
              <select
                value={historyVerificationFilter}
                onChange={(e) =>
                  setHistoryVerificationFilter(
                    e.target.value as HistoryVerificationFilter,
                  )
                }
                className={filterSelectClass}
              >
                <option value="all">{tr("Toutes", "الكل")}</option>
                <option value="verified">{tr("Vérifié", "تم التحقق")}</option>
                <option value="unverified">
                  {tr("Non vérifié", "غير محقق")}
                </option>
              </select>
            </div>
          ) : null}
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-12 lg:items-end">
          <div className="lg:col-span-5">
            <label className="text-on-surface-variant mb-2 ml-1 block text-[10px] font-bold uppercase">
              {tr("Recherche", "بحث")}
            </label>
            <div className="relative">
              <Search
                className="text-outline pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 stroke-[1.75]"
                aria-hidden
              />
              <Input
                value={historySearch}
                onChange={(e) => setHistorySearch(e.target.value)}
                placeholder={
                  scopeAll
                    ? tr("Réf., note, nom ou téléphone…", "مرجع، ملاحظة، اسم أو هاتف…")
                    : tr("Référence, note…", "مرجع، ملاحظة…")
                }
                className="bg-surface-container-lowest border-transparent h-11 rounded-xl pr-3 pl-10"
                aria-label={tr("Filtrer l'historique", "تصفية السجل")}
              />
            </div>
          </div>
          <div className="sm:col-span-1 lg:col-span-3">
            <label className="text-on-surface-variant mb-2 ml-1 block text-[10px] font-bold uppercase">
              {tr("Du", "من")}
            </label>
            <FrenchDateInput
              value={historyDateFrom}
              onValueChange={setHistoryDateFrom}
              className="bg-surface-container-lowest border-transparent h-11 rounded-xl font-medium"
            />
          </div>
          <div className="sm:col-span-1 lg:col-span-3">
            <label className="text-on-surface-variant mb-2 ml-1 block text-[10px] font-bold uppercase">
              {tr("Au", "إلى")}
            </label>
            <FrenchDateInput
              value={historyDateTo}
              onValueChange={setHistoryDateTo}
              className="bg-surface-container-lowest border-transparent h-11 rounded-xl font-medium"
            />
          </div>
          <div className="lg:col-span-1 lg:flex lg:justify-end">
            <Button
              type="button"
              variant="outline"
              disabled={!historyFiltersActive}
              onClick={resetHistoryFilters}
              className="h-11 w-full rounded-xl font-bold lg:w-auto lg:min-w-[7rem]"
            >
              {tr("Réinitialiser", "إعادة تعيين")}
            </Button>
          </div>
        </div>

        {historyFiltersActive && tableEntries.length > 0 ? (
          <p className="text-on-surface-variant text-xs font-medium">
            <span className="text-on-surface font-bold tabular-nums">
              {historyFilteredEntries.length}
            </span>{" "}
            {tr("résultat", "نتيجة")}
            {historyFilteredEntries.length !== 1 ? tr("s", "") : ""}{" "}
            {tr("sur", "من")}{" "}
            <span className="tabular-nums">{tableEntries.length}</span>{" "}
            {tr("mouvement", "حركة")}
            {tableEntries.length !== 1 ? tr("s", "") : ""}
          </p>
        ) : null}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] border-collapse">
          <thead>
            <tr className="bg-surface-container-low/50">
              {scopeAll ? (
                <SortableTh
                  column="client"
                  activeColumn={sortColumn}
                  direction={sortDirection}
                  onSort={handleSort}
                >
                  {tr("Client", "العميل")}
                </SortableTh>
              ) : null}
              <SortableTh
                column="date"
                activeColumn={sortColumn}
                direction={sortDirection}
                onSort={handleSort}
              >
                {tr("Date", "التاريخ")}
              </SortableTh>
              <SortableTh
                column="type"
                activeColumn={sortColumn}
                direction={sortDirection}
                onSort={handleSort}
              >
                {tr("Type / Ref", "النوع / المرجع")}
              </SortableTh>
              <th className="text-on-surface-variant px-6 py-4 text-left text-[10px] font-bold tracking-wider uppercase">
                {tr("Note", "ملاحظة")}
              </th>
              <SortableTh
                column="source"
                activeColumn={sortColumn}
                direction={sortDirection}
                onSort={handleSort}
              >
                {tr("Origine", "المصدر")}
              </SortableTh>
              <SortableTh
                column="montant"
                activeColumn={sortColumn}
                direction={sortDirection}
                onSort={handleSort}
                align="end"
              >
                {tr("Montant", "المبلغ")}
              </SortableTh>
              {runningSoldeEnabled ? (
                <th className="text-on-surface-variant px-4 py-4 text-right text-[10px] font-bold tracking-wider uppercase">
                  {tr("Solde", "الرصيد")}
                </th>
              ) : null}
              {showVerification ? (
                <th className="text-on-surface-variant min-w-[7.25rem] px-4 py-4 text-right text-[10px] font-bold tracking-wider uppercase">
                  {tr("Vérification", "التحقق")}
                </th>
              ) : null}
              <SortableTh
                column="statut"
                activeColumn={sortColumn}
                direction={sortDirection}
                onSort={handleSort}
                align="end"
                className="min-w-[5.75rem] px-4"
              >
                {tr("Statut", "الحالة")}
              </SortableTh>
              {canDeletePayment ? (
                <th className="text-on-surface-variant px-4 py-4 text-right text-[10px] font-bold tracking-wider uppercase">
                  {tr("Actions", "إجراءات")}
                </th>
              ) : null}
            </tr>
          </thead>
          <tbody className="divide-sidebar-border divide-y">
            {tableEntries.length === 0 ? (
              <tr>
                <td
                  colSpan={colCount}
                  className="text-on-surface-variant px-6 py-8 text-center text-sm"
                >
                  {tr("Aucun mouvement.", "لا توجد حركات.")}
                </td>
              </tr>
            ) : historyFilteredEntries.length === 0 ? (
              <tr>
                <td
                  colSpan={colCount}
                  className="text-on-surface-variant px-6 py-8 text-center text-sm"
                >
                  <p>
                    {tr(
                      "Aucun résultat pour ces filtres.",
                      "لا توجد نتائج لهذه الفلاتر.",
                    )}
                  </p>
                  <Button
                    type="button"
                    variant="link"
                    className="text-primary mt-2 h-auto p-0 font-bold"
                    onClick={resetHistoryFilters}
                  >
                    {tr("Réinitialiser les filtres", "إعادة تعيين الفلاتر")}
                  </Button>
                </td>
              </tr>
            ) : (
              sortedLedgerEntries.map((row) => {
                const rowClient = clients.find((c) => c.id === row.clientId);
                const origin = ledgerSourceLabel(row);
                const isReturnRow = isLedgerReturn(row);
                const isPaymentRow = isLedgerPayment(row);
                const soldeAfter = runningSoldeByEntryId?.get(row.id);
                const timeLabel = resolveLedgerTime(row);
                return (
                  <tr
                    key={row.id}
                    className={cn("transition-colors", ledgerRowClass(row))}
                  >
                    {scopeAll ? (
                      <td className="px-6 py-4">
                        {onOpenClientFiche ? (
                          <button
                            type="button"
                            onClick={() => onOpenClientFiche(row.clientId)}
                            className="text-primary hover:text-primary/80 text-left text-sm font-semibold underline-offset-2 hover:underline"
                          >
                            {rowClient?.fullName ?? row.clientId}
                          </button>
                        ) : (
                          <span className="text-sm font-semibold">
                            {rowClient?.fullName ?? row.clientId}
                          </span>
                        )}
                      </td>
                    ) : null}
                    <td className="px-6 py-4">
                      <p className="text-sm font-bold">
                        {formatLedgerDate(row.date)}
                      </p>
                      <p className="text-on-surface-variant text-[10px] font-medium uppercase">
                        {timeLabel ? (
                          <span className="tabular-nums normal-case">
                            {timeLabel}
                          </span>
                        ) : null}
                        {timeLabel ? " · " : null}
                        {formatWeekday(row.date)}
                      </p>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <span
                          className={cn(
                            "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg",
                            ledgerIconClass(row),
                          )}
                        >
                          {isPaymentRow ? (
                            <Banknote
                              className="size-4 stroke-[1.75]"
                              aria-hidden
                            />
                          ) : isReturnRow ? (
                            <RotateCcw
                              className="size-4 stroke-[1.75]"
                              aria-hidden
                            />
                          ) : (
                            <FileText
                              className="size-4 stroke-[1.75]"
                              aria-hidden
                            />
                          )}
                        </span>
                        <div className="min-w-0">
                          <p className="text-on-surface-variant text-[10px] font-medium uppercase">
                            {ledgerKindLabel(row, isAr)}
                          </p>
                          <div className="flex min-w-0 flex-wrap items-center gap-1.5">
                            {row.invoiceId ? (
                              <Link
                                href={`/${locale}/factures/${row.invoiceId}`}
                                className="text-primary hover:text-primary/80 truncate text-sm font-semibold underline-offset-2 hover:underline"
                              >
                                {row.ref}
                              </Link>
                            ) : (
                              <p className="truncate text-sm font-semibold">
                                {row.ref}
                              </p>
                            )}
                            {row.kind === "invoice" &&
                            (row.returnedArticlesQty ?? 0) > 0 ? (
                              <span
                                className="bg-orange-100 text-orange-700 shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold tabular-nums"
                                title={tr(
                                  `${row.returnedArticlesQty} article(s) retourné(s)`,
                                  `${row.returnedArticlesQty} قطعة مرتجعة`,
                                )}
                              >
                                {row.returnedArticlesQty}{" "}
                                {tr("ret.", "مرتجع")}
                              </span>
                            ) : null}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-on-surface-variant text-sm">
                        {row.note}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span
                        title={origin.title}
                        className="text-on-surface-variant text-sm font-medium"
                      >
                        {origin.short}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <span
                        className={cn(
                          "text-sm font-bold tabular-nums",
                          ledgerAmountClass(row),
                        )}
                      >
                        {ledgerAmountSign(row)}{" "}
                        {formatMad(row.amountMad, 2, locale)}
                      </span>
                    </td>
                    {runningSoldeEnabled ? (
                      <td className="px-4 py-4 text-right">
                        {soldeAfter == null ? (
                          <span className="text-on-surface-variant text-sm">
                            —
                          </span>
                        ) : (
                          <span
                            className={cn(
                              "text-sm font-bold tabular-nums",
                              soldeToneClass(soldeAfter),
                            )}
                            title={tr(
                              "Solde après ce mouvement",
                              "الرصيد بعد هذه الحركة",
                            )}
                          >
                            {formatMad(soldeAfter, 2, locale)}
                          </span>
                        )}
                      </td>
                    ) : null}
                    {showVerification ? (
                      <td className="px-4 py-4">
                        <div className="flex justify-end">
                          {row.kind === "invoice" ? (
                            <span
                              className={cn(
                                ledgerBadgeBaseClass,
                                verificationBadgeClass(row.invoiceVerified),
                              )}
                            >
                              {verificationLabel(row.invoiceVerified, isAr)}
                            </span>
                          ) : (
                            <span className="text-on-surface-variant text-sm">
                              —
                            </span>
                          )}
                        </div>
                      </td>
                    ) : null}
                    <td className="px-4 py-4">
                      <div className="flex justify-end">
                        <span
                          className={cn(
                            ledgerBadgeBaseClass,
                            statusBadgeClass(row.status),
                          )}
                        >
                          {statusLabel(row.status, isAr, {
                            feminine: row.kind === "invoice",
                          })}
                        </span>
                      </div>
                    </td>
                    {canDeletePayment ? (
                      <td className="px-3 py-4 text-right">
                        {isPaymentRow ? (
                          <button
                            type="button"
                            className="text-on-surface-variant hover:bg-error-container hover:text-on-error-container inline-flex size-8 items-center justify-center rounded-lg"
                            aria-label={tr(
                              `Supprimer le paiement ${row.ref}`,
                              `حذف الدفعة ${row.ref}`,
                            )}
                            onClick={() => setPaymentToDelete(row)}
                          >
                            <Trash2
                              className="size-4 stroke-[1.75]"
                              aria-hidden
                            />
                          </button>
                        ) : null}
                      </td>
                    ) : null}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <ConfirmDeleteDialog
        open={paymentToDelete != null}
        onOpenChange={(open) => {
          if (!open && !deletingPayment) setPaymentToDelete(null);
        }}
        entityName={
          paymentToDelete
            ? `${paymentToDelete.ref} · ${formatMad(paymentToDelete.amountMad, 2, locale)}`
            : ""
        }
        confirmText={paymentToDelete?.ref ?? ""}
        title={tr("Supprimer ce paiement ?", "حذف هذه الدفعة؟")}
        description={tr(
          "Le paiement sera annulé comme s'il n'avait jamais existé : le solde du client, les factures et le plan lié seront remis à l'état précédent. Tapez la référence exacte pour confirmer.",
          "سيتم إلغاء الدفعة وكأنها لم توجد: سيُعاد رصيد العميل والفواتير والخطة المرتبطة إلى حالتها السابقة. اكتب المرجع تمامًا للتأكيد.",
        )}
        typePrompt={
          paymentToDelete
            ? tr(
                `Tapez « ${paymentToDelete.ref} » pour confirmer`,
                `اكتب « ${paymentToDelete.ref} » للتأكيد`,
              )
            : undefined
        }
        confirmLabel={tr("Supprimer définitivement", "حذف نهائي")}
        cancelLabel={tr("Annuler", "إلغاء")}
        busy={deletingPayment}
        onConfirm={handleConfirmDeletePayment}
      />
    </div>
  );
}
