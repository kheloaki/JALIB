"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocale } from "next-intl";
import { useMutation, useQuery } from "convex/react";
import {
  CheckCircle2,
  Eye,
  ScanLine,
  Search,
  UserRound,
} from "lucide-react";

import {
  CreditsInvoiceVerificationPreviewDialog,
  type CreditInvoiceVerificationRow,
} from "@/components/credits/credits-invoice-verification-preview-dialog";
import { BarcodeScanDialog } from "@/components/products/barcode-scan-dialog";
import { InlineTableSkeleton } from "@/components/skeletons";
import { BulkActionBar } from "@/components/tables/bulk-action-bar";
import { TableSelectCheckbox } from "@/components/tables/table-select-checkbox";
import { Button } from "@/components/ui/button";
import { SortableTh } from "@/components/ui/sortable-th";
import { useToast } from "@/components/ui/toaster";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { useClientTableSort } from "@/hooks/use-client-table-sort";
import { useRowSelection } from "@/hooks/use-row-selection";
import { formatDateFr } from "@/lib/dates/format-date";
import { normalizeInvoiceBarcode } from "@/lib/invoices/barcode";
import { formatPosDh } from "@/lib/pos/format-pos-dh";
import { statusPillClass } from "@/lib/ui/status-pill";
import { cn } from "@/lib/utils";

type VerificationSortColumn =
  | "facture"
  | "client"
  | "date"
  | "montant"
  | "statut";

function compareVerificationRows(
  a: CreditInvoiceVerificationRow,
  b: CreditInvoiceVerificationRow,
  column: VerificationSortColumn,
): number {
  switch (column) {
    case "facture":
      return a.number.localeCompare(b.number, "fr", { numeric: true });
    case "client":
      return a.clientName.localeCompare(b.clientName, "fr");
    case "date": {
      const dateCmp = a.date.localeCompare(b.date);
      if (dateCmp !== 0) return dateCmp;
      return (a.time || "").localeCompare(b.time || "");
    }
    case "montant":
      return a.totalMad - b.totalMad;
    case "statut":
      return a.status.localeCompare(b.status);
    default:
      return 0;
  }
}

function rowMatchesSearch(
  row: CreditInvoiceVerificationRow,
  query: string,
): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const digits = q.replace(/\D/g, "");
  if (row.number.toLowerCase().includes(q)) return true;
  if (row.clientName.toLowerCase().includes(q)) return true;
  if (row.barcode.toLowerCase().includes(q)) return true;
  if (digits.length > 0) {
    const barcodeDigits = row.barcode.replace(/\D/g, "");
    if (barcodeDigits.includes(digits)) return true;
  }
  return false;
}

