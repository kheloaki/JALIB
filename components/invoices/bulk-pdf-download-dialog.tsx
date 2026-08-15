"use client";

import { Files, Loader2, ScrollText } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

type BulkPdfDownloadDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedCount: number;
  busy?: boolean;
  tr: (fr: string, ar: string) => string;
  onDownloadCombined: () => void;
  onDownloadSeparate: () => void;
};

export function BulkPdfDownloadDialog({
  open,
  onOpenChange,
  selectedCount,
  busy = false,
  tr,
  onDownloadCombined,
  onDownloadSeparate,
}: BulkPdfDownloadDialogProps) {
  const countLabel =
    selectedCount <= 1
      ? tr(
          `${selectedCount} facture sélectionnée`,
          `${selectedCount} فاتورة محددة`,
        )
      : tr(
          `${selectedCount} factures sélectionnées`,
          `${selectedCount} فواتير محددة`,
        );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg gap-0 overflow-hidden p-0 sm:max-w-lg">
        <DialogHeader className="border-sidebar-border space-y-1.5 border-b px-5 py-4 pr-12 text-start">
          <DialogTitle className="text-lg font-bold tracking-tight">
            {tr("Télécharger les PDF", "تنزيل ملفات PDF")}
          </DialogTitle>
          <DialogDescription className="text-on-surface-variant text-sm leading-relaxed">
            {countLabel}.{" "}
            {tr("Choisissez le format d’export.", "اختر صيغة التصدير.")}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-3 p-5">
          <button
            type="button"
            disabled={busy || selectedCount < 1}
            onClick={onDownloadCombined}
            className={cn(
              "border-primary/20 bg-primary text-on-primary hover:bg-primary/92 flex w-full items-start gap-3.5 rounded-2xl border px-4 py-4 text-start transition-colors",
              "focus-visible:ring-primary/40 focus-visible:ring-2 focus-visible:outline-none",
              "disabled:pointer-events-none disabled:opacity-55",
            )}
          >
            <span className="bg-on-primary/15 flex size-10 shrink-0 items-center justify-center rounded-xl">
              {busy ? (
                <Loader2 className="size-5 animate-spin" aria-hidden />
              ) : (
                <ScrollText className="size-5 stroke-[1.75]" aria-hidden />
              )}
            </span>
            <span className="min-w-0 flex-1 space-y-1">
              <span className="block text-sm font-bold">
                {tr("Relevé client (1 PDF)", "كشف العميل (PDF واحد)")}
              </span>
              <span className="text-on-primary/80 block text-xs leading-snug font-medium">
                {tr(
                  "Solde initial du client, puis débit / crédit et solde après chaque facture.",
                  "الرصيد الافتتاحي للعميل، ثم مدين / دائن والرصيد بعد كل فاتورة.",
                )}
              </span>
            </span>
          </button>

          <button
            type="button"
            disabled={busy || selectedCount < 1}
            onClick={onDownloadSeparate}
            className={cn(
              "border-sidebar-border bg-surface-container-low text-on-surface hover:bg-surface-container-high flex w-full items-start gap-3.5 rounded-2xl border px-4 py-4 text-start transition-colors",
              "focus-visible:ring-primary/40 focus-visible:ring-2 focus-visible:outline-none",
              "disabled:pointer-events-none disabled:opacity-55",
            )}
          >
            <span className="bg-surface-container-highest text-primary flex size-10 shrink-0 items-center justify-center rounded-xl">
              {busy ? (
                <Loader2 className="size-5 animate-spin" aria-hidden />
              ) : (
                <Files className="size-5 stroke-[1.75]" aria-hidden />
              )}
            </span>
            <span className="min-w-0 flex-1 space-y-1">
              <span className="block text-sm font-bold">
                {tr("PDF séparés", "ملفات PDF منفصلة")}
              </span>
              <span className="text-on-surface-variant block text-xs leading-snug font-medium">
                {tr(
                  "Une facture interne A4 par fichier, sans fusion.",
                  "فاتورة داخلية A4 لكل ملف، بدون دمج.",
                )}
              </span>
            </span>
          </button>
        </div>

        <div className="border-sidebar-border flex justify-end border-t px-5 py-3">
          <Button
            type="button"
            variant="ghost"
            disabled={busy}
            onClick={() => onOpenChange(false)}
            className="rounded-xl"
          >
            {tr("Annuler", "إلغاء")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
