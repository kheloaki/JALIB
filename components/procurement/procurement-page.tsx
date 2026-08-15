"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { Check, PackagePlus, Plus, ScanBarcode, ShoppingCart, X } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";

import { ProcurementBonsTableSkeleton } from "@/components/skeletons";
import { BarcodeScanDialog } from "@/components/products/barcode-scan-dialog";
import {
  AddProductDialog,
  type AddProductPrefill,
} from "@/components/products/add-product-dialog";
import { PosDialogProductPicker } from "@/components/pos/pos-dialog-product-picker";
import type { Product } from "@/components/pos/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAdminChrome } from "@/components/layout/admin-chrome-context";
import { AdminFilterSummary } from "@/components/layout/admin-filter-summary";
import { useToast } from "@/components/ui/toaster";
import { useConvexCatalog } from "@/hooks/use-convex-catalog";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { ProcurementBonsTable, type ProcurementBonSummary } from "@/components/procurement/procurement-bons-table";
import {
  ProcurementListDetailSheet,
  type ProcurementDetailListItem,
} from "@/components/procurement/procurement-list-detail-sheet";
import { ProcurementListTable } from "@/components/procurement/procurement-list-table";
import { canBuildProcurementList, canExportReports } from "@/lib/auth/permissions";
import { procurementApi } from "@/lib/convex/procurement-api";
import {
  buildProcurementListPdfBlob,
  downloadProcurementListPdf,
  printProcurementListPdf,
  type ProcurementListPdfDocument,
  type ProcurementListPdfRow,
} from "@/lib/procurement/build-procurement-list-pdf";
import { procurementListWhatsAppShareMessage } from "@/lib/procurement/procurement-share-message";
import { sharePdfViaWhatsApp, whatsAppShareToastCopy } from "@/lib/share/share-pdf-whatsapp";
import { usePdfShareUpload } from "@/hooks/use-pdf-share-upload";
import { formatMad } from "@/lib/money/mad";
import { resolveDocumentLocale, getDocumentLabels } from "@/lib/i18n/document-labels";
import { findProductByBarcode, normalizeBarcodeInput } from "@/lib/pos/catalog-lookup";

import { formatDateTimeMediumFr } from "@/lib/dates/format-date";
import { statusPillClass } from "@/lib/ui/status-pill";
import { cn } from "@/lib/utils";

function prefillFromSearchQuery(query: string): AddProductPrefill {
  const trimmed = query.trim();
  if (!trimmed) return {};
  const normalized = normalizeBarcodeInput(trimmed);
  const digitsOnly = trimmed.replace(/\D/g, "");
  if (normalized.length >= 8 && digitsOnly.length >= 8) {
    return { barcode: trimmed };
  }
  return { name: trimmed };
}

type ListItem = ProcurementDetailListItem;

function unitCostMad(
  item: ListItem,
  paidByItem: Record<string, number>,
): number | null {
  if (item.status === "bought" && item.paidCostMad != null) {
    return item.paidCostMad;
  }
  const draft = paidByItem[item.id];
  if (draft != null && draft > 0) return draft;
  if (item.plannedCostMad != null && item.plannedCostMad > 0) {
    return item.plannedCostMad;
  }
  return item.product.costMad;
}

function summarizeList(
  items: ListItem[],
  paidByItem: Record<string, number>,
) {
  let totalQty = 0;
  let totalPurchase = 0;
  let totalSell = 0;
  let hasMissingCost = false;

  for (const item of items) {
    totalQty += item.quantity;
    const unitCost = unitCostMad(item, paidByItem);
    if (unitCost != null && unitCost > 0) {
      totalPurchase += unitCost * item.quantity;
    } else {
      hasMissingCost = true;
    }
    totalSell += item.product.priceMad * item.quantity;
  }

  return {
    lineCount: items.length,
    totalQty,
    totalPurchase,
    totalSell,
    hasMissingCost,
  };
}

export function ProcurementPage() {
  return <ProcurementPanel />;
}

