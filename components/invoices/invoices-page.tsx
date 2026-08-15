"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { flushSync } from "react-dom";
import { useConvex, useMutation, usePaginatedQuery, useQuery } from "convex/react";
import { useRouter } from "next/navigation";
import { useLocale } from "next-intl";
import {
  Calendar,
  Eye,
  FileDown,
  Filter,
  Printer,
  ScanBarcode,
  Trash2,
} from "lucide-react";

import { BulkPdfDownloadDialog } from "@/components/invoices/bulk-pdf-download-dialog";
import { InvoiceClientFilter } from "@/components/invoices/invoice-client-filter";
import {
  InvoiceReceiptPreview,
  type InvoiceReceiptMode,
} from "@/components/invoices/invoice-receipt-preview";
import { InvoiceReceiptActions } from "@/components/invoices/invoice-receipt-actions";
import { WhatsAppShareButton } from "@/components/share/whatsapp-share-button";
import { BulkActionBar } from "@/components/tables/bulk-action-bar";
import { TableSelectCheckbox } from "@/components/tables/table-select-checkbox";
import { SortableTh } from "@/components/ui/sortable-th";
import { useAdminChrome } from "@/components/layout/admin-chrome-context";
import { AdminFilterSummary } from "@/components/layout/admin-filter-summary";
import { InvoicesPageSkeleton } from "@/components/skeletons";
import { BarcodeScanDialog } from "@/components/products/barcode-scan-dialog";
import { useClientTableSort } from "@/hooks/use-client-table-sort";
import { useRowSelection } from "@/hooks/use-row-selection";
import type {
  Invoice,
  InvoicePaymentType,
  InvoiceStatus,
  InvoiceSummary,
} from "@/lib/invoices/types";
import { normalizeInvoiceBarcode } from "@/lib/invoices/barcode";
import { Button } from "@/components/ui/button";
import { ConfirmDeleteDialog } from "@/components/ui/confirm-delete-dialog";
import { FrenchDateInput } from "@/components/ui/french-date-input";
import { useToast } from "@/components/ui/toaster";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { useLoadMoreOnIntersect } from "@/hooks/use-load-more-on-intersect";
import {
  canDeleteInvoices,
  canDownloadInvoicePdf,
} from "@/lib/auth/permissions";
import { invoiceFromConvex, invoiceSummaryFromConvex } from "@/lib/convex/mappers";
import {
  buildInvoicePdfBlob,
  downloadInvoicePdf,
  downloadInvoicesPdfCombined,
  downloadInvoicesPdfSeparate,
} from "@/lib/invoices/download-invoice-pdf";
import { invoiceWhatsAppShareMessage } from "@/lib/invoices/invoice-share-message";
import { sharePdfViaWhatsApp, whatsAppShareToastCopy } from "@/lib/share/share-pdf-whatsapp";
import { usePdfShareUpload } from "@/hooks/use-pdf-share-upload";
import { formatDateFr } from "@/lib/dates/format-date";
import { printElementById } from "@/lib/print/wait-for-print-images";
import { statusPillClass } from "@/lib/ui/status-pill";
import { cn } from "@/lib/utils";

const DEFAULT_PAGE_SIZE = 20;
const PAGE_SIZE_OPTIONS = [20, 50] as const;
/** Soft cap when selecting every matching invoice across pages. */
const SELECT_ALL_MAX = 2000;

function formatTableDate(iso: string): string {
  return formatDateFr(iso);
}

function formatTableDateTime(date: string, time?: string | null): string {
  const d = formatTableDate(date);
  const t = time?.trim();
  return t ? `${d} ${t}` : d;
}

