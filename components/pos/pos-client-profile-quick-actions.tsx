"use client";

import { useCallback, useMemo, useState } from "react";
import { useConvex, useMutation, useQuery } from "convex/react";
import {
  Banknote,
  FileDown,
  History,
  Loader2,
  Printer,
  Wallet,
} from "lucide-react";

import { CreditsRegisterPaymentDialog } from "@/components/credits/credits-register-payment-dialog";
import { Button } from "@/components/ui/button";
import {
  PosDialog,
  PosDialogContent,
  PosDialogDescription,
  PosDialogFooter,
  PosDialogHeader,
  PosDialogTitle,
} from "@/components/pos/pos-dialog";
import { useToast } from "@/components/ui/toaster";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { canCollectCredits, canExportReports } from "@/lib/auth/permissions";
import type { CreditStore, LedgerEntry } from "@/lib/credits/types";
import type { Client } from "@/lib/clients/types";
import {
  downloadClientRelevePdf,
  printClientRelevePdf,
} from "@/lib/invoices/download-client-releve-pdf";
import { formatPosDh } from "@/lib/pos/format-pos-dh";
import { cn } from "@/lib/utils";

const QUICK_PAY_AMOUNTS = [100, 200, 500] as const;

type PosClientProfileQuickActionsProps = {
  client: Client;
  entries: LedgerEntry[];
  encoursMad: number;
  locale: string;
  tr: (fr: string, ar: string) => string;
  onOpenHistory: () => void;
};

function QuickActionButton({
  label,
  icon: Icon,
  onClick,
  disabled,
  className,
  iconClassName,
}: {
  label: string;
  icon: typeof Banknote;
  onClick: () => void;
  disabled?: boolean;
  className?: string;
  iconClassName?: string;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "flex h-14 flex-col items-center justify-center gap-1 rounded-xl border-2 px-1 text-[10px] font-black transition-all active:scale-[0.98] disabled:opacity-45 sm:h-16 sm:text-xs",
        className,
      )}
    >
      <Icon className={cn("size-4 stroke-[1.75] sm:size-5", iconClassName)} aria-hidden />
      <span className="leading-tight">{label}</span>
    </button>
  );
}