export function ProcurementPanel() {
  const t = useTranslations("procurement");
  const locale = useLocale();
  const isAr = locale === "ar";
  const tr = (fr: string, ar: string) => (isAr ? ar : fr);
  const toast = useToast();
  const uploadShareLink = usePdfShareUpload();
  const { headerSearchQuery, setHeaderSearchQuery } = useAdminChrome();
  const { products: catalog, isLoading: catalogLoading } = useConvexCatalog();
  const currentUser = useQuery(api.authz.currentUser);
  const appSettings = useQuery(api.settings.getAppSettings);
  const documentLocale = resolveDocumentLocale(appSettings ?? {});
  const formatUiHistoryDate = (iso: string) => formatDateTimeMediumFr(iso);
  const permissions = currentUser?.permissions ?? [];
  const canManage = canBuildProcurementList(permissions);
  const canFulfill = permissions.includes("procurement.fulfill");
  const canExportPdf = canExportReports(permissions);

  const activeList = useQuery(
    procurementApi.getActiveList,
    canFulfill || canManage ? {} : "skip",
  );
  const draftList = useQuery(
    procurementApi.getDraftList,
    canManage ? {} : "skip",
  );
  const bons = useQuery(
    procurementApi.listBons,
    canFulfill || canManage ? {} : "skip",
  );

  const [openedListId, setOpenedListId] = useState<Id<"procurementLists"> | null>(
    null,
  );
  const [pdfBonId, setPdfBonId] = useState<Id<"procurementLists"> | null>(null);
  const [shareBonId, setShareBonId] = useState<Id<"procurementLists"> | null>(
    null,
  );
  const [pendingPrintListId, setPendingPrintListId] = useState<
    Id<"procurementLists"> | null
  >(null);

  const openedList = useQuery(
    procurementApi.getListById,
    openedListId ? { listId: openedListId } : "skip",
  );
  const pdfList = useQuery(
    procurementApi.getListById,
    pdfBonId ? { listId: pdfBonId } : "skip",
  );
  const shareList = useQuery(
    procurementApi.getListById,
    shareBonId ? { listId: shareBonId } : "skip",
  );

  const addItem = useMutation(procurementApi.addItem);
  const removeItem = useMutation(procurementApi.removeItem);
  const updateItemQuantity = useMutation(procurementApi.updateItemQuantity);
  const updateItemPlannedCost = useMutation(procurementApi.updateItemPlannedCost);
  const publishList = useMutation(procurementApi.publishList);
  const fulfillItem = useMutation(procurementApi.fulfillItem);
  const completeList = useMutation(procurementApi.completeList);

  const [scanOpen, setScanOpen] = useState(false);
  const [selectedProductId, setSelectedProductId] =
    useState<Id<"products"> | null>(null);
  const [listTitle, setListTitle] = useState("");
  const [paidByItem, setPaidByItem] = useState<Record<string, number>>({});
  const [busy, setBusy] = useState(false);
  const [pdfDownloading, setPdfDownloading] = useState(false);
  const [pdfSharing, setPdfSharing] = useState(false);
  const [addProductOpen, setAddProductOpen] = useState(false);
  const [addProductPrefill, setAddProductPrefill] =
    useState<AddProductPrefill | null>(null);
  const [sessionOpen, setSessionOpen] = useState(false);
  const [lastPickedId, setLastPickedId] = useState<string | null>(null);
  const [sessionInit, setSessionInit] = useState(false);
  const [unlockedListId, setUnlockedListId] =
    useState<Id<"procurementLists"> | null>(null);

  const publishedBons = (bons ?? []) as ProcurementBonSummary[];
  const filteredBons = useMemo(() => {
    const q = headerSearchQuery.trim().toLowerCase();
    if (!q) return publishedBons;
    return publishedBons.filter((bon) => {
      const hay = [bon.number, bon.title ?? "", bon.status].join(" ").toLowerCase();
      return hay.includes(q);
    });
  }, [headerSearchQuery, publishedBons]);
  const draftItemCount = draftList?.items.length ?? 0;
  const unlockedList =
    unlockedListId && activeList?.id === unlockedListId ? activeList : null;
  const sessionList = unlockedList ?? draftList;
  const sessionItems = sessionList?.items ?? [];
  const sessionItemCount = sessionItems.length;
  const hasSessionLines = sessionItemCount > 0;
  const isUnlockingActiveList = Boolean(unlockedList);
  const filteredSessionItems = useMemo(() => {
    const items: ListItem[] = sessionItems;
    const q = headerSearchQuery.trim().toLowerCase();
    if (!q) return items;
    return items.filter((item: ListItem) => {
      const hay = [
        item.product.name,
        item.product.category,
        item.product.barcode ?? "",
      ]
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [sessionItems, headerSearchQuery]);
  const listsLoading =
    ((canFulfill || canManage) && (activeList === undefined || bons === undefined)) ||
    (canManage && draftList === undefined);

  const openedBonNumber = useMemo(() => {
    if (!openedListId) return "";
    const bon = publishedBons.find((row) => row.id === openedListId);
    return bon?.number ?? openedListId.slice(-6).toUpperCase();
  }, [openedListId, publishedBons]);

  useEffect(() => {
    if (!canManage || sessionInit || draftList === undefined) return;
    setSessionInit(true);
    if ((draftList?.items.length ?? 0) > 0) {
      setSessionOpen(true);
    }
  }, [canManage, draftList, sessionInit]);

  function openSession() {
    setUnlockedListId(null);
    setLastPickedId(null);
    setSessionOpen(true);
  }

  function openUnlockedSession(listId: Id<"procurementLists">) {
    setUnlockedListId(listId);
    setOpenedListId(null);
    setLastPickedId(null);
    setSessionOpen(true);
  }

  function closeSession() {
    setSessionOpen(false);
    setUnlockedListId(null);
    setLastPickedId(null);
  }

  function finishUnlockSession() {
    const listId = unlockedListId;
    closeSession();
    toast.success(t("unlockSavedTitle"), t("unlockSavedDescription"));
    if (listId) setOpenedListId(listId);
  }

  function openAddProductDialog(prefill?: AddProductPrefill) {
    setAddProductPrefill(prefill ?? null);
    setAddProductOpen(true);
  }

  async function addProductFromCatalog(product: Product) {
    setLastPickedId(product.id);
    setSelectedProductId(product.id as Id<"products">);
    setBusy(true);
    try {
      await addItem({
        productId: product.id as Id<"products">,
        quantity: 1,
        ...(unlockedListId ? { listId: unlockedListId } : {}),
      });
      toast.success(t("itemAddedTitle"), product.name);
    } catch (e) {
      toast.error(
        t("errorTitle"),
        e instanceof Error ? e.message : t("errorGeneric"),
      );
    } finally {
      setBusy(false);
    }
  }

  function handleProductCreated(product: { id: string; name: string }) {
    setSelectedProductId(product.id as Id<"products">);
    setLastPickedId(product.id);
    toast.success(t("productCreatedTitle"), t("productCreatedDescription"));
    void addItem({
      productId: product.id as Id<"products">,
      quantity: 1,
      ...(unlockedListId ? { listId: unlockedListId } : {}),
    }).catch(
      (e) => {
        toast.error(
          t("errorTitle"),
          e instanceof Error ? e.message : t("errorGeneric"),
        );
      },
    );
  }

  function handleBarcodeScan(raw: string) {
    setScanOpen(false);
    const trimmed = raw.trim();
    if (!trimmed) return;
    const hit = findProductByBarcode(catalog, trimmed);
    if (hit) {
      void addProductFromCatalog(hit);
      return;
    }
    openAddProductDialog(prefillFromSearchQuery(trimmed));
    toast.info(t("barcodeUnknownTitle"), t("barcodeUnknownDescription"));
  }

  async function handleRemoveItem(item: ListItem) {
    setBusy(true);
    try {
      await removeItem({ itemId: item.id });
      if (selectedProductId === item.productId) {
        setSelectedProductId(null);
      }
      setPaidByItem((prev) => {
        const next = { ...prev };
        delete next[item.id];
        return next;
      });
      toast.success(t("itemRemovedTitle"), item.product.name);
    } catch (e) {
      toast.error(
        t("errorTitle"),
        e instanceof Error ? e.message : t("errorGeneric"),
      );
    } finally {
      setBusy(false);
    }
  }

  async function handleUpdateItemQty(item: ListItem, quantity: number) {
    const qty = Math.floor(quantity);
    if (qty < 1) {
      toast.error(t("invalidQtyTitle"), t("invalidQtyDescription"));
      return;
    }
    if (qty === item.quantity) return;
    setBusy(true);
    try {
      await updateItemQuantity({ itemId: item.id, quantity: qty });
    } catch (e) {
      toast.error(
        t("errorTitle"),
        e instanceof Error ? e.message : t("errorGeneric"),
      );
    } finally {
      setBusy(false);
    }
  }

  async function handleUpdateItemPlannedCost(item: ListItem, plannedCostMad: number) {
    setPaidByItem((prev) => ({ ...prev, [item.id]: plannedCostMad }));
    try {
      await updateItemPlannedCost({
        itemId: item.id,
        plannedCostMad,
      });
    } catch (e) {
      toast.error(
        t("errorTitle"),
        e instanceof Error ? e.message : t("errorGeneric"),
      );
    }
  }

  async function handlePublish() {
    setBusy(true);
    try {
      await publishList({
        title: listTitle.trim() || undefined,
      });
      setListTitle("");
      setOpenedListId(null);
      closeSession();
      toast.success(t("publishedTitle"), t("publishedDescription"));
    } catch (e) {
      toast.error(
        t("errorTitle"),
        e instanceof Error ? e.message : t("errorGeneric"),
      );
    } finally {
      setBusy(false);
    }
  }

  async function handleFulfill(item: ListItem) {
    const paid =
      paidByItem[item.id] ?? item.plannedCostMad ?? item.product.costMad ?? 0;
    if (paid <= 0) {
      toast.error(t("invalidPriceTitle"), t("invalidPriceDescription"));
      return;
    }
    setBusy(true);
    try {
      await fulfillItem({ itemId: item.id, paidCostMad: paid });
      toast.success(t("fulfilledTitle"), item.product.name);
    } catch (e) {
      toast.error(
        t("errorTitle"),
        e instanceof Error ? e.message : t("errorGeneric"),
      );
    } finally {
      setBusy(false);
    }
  }

  async function handleComplete(listId: Id<"procurementLists">) {
    setBusy(true);
    try {
      await completeList({ listId });
      setOpenedListId(null);
      toast.success(t("completedTitle"), t("completedDescription"));
    } catch (e) {
      toast.error(
        t("errorTitle"),
        e instanceof Error ? e.message : t("errorGeneric"),
      );
    } finally {
      setBusy(false);
    }
  }

  const pendingCount = activeList?.pendingCount ?? 0;
  const isArabic = locale.startsWith("ar");
  const scanBarcodeLabel = t.has("scanBarcodeAria")
    ? t("scanBarcodeAria")
    : isArabic
      ? "مسح الباركود"
      : "Scanner un code-barres";
  const addProductLabel = t.has("addNewProduct")
    ? t("addNewProduct")
    : isArabic
      ? "منتج جديد"
      : "Nouveau produit";

  useEffect(() => {
    if (!openedListId || !openedList?.items.length) return;
    const firstId = openedList.items[0]!.productId;
    if (selectedProductId === null) {
      setSelectedProductId(firstId);
      return;
    }
    let found = false;
    for (let i = 0; i < openedList.items.length; i += 1) {
      if (openedList.items[i]!.productId === selectedProductId) {
        found = true;
        break;
      }
    }
    if (!found) setSelectedProductId(firstId);
  }, [openedListId, openedList, selectedProductId]);

  const draftTotals = useMemo(
    () =>
      sessionItems.length
        ? summarizeList(sessionItems, paidByItem)
        : null,
    [sessionItems, paidByItem],
  );

  const openedTotals = useMemo(
    () =>
      openedList?.items.length
        ? summarizeList(openedList.items, paidByItem)
        : null,
    [openedList?.items, paidByItem],
  );

  function buildPdfRowsFromList(list: { items: ListItem[] }): ProcurementListPdfRow[] {
    const procLabels = getDocumentLabels(documentLocale).procurement;
    return list.items.map((item: ListItem, index: number) => {
      const unitCost = unitCostMad(item, paidByItem);
      const linePurchase =
        unitCost != null && unitCost > 0 ? unitCost * item.quantity : null;
      return {
        index: index + 1,
        name: item.product.name,
        category: item.product.category,
        qty: item.quantity,
        unitCostLabel:
          unitCost != null && unitCost > 0
            ? formatMad(unitCost, 2, locale)
            : "—",
        unitSellLabel: formatMad(item.product.priceMad, 2, locale),
        lineTotalLabel:
          linePurchase != null ? formatMad(linePurchase, 2, locale) : "—",
        statusLabel:
          item.status === "bought" ? procLabels.bought : procLabels.pending,
      };
    });
  }

  function buildListPdfDocument(
    list: NonNullable<typeof openedList>,
    bon: ProcurementBonSummary | undefined,
  ): ProcurementListPdfDocument {
    const totals = summarizeList(list.items, paidByItem);
    const procLabels = getDocumentLabels(documentLocale).procurement;
    return {
      title: procLabels.defaultTitle,
      listTitle: list.title ?? bon?.title ?? null,
      statusLabel:
        list.status === "active"
          ? procLabels.listStatusActive
          : procLabels.listStatusCompleted,
      metaLine: list.publishedAt
        ? procLabels.publishedAt(formatDateTimeMediumFr(list.publishedAt))
        : "",
      totalLines: totals.lineCount,
      totalQty: totals.totalQty,
      totalPurchaseLabel: totals.hasMissingCost
        ? procLabels.totalPartial
        : formatMad(totals.totalPurchase, 2, locale),
      totalSellLabel: formatMad(totals.totalSell, 2, locale),
      rows: buildPdfRowsFromList(list),
      documentLocale,
    };
  }

  async function printListDocument(
    list: NonNullable<typeof openedList>,
    bon: ProcurementBonSummary | undefined,
  ) {
    await printProcurementListPdf(buildListPdfDocument(list, bon));
  }

  async function downloadListDocument(
    list: NonNullable<typeof openedList>,
    bon: ProcurementBonSummary | undefined,
  ) {
    await downloadProcurementListPdf(buildListPdfDocument(list, bon));
  }

  async function shareListDocument(
    list: NonNullable<typeof openedList>,
    bon: ProcurementBonSummary | undefined,
  ) {
    const { blob, filename } = await buildProcurementListPdfBlob(
      buildListPdfDocument(list, bon),
    );
    const result = await sharePdfViaWhatsApp({
      blob,
      filename,
      message: procurementListWhatsAppShareMessage(
        list.title ?? bon?.title,
        locale,
      ),
      phoneDigits: appSettings?.storePhone ?? null,
      uploadShareLink,
    });
    const toastCopy = whatsAppShareToastCopy(result, locale);
    toast.success(toastCopy.title, toastCopy.description);
  }

  useEffect(() => {
    if (!pdfBonId || pdfList === undefined || !pdfList) return;
    const bon = publishedBons.find((row) => row.id === pdfBonId);
    setPdfDownloading(true);
    void downloadListDocument(pdfList, bon)
      .catch(() => {
        toast.error(t("downloadListError"));
      })
      .finally(() => {
        setPdfDownloading(false);
        setPdfBonId(null);
      });
  }, [pdfBonId, pdfList, publishedBons, locale, paidByItem, t, toast]);

  useEffect(() => {
    if (!shareBonId || shareList === undefined || !shareList) return;
    const bon = publishedBons.find((row) => row.id === shareBonId);
    setPdfSharing(true);
    void shareListDocument(shareList, bon)
      .catch(() => {
        toast.error(t("shareListError"));
      })
      .finally(() => {
        setPdfSharing(false);
        setShareBonId(null);
      });
  }, [shareBonId, shareList, publishedBons, locale, paidByItem, t, toast]);

  function handleOpenBon(bonId: Id<"procurementLists">) {
    setOpenedListId(bonId);
    setSelectedProductId(null);
  }

  function handlePrintBon(bon: ProcurementBonSummary) {
    setOpenedListId(bon.id);
    setPendingPrintListId(bon.id);
  }

  useEffect(() => {
    if (!pendingPrintListId) return;
    if (openedListId !== pendingPrintListId) return;
    // Still fetching the list — keep waiting.
    if (openedList === undefined) return;

    if (!openedList || openedList.items.length === 0) {
      setPendingPrintListId(null);
      toast.error(t("downloadListError"));
      return;
    }

    let cancelled = false;
    const bon = publishedBons.find((row) => row.id === pendingPrintListId);
    void printListDocument(openedList, bon)
      .catch(() => {
        if (!cancelled) toast.error(t("downloadListError"));
      })
      .finally(() => {
        if (!cancelled) setPendingPrintListId(null);
      });

    return () => {
      cancelled = true;
    };
  }, [
    pendingPrintListId,
    openedListId,
    openedList,
    publishedBons,
    locale,
    paidByItem,
    documentLocale,
    t,
    toast,
  ]);

  function handleDownloadBon(bon: ProcurementBonSummary) {
    setPdfBonId(bon.id);
  }

  function handleShareBon(bon: ProcurementBonSummary) {
    setShareBonId(bon.id);
  }

  return (
    <div className="bg-surface text-on-background flex min-h-0 flex-1 flex-col">
      <BarcodeScanDialog
        open={scanOpen}
        onOpenChange={setScanOpen}
        onScan={handleBarcodeScan}
      />
      <AddProductDialog
        open={addProductOpen}
        onOpenChange={setAddProductOpen}
        prefill={addProductPrefill}
        onCreated={handleProductCreated}
        openCameraOnOpen
      />
      <main className="w-full flex-1 overflow-auto px-3 pt-2 sm:p-6 lg:p-8">
        <div className="admin-page-scroll-content flex flex-col gap-4">
          <section className="border-sidebar-border bg-surface-container-low/40 flex min-w-0 flex-col rounded-2xl border">
        {sessionOpen && canManage ? (
          <>
            <header className="border-sidebar-border flex flex-wrap items-center justify-between gap-3 border-b px-4 py-4 sm:px-5">
              <div>
                <h2 className="text-on-background text-lg font-bold">
                  {isUnlockingActiveList
                    ? t("unlockSessionTitle")
                    : t("draftSectionTitle")}
                </h2>
                <p className="text-muted-foreground mt-0.5 text-sm">
                  {isUnlockingActiveList
                    ? t("unlockSessionHint")
                    : t("draftSessionHint")}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  className="rounded-xl"
                  onClick={() => setScanOpen(true)}
                  disabled={busy}
                >
                  <ScanBarcode className="size-4" aria-hidden />
                  {scanBarcodeLabel}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="rounded-xl"
                  onClick={() => openAddProductDialog()}
                  disabled={busy}
                >
                  <PackagePlus className="size-4" aria-hidden />
                  {addProductLabel}
                </Button>
                {isUnlockingActiveList ? (
                  <Button
                    type="button"
                    className="rounded-xl"
                    disabled={busy}
                    onClick={finishUnlockSession}
                  >
                    <Check className="size-4" aria-hidden />
                    {t("finishUnlock")}
                  </Button>
                ) : (
                  <>
                    <Button
                      type="button"
                      variant="outline"
                      className="rounded-xl"
                      onClick={closeSession}
                      disabled={busy}
                    >
                      <X className="size-4" aria-hidden />
                      {t("cancel")}
                    </Button>
                    <Button
                      type="button"
                      className="rounded-xl"
                      disabled={busy || draftItemCount === 0}
                      onClick={() => void handlePublish()}
                    >
                      <ShoppingCart className="size-4" aria-hidden />
                      {t("publishList")}
                    </Button>
                  </>
                )}
              </div>
            </header>

            <div className="px-4 py-4 sm:px-5">
              <AdminFilterSummary
                filteredCount={filteredSessionItems.length}
                totalCount={sessionItemCount}
                searchQuery={headerSearchQuery}
                onClearSearch={() => setHeaderSearchQuery("")}
                itemLabel={tr("ligne", "سطر")}
                itemLabelPlural={tr("lignes", "أسطر")}
                className="mb-4"
              />
              {activeList && !isUnlockingActiveList && draftItemCount === 0 ? (
                <p className="bg-warning-container/40 text-on-warning-container mb-4 rounded-xl px-3 py-2.5 text-sm leading-snug">
                  {t("activeListNewDraftHint", { count: pendingCount })}
                </p>
              ) : null}
              {activeList && !isUnlockingActiveList && draftItemCount > 0 ? (
                <p className="bg-primary/10 text-primary mb-4 rounded-xl px-3 py-2.5 text-sm leading-snug">
                  {t("draftWhileActiveBanner", { count: draftItemCount })}
                </p>
              ) : null}
              {isUnlockingActiveList ? (
                <p className="bg-primary/10 text-primary mb-4 rounded-xl px-3 py-2.5 text-sm leading-snug">
                  {t("unlockSessionBanner")}
                </p>
              ) : null}

              <PosDialogProductPicker
                selectedProductId={lastPickedId}
                onSelectProduct={(product) => void addProductFromCatalog(product)}
                pickMode="stock"
                tr={tr}
                gridClassName="max-h-[min(55vh,480px)] sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6"
              />

              {!hasSessionLines ? (
                <p className="text-muted-foreground mt-4 text-center text-sm">
                  {t("draftPickHint")}
                </p>
              ) : null}

              {sessionList && sessionList.items.length > 0 ? (
                <div className="mt-6 space-y-4">
                  {!isUnlockingActiveList ? (
                    <div className="flex flex-wrap items-end gap-3">
                      <div className="min-w-0 flex-1">
                        <label className="text-muted-foreground mb-1 block text-xs font-medium">
                          {t("listTitleOptional")}
                        </label>
                        <Input
                          value={listTitle}
                          onChange={(e) => setListTitle(e.target.value)}
                          placeholder={t("listTitlePlaceholder")}
                          className="h-10"
                          dir="auto"
                          lang={locale}
                        />
                      </div>
                    </div>
                  ) : null}
                  <div>
                    <p className="text-muted-foreground mb-2 text-xs font-bold tracking-wide uppercase">
                      {isUnlockingActiveList
                        ? t("activeLinesTitle")
                        : t("draftLinesTitle")}
                    </p>
                    <ProcurementListTable
                      items={filteredSessionItems}
                      paidByItem={paidByItem}
                      onPaidChange={(itemId, value) =>
                        setPaidByItem((prev) => ({ ...prev, [itemId]: value }))
                      }
                      selectedProductId={selectedProductId}
                      onSelectProduct={setSelectedProductId}
                      locale={locale}
                      isDraftMode={!isUnlockingActiveList}
                      canEditCost
                      canRemovePending={isUnlockingActiveList && canManage}
                      canFulfill={canFulfill && isUnlockingActiveList}
                      hasActiveList={isUnlockingActiveList}
                      busy={busy}
                      onFulfill={(item) => void handleFulfill(item)}
                      onRemove={(item) => void handleRemoveItem(item)}
                      onQtyChange={(item, qty) => void handleUpdateItemQty(item, qty)}
                      onPlannedCostChange={(item, value) =>
                        void handleUpdateItemPlannedCost(item, value)
                      }
                      onShowPriceHistory={(item) => setSelectedProductId(item.productId)}
                      listTotals={draftTotals}
                      tr={t}
                    />
                  </div>
                </div>
              ) : null}
            </div>
          </>
        ) : (
          <>
            <header className="border-sidebar-border flex flex-wrap items-start justify-between gap-3 border-b px-4 py-4 md:px-6">
              <div className="min-w-0 flex-1">
                <div className="mb-1 flex flex-wrap items-center gap-2">
                  <span className="bg-primary/10 text-primary flex size-10 items-center justify-center rounded-xl">
                    <ShoppingCart className="size-5" aria-hidden />
                  </span>
                  <div>
                    <p className="text-primary text-[10px] font-bold tracking-widest uppercase">
                      {t("documentTitle")}
                    </p>
                    <h1 className="text-lg font-black tracking-tight">{t("title")}</h1>
                  </div>
                </div>
                <p className="text-muted-foreground text-sm">{t("pageDescription")}</p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {activeList && pendingCount > 0 ? (
                  <span className={cn(statusPillClass, "bg-warning-container text-on-warning-container px-3 py-1 text-xs font-semibold")}>
                    {t("pendingBanner", { count: pendingCount })}
                  </span>
                ) : null}
                {canManage ? (
                  <Button
                    type="button"
                    className="h-10 shrink-0 rounded-xl"
                    onClick={openSession}
                  >
                    <Plus className="size-4" aria-hidden />
                    {t("newList")}
                  </Button>
                ) : null}
              </div>
            </header>

            <div className="px-4 py-4 md:px-6">
              <AdminFilterSummary
                filteredCount={filteredBons.length}
                totalCount={publishedBons.length}
                searchQuery={headerSearchQuery}
                onClearSearch={() => setHeaderSearchQuery("")}
                itemLabel={tr("bon", "أمر")}
                itemLabelPlural={tr("bons", "أوامر")}
                className="mb-4"
              />
              {catalogLoading || listsLoading ? (
                <ProcurementBonsTableSkeleton />
              ) : publishedBons.length === 0 && !canManage ? (
                <div className="text-muted-foreground flex flex-col items-center justify-center gap-2 py-16 text-center text-sm">
                  <ShoppingCart className="size-10 opacity-40" aria-hidden />
                  <p className="font-medium">{t("emptyTitle")}</p>
                  <p>{t("emptyWorkerHint")}</p>
                </div>
              ) : (
                <div className="flex flex-col gap-3">
                  <p className="text-muted-foreground text-xs font-bold tracking-wide uppercase">
                    {t("bonsTableTitle")}
                  </p>
                  {filteredBons.length === 0 ? (
                    <p className="text-muted-foreground text-sm">{t("bonsEmptyHint")}</p>
                  ) : (
                    <ProcurementBonsTable
                      bons={filteredBons}
                      selectedBonId={openedListId}
                      locale={locale}
                      canExportPdf={canExportPdf}
                      pdfDownloadingId={pdfDownloading ? pdfBonId : null}
                      pdfSharingId={pdfSharing ? shareBonId : null}
                      onOpen={handleOpenBon}
                      onUnlock={(bon) => openUnlockedSession(bon.id)}
                      onPrint={handlePrintBon}
                      onDownload={handleDownloadBon}
                      onShare={handleShareBon}
                      tr={t}
                      formatDate={formatUiHistoryDate}
                    />
                  )}
                </div>
              )}
            </div>
          </>
        )}
          </section>
        </div>
      </main>

      <ProcurementListDetailSheet
        open={openedListId !== null}
        onOpenChange={(next) => {
          if (!next) setOpenedListId(null);
        }}
        list={
          openedListId && openedList
            ? {
                id: openedList.id,
                status: openedList.status as "active" | "completed",
                title: openedList.title,
                publishedAt: openedList.publishedAt,
                items: openedList.items,
                pendingCount: openedList.pendingCount,
              }
            : openedListId
              ? undefined
              : null
        }
        bonNumber={openedBonNumber}
        locale={locale}
        paidByItem={paidByItem}
        onPaidChange={(itemId, value) =>
          setPaidByItem((prev) => ({ ...prev, [itemId]: value }))
        }
        selectedProductId={selectedProductId}
        onSelectProduct={setSelectedProductId}
        canFulfill={canFulfill}
        canManage={canManage}
        busy={busy}
        canExportPdf={canExportPdf}
        pdfDownloading={pdfDownloading}
        pdfSharing={pdfSharing}
        onFulfill={(item) => void handleFulfill(item)}
        onQtyChange={(item, qty) => void handleUpdateItemQty(item, qty)}
        onPlannedCostChange={(item, value) =>
          void handleUpdateItemPlannedCost(item, value)
        }
        onUnlock={
          openedList?.status === "active" && canManage
            ? () => openUnlockedSession(openedList.id)
            : undefined
        }
        onComplete={
          openedList?.status === "active" && canManage
            ? () => void handleComplete(openedList.id)
            : undefined
        }
        onPrint={() => {
          if (!openedList) return;
          const bon = publishedBons.find((row) => row.id === openedList.id);
          void printListDocument(openedList, bon).catch(() => {
            toast.error(t("downloadListError"));
          });
        }}
        onDownload={() => {
          if (openedList) {
            const bon = publishedBons.find((row) => row.id === openedList.id);
            setPdfDownloading(true);
            void downloadListDocument(openedList, bon)
              .catch(() => toast.error(t("downloadListError")))
              .finally(() => setPdfDownloading(false));
          }
        }}
        onShare={() => {
          if (openedList) {
            const bon = publishedBons.find((row) => row.id === openedList.id);
            setPdfSharing(true);
            void shareListDocument(openedList, bon)
              .catch(() => toast.error(t("shareListError")))
              .finally(() => setPdfSharing(false));
          }
        }}
        listTotals={openedTotals}
        tr={t}
        formatDate={formatUiHistoryDate}
      />
    </div>
  );
}
