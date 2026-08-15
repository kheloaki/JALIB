"use client";

import { useMemo } from "react";
import { Download, LockOpen, Printer, X } from "lucide-react";

import { WhatsAppShareButton } from "@/components/share/whatsapp-share-button";

import { ProcurementListTable } from "@/components/procurement/procurement-list-table";
import { ProcurementPriceHistoryPanel } from "@/components/procurement/procurement-price-history-panel";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import type { Id } from "@/convex/_generated/dataModel";
import { formatMad } from "@/lib/money/mad";

type ListItem = {
  id: Id<"procurementListItems">;
  productId: Id<"products">;
  quantity: number;
  status: "pending" | "bought";
  plannedCostMad: number | null;
  paidCostMad: number | null;
  boughtAt: string | null;
  product: {
    id: Id<"products">;
    name: string;
    category: string;
    image: string;
    imageAlt: string;
    barcode: string | null;
    costMad: number | null;
    priceMad: number;
    stockQty: number;
  };
};

type OpenedList = {
  id: Id<"procurementLists">;
  status: "active" | "completed";
  title: string | null;
  publishedAt: string | null;
  items: ListItem[];
  pendingCount: number;
};

type ProcurementListDetailSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  list: OpenedList | null | undefined;
  bonNumber: string;
  locale: string;
  paidByItem: Record<string, number>;
  onPaidChange: (itemId: string, value: number) => void;
  selectedProductId: Id<"products"> | null;
  onSelectProduct: (productId: Id<"products">) => void;
  canFulfill: boolean;
  canManage: boolean;
  busy: boolean;
  canExportPdf: boolean;
  pdfDownloading: boolean;
  pdfSharing: boolean;
  onFulfill: (item: ListItem) => void;
  onQtyChange: (item: ListItem, quantity: number) => void;
  onPlannedCostChange: (item: ListItem, plannedCostMad: number) => void;
  onUnlock?: () => void;
  onComplete?: () => void;
  onPrint: () => void;
  onDownload: () => void;
  onShare: () => void;
  listTotals: {
    lineCount: number;
    totalQty: number;
    totalPurchase: number;
    totalSell: number;
    hasMissingCost: boolean;
  } | null;
  tr: (key: string, values?: Record<string, string | number>) => string;
  formatDate: (iso: string) => string;
};

