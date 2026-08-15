"use client";

import { useState } from "react";
import { useConvex, useQuery } from "convex/react";
import { FileDown, Printer } from "lucide-react";

import type { CreditStatementPrintProps } from "@/components/credits/credit-statement-print";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toaster";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { canExportReports } from "@/lib/auth/permissions";
import {
  downloadClientRelevePdf,
  printClientRelevePdf,
} from "@/lib/invoices/download-client-releve-pdf";

type CreditStatementActionsProps = {
  client: CreditStatementPrintProps["client"] & { id: string };
  tr: (fr: string, ar: string) => string;
  className?: string;
  /** Icon-only buttons (no label text). */
  iconOnly?: boolean;
  /** History filter “Du” (YYYY-MM-DD) — applied to relevé PDF/print. */
  dateFrom?: string;
  /** History filter “Au” (YYYY-MM-DD) — applied to relevé PDF/print. */
  dateTo?: string;
};

export function CreditStatementActions({
  client,
  tr,
  className,
  iconOnly = false,
  dateFrom,
  dateTo,
}: CreditStatementActionsProps) {
  const toast = useToast();
  const convex = useConvex();
  const [busy, setBusy] = useState<"download" | "print" | null>(null);
  const settingsRow = useQuery(api.settings.getAppSettings);
  const currentUser = useQuery(api.authz.currentUser);
  const canExportPdf = canExportReports(currentUser?.permissions ?? []);

  function releveArgs() {
    return {
      clientId: client.id as Id<"clients">,
      clientName: client.fullName,
      settingsSource: settingsRow,
      dateFrom,
      dateTo,
    };
  }

  function rangeHint() {
    if (!dateFrom && !dateTo) return "";
    return tr(
      ` · ${dateFrom || "…"} → ${dateTo || "…"}`,
      ` · ${dateFrom || "…"} → ${dateTo || "…"}`,
    );
  }

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
    setBusy("download");
    try {
      const result = await downloadClientRelevePdf(convex, releveArgs());
      toast.success(
        tr("PDF téléchargé", "تم تنزيل PDF"),
        tr(
          `Relevé · ${result.invoiceCount} facture(s) · ${result.versementCount} versement(s)${rangeHint()}.`,
          `كشف · ${result.invoiceCount} فاتورة · ${result.versementCount} تحصيل${rangeHint()}.`,
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
      setBusy(null);
    }
  }

  async function handlePrint() {
    if (!canExportPdf) {
      toast.error(
        tr("Impression non autorisée", "الطباعة غير مسموحة"),
        tr(
          "Votre rôle n'a pas la permission d'exporter des PDF.",
          "دورك لا يملك صلاحية تصدير PDF.",
        ),
      );
      return;
    }
    setBusy("print");
    try {
      const result = await printClientRelevePdf(convex, releveArgs());
      toast.success(
        tr("Impression prête", "جاهز للطباعة"),
        tr(
          `Relevé · ${result.invoiceCount} facture(s) · ${result.versementCount} versement(s)${rangeHint()}.`,
          `كشف · ${result.invoiceCount} فاتورة · ${result.versementCount} تحصيل${rangeHint()}.`,
        ),
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : undefined;
      toast.error(
        tr("Échec de l'impression", "فشل الطباعة"),
        message ??
          tr(
            "Impossible d'imprimer le relevé. Réessayez.",
            "تعذر طباعة الكشف. أعد المحاولة.",
          ),
      );
    } finally {
      setBusy(null);
    }
  }

  if (iconOnly) {
    return (
      <div className={className ?? "flex flex-wrap items-center justify-end gap-1"}>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-8 gap-1 rounded-lg px-2 text-[11px] font-bold print:hidden"
          onClick={() => void handlePrint()}
          disabled={busy != null || !canExportPdf}
          title={tr("Imprimer relevé", "طباعة الكشف")}
        >
          <Printer className="size-3.5 stroke-[1.75]" aria-hidden />
          {busy === "print"
            ? tr("…", "…")
            : tr("Imprimer", "طباعة")}
        </Button>
        <Button
          type="button"
          size="sm"
          className="h-8 gap-1 rounded-lg px-2 text-[11px] font-bold print:hidden"
          onClick={() => void handleDownload()}
          disabled={busy != null || !canExportPdf}
          title={tr("Télécharger PDF", "تنزيل PDF")}
        >
          <FileDown className="size-3.5 stroke-[1.75]" aria-hidden />
          {busy === "download" ? tr("…", "…") : "PDF"}
        </Button>
      </div>
    );
  }

  return (
    <div className={className ?? "flex flex-wrap items-center gap-2"}>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="gap-2 rounded-xl font-bold print:hidden"
        onClick={() => void handlePrint()}
        disabled={busy != null || !canExportPdf}
      >
        <Printer className="size-4 stroke-[1.75]" aria-hidden />
        {busy === "print"
          ? tr("Impression…", "جاري الطباعة…")
          : tr("Imprimer relevé", "طباعة الكشف")}
      </Button>
      <Button
        type="button"
        size="sm"
        className="gap-2 rounded-xl font-bold print:hidden"
        onClick={() => void handleDownload()}
        disabled={busy != null || !canExportPdf}
      >
        <FileDown className="size-4 stroke-[1.75]" aria-hidden />
        {busy === "download"
          ? tr("Téléchargement…", "جاري التنزيل…")
          : tr("Télécharger PDF", "تنزيل PDF")}
      </Button>
    </div>
  );
}
