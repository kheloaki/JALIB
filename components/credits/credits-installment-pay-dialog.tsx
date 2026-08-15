"use client";

import { useMemo } from "react";
import { useLocale } from "next-intl";
import { useMutation } from "convex/react";
import { CalendarClock } from "lucide-react";

import { MadPriceField } from "@/components/money/mad-price-field";
import type { CreditStore } from "@/lib/credits/types";
import { planRemainingForStore } from "@/lib/credits/installments/plan-remaining";
import type { InstallmentPlan } from "@/lib/credits/installments/types";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { FrenchDateInput } from "@/components/ui/french-date-input";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { formatMad } from "@/lib/money/mad";

export type InstallmentPayDraft = {
  plan: InstallmentPlan;
  amount: string;
  date: string;
  note: string;
};

export function CreditsInstallmentPayDialog({
  draft,
  creditStore,
  error,
  onDraftChange,
  onErrorChange,
  onClose,
  tr,
}: {
  draft: InstallmentPayDraft | null;
  creditStore: CreditStore;
  error: string | null;
  onDraftChange: (draft: InstallmentPayDraft | null) => void;
  onErrorChange: (error: string | null) => void;
  onClose: () => void;
  tr: (fr: string, ar: string) => string;
}) {
  const locale = useLocale();
  const recordCreditPayment = useMutation(api.credits.recordPayment);
  const setInstallmentPlanStatus = useMutation(api.installmentPlans.setStatus);

  const metrics = useMemo(() => {
    if (!draft) return null;
    const remaining = planRemainingForStore(
      draft.plan,
      creditStore.entriesByClient,
    );
    const paid = Math.max(
      0,
      Math.round((draft.plan.totalMad - remaining) * 100) / 100,
    );
    return { remaining, paid, total: draft.plan.totalMad };
  }, [draft, creditStore.entriesByClient]);

  function parsePositive(raw: string): number | null {
    const n = Number.parseFloat(raw.replace(",", "."));
    if (!Number.isFinite(n) || n <= 0) return null;
    return Math.round(n * 100) / 100;
  }

  async function submitInstallmentPayment(e: React.FormEvent) {
    e.preventDefault();
    if (!draft) return;
    const { plan, amount: amountRaw, date, note } = draft;
    if (plan.status !== "active") return;

    const remaining = planRemainingForStore(plan, creditStore.entriesByClient);
    if (remaining <= 0) {
      await setInstallmentPlanStatus({
        planId: plan.id as Id<"installmentPlans">,
        status: "completed",
      });
      onClose();
      return;
    }

    const amount = parsePositive(amountRaw);
    if (amount === null) {
      onErrorChange(tr("Montant invalide.", "مبلغ غير صالح."));
      return;
    }

    try {
      await recordCreditPayment({
        clientId: plan.clientId as Id<"clients">,
        planId: plan.id as Id<"installmentPlans">,
        amountMad: amount,
        date,
        note: note.trim() || `Mensualité - ${plan.title}`,
      });
      onClose();
      onErrorChange(null);
    } catch (err) {
      onErrorChange(
        err instanceof Error ? err.message : "Une erreur est survenue.",
      );
    }
  }

  return (
    <Dialog
      open={Boolean(draft)}
      onOpenChange={(open) => {
        if (!open) {
          onClose();
          onErrorChange(null);
        }
      }}
    >
      <DialogContent className="max-w-md gap-0 overflow-hidden p-0 sm:max-w-md">
        {draft && metrics ? (
          <form onSubmit={submitInstallmentPayment} className="flex flex-col">
            <div className="from-primary/12 to-primary-fixed/8 border-primary/15 border-b bg-linear-to-br px-6 pt-6 pr-14 pb-4">
              <DialogHeader className="gap-2 text-left">
                <DialogTitle className="text-xl font-black tracking-tight">
                  {tr("Encaisser un paiement", "تحصيل دفعة")}
                </DialogTitle>
                <DialogDescription className="text-on-surface-variant text-xs">
                  {draft.plan.title}
                </DialogDescription>
              </DialogHeader>
            </div>

            <div className="space-y-4 px-6 pt-5 pb-2">
              <div className="grid grid-cols-3 gap-2">
                <div className="bg-surface-container-high/80 rounded-xl px-2 py-3 text-center">
                  <p className="text-on-surface-variant mb-1 text-[9px] font-bold uppercase">
                    {tr("Total", "الإجمالي")}
                  </p>
                  <p className="text-sm font-black tabular-nums">
                    {formatMad(metrics.total, 2, locale)}
                  </p>
                </div>
                <div className="rounded-xl border border-green-200 bg-green-50 px-2 py-3 text-center dark:border-green-800/60 dark:bg-green-950/35">
                  <p className="mb-1 text-[9px] font-bold text-green-800 uppercase dark:text-green-400/90">
                    {tr("Payé", "مدفوع")}
                  </p>
                  <p className="text-sm font-black text-green-700 tabular-nums dark:text-green-400">
                    {formatMad(metrics.paid, 2, locale)}
                  </p>
                </div>
                <div className="bg-error-container/45 border-error/20 rounded-xl border px-2 py-3 text-center">
                  <p className="text-on-error-container mb-1 text-[9px] font-bold uppercase">
                    {tr("Reste", "المتبقي")}
                  </p>
                  <p className="text-on-error-container text-sm font-black tabular-nums">
                    {formatMad(metrics.remaining, 2, locale)}
                  </p>
                </div>
              </div>

              <div className="bg-tertiary-fixed-dim/15 text-tertiary flex items-center gap-2 rounded-xl border px-3 py-2.5 text-xs">
                <CalendarClock className="size-4 shrink-0" aria-hidden />
                {tr("Échéance", "الاستحقاق")}: {draft.plan.nextDueDate}
              </div>
            </div>

            <div className="border-border space-y-4 border-t px-6 pt-4 pb-6">
              <div>
                <label className="text-on-surface-variant mb-2 ml-1 block text-[10px] font-bold uppercase">
                  {tr("Montant (MAD)", "المبلغ (درهم)")}
                </label>
                <MadPriceField
                  value={Number.parseFloat(draft.amount.replace(",", ".")) || 0}
                  onValueChange={(v) => {
                    onErrorChange(null);
                    onDraftChange({
                      ...draft,
                      amount: v > 0 ? String(v) : "",
                    });
                  }}
                  min={0.01}
                  labelFr="Montant"
                  labelAr="المبلغ"
                  wrapperClassName="max-w-full"
                  className="h-12 rounded-xl border-2 text-lg font-black"
                />
                <p className="text-on-surface-variant mt-2 text-[11px] font-medium">
                  {tr(
                    "Un montant supérieur au reste du plan crée un avoir client.",
                    "مبلغ أكبر من متبقي الخطة ينشئ رصيدًا دائنًا للعميل.",
                  )}
                </p>
              </div>
              <div>
                <label className="text-on-surface-variant mb-2 ml-1 block text-[10px] font-bold uppercase">
                  {tr("Date", "التاريخ")}
                </label>
                <FrenchDateInput
                  value={draft.date}
                  onValueChange={(date) =>
                    onDraftChange({ ...draft, date })
                  }
                  className="h-11 rounded-xl"
                  required
                />
              </div>
              <div>
                <label className="text-on-surface-variant mb-2 ml-1 block text-[10px] font-bold uppercase">
                  {tr("Note", "ملاحظة")}
                </label>
                <Input
                  value={draft.note}
                  onChange={(e) =>
                    onDraftChange({ ...draft, note: e.target.value })
                  }
                  className="h-11 rounded-xl"
                />
              </div>
              {error ? (
                <p
                  className="bg-error/10 text-error rounded-lg px-3 py-2 text-sm font-semibold"
                  role="alert"
                >
                  {error}
                </p>
              ) : null}
              <DialogFooter className="gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  className="rounded-xl font-bold"
                  onClick={onClose}
                >
                  {tr("Annuler", "إلغاء")}
                </Button>
                <Button type="submit" className="rounded-xl font-bold">
                  {tr("Valider", "تأكيد")}
                </Button>
              </DialogFooter>
            </div>
          </form>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