export function ProcurementListDetailSheet({
  open,
  onOpenChange,
  list,
  bonNumber,
  locale,
  paidByItem,
  onPaidChange,
  selectedProductId,
  onSelectProduct,
  canFulfill,
  canManage,
  busy,
  canExportPdf,
  pdfDownloading,
  pdfSharing,
  onFulfill,
  onQtyChange,
  onPlannedCostChange,
  onUnlock,
  onComplete,
  onPrint,
  onDownload,
  onShare,
  listTotals,
  tr,
  formatDate,
}: ProcurementListDetailSheetProps) {
  const isActive = list?.status === "active";

  const selectedProductPreview = useMemo(() => {
    if (!selectedProductId || !list) return null;
    const line = list.items.find((item) => item.productId === selectedProductId);
    if (!line) return null;
    return {
      name: line.product.name,
      category: line.product.category,
      image: line.product.image,
      imageAlt: line.product.imageAlt,
    };
  }, [list, selectedProductId]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        size="wide"
        showCloseButton={false}
        className="flex flex-col gap-0 p-0"
      >
        <SheetHeader className="border-sidebar-border shrink-0 border-b px-5 py-4 text-start">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <SheetDescription className="text-primary text-[10px] font-bold tracking-widest uppercase">
                {tr("bonDetailTitle")}
              </SheetDescription>
              <SheetTitle className="text-lg font-black">{bonNumber}</SheetTitle>
              {list ? (
                <p className="text-muted-foreground mt-1 text-sm">
                  {list.title?.trim() || tr("bonUntitled")}
                  {list.publishedAt ? (
                    <>
                      <span className="mx-1.5">·</span>
                      {formatDate(list.publishedAt)}
                    </>
                  ) : null}
                </p>
              ) : null}
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="shrink-0 rounded-lg"
              onClick={() => onOpenChange(false)}
              aria-label={tr("closeBon")}
            >
              <X className="size-4" aria-hidden />
            </Button>
          </div>
          <div className="mt-3 flex flex-wrap gap-2 print:hidden">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-9 rounded-lg"
              disabled={!list?.items.length}
              onClick={onPrint}
            >
              <Printer className="size-3.5" aria-hidden />
              {tr("printList")}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-9 rounded-lg"
              disabled={!list?.items.length || !canExportPdf || pdfDownloading}
              onClick={onDownload}
            >
              <Download className="size-3.5" aria-hidden />
              {tr("downloadList")}
            </Button>
            <WhatsAppShareButton
              onClick={onShare}
              disabled={!list?.items.length || !canExportPdf}
              busy={pdfSharing}
              ariaLabel={tr("shareListWhatsApp")}
              className="size-9 shrink-0 rounded-lg"
            />
            {canManage && isActive && onComplete ? (
              <>
                {onUnlock ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-9 rounded-lg"
                    disabled={busy}
                    onClick={onUnlock}
                  >
                    <LockOpen className="size-3.5" aria-hidden />
                    {tr("unlockList")}
                  </Button>
                ) : null}
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-9 rounded-lg"
                disabled={busy}
                onClick={onComplete}
              >
                {tr("completeList")}
              </Button>
              </>
            ) : null}
          </div>
          {listTotals ? (
            <p className="text-muted-foreground mt-2 text-xs">
              {tr("bonDetailSummary", {
                lines: listTotals.lineCount,
                qty: listTotals.totalQty,
                total: listTotals.hasMissingCost
                  ? tr("totalPartial")
                  : formatMad(listTotals.totalPurchase, 2, locale),
              })}
            </p>
          ) : null}
        </SheetHeader>

        <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
          <div
            id="procurement-list-print-area"
            className="min-h-0 min-w-0 flex-1 overflow-y-auto px-4 py-4"
          >
            {!list ? (
              <p className="text-muted-foreground text-sm">{tr("loading")}</p>
            ) : list.items.length === 0 ? (
              <p className="text-muted-foreground text-sm">{tr("emptyTitle")}</p>
            ) : (
              <ProcurementListTable
                items={list.items}
                paidByItem={paidByItem}
                onPaidChange={onPaidChange}
                selectedProductId={selectedProductId}
                onSelectProduct={onSelectProduct}
                locale={locale}
                isDraftMode={false}
                canEditCost={(canManage || canFulfill) && isActive}
                canFulfill={canFulfill && isActive}
                hasActiveList={isActive}
                busy={busy}
                onFulfill={onFulfill}
                onRemove={() => {}}
                onQtyChange={onQtyChange}
                onPlannedCostChange={onPlannedCostChange}
                onShowPriceHistory={(item) => onSelectProduct(item.productId)}
                listTotals={listTotals}
                tr={tr}
              />
            )}
          </div>

          <aside className="border-sidebar-border bg-surface-container-low/40 flex min-h-[14rem] shrink-0 flex-col border-t lg:min-h-0 lg:w-80 lg:border-t-0 lg:border-s print:hidden xl:w-96">
            <header className="border-sidebar-border shrink-0 border-b px-4 py-3">
              <h2 className="text-sm font-bold">{tr("pricePanelTitle")}</h2>
            </header>
            <div className="min-h-0 flex-1 overflow-y-auto p-4">
              <ProcurementPriceHistoryPanel
                productId={selectedProductId}
                productPreview={selectedProductPreview}
                locale={locale}
                tr={tr}
                formatDate={formatDate}
              />
            </div>
          </aside>
        </div>
      </SheetContent>
    </Sheet>
  );
}

export type { ListItem as ProcurementDetailListItem };
