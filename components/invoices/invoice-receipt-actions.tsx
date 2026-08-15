"use client";

import { useState } from "react";
import { useQuery } from "convex/react";
import { FileDown, Printer } from "lucide-react";

import { WhatsAppShareButton } from "@/components/share/whatsapp-share-button";
import type { InvoiceReceiptMode } from "@/components/invoices/invoice-receipt-preview";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toaster";
import { api } from "@/convex/_generated/api";
import { canDownloadInvoicePdf } from "@/lib/auth/permissions";
import {
  buildInvoicePdfBlob,
  downloadInvoicePdf,
} from "@/lib/invoices/download-invoice-pdf";
import { invoiceWhatsAppShareMessage } from "@/lib/invoices/invoice-share-message";
import type { Invoice } from "@/lib/invoices/types";
import {
  sharePdfViaWhatsApp,
  whatsAppShareToastCopy,
} from "@/lib/share/share-pdf-whatsapp";
import { usePdfShareUpload } from "@/hooks/use-pdf-share-upload";
import { useLocale } from "next-intl";

import { cn } from "@/lib/utils";

type InvoiceReceiptActionsProps = {
  invoice: Invoice;
  mode: InvoiceReceiptMode;
  onPrint: () => void;
  tr: (fr: string, ar: string) => string;
  className?: string;
  clientPhone?: string | null;
};

export function InvoiceReceiptActions({
  invoice,
  mode,
  onPrint,
  tr,
  className,
  clientPhone,
}: InvoiceReceiptActionsProps) {
  const locale = useLocale();
  const toast = useToast();
  const uploadShareLink = usePdfShareUpload();
  const [downloading, setDownloading] = useState(false);
  const [sharing, setSharing] = useState(false);
  const isOwnerMode = mode === "owner";
  const settingsRow = useQuery(api.settings.getAppSettings);
  const currentUser = useQuery(api.authz.currentUser);
  const canExportPdf = canDownloadInvoicePdf(currentUser?.permissions ?? []);

  async function handleDownload() {
    if (!canExportPdf) {
      toast.error(
        tr("Export non autorisé", "التصدير غير مسموح"),
        tr(
          "Votre rôle n'a pas la permission d'exporter des PDF.",
          "دورك لا يملك صلاحية تصدير PDF.",
        ),
      );
      return;
    }
    setDownloading(true);
    try {
      await downloadInvoicePdf(invoice, settingsRow, mode);
      toast.success(
        tr("PDF téléchargé", "تم تنزيل PDF"),
        isOwnerMode
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
      setDownloading(false);
    }
  }

  async function handleWhatsAppShare() {
    if (!canExportPdf) {
      toast.error(
        tr("Export non autorisé", "التصدير غير مسموح"),
        tr(
          "Votre rôle n'a pas la permission d'exporter des PDF.",
          "دورك لا يملك صلاحية تصدير PDF.",
        ),
      );
      return;
    }
    setSharing(true);
    try {
      const shareMode = isOwnerMode ? "owner" : "client";
      const { blob, filename } = await buildInvoicePdfBlob(
        invoice,
        settingsRow,
        shareMode,
      );
      const result = await sharePdfViaWhatsApp({
        blob,
        filename,
        message: invoiceWhatsAppShareMessage(invoice, locale),
        phoneDigits: isOwnerMode ? null : clientPhone,
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
      setSharing(false);
    }
  }

  return (
    <div
      className={cn(
        "flex min-w-0 flex-col gap-2 print:hidden",
        className,
      )}
    >
      <Button
        type="button"
        variant="outline"
        className="w-full gap-2 rounded-xl font-bold"
        onClick={onPrint}
      >
        <Printer className="size-4 shrink-0 stroke-[1.75]" aria-hidden />
        <span className="truncate">
          {isOwnerMode
            ? tr("Imprimer copie interne", "طباعة نسخة المتجر")
            : tr("Imprimer ticket client", "طباعة تذكرة الزبون")}
        </span>
      </Button>
      <div className="flex min-w-0 gap-2">
        <Button
          type="button"
          className="min-w-0 flex-1 gap-2 rounded-xl font-bold"
          onClick={handleDownload}
          disabled={downloading || !canExportPdf}
        >
          <FileDown className="size-4 shrink-0 stroke-[1.75]" aria-hidden />
          <span className="truncate">
            {downloading
              ? tr("Téléchargement…", "جاري التنزيل…")
              : tr("Télécharger PDF", "تنزيل PDF")}
          </span>
        </Button>
        <WhatsAppShareButton
          onClick={() => void handleWhatsAppShare()}
          disabled={!canExportPdf}
          busy={sharing}
          ariaLabel={tr("Partager sur WhatsApp", "مشاركة عبر واتساب")}
          className="border-sidebar-border size-10 shrink-0 rounded-xl border bg-white"
        />
      </div>
    </div>
  );
}