export function CreditsVerificationPanel({
  tr,
  headerSearchQuery,
  onOpenClientFiche,
}: {
  tr: (fr: string, ar: string) => string;
  headerSearchQuery: string;
  onOpenClientFiche: (clientId: string) => void;
}) {
  const locale = useLocale();
  const toast = useToast();
  const unverifiedRows = useQuery(api.invoiceVerification.listUnverifiedCreditInvoices, {
    limit: 150,
  });
  const verifyInvoice = useMutation(api.invoiceVerification.verifyInvoice);
  const verifyMany = useMutation(api.invoiceVerification.verifyMany);

  const [scanOpen, setScanOpen] = useState(false);
  const [previewInvoice, setPreviewInvoice] =
    useState<CreditInvoiceVerificationRow | null>(null);
  const [verifyMethod, setVerifyMethod] = useState<"manual" | "barcode_scan">(
    "manual",
  );
  const [verifying, setVerifying] = useState(false);
  const [lookupBarcode, setLookupBarcode] = useState<string | null>(null);

  const scannedInvoice = useQuery(
    api.invoiceVerification.getCreditInvoiceByBarcode,
    lookupBarcode ? { barcode: lookupBarcode } : "skip",
  );

  const loading = unverifiedRows === undefined;
  const rows = unverifiedRows ?? [];
  const trimmedSearch = headerSearchQuery.trim();
  const filteredRows = useMemo(
    () => rows.filter((row) => rowMatchesSearch(row, headerSearchQuery)),
    [headerSearchQuery, rows],
  );
  const compare = useCallback(compareVerificationRows, []);
  const {
    sortColumn,
    sortDirection,
    handleSort,
    sortedRows,
  } = useClientTableSort({
    rows: filteredRows,
    initialColumn: "date" as VerificationSortColumn,
    initialDirection: "desc",
    compare,
  });
  const visibleIds = useMemo(
    () => sortedRows.map((row) => row.id),
    [sortedRows],
  );
  const selection = useRowSelection(visibleIds);

  const statusLabel = useCallback(
    (status: CreditInvoiceVerificationRow["status"]) => {
      if (status === "paid") return tr("Soldée", "مسددة");
      if (status === "returned") return tr("Retournée", "مرتجعة");
      return tr("En cours", "قيد السداد");
    },
    [tr],
  );

  const openPreview = useCallback(
    (
      invoice: CreditInvoiceVerificationRow,
      method: "manual" | "barcode_scan" = "manual",
    ) => {
      setVerifyMethod(method);
      setPreviewInvoice(invoice);
    },
    [],
  );

  const handleBarcodeLookup = useCallback(
    (raw: string) => {
      const code = normalizeInvoiceBarcode(raw);
      if (!code) {
        toast.error(
          tr("Code-barres invalide", "رمز شريطي غير صالح"),
          tr("Réessayez.", "حاول مجددًا."),
        );
        return;
      }
      setLookupBarcode(code);
    },
    [toast, tr],
  );

  const handleScan = useCallback(
    (raw: string) => {
      setScanOpen(false);
      handleBarcodeLookup(raw);
    },
    [handleBarcodeLookup],
  );

  useEffect(() => {
    if (lookupBarcode == null || scannedInvoice === undefined) return;
    if (!scannedInvoice) {
      toast.error(
        tr("Facture introuvable", "الفاتورة غير موجودة"),
        tr(
          "Aucune facture crédit pour ce code-barres.",
          "لا توجد فاتورة آجل لهذا الرمز.",
        ),
      );
      setLookupBarcode(null);
      return;
    }
    openPreview(scannedInvoice, "barcode_scan");
    setLookupBarcode(null);
  }, [lookupBarcode, openPreview, scannedInvoice, toast, tr]);

  const handleSearchAll = useCallback(() => {
    const q = trimmedSearch;
    if (!q) {
      toast.error(
        tr("Recherche vide", "بحث فارغ"),
        tr(
          "Utilisez la barre de recherche en haut.",
          "استخدم شريط البحث في الأعلى.",
        ),
      );
      return;
    }

    const normalizedBarcode = normalizeInvoiceBarcode(q);
    if (normalizedBarcode.length >= 6) {
      handleBarcodeLookup(q);
      return;
    }

    if (filteredRows.length === 1) {
      openPreview(filteredRows[0]!, "manual");
      return;
    }

    if (filteredRows.length === 0) {
      toast.error(
        tr("Aucune facture trouvée", "لم تُعثر على فاتورة"),
        tr(
          "Essayez un numéro, un client ou un code-barres.",
          "جرّب رقمًا أو عميلًا أو رمزًا شريطيًا.",
        ),
      );
    }
  }, [
    filteredRows,
    handleBarcodeLookup,
    openPreview,
    toast,
    tr,
    trimmedSearch,
  ]);

  async function confirmVerify() {
    if (!previewInvoice || verifying) return;
    setVerifying(true);
    try {
      const result = await verifyInvoice({
        invoiceId: previewInvoice.id,
        method: verifyMethod,
      });
      setPreviewInvoice(null);
      if (result.alreadyVerified) {
        toast.success(
          tr("Déjà vérifiée", "تم التحقق مسبقًا"),
          result.invoice.number,
        );
      } else {
        toast.success(
          tr("Facture vérifiée", "تم التحقق من الفاتورة"),
          result.invoice.number,
        );
      }
    } catch (error) {
      toast.error(
        tr("Vérification impossible", "تعذر التحقق"),
        error instanceof Error ? error.message : tr("Réessayez.", "حاول مجددًا."),
      );
    } finally {
      setVerifying(false);
    }
  }

  async function handleBulkVerify() {
    if (selection.selectedCount === 0 || verifying) return;
    setVerifying(true);
    try {
      const result = await verifyMany({
        invoiceIds: selection.selectedIdList as Id<"invoices">[],
        method: "manual",
      });
      selection.clear();
      toast.success(
        tr("Vérification groupée", "تحقق جماعي"),
        tr(
          `${result.verified} vérifiée(s)${result.alreadyVerified ? `, ${result.alreadyVerified} déjà OK` : ""}${result.failed ? `, ${result.failed} échec(s)` : ""}.`,
          `${result.verified} تم التحقق${result.alreadyVerified ? `، ${result.alreadyVerified} مسبقًا` : ""}${result.failed ? `، ${result.failed} فشل` : ""}.`,
        ),
      );
    } catch (error) {
      toast.error(
        tr("Vérification impossible", "تعذر التحقق"),
        error instanceof Error ? error.message : tr("Réessayez.", "حاول مجددًا."),
      );
    } finally {
      setVerifying(false);
    }
  }

  return (
    <>
      <div className="flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-2">
          <Button
            type="button"
            className="from-primary to-primary-container h-11 gap-2 rounded-xl bg-linear-to-br font-bold text-white"
            onClick={() => setScanOpen(true)}
          >
            <ScanLine className="size-4 stroke-[1.75]" aria-hidden />
            {tr("Scanner facture", "مسح الفاتورة")}
          </Button>
          <Button
            type="button"
            variant="outline"
            className="h-11 gap-2 rounded-xl font-bold"
            onClick={handleSearchAll}
          >
            <Search className="size-4 stroke-[1.75]" aria-hidden />
            {tr("Rechercher tout", "بحث شامل")}
          </Button>
        </div>

        <div className="bg-surface-container-lowest border-sidebar-border overflow-hidden rounded-xl border shadow-sm">
          <div className="border-sidebar-border flex items-center justify-between border-b px-6 py-4">
            <h3 className="font-bold">
              {tr("Factures non vérifiées", "فواتير غير مُحقَّقة")}
            </h3>
            <span className="bg-tertiary-fixed text-on-tertiary-fixed rounded-full px-2.5 py-1 text-xs font-bold tabular-nums">
              {loading ? "…" : sortedRows.length}
            </span>
          </div>

          {loading ? (
            <InlineTableSkeleton cols={6} rows={5} />
          ) : rows.length === 0 ? (
            <p className="text-secondary px-6 py-10 text-center text-sm font-semibold">
              {tr(
                "Toutes les factures crédit récentes sont vérifiées.",
                "جميع فواتير الآجل الأخيرة تم التحقق منها.",
              )}
            </p>
          ) : sortedRows.length === 0 ? (
            <p className="text-on-surface-variant px-6 py-10 text-center text-sm">
              {tr(
                "Aucune facture ne correspond à la recherche.",
                "لا توجد فاتورة تطابق البحث.",
              )}
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[860px] border-collapse">
                <thead>
                  <tr className="bg-surface-container-low/50">
                    <th className="w-10 px-4 py-3">
                      <TableSelectCheckbox
                        checked={selection.allVisibleSelected}
                        indeterminate={selection.someVisibleSelected}
                        onChange={selection.toggleAllVisible}
                        aria-label={tr("Tout sélectionner", "تحديد الكل")}
                      />
                    </th>
                    <SortableTh
                      column="facture"
                      activeColumn={sortColumn}
                      direction={sortDirection}
                      onSort={handleSort}
                      className="px-4 py-3"
                    >
                      {tr("Facture", "فاتورة")}
                    </SortableTh>
                    <SortableTh
                      column="client"
                      activeColumn={sortColumn}
                      direction={sortDirection}
                      onSort={handleSort}
                      className="px-4 py-3"
                    >
                      {tr("Client", "العميل")}
                    </SortableTh>
                    <SortableTh
                      column="date"
                      activeColumn={sortColumn}
                      direction={sortDirection}
                      onSort={handleSort}
                      className="px-4 py-3"
                    >
                      {tr("Date", "التاريخ")}
                    </SortableTh>
                    <SortableTh
                      column="montant"
                      activeColumn={sortColumn}
                      direction={sortDirection}
                      onSort={handleSort}
                      align="end"
                      className="px-4 py-3"
                    >
                      {tr("Montant", "المبلغ")}
                    </SortableTh>
                    <SortableTh
                      column="statut"
                      activeColumn={sortColumn}
                      direction={sortDirection}
                      onSort={handleSort}
                      className="px-4 py-3"
                    >
                      {tr("Statut", "الحالة")}
                    </SortableTh>
                    <th className="text-on-surface-variant px-4 py-3 text-right text-[10px] font-bold tracking-wider uppercase">
                      {tr("Actions", "إجراءات")}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-sidebar-border divide-y">
                  {sortedRows.map((row) => (
                    <tr
                      key={row.id}
                      className={cn(
                        "hover:bg-surface-container-low/40 transition-colors",
                        selection.isSelected(row.id) && "bg-primary/10",
                      )}
                    >
                      <td className="px-4 py-3">
                        <TableSelectCheckbox
                          checked={selection.isSelected(row.id)}
                          onChange={() => selection.toggle(row.id)}
                          aria-label={tr(
                            `Sélectionner ${row.number}`,
                            `تحديد ${row.number}`,
                          )}
                        />
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-mono text-sm font-bold">{row.number}</p>
                        <p className="text-on-surface-variant mt-0.5 font-mono text-[10px]">
                          {row.barcode}
                        </p>
                      </td>
                      <td className="px-4 py-3 text-sm font-semibold">{row.clientName}</td>
                      <td className="text-on-surface-variant px-4 py-3 text-sm tabular-nums">
                        {formatDateFr(row.date)}
                        <span className="text-outline ms-1">{row.time}</span>
                      </td>
                      <td className="px-4 py-3 text-right text-sm font-bold tabular-nums">
                        {formatPosDh(row.totalMad, 2, locale)}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={cn(
                            statusPillClass,
                            "px-2 py-0.5 text-[10px] font-bold uppercase",
                            row.status === "paid" &&
                              "bg-secondary-container text-on-secondary-container",
                            row.status === "pending" &&
                              "bg-tertiary-fixed text-on-tertiary-fixed",
                            row.status === "returned" &&
                              "bg-surface-container-high text-on-surface-variant",
                          )}
                        >
                          {statusLabel(row.status)}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1.5">
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="border-primary/30 bg-primary/10 text-primary hover:bg-primary/15 h-8 gap-1 rounded-lg px-2 text-xs font-bold"
                            onClick={() => openPreview(row)}
                            title={tr("Aperçu rapide", "معاينة سريعة")}
                          >
                            <Eye className="size-3.5 stroke-[1.75]" aria-hidden />
                            {tr("Voir", "عرض")}
                          </Button>
                          {row.clientId ? (
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              className="border-tertiary/30 bg-tertiary-fixed/35 text-tertiary h-8 gap-1 rounded-lg px-2 text-xs font-bold"
                              onClick={() => onOpenClientFiche(row.clientId!)}
                              title={tr("Fiche client", "بطاقة العميل")}
                            >
                              <UserRound className="size-3.5 stroke-[1.75]" aria-hidden />
                              {tr("Fiche", "بطاقة")}
                            </Button>
                          ) : null}
                          <Button
                            type="button"
                            size="sm"
                            className="from-secondary to-on-secondary-container h-8 gap-1 rounded-lg bg-linear-to-br px-2 text-xs font-bold text-white"
                            onClick={() => openPreview(row)}
                          >
                            <CheckCircle2 className="size-3.5 stroke-[1.75]" aria-hidden />
                            {tr("Vérifier", "تحقق")}
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <BulkActionBar
          selectedCount={selection.selectedCount}
          itemLabel={tr("facture sélectionnée", "فاتورة محددة")}
          itemLabelPlural={tr("factures sélectionnées", "فواتير محددة")}
          clearLabel={tr("Effacer la sélection", "مسح التحديد")}
          onClear={selection.clear}
          actions={[
            {
              key: "verify",
              label: tr("Vérifier", "تحقق"),
              icon: (
                <CheckCircle2 className="size-3.5 stroke-[1.75]" aria-hidden />
              ),
              disabled: verifying,
              onClick: () => void handleBulkVerify(),
            },
          ]}
        />
      </div>

      <BarcodeScanDialog
        open={scanOpen}
        onOpenChange={setScanOpen}
        onScan={handleScan}
      />

      <CreditsInvoiceVerificationPreviewDialog
        invoice={previewInvoice}
        open={previewInvoice != null}
        onOpenChange={(open) => {
          if (!open && !verifying) setPreviewInvoice(null);
        }}
        locale={locale}
        tr={tr}
        onOpenClientFiche={(clientId) => {
          onOpenClientFiche(clientId);
        }}
        onVerify={() => void confirmVerify()}
        verifying={verifying}
        verifyMethod={verifyMethod}
      />
    </>
  );
}