function formatTableMoney(n: number): string {
  return n.toLocaleString("fr-FR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function paymentBadgeClass(t: InvoicePaymentType): string {
  return t === "cash"
    ? "bg-surface-container-highest text-on-surface-variant"
    : "bg-tertiary-fixed-dim/35 text-tertiary border border-tertiary/25";
}

function paymentLabel(t: InvoicePaymentType, isAr: boolean): string {
  if (isAr) return t === "cash" ? "نقدًا" : "آجل";
  return t === "cash" ? "Espèces" : "Crédit";
}

function statusBadgeClass(s: InvoiceStatus): string {
  if (s === "returned") {
    return "bg-surface-container-highest text-on-surface";
  }
  return s === "paid"
    ? "bg-secondary-container text-on-secondary-container"
    : "bg-error-container/80 text-on-error-container";
}

function statusLabel(s: InvoiceStatus, isAr: boolean): string {
  if (isAr) {
    if (s === "returned") return "مرتجعة";
    return s === "paid" ? "مدفوعة" : "قيد الانتظار";
  }
  if (s === "returned") return "RETOURNÉE";
  return s === "paid" ? "PAYÉ" : "EN ATTENTE";
}

type ListArgs = {
  dateFrom?: string;
  dateTo?: string;
  clientId?: Id<"clients">;
  paymentType?: InvoicePaymentType;
  status?: InvoiceStatus;
};

type InvoiceSortColumn =
  | "number"
  | "date"
  | "client"
  | "type"
  | "total"
  | "status";

const invoiceSortCompare = (
  a: InvoiceSummary,
  b: InvoiceSummary,
  column: InvoiceSortColumn,
): number => {
  switch (column) {
    case "number":
      return a.number.localeCompare(b.number, "fr", { numeric: true });
    case "date": {
      const dateCmp = a.date.localeCompare(b.date);
      if (dateCmp !== 0) return dateCmp;
      return (a.time || "").localeCompare(b.time || "");
    }
    case "client":
      return a.clientName.localeCompare(b.clientName, "fr");
    case "type":
      return a.paymentType.localeCompare(b.paymentType);
    case "total":
      return a.totalMad - b.totalMad;
    case "status":
      return a.status.localeCompare(b.status);
    default:
      return 0;
  }
};

export function InvoicesPage() {
  const [pageSize, setPageSize] =
    useState<(typeof PAGE_SIZE_OPTIONS)[number]>(DEFAULT_PAGE_SIZE);
  const [listKey, setListKey] = useState(0);
  const [activeDateFrom, setActiveDateFrom] = useState("");
  const [activeDateTo, setActiveDateTo] = useState("");
  const [activeClientId, setActiveClientId] = useState<string | null>(null);
  const [activeType, setActiveType] = useState<"all" | InvoicePaymentType>(
    "all",
  );
  const [activeStatus, setActiveStatus] = useState<"all" | InvoiceStatus>(
    "all",
  );

  const remountList = useCallback(() => {
    setListKey((key) => key + 1);
  }, []);

  const handlePageSizeChange = useCallback(
    (size: (typeof PAGE_SIZE_OPTIONS)[number]) => {
      setPageSize(size);
      remountList();
    },
    [remountList],
  );

  const handleApplyFilters = useCallback(
    (
      dateFrom: string,
      dateTo: string,
      clientId: string | null,
      type: "all" | InvoicePaymentType,
      status: "all" | InvoiceStatus,
    ) => {
      setActiveDateFrom(dateFrom);
      setActiveDateTo(dateTo);
      setActiveClientId(clientId);
      setActiveType(type);
      setActiveStatus(status);
      remountList();
    },
    [remountList],
  );

  return (
    <InvoicesPageContent
      key={listKey}
      pageSize={pageSize}
      activeDateFrom={activeDateFrom}
      activeDateTo={activeDateTo}
      activeClientId={activeClientId}
      activeType={activeType}
      activeStatus={activeStatus}
      onPageSizeChange={handlePageSizeChange}
      onApplyFilters={handleApplyFilters}
    />
  );
}

function InvoicesPageContent({
  pageSize,
  activeDateFrom,
  activeDateTo,
  activeClientId,
  activeType,
  activeStatus,
  onPageSizeChange,
  onApplyFilters,
}: {
  pageSize: (typeof PAGE_SIZE_OPTIONS)[number];
  activeDateFrom: string;
  activeDateTo: string;
  activeClientId: string | null;
  activeType: "all" | InvoicePaymentType;
  activeStatus: "all" | InvoiceStatus;
  onPageSizeChange: (size: (typeof PAGE_SIZE_OPTIONS)[number]) => void;
  onApplyFilters: (
    dateFrom: string,
    dateTo: string,
    clientId: string | null,
    type: "all" | InvoicePaymentType,
    status: "all" | InvoiceStatus,
  ) => void;
}) {
  const locale = useLocale();
  const isAr = locale === "ar";
  const tr = useCallback((fr: string, ar: string) => (isAr ? ar : fr), [isAr]);
  const { headerSearchQuery, setHeaderSearchQuery } = useAdminChrome();
  const router = useRouter();
  const toast = useToast();
  const convex = useConvex();
  const uploadShareLink = usePdfShareUpload();
  const settingsRow = useQuery(api.settings.getAppSettings);
  const currentUser = useQuery(api.authz.currentUser);
  const canDownloadPdf = canDownloadInvoicePdf(currentUser?.permissions ?? []);
  const canDelete = canDeleteInvoices(currentUser?.permissions ?? []);
  const removeInvoice = useMutation(api.invoices.remove);
  const hasClientAccess = (currentUser?.permissions ?? []).some(
    (permission) =>
      permission === "clients.view" || permission === "clients.manage",
  );
  const [draftDateFrom, setDraftDateFrom] = useState(activeDateFrom);
  const [draftDateTo, setDraftDateTo] = useState(activeDateTo);
  const [draftClientId, setDraftClientId] = useState<string | null>(
    activeClientId,
  );
  const [draftType, setDraftType] = useState(activeType);
  const [draftStatus, setDraftStatus] = useState(activeStatus);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [receiptMode, setReceiptMode] =
    useState<InvoiceReceiptMode>("client");
  const [scanOpen, setScanOpen] = useState(false);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [sharingId, setSharingId] = useState<string | null>(null);
  const [deleteInvoice, setDeleteInvoice] = useState<InvoiceSummary | null>(
    null,
  );
  const [bulkPdfOpen, setBulkPdfOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [bulkBusy, setBulkBusy] = useState(false);
  const [selectingAll, setSelectingAll] = useState(false);
  const [allMatchingCount, setAllMatchingCount] = useState<number | null>(
    null,
  );

  const listArgs = useMemo<ListArgs>(() => {
    const args: ListArgs = {};
    if (activeDateFrom) args.dateFrom = activeDateFrom;
    if (activeDateTo) args.dateTo = activeDateTo;
    if (activeClientId) args.clientId = activeClientId as Id<"clients">;
    if (activeType !== "all") args.paymentType = activeType;
    // When a client is selected, status can be applied server-side with it.
    // Without client, status filter only when payment type is unconstrained.
    if (activeStatus !== "all") {
      if (activeClientId || activeType === "all") {
        args.status = activeStatus;
      }
    }
    return args;
  }, [
    activeDateFrom,
    activeDateTo,
    activeClientId,
    activeType,
    activeStatus,
  ]);

  const { results, status, loadMore } = usePaginatedQuery(
    api.invoices.listSummaries,
    listArgs,
    { initialNumItems: pageSize },
  );

  const summaries = useMemo(() => {
    let rows = results.map(invoiceSummaryFromConvex);
    // When type + status without client, status is filtered client-side.
    if (
      !activeClientId &&
      activeType !== "all" &&
      activeStatus !== "all"
    ) {
      rows = rows.filter((row) => row.status === activeStatus);
    }
    return rows;
  }, [results, activeClientId, activeType, activeStatus]);

  const isLoadingInvoices = status === "LoadingFirstPage";

  const applyFilters = useCallback(() => {
    onApplyFilters(
      draftDateFrom,
      draftDateTo,
      draftClientId,
      draftType,
      draftStatus,
    );
  }, [
    draftDateFrom,
    draftDateTo,
    draftClientId,
    draftType,
    draftStatus,
    onApplyFilters,
  ]);

  const filtered = useMemo(() => {
    const q = headerSearchQuery.trim().toLowerCase();
    if (!q) return summaries;
    return summaries.filter((inv) => {
      const num = inv.number.toLowerCase();
      const client = inv.clientName.toLowerCase();
      const barcode = normalizeInvoiceBarcode(inv.barcode);
      const barcodeQuery = normalizeInvoiceBarcode(q);
      return (
        num.includes(q) ||
        client.includes(q) ||
        `#${num}`.includes(q) ||
        (!!barcodeQuery && barcode === barcodeQuery)
      );
    });
  }, [summaries, headerSearchQuery]);

  const {
    sortColumn,
    sortDirection,
    handleSort,
    sortedRows: sortedInvoices,
  } = useClientTableSort({
    rows: filtered,
    initialColumn: "date" as InvoiceSortColumn,
    initialDirection: "desc",
    compare: invoiceSortCompare,
  });

  const visibleInvoiceIds = useMemo(
    () => sortedInvoices.map((inv) => inv.id),
    [sortedInvoices],
  );
  const selection = useRowSelection(visibleInvoiceIds);

  useEffect(() => {
    selection.clear();
    setAllMatchingCount(null);
    // Reset when list filters / search change — not when selection identity changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional
  }, [
    activeDateFrom,
    activeDateTo,
    activeClientId,
    activeType,
    activeStatus,
    headerSearchQuery,
  ]);

  const matchesClientFilters = useCallback(
    (inv: InvoiceSummary) => {
      if (
        !activeClientId &&
        activeType !== "all" &&
        activeStatus !== "all"
      ) {
        if (inv.status !== activeStatus) return false;
      }
      const q = headerSearchQuery.trim().toLowerCase();
      if (!q) return true;
      const num = inv.number.toLowerCase();
      const client = inv.clientName.toLowerCase();
      const barcode = normalizeInvoiceBarcode(inv.barcode);
      const barcodeQuery = normalizeInvoiceBarcode(q);
      return (
        num.includes(q) ||
        client.includes(q) ||
        `#${num}`.includes(q) ||
        (!!barcodeQuery && barcode === barcodeQuery)
      );
    },
    [activeClientId, activeType, activeStatus, headerSearchQuery],
  );

  const fetchAllMatchingInvoiceIds = useCallback(async () => {
    if (status === "Exhausted") {
      return sortedInvoices.map((inv) => inv.id);
    }

    const ids: string[] = [];
    let cursor: string | null = null;
    let truncated = false;

    for (;;) {
      const page: {
        page: Parameters<typeof invoiceSummaryFromConvex>[0][];
        isDone: boolean;
        continueCursor: string;
      } = await convex.query(api.invoices.listSummaries, {
        ...listArgs,
        paginationOpts: { numItems: 50, cursor },
      });
      for (const raw of page.page) {
        const inv = invoiceSummaryFromConvex(raw);
        if (!matchesClientFilters(inv)) continue;
        ids.push(inv.id);
        if (ids.length >= SELECT_ALL_MAX) {
          truncated = true;
          break;
        }
      }
      if (truncated || page.isDone) break;
      cursor = page.continueCursor;
    }

    if (truncated) {
      toast.error(
        tr("Sélection limitée", "تحديد محدود"),
        tr(
          `Maximum ${SELECT_ALL_MAX} factures sélectionnées.`,
          `الحد الأقصى ${SELECT_ALL_MAX} فاتورة.`,
        ),
      );
    }

    return ids;
  }, [
    status,
    sortedInvoices,
    convex,
    listArgs,
    matchesClientFilters,
    toast,
    tr,
  ]);

  const allMatchingSelected =
    allMatchingCount !== null &&
    selection.selectedCount > 0 &&
    selection.selectedCount === allMatchingCount;

  const headerSelectChecked =
    allMatchingSelected ||
    (status === "Exhausted" &&
      selection.allVisibleSelected &&
      sortedInvoices.length > 0);

  const headerSelectIndeterminate =
    selection.selectedCount > 0 && !headerSelectChecked;

  async function handleToggleSelectAll() {
    if (headerSelectChecked) {
      selection.clear();
      setAllMatchingCount(null);
      return;
    }
    setSelectingAll(true);
    try {
      const ids = await fetchAllMatchingInvoiceIds();
      selection.replaceSelection(ids);
      setAllMatchingCount(ids.length);
    } catch (error) {
      toast.error(
        tr("Sélection impossible", "تعذر التحديد"),
        error instanceof Error ? error.message : "SELECT_ALL_FAILED",
      );
    } finally {
      setSelectingAll(false);
    }
  }

  const effectiveSelectedId = useMemo(() => {
    if (
      selectedId &&
      sortedInvoices.some((invoice) => invoice.id === selectedId)
    ) {
      return selectedId;
    }
    return sortedInvoices[0]?.id ?? null;
  }, [sortedInvoices, selectedId]);

  const selectedRow = useQuery(
    api.invoices.getWithLines,
    effectiveSelectedId ? { invoiceId: effectiveSelectedId } : "skip",
  );
  const selected = useMemo(
    () => (selectedRow ? invoiceFromConvex(selectedRow) : null),
    [selectedRow],
  );

  const selectedClientRow = useQuery(
    api.clients.findByFullName,
    hasClientAccess && selected?.clientName
      ? { fullName: selected.clientName }
      : "skip",
  );
  const selectedClientPhone = selectedClientRow?.phone ?? null;

  const resolveClientPhone = useCallback(
    async (clientName: string) => {
      if (!hasClientAccess || !clientName.trim()) return null;
      if (
        selected?.clientName.trim().toLowerCase() ===
        clientName.trim().toLowerCase()
      ) {
        return selectedClientPhone;
      }
      const row = await convex.query(api.clients.findByFullName, {
        fullName: clientName,
      });
      return row?.phone ?? null;
    },
    [convex, hasClientAccess, selected?.clientName, selectedClientPhone],
  );

  const ensureFullInvoice = useCallback(
    async (invoiceId: string): Promise<Invoice | null> => {
      if (selected?.id === invoiceId) return selected;
      const row = await convex.query(api.invoices.getWithLines, { invoiceId });
      return row ? invoiceFromConvex(row) : null;
    },
    [convex, selected],
  );

  const handleSelectInvoice = useCallback((invoiceId: string) => {
    setSelectedId(invoiceId);
  }, []);

  const handlePrintInvoice = useCallback(
    async (invoiceId: string, mode: InvoiceReceiptMode = receiptMode) => {
      const full = await ensureFullInvoice(invoiceId);
      if (!full) {
        toast.error(
          tr("Facture introuvable", "الفاتورة غير موجودة"),
          tr(
            "Impossible de charger la facture pour l'impression.",
            "تعذر تحميل الفاتورة للطباعة.",
          ),
        );
        return;
      }
      flushSync(() => {
        setSelectedId(invoiceId);
        setReceiptMode(mode);
      });
      await printElementById("invoice-print-area");
    },
    [ensureFullInvoice, receiptMode, toast, tr],
  );

  const handlePrintSelected = useCallback(() => {
    if (!effectiveSelectedId) return;
    void handlePrintInvoice(effectiveSelectedId, receiptMode);
  }, [effectiveSelectedId, handlePrintInvoice, receiptMode]);

  async function handleConfirmDeleteInvoice() {
    if (!deleteInvoice) return;
    setDeleting(true);
    try {
      await removeInvoice({
        invoiceId: deleteInvoice.id as Id<"invoices">,
      });
      toast.success(
        tr("Facture supprimée", "تم حذف الفاتورة"),
        `#${deleteInvoice.number}`,
      );
      if (selectedId === deleteInvoice.id) setSelectedId(null);
      selection.clear();
      setDeleteInvoice(null);
    } catch (error) {
      toast.error(
        tr("Suppression impossible", "تعذر الحذف"),
        error instanceof Error ? error.message : "DELETE_FAILED",
      );
    } finally {
      setDeleting(false);
    }
  }

  async function loadSelectedInvoices(): Promise<Invoice[]> {
    const loaded: Invoice[] = [];
    for (const id of selection.selectedIdList) {
      const invoice = await ensureFullInvoice(id);
      if (invoice) loaded.push(invoice);
    }
    return loaded;
  }

  async function resolveStatementClientId(
    invoices: Invoice[],
  ): Promise<Id<"clients"> | null> {
    if (activeClientId) return activeClientId as Id<"clients">;

    const fromInvoices = [
      ...new Set(
        invoices
          .map((inv) => inv.clientId)
          .filter((id): id is string => typeof id === "string" && id.length > 0),
      ),
    ];
    if (fromInvoices.length === 1) {
      return fromInvoices[0] as Id<"clients">;
    }
    if (fromInvoices.length > 1) return null;

    // Fallback: unique client name → lookup (walk-in / legacy rows).
    const names = [
      ...new Set(
        invoices.map((inv) => inv.clientName.trim()).filter(Boolean),
      ),
    ];
    if (names.length !== 1) return null;
    try {
      const client = await convex.query(api.clients.findByFullName, {
        fullName: names[0]!,
      });
      return client?.id ?? null;
    } catch {
      return null;
    }
  }

  async function resolveStatementContext(invoices: Invoice[]) {
    if (invoices.length === 0) return null;
    const clientId = await resolveStatementClientId(invoices);
    if (!clientId) return null;

    let fromDate = invoices[0]!.date;
    let toDate = invoices[0]!.date;
    for (const inv of invoices) {
      if (inv.date < fromDate) fromDate = inv.date;
      if (inv.date > toDate) toDate = inv.date;
    }
    // Honor Factures Du/Au so opening + versements match the filtered window.
    if (activeDateFrom) fromDate = activeDateFrom;
    const today = new Date().toISOString().slice(0, 10);
    if (activeDateTo) toDate = activeDateTo;
    else if (today > toDate) toDate = today;
    if (fromDate > toDate) {
      const swap = fromDate;
      fromDate = toDate;
      toDate = swap;
    }

    return await convex.query(api.invoices.clientStatementContext, {
      clientId,
      fromDate,
      toDate,
    });
  }

  async function handleBulkDownloadCombined() {
    if (!canDownloadPdf || selection.selectedCount === 0) return;
    setBulkBusy(true);
    try {
      const loaded = await loadSelectedInvoices();
      const invoices = loaded.filter((inv) => {
        if (activeDateFrom && inv.date < activeDateFrom) return false;
        if (activeDateTo && inv.date > activeDateTo) return false;
        return true;
      });
      if (invoices.length === 0) {
        toast.error(
          tr("Aucune facture", "لا توجد فاتورة"),
          tr(
            activeDateFrom || activeDateTo
              ? "Aucune facture dans la période Du / Au."
              : "Impossible de charger les factures.",
            activeDateFrom || activeDateTo
              ? "لا توجد فاتورة في فترة من / إلى."
              : "تعذر تحميل الفواتير.",
          ),
        );
        return;
      }
      let statement: Awaited<
        ReturnType<typeof resolveStatementContext>
      > = null;
      try {
        statement = await resolveStatementContext(invoices);
      } catch (error) {
        toast.error(
          tr("Versements non chargés", "تعذر تحميل التحصيلات"),
          error instanceof Error
            ? error.message
            : tr(
                "Le relevé sera exporté sans versements du grand livre.",
                "سيتم التصدير بدون تحصيلات دفتر العميل.",
              ),
        );
      }
      if (
        !statement &&
        invoices.every((inv) => inv.paymentType === "credit")
      ) {
        toast.error(
          tr("Client introuvable pour le relevé", "تعذر تحديد العميل للكشف"),
          tr(
            "Filtrez par client avant d’exporter pour inclure les versements.",
            "صفِّ حسب العميل قبل التصدير لتضمين التحصيلات.",
          ),
        );
      }
      await downloadInvoicesPdfCombined(invoices, settingsRow, "owner", {
        ...(statement
          ? {
              openingBalanceMad: statement.openingBalanceMad,
              ledgerMovements: statement.movements,
            }
          : {}),
      });
      setBulkPdfOpen(false);
      const versementCount =
        statement?.movements.filter((m) => m.kind === "payment").length ?? 0;
      toast.success(
        tr("PDF prêt", "PDF جاهز"),
        tr(
          `${invoices.length} facture(s) · ${versementCount} versement(s).`,
          `${invoices.length} فاتورة · ${versementCount} تحصيل.`,
        ),
      );
    } catch (error) {
      toast.error(
        tr("Téléchargement impossible", "تعذر التنزيل"),
        error instanceof Error ? error.message : "PDF_FAILED",
      );
    } finally {
      setBulkBusy(false);
    }
  }

  async function handleBulkDownloadSeparate() {
    if (!canDownloadPdf || selection.selectedCount === 0) return;
    setBulkBusy(true);
    try {
      const invoices = await loadSelectedInvoices();
      if (invoices.length === 0) {
        toast.error(
          tr("Aucune facture", "لا توجد فاتورة"),
          tr("Impossible de charger les factures.", "تعذر تحميل الفواتير."),
        );
        return;
      }
      const result = await downloadInvoicesPdfSeparate(
        invoices,
        settingsRow,
        "owner",
      );
      setBulkPdfOpen(false);
      toast.success(
        tr("Téléchargements prêts", "جاهز للتنزيل"),
        tr(
          `${result.ok} PDF${result.failed ? ` · ${result.failed} échec(s)` : ""}`,
          `${result.ok} PDF${result.failed ? ` · ${result.failed} فشل` : ""}`,
        ),
      );
    } catch (error) {
      toast.error(
        tr("Téléchargement impossible", "تعذر التنزيل"),
        error instanceof Error ? error.message : "PDF_FAILED",
      );
    } finally {
      setBulkBusy(false);
    }
  }

  const handleDownloadInvoice = useCallback(
    async (invoiceId: string, mode: InvoiceReceiptMode = "client") => {
      if (!canDownloadPdf) {
        toast.error(
          tr("Export non autorisé", "التصدير غير مسموح"),
          tr(
            "Votre rôle n'a pas la permission d'exporter des PDF.",
            "دورك لا يملك صلاحية تصدير PDF.",
          ),
        );
        return;
      }
      setDownloadingId(invoiceId);
      try {
        const invoice = await ensureFullInvoice(invoiceId);
        if (!invoice) {
          toast.error(
            tr("Facture introuvable", "الفاتورة غير موجودة"),
            tr(
              "Impossible de charger la facture pour le téléchargement.",
              "تعذر تحميل الفاتورة للتنزيل.",
            ),
          );
          return;
        }
        await downloadInvoicePdf(invoice, settingsRow, mode);
        toast.success(
          tr("PDF téléchargé", "تم تنزيل PDF"),
          mode === "owner"
            ? tr(
                `Copie interne ${invoice.number} enregistrée.`,
                `تم حفظ النسخة الداخلية ${invoice.number}.`,
              )
            : tr(
                `Ticket client ${invoice.number} enregistré.`,
                `تم حفظ تذكرة الزبون ${invoice.number}.`,
              ),
        );
      } catch (error) {
        const message = error instanceof Error ? error.message : undefined;
        toast.error(
          tr("Échec du téléchargement", "فشل التنزيل"),
          message ??
            tr(
              "Impossible de générer le PDF. Réessayez.",
              "تعذر إنشاء PDF. أعد المحاولة.",
            ),
        );
      } finally {
        setDownloadingId(null);
      }
    },
    [canDownloadPdf, ensureFullInvoice, settingsRow, toast, tr],
  );

  const handleShareInvoice = useCallback(
    async (invoiceId: string, clientName: string) => {
      if (!canDownloadPdf) {
        toast.error(
          tr("Export non autorisé", "التصدير غير مسموح"),
          tr(
            "Votre rôle n'a pas la permission d'exporter des PDF.",
            "دورك لا يملك صلاحية تصدير PDF.",
          ),
        );
        return;
      }
      setSharingId(invoiceId);
      try {
        const invoice = await ensureFullInvoice(invoiceId);
        if (!invoice) {
          toast.error(
            tr("Facture introuvable", "الفاتورة غير موجودة"),
            tr(
              "Impossible de charger la facture pour le partage.",
              "تعذر تحميل الفاتورة للمشاركة.",
            ),
          );
          return;
        }
        const { blob, filename } = await buildInvoicePdfBlob(
          invoice,
          settingsRow,
          "client",
        );
        const result = await sharePdfViaWhatsApp({
          blob,
          filename,
          message: invoiceWhatsAppShareMessage(invoice, locale),
          phoneDigits: await resolveClientPhone(clientName),
          uploadShareLink,
        });
        const toastCopy = whatsAppShareToastCopy(result, locale);
        toast.success(toastCopy.title, toastCopy.description);
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return;
        const message = error instanceof Error ? error.message : undefined;
        toast.error(
          tr("Partage impossible", "تعذر المشاركة"),
          message ??
            tr(
              "Impossible de partager le PDF. Réessayez.",
              "تعذر مشاركة PDF. أعد المحاولة.",
            ),
        );
      } finally {
        setSharingId(null);
      }
    },
    [
      canDownloadPdf,
      ensureFullInvoice,
      locale,
      resolveClientPhone,
      settingsRow,
      toast,
      tr,
      uploadShareLink,
    ],
  );

  const handleScan = useCallback(
    async (raw: string) => {
      const code = normalizeInvoiceBarcode(raw);
      if (!code) return;
      try {
        const hit = await convex.query(api.invoices.findByBarcode, {
          barcode: code,
        });
        if (!hit) {
          toast.error(
            tr("Facture introuvable", "الفاتورة غير موجودة"),
            tr(
              "Aucune facture ne correspond au code-barres scanné.",
              "لا توجد فاتورة تطابق الباركود الممسوح.",
            ),
          );
          return;
        }
        router.push(`/${locale}/factures/${hit.id}`);
        toast.success(
          tr("Facture trouvée", "تم العثور على الفاتورة"),
          `${hit.number} • ${hit.clientName}`,
        );
      } catch (error) {
        toast.error(
          tr("Scan impossible", "تعذر المسح"),
          error instanceof Error ? error.message : "SCAN_FAILED",
        );
      }
    },
    [convex, locale, router, toast, tr],
  );

  const canLoadMore = status === "CanLoadMore" || status === "LoadingMore";
  const loadMoreBusy = status === "LoadingMore";
  const loadMoreSentinelRef = useLoadMoreOnIntersect(
    status === "CanLoadMore",
    loadMoreBusy,
    () => loadMore(pageSize),
  );

  const invoiceTotal = useQuery(api.invoices.countMatching, {
    ...(activeDateFrom ? { dateFrom: activeDateFrom } : {}),
    ...(activeDateTo ? { dateTo: activeDateTo } : {}),
    ...(activeClientId
      ? { clientId: activeClientId as Id<"clients"> }
      : {}),
    ...(activeType !== "all" ? { paymentType: activeType } : {}),
    ...(activeStatus !== "all" &&
    (activeClientId || activeType === "all")
      ? { status: activeStatus }
      : {}),
  });

  const badgeTotal = invoiceTotal ?? summaries.length;
  const badgeFiltered = headerSearchQuery.trim()
    ? sortedInvoices.length
    : badgeTotal;

  const selectInputClass =
    "bg-surface-container-low border-sidebar-border text-on-surface focus:ring-primary/20 w-full rounded-xl border py-2.5 pr-3 pl-3 text-sm focus:ring-2";

  if (isLoadingInvoices) {
    return <InvoicesPageSkeleton />;
  }

  return (
    <div className="bg-surface text-on-surface flex min-h-0 flex-1 flex-col">
      <main className="flex-1 overflow-auto px-3 pt-2 sm:px-4 sm:py-4 lg:px-5 lg:py-5">
        <div className="admin-page-scroll-content flex w-full flex-col gap-3 xl:flex-row xl:items-start xl:gap-4">
          <div className="min-w-0 flex-1 space-y-3 xl:space-y-4">
            <div className="border-sidebar-border bg-surface-container-lowest rounded-2xl border p-3 shadow-sm sm:p-4">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:gap-4">
                <div className="grid min-w-0 flex-1 grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5 sm:gap-3">
                  <InvoiceClientFilter
                    selectedClientId={draftClientId}
                    onClientChange={setDraftClientId}
                    tr={tr}
                    className="col-span-2 sm:col-span-1 lg:col-span-1"
                  />
                  <label className="min-w-0 space-y-1">
                    <span className="text-on-surface-variant block text-[10px] font-bold tracking-wide uppercase sm:text-xs">
                      {tr("Du", "من")}
                    </span>
                    <div className="relative">
                      <Calendar
                        className="text-on-surface-variant pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 stroke-[1.75] sm:left-3 sm:size-4"
                        aria-hidden
                      />
                      <FrenchDateInput
                        value={draftDateFrom}
                        onValueChange={setDraftDateFrom}
                        className={cn(
                          selectInputClass,
                          "py-2 pl-8 text-xs sm:py-2.5 sm:pl-10 sm:text-sm",
                        )}
                      />
                    </div>
                  </label>
                  <label className="min-w-0 space-y-1">
                    <span className="text-on-surface-variant block text-[10px] font-bold tracking-wide uppercase sm:text-xs">
                      {tr("Au", "إلى")}
                    </span>
                    <div className="relative">
                      <Calendar
                        className="text-on-surface-variant pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 stroke-[1.75] sm:left-3 sm:size-4"
                        aria-hidden
                      />
                      <FrenchDateInput
                        value={draftDateTo}
                        onValueChange={setDraftDateTo}
                        className={cn(
                          selectInputClass,
                          "py-2 pl-8 text-xs sm:py-2.5 sm:pl-10 sm:text-sm",
                        )}
                      />
                    </div>
                  </label>
                  <label className="min-w-0 space-y-1">
                    <span className="text-on-surface-variant block text-[10px] font-bold tracking-wide uppercase sm:text-xs">
                      {tr("Type", "النوع")}
                    </span>
                    <select
                      value={draftType}
                      onChange={(e) =>
                        setDraftType(e.target.value as typeof draftType)
                      }
                      className={cn(
                        selectInputClass,
                        "py-2 text-xs sm:py-2.5 sm:text-sm",
                      )}
                    >
                      <option value="all">{tr("Tous", "الكل")}</option>
                      <option value="cash">{tr("Espèces", "نقدًا")}</option>
                      <option value="credit">{tr("Crédit", "آجل")}</option>
                    </select>
                  </label>
                  <label className="min-w-0 space-y-1">
                    <span className="text-on-surface-variant block text-[10px] font-bold tracking-wide uppercase sm:text-xs">
                      {tr("Statut", "الحالة")}
                    </span>
                    <select
                      value={draftStatus}
                      onChange={(e) =>
                        setDraftStatus(e.target.value as typeof draftStatus)
                      }
                      className={cn(
                        selectInputClass,
                        "py-2 text-xs sm:py-2.5 sm:text-sm",
                      )}
                    >
                      <option value="all">{tr("Tous", "الكل")}</option>
                      <option value="paid">{tr("Payé", "مدفوعة")}</option>
                      <option value="pending">
                        {tr("En attente", "قيد الانتظار")}
                      </option>
                      <option value="returned">
                        {tr("Retournée", "مرتجعة")}
                      </option>
                    </select>
                  </label>
                </div>
                <div className="flex shrink-0 items-end gap-2 self-end">
                  <Button
                    type="button"
                    size="icon"
                    onClick={applyFilters}
                    title={tr("Appliquer les filtres", "تطبيق الفلاتر")}
                    aria-label={tr("Appliquer les filtres", "تطبيق الفلاتر")}
                    className="size-10 shrink-0 rounded-xl sm:size-11"
                  >
                    <Filter className="size-4 stroke-[1.75]" aria-hidden />
                  </Button>
                  <Button
                    type="button"
                    size="icon"
                    variant="outline"
                    onClick={() => setScanOpen(true)}
                    title={tr("Scanner ticket", "مسح التذكرة")}
                    aria-label={tr("Scanner ticket", "مسح التذكرة")}
                    className="size-10 shrink-0 rounded-xl sm:size-11"
                  >
                    <ScanBarcode className="size-4 stroke-[1.75]" aria-hidden />
                  </Button>
                </div>
              </div>
            </div>

            <AdminFilterSummary
              filteredCount={badgeFiltered}
              totalCount={badgeTotal}
              searchQuery={headerSearchQuery}
              onClearSearch={() => setHeaderSearchQuery("")}
              extraActive={
                activeDateFrom !== "" ||
                activeDateTo !== "" ||
                activeClientId != null ||
                activeType !== "all" ||
                activeStatus !== "all"
              }
              extraLabel={tr("Filtres actifs", "فلاتر نشطة")}
              itemLabel={tr("facture", "فاتورة")}
              itemLabelPlural={tr("factures", "فواتير")}
              className="px-1"
            />

            <div className="border-sidebar-border bg-surface-container-lowest overflow-hidden rounded-2xl border shadow-sm">
              <div className="no-scrollbar overflow-x-auto">
                <table className="w-full min-w-[720px] text-left text-sm">
                  <thead>
                    <tr className="border-sidebar-border bg-surface-container-low/80 border-b">
                      <th className="w-10 px-3 py-2.5">
                        <TableSelectCheckbox
                          checked={headerSelectChecked}
                          indeterminate={headerSelectIndeterminate}
                          onChange={() => void handleToggleSelectAll()}
                          disabled={selectingAll || sortedInvoices.length === 0}
                          aria-label={tr(
                            "Tout sélectionner",
                            "تحديد الكل",
                          )}
                        />
                      </th>
                      <SortableTh
                        column="number"
                        activeColumn={sortColumn}
                        direction={sortDirection}
                        onSort={handleSort}
                        className="text-outline px-3 py-2.5 text-[10px] tracking-widest"
                      >
                        {tr("Facture #", "فاتورة #")}
                      </SortableTh>
                      <SortableTh
                        column="date"
                        activeColumn={sortColumn}
                        direction={sortDirection}
                        onSort={handleSort}
                        className="text-outline px-3 py-2.5 text-[10px] tracking-widest"
                      >
                        {tr("Date / heure", "التاريخ / الوقت")}
                      </SortableTh>
                      <SortableTh
                        column="client"
                        activeColumn={sortColumn}
                        direction={sortDirection}
                        onSort={handleSort}
                        className="text-outline px-3 py-2.5 text-[10px] tracking-widest"
                      >
                        {tr("Client", "العميل")}
                      </SortableTh>
                      <SortableTh
                        column="type"
                        activeColumn={sortColumn}
                        direction={sortDirection}
                        onSort={handleSort}
                        className="text-outline px-3 py-2.5 text-[10px] tracking-widest"
                      >
                        {tr("Type", "النوع")}
                      </SortableTh>
                      <SortableTh
                        column="total"
                        activeColumn={sortColumn}
                        direction={sortDirection}
                        onSort={handleSort}
                        className="text-outline px-3 py-2.5 text-[10px] tracking-widest"
                      >
                        {tr("Total (MAD)", "الإجمالي (درهم)")}
                      </SortableTh>
                      <SortableTh
                        column="status"
                        activeColumn={sortColumn}
                        direction={sortDirection}
                        onSort={handleSort}
                        className="text-outline min-w-[6rem] px-3 py-2.5 text-[10px] tracking-widest whitespace-nowrap"
                      >
                        {tr("Statut", "الحالة")}
                      </SortableTh>
                      <th className="text-outline px-3 py-2.5 text-right text-[10px] font-bold tracking-widest uppercase">
                        {tr("Actions", "الإجراءات")}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedInvoices.length === 0 ? (
                      <tr>
                        <td
                          colSpan={8}
                          className="text-on-surface-variant px-4 py-12 text-center text-sm"
                        >
                          {tr(
                            "Aucune facture ne correspond aux filtres ou à la recherche.",
                            "لا توجد فاتورة تطابق الفلاتر أو البحث.",
                          )}
                        </td>
                      </tr>
                    ) : (
                      sortedInvoices.map((inv, idx) => {
                        const active = inv.id === effectiveSelectedId;
                        const checked = selection.isSelected(inv.id);
                        const stripe = idx % 2 === 0;
                        return (
                          <tr
                            key={inv.id}
                            onClick={() => handleSelectInvoice(inv.id)}
                            onKeyDown={(e) => {
                              if (e.key !== "Enter" && e.key !== " ") return;
                              e.preventDefault();
                              handleSelectInvoice(inv.id);
                            }}
                            tabIndex={0}
                            aria-selected={active}
                            className={cn(
                              "border-sidebar-border cursor-pointer border-b transition-colors outline-none focus-visible:ring-2 focus-visible:ring-primary/30 focus-visible:ring-inset",
                              checked
                                ? "bg-primary/12"
                                : active
                                  ? "bg-primary/8"
                                  : stripe
                                    ? "bg-surface-container-lowest hover:bg-surface-container-low/80"
                                    : "bg-surface-container-low/40 hover:bg-surface-container-low",
                            )}
                          >
                            <td className="px-3 py-2.5">
                              <TableSelectCheckbox
                                checked={checked}
                                onChange={() => selection.toggle(inv.id)}
                                aria-label={tr(
                                  `Sélectionner #${inv.number}`,
                                  `تحديد #${inv.number}`,
                                )}
                              />
                            </td>
                            <td className="px-3 py-2.5">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleSelectInvoice(inv.id);
                                }}
                                className="text-primary font-bold hover:underline"
                              >
                                #{inv.number}
                              </button>
                            </td>
                            <td className="text-on-surface-variant px-3 py-2.5 tabular-nums">
                              {formatTableDateTime(inv.date, inv.time)}
                            </td>
                            <td className="px-3 py-2.5 font-medium">
                              {inv.clientName}
                            </td>
                            <td className="px-3 py-2.5">
                              <span
                                className={cn(
                                  statusPillClass,
                                  "px-2.5 py-0.5 text-[10px] font-black uppercase",
                                  paymentBadgeClass(inv.paymentType),
                                )}
                              >
                                {paymentLabel(inv.paymentType, isAr)}
                              </span>
                            </td>
                            <td className="px-3 py-2.5 font-black tabular-nums">
                              {formatTableMoney(inv.totalMad)}
                            </td>
                            <td className="px-3 py-2.5 whitespace-nowrap">
                              <span
                                className={cn(
                                  statusPillClass,
                                  "px-2.5 py-0.5 text-[10px] font-black uppercase",
                                  statusBadgeClass(inv.status),
                                )}
                              >
                                {statusLabel(inv.status, isAr)}
                              </span>
                            </td>
                            <td className="px-3 py-2.5">
                              <div className="flex items-center justify-end gap-0.5">
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    router.push(`/${locale}/factures/${inv.id}`);
                                  }}
                                  className="text-outline hover:text-primary hover:bg-primary/10 rounded-lg p-2 transition-colors"
                                  aria-label={tr("Voir", "عرض")}
                                >
                                  <Eye className="size-4 stroke-[1.75]" />
                                </button>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    void handlePrintInvoice(inv.id, "client");
                                  }}
                                  className="text-outline hover:text-primary hover:bg-primary/10 rounded-lg p-2 transition-colors"
                                  aria-label={tr("Imprimer", "طباعة")}
                                >
                                  <Printer className="size-4 stroke-[1.75]" />
                                </button>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    void handleDownloadInvoice(inv.id, "client");
                                  }}
                                  disabled={downloadingId === inv.id || !canDownloadPdf}
                                  className="text-outline hover:text-primary hover:bg-primary/10 rounded-lg p-2 transition-colors disabled:opacity-40"
                                  title={tr("Télécharger PDF", "تنزيل PDF")}
                                  aria-label={tr("Télécharger PDF", "تنزيل PDF")}
                                >
                                  <FileDown className="size-4 stroke-[1.75]" />
                                </button>
                                <WhatsAppShareButton
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    void handleShareInvoice(
                                      inv.id,
                                      inv.clientName,
                                    );
                                  }}
                                  disabled={!canDownloadPdf}
                                  busy={sharingId === inv.id}
                                  ariaLabel={tr(
                                    "Partager sur WhatsApp",
                                    "مشاركة عبر واتساب",
                                  )}
                                />
                                {canDelete ? (
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setDeleteInvoice(inv);
                                    }}
                                    className="text-outline hover:text-error hover:bg-error/10 rounded-lg p-2 transition-colors"
                                    title={tr("Supprimer", "حذف")}
                                    aria-label={tr("Supprimer", "حذف")}
                                  >
                                    <Trash2 className="size-4 stroke-[1.75]" />
                                  </button>
                                ) : null}
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>

              <div className="border-sidebar-border flex flex-col gap-4 border-t px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
                  <p className="text-on-surface-variant text-xs sm:text-sm">
                    <span className="text-on-surface font-semibold">
                      {sortedInvoices.length}
                    </span>{" "}
                    {tr(
                      sortedInvoices.length === 1
                        ? "résultat chargé"
                        : "résultats chargés",
                      sortedInvoices.length === 1
                        ? "نتيجة محمّلة"
                        : "نتائج محمّلة",
                    )}
                    {headerSearchQuery.trim() ? (
                      <span className="text-on-surface-variant/80">
                        {" "}
                        — {summaries.length}{" "}
                        {tr("avant recherche", "قبل البحث")}
                      </span>
                    ) : null}
                  </p>
                  <label className="text-on-surface-variant flex items-center gap-2 text-xs sm:text-sm">
                    <span className="shrink-0">
                      {tr("Par page", "لكل صفحة")}
                    </span>
                    <select
                      value={pageSize}
                      onChange={(e) => {
                        onPageSizeChange(
                          Number(e.target.value) as (typeof PAGE_SIZE_OPTIONS)[number],
                        );
                      }}
                      className="bg-surface-container-low border-sidebar-border text-on-surface focus:ring-primary/20 h-9 min-w-[4.5rem] rounded-lg border px-2 text-sm font-medium focus:ring-2"
                      aria-label={tr("Lignes par page", "عدد الصفوف لكل صفحة")}
                    >
                      {PAGE_SIZE_OPTIONS.map((size) => (
                        <option key={size} value={size}>
                          {size}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                {canLoadMore ? (
                  <div
                    ref={loadMoreSentinelRef}
                    className="flex min-h-9 items-center justify-end"
                    aria-hidden
                  >
                    {status === "LoadingMore" ? (
                      <p className="text-on-surface-variant text-xs font-medium">
                        {tr("Chargement…", "جاري التحميل…")}
                      </p>
                    ) : (
                      <span className="h-1 w-1" />
                    )}
                  </div>
                ) : null}
              </div>
            </div>

            <BulkActionBar
              selectedCount={selection.selectedCount}
              itemLabel={tr("facture sélectionnée", "فاتورة محددة")}
              itemLabelPlural={tr("factures sélectionnées", "فواتير محددة")}
              clearLabel={tr("Effacer la sélection", "مسح التحديد")}
              onClear={selection.clear}
              actions={[
                ...(canDownloadPdf
                  ? [
                      {
                        key: "pdf",
                        label: tr("Télécharger PDF", "تنزيل PDF"),
                        icon: (
                          <FileDown
                            className="size-3.5 stroke-[1.75]"
                            aria-hidden
                          />
                        ),
                        disabled: bulkBusy,
                        onClick: () => setBulkPdfOpen(true),
                      },
                    ]
                  : []),
              ]}
            />
          </div>

          <aside className="border-sidebar-border bg-surface-container-low/40 hidden w-full shrink-0 space-y-3 rounded-2xl border p-3 print:block xl:sticky xl:top-3 xl:block xl:w-[320px] xl:self-start 2xl:w-[340px]">
            <h2 className="text-outline text-xs font-bold tracking-widest uppercase">
              {tr("Aperçu facture", "معاينة الفاتورة")}
            </h2>
            <InvoiceReceiptPreview
              invoice={selected}
              mode={receiptMode}
              onModeChange={setReceiptMode}
              layout="sidebar"
            />
            {selected ? (
              <InvoiceReceiptActions
                invoice={selected}
                mode={receiptMode}
                onPrint={handlePrintSelected}
                tr={tr}
                clientPhone={selectedClientPhone}
              />
            ) : null}
          </aside>
        </div>
        <BarcodeScanDialog
          open={scanOpen}
          onOpenChange={setScanOpen}
          onScan={handleScan}
        />
        <ConfirmDeleteDialog
          open={deleteInvoice !== null}
          onOpenChange={(open) => {
            if (!open) setDeleteInvoice(null);
          }}
          entityName={
            deleteInvoice ? `#${deleteInvoice.number}` : ""
          }
          confirmText={deleteInvoice?.number ?? ""}
          title={tr("Supprimer cette facture ?", "حذف هذه الفاتورة؟")}
          description={tr(
            "La facture et ses lignes / paiements / crédits liés seront définitivement supprimés. Tapez le numéro exact pour confirmer.",
            "سيتم حذف الفاتورة وعناصرها ومدفوعاتها وائتمانها نهائيًا. اكتب رقم الفاتورة تمامًا للتأكيد.",
          )}
          typePrompt={tr(
            `Tapez « ${deleteInvoice?.number ?? ""} » pour confirmer`,
            `اكتب « ${deleteInvoice?.number ?? ""} » للتأكيد`,
          )}
          confirmLabel={tr("Supprimer définitivement", "حذف نهائي")}
          cancelLabel={tr("Annuler", "إلغاء")}
          busy={deleting}
          onConfirm={handleConfirmDeleteInvoice}
        />
        <BulkPdfDownloadDialog
          open={bulkPdfOpen}
          onOpenChange={setBulkPdfOpen}
          selectedCount={selection.selectedCount}
          busy={bulkBusy}
          tr={tr}
          onDownloadCombined={() => void handleBulkDownloadCombined()}
          onDownloadSeparate={() => void handleBulkDownloadSeparate()}
        />
      </main>
    </div>
  );
}