export function PosClientProfileQuickActions({
  client,
  entries,
  encoursMad,
  locale,
  tr,
  onOpenHistory,
}: PosClientProfileQuickActionsProps) {
  const toast = useToast();
  const convex = useConvex();
  const recordCreditPayment = useMutation(api.credits.recordPayment);
  const currentUser = useQuery(api.authz.currentUser);
  const appSettingsRow = useQuery(api.settings.getAppSettings);

  const [paymentOpen, setPaymentOpen] = useState(false);
  const [pendingQuickPayAmount, setPendingQuickPayAmount] = useState<number | null>(
    null,
  );
  const [quickPaying, setQuickPaying] = useState<number | null>(null);
  const [releveBusy, setReleveBusy] = useState<"download" | "print" | null>(
    null,
  );

  const canCollect = canCollectCredits(currentUser?.permissions ?? []);
  const canExportPdf = canExportReports(currentUser?.permissions ?? []);
  const creditStore = useMemo<CreditStore>(
    () => ({ entriesByClient: { [client.id]: entries } }),
    [client.id, entries],
  );

  const quickAmounts = useMemo(() => {
    const amounts = new Set<number>();
    if (encoursMad > 0) amounts.add(Math.round(encoursMad * 100) / 100);
    for (const preset of QUICK_PAY_AMOUNTS) {
      if (preset < encoursMad) amounts.add(preset);
    }
    return [...amounts].sort((a, b) => a - b);
  }, [encoursMad]);

  const registerQuickPayment = useCallback(
    async (amountMad: number) => {
      if (!canCollect || amountMad <= 0) return;
      setQuickPaying(amountMad);
      try {
        await recordCreditPayment({
          clientId: client.id as Id<"clients">,
          amountMad,
          date: new Date().toISOString().slice(0, 10),
          note: tr("Versement caisse", "دفعة من الصندوق"),
        });
        setPendingQuickPayAmount(null);
        toast.success(
          tr("Paiement enregistré", "تم تسجيل الدفعة"),
          formatPosDh(amountMad, 2, locale),
        );
      } catch (error) {
        toast.error(
          tr("Paiement non enregistré", "لم يتم تسجيل الدفعة"),
          error instanceof Error ? error.message : tr("Réessayez.", "حاول مجددًا."),
        );
      } finally {
        setQuickPaying(null);
      }
    },
    [canCollect, client.id, locale, recordCreditPayment, toast, tr],
  );

  const pendingResteMad =
    pendingQuickPayAmount != null
      ? Math.max(0, Math.round((encoursMad - pendingQuickPayAmount) * 100) / 100)
      : null;
  const paysFullBalance =
    pendingQuickPayAmount != null &&
    pendingQuickPayAmount >= encoursMad - 1e-9;
  const pendingAvoirMad =
    pendingQuickPayAmount != null && encoursMad >= 0
      ? Math.max(
          0,
          Math.round((pendingQuickPayAmount - encoursMad) * 100) / 100,
        )
      : 0;

  async function handleReleveDownload() {
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
    setReleveBusy("download");
    try {
      const result = await downloadClientRelevePdf(convex, {
        clientId: client.id as Id<"clients">,
        clientName: client.fullName,
        settingsSource: appSettingsRow,
      });
      toast.success(
        tr("PDF téléchargé", "تم تنزيل PDF"),
        tr(
          `Relevé · ${result.invoiceCount} facture(s) · ${result.versementCount} versement(s).`,
          `كشف · ${result.invoiceCount} فاتورة · ${result.versementCount} تحصيل.`,
        ),
      );
    } catch (error) {
      toast.error(
        tr("Échec du téléchargement", "فشل التنزيل"),
        error instanceof Error
          ? error.message
          : tr("Réessayez.", "حاول مجددًا."),
      );
    } finally {
      setReleveBusy(null);
    }
  }

  async function handleRelevePrint() {
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
    setReleveBusy("print");
    try {
      const result = await printClientRelevePdf(convex, {
        clientId: client.id as Id<"clients">,
        clientName: client.fullName,
        settingsSource: appSettingsRow,
      });
      toast.success(
        tr("Impression prête", "جاهز للطباعة"),
        tr(
          `Relevé · ${result.invoiceCount} facture(s) · ${result.versementCount} versement(s).`,
          `كشف · ${result.invoiceCount} فاتورة · ${result.versementCount} تحصيل.`,
        ),
      );
    } catch (error) {
      toast.error(
        tr("Échec de l'impression", "فشل الطباعة"),
        error instanceof Error
          ? error.message
          : tr("Réessayez.", "حاول مجددًا."),
      );
    } finally {
      setReleveBusy(null);
    }
  }

  const showPayments = canCollect && !client.isCashOnly;
  const showQuickPay = showPayments && encoursMad > 0;

  return (
    <>
      <div className="space-y-3">
        <p className="text-outline text-[10px] font-bold tracking-widest uppercase">
          {tr("Actions rapides", "إجراءات سريعة")}
        </p>

        <div className="grid grid-cols-2 gap-2">
          <QuickActionButton
            label={tr("Paiement", "دفعة")}
            icon={Banknote}
            disabled={!showPayments}
            onClick={() => setPaymentOpen(true)}
            className="border-secondary/35 bg-secondary-container/40 text-on-secondary-container hover:bg-secondary-container/65"
          />
          <QuickActionButton
            label={tr("Historique", "السجل")}
            icon={History}
            onClick={onOpenHistory}
            className="border-primary/30 bg-primary/10 text-primary hover:bg-primary/15"
          />
          <QuickActionButton
            label={
              releveBusy === "print"
                ? tr("Impression…", "جاري الطباعة…")
                : tr("Imprimer", "طباعة")
            }
            icon={Printer}
            disabled={!canExportPdf || releveBusy != null}
            onClick={() => void handleRelevePrint()}
            className="border-sidebar-border bg-surface-container-low text-on-surface-variant hover:bg-surface-container"
          />
          <QuickActionButton
            label={
              releveBusy === "download"
                ? tr("PDF…", "PDF…")
                : tr("PDF", "PDF")
            }
            icon={FileDown}
            disabled={!canExportPdf || releveBusy != null}
            onClick={() => void handleReleveDownload()}
            className="border-primary/25 bg-primary-fixed/30 text-primary hover:bg-primary-fixed/45"
          />
        </div>

        {showQuickPay ? (
          <div className="border-secondary/20 bg-secondary-container/15 space-y-2 rounded-xl border px-3 py-3">
            <p className="text-on-secondary-container flex items-center gap-1.5 text-[10px] font-bold tracking-wide uppercase">
              <Wallet className="size-3.5 stroke-[1.75]" aria-hidden />
              {tr("Paiement rapide", "دفع سريع")}
            </p>
            <div className="flex flex-wrap gap-1.5">
              {encoursMad > 0 ? (
                <Button
                  type="button"
                  size="sm"
                  disabled={quickPaying !== null}
                  onClick={() => setPendingQuickPayAmount(encoursMad)}
                  className="from-secondary to-on-secondary-container h-9 rounded-lg bg-linear-to-br px-3 text-xs font-black text-white shadow-sm"
                >
                  {tr("Tout", "الكل")}{" "}
                  <span className="tabular-nums">
                    {formatPosDh(encoursMad, 0, locale)}
                  </span>
                </Button>
              ) : null}
              {quickAmounts
                .filter((amount) => amount !== encoursMad)
                .map((amount) => (
                  <Button
                    key={amount}
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={quickPaying !== null}
                    onClick={() => setPendingQuickPayAmount(amount)}
                    className="border-secondary/30 bg-surface-container-lowest text-secondary h-9 rounded-lg px-3 text-xs font-black tabular-nums"
                  >
                    {formatPosDh(amount, 0, locale)}
                  </Button>
                ))}
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={quickPaying !== null}
                onClick={() => setPaymentOpen(true)}
                className="border-tertiary/35 bg-tertiary-fixed/35 text-tertiary h-9 rounded-lg px-3 text-xs font-black"
              >
                {tr("Autre", "آخر")}
              </Button>
            </div>
          </div>
        ) : !canCollect ? (
          <p className="text-on-surface-variant text-[11px] font-medium">
            {tr(
              "Encaissement crédit non autorisé pour votre rôle.",
              "تحصيل الائتمان غير مسموح لدورك.",
            )}
          </p>
        ) : client.isCashOnly ? (
          <p className="text-on-surface-variant text-[11px] font-medium">
            {tr("Client comptant — pas de paiement crédit.", "عميل نقدي — لا دفع آجل.")}
          </p>
        ) : showPayments && encoursMad <= 0 ? (
          <p className="text-secondary text-[11px] font-semibold">
            {tr(
              "Aucun dû — un paiement crée un avoir client.",
              "لا مستحقات — أي دفعة تنشئ رصيدًا دائنًا.",
            )}
          </p>
        ) : null}
      </div>

      <CreditsRegisterPaymentDialog
        client={client}
        creditStore={creditStore}
        open={paymentOpen}
        onOpenChange={setPaymentOpen}
        tr={tr}
      />

      <PosDialog
        open={pendingQuickPayAmount != null}
        onOpenChange={(open) => {
          if (!open && quickPaying === null) setPendingQuickPayAmount(null);
        }}
      >
        <PosDialogContent className="max-w-sm rounded-2xl">
          <PosDialogHeader>
            <PosDialogTitle className="text-lg font-black">
              {tr("Confirmer le paiement", "تأكيد الدفعة")}
            </PosDialogTitle>
            <PosDialogDescription className="text-on-surface-variant text-sm font-medium">
              {client.fullName}
            </PosDialogDescription>
          </PosDialogHeader>

          {pendingQuickPayAmount != null ? (
            <div className="space-y-3 py-1">
              <div className="border-secondary/25 bg-secondary-container/20 rounded-xl border px-4 py-3 text-center">
                <p className="text-on-surface-variant text-[10px] font-bold tracking-wide uppercase">
                  {tr("Montant à encaisser", "المبلغ للتحصيل")}
                </p>
                <p className="text-secondary mt-1 text-2xl font-black tabular-nums">
                  {formatPosDh(pendingQuickPayAmount, 2, locale)}
                </p>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="bg-surface-container-low rounded-lg px-3 py-2">
                  <p className="text-on-surface-variant font-bold uppercase">
                    {tr("Encours actuel", "الرصيد الحالي")}
                  </p>
                  <p className="mt-0.5 font-black tabular-nums">
                    {formatPosDh(encoursMad, 2, locale)}
                  </p>
                </div>
                <div className="bg-surface-container-low rounded-lg px-3 py-2">
                  <p className="text-on-surface-variant font-bold uppercase">
                    {tr("Reste après", "المتبقي بعد")}
                  </p>
                  <p
                    className={cn(
                      "mt-0.5 font-black tabular-nums",
                      pendingAvoirMad > 0
                        ? "text-secondary"
                        : paysFullBalance
                          ? "text-secondary"
                          : "text-on-surface",
                    )}
                  >
                    {pendingAvoirMad > 0
                      ? `${tr("Avoir", "دائن")} ${formatPosDh(pendingAvoirMad, 2, locale)}`
                      : paysFullBalance
                        ? tr("Soldé", "مسدد")
                        : formatPosDh(pendingResteMad ?? 0, 2, locale)}
                  </p>
                </div>
              </div>
              <p className="text-on-surface-variant text-[11px] leading-snug">
                {tr(
                  "Vérifiez le montant reçu du client avant de confirmer.",
                  "تحقق من المبلغ المستلم من العميل قبل التأكيد.",
                )}
              </p>
            </div>
          ) : null}

          <PosDialogFooter className="gap-2 sm:gap-2">
            <Button
              type="button"
              variant="outline"
              className="rounded-xl font-bold"
              disabled={quickPaying !== null}
              onClick={() => setPendingQuickPayAmount(null)}
            >
              {tr("Annuler", "إلغاء")}
            </Button>
            <Button
              type="button"
              className="from-secondary to-on-secondary-container rounded-xl bg-linear-to-br font-black text-white"
              disabled={quickPaying !== null || pendingQuickPayAmount == null}
              onClick={() => {
                if (pendingQuickPayAmount == null) return;
                void registerQuickPayment(pendingQuickPayAmount);
              }}
            >
              {quickPaying !== null ? (
                <>
                  <Loader2 className="me-1.5 size-4 animate-spin" aria-hidden />
                  {tr("Enregistrement…", "جاري التسجيل…")}
                </>
              ) : (
                tr("Confirmer le paiement", "تأكيد الدفعة")
              )}
            </Button>
          </PosDialogFooter>
        </PosDialogContent>
      </PosDialog>

    </>
  );
}
