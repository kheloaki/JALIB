"use client";

import { useMemo, useState } from "react";
import { useLocale } from "next-intl";
import { useMutation, useQuery } from "convex/react";
import { Banknote } from "lucide-react";

import { MadPriceField } from "@/components/money/mad-price-field";
import type { Client } from "@/lib/clients/types";
import { summarizeClientLedger } from "@/lib/credits/invoice-settlement";
import type { CreditStore } from "@/lib/credits/types";
import { planRemainingForStore } from "@/lib/credits/installments/plan-remaining";
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
import { useToast } from "@/components/ui/toaster";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { installmentPlanFromConvex } from "@/lib/convex/mappers";
import { formatMad } from "@/lib/money/mad";
import { cn } from "@/lib/utils";

export function CreditsRegisterPaymentDialog({
  client,
  creditStore,
  open,
  onOpenChange,
  tr,
}: {
  client: Client | null;
  creditStore: CreditStore;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tr: (fr: string, ar: string) => string;
}) {
  const locale = useLocale();
  const toast = useToast();
  const recordCreditPayment = useMutation(api.credits.recordPayment);

  const [payAmount, setPayAmount] = useState(0);
  const [payDate, setPayDate] = useState(() =>
    new Date().toISOString().slice(0, 10),
  );
  const [payNote, setPayNote] = useState("");
  const [payLinkedPlanId, setPayLinkedPlanId] = useState("");

  const planRows = useQuery(
    api.installmentPlans.listByClient,
    client ? { clientId: client.id as Id<"clients"> } : "skip",
  );

  const plans = useMemo(
    () => (planRows ?? []).map(installmentPlanFromConvex),
    [planRows],
  );

  const linkableActivePlans = useMemo(() => {
    if (!client) return [];
    return plans.filter((p) => {
      if (p.clientId !== client.id || p.status !== "active") return false;
      return planRemainingForStore(p, creditStore.entriesByClient) > 0;
    });
  }, [plans, client, creditStore.entriesByClient]);

  const clientSummary = useMemo(() => {
    if (!client) return null;
    return summarizeClientLedger(
      creditStore.entriesByClient[client.id] ?? [],
      client.initialSoldeMad,
    );
  }, [client, creditStore.entriesByClient]);

  const payPreview = useMemo(() => {
    if (!clientSummary || payAmount <= 0) return null;
    const amt = Math.round(payAmount * 100) / 100;
    const nextSoldeMad =
      Math.round((clientSummary.soldeMad + amt) * 100) / 100;
    const linkedPlan = payLinkedPlanId
      ? plans.find((p) => p.id === payLinkedPlanId)
      : undefined;
    const planRem = linkedPlan
      ? planRemainingForStore(linkedPlan, creditStore.entriesByClient)
      : 0;
    const avoirMad = linkedPlan
      ? Math.max(0, Math.round((amt - planRem) * 100) / 100)
      : Math.max(0, nextSoldeMad);
    return { nextSoldeMad, avoirMad, planRem };
  }, [
    clientSummary,
    payAmount,
    payLinkedPlanId,
    plans,
    creditStore.entriesByClient,
  ]);

  function resetForm() {
    setPayAmount(0);
    setPayNote("");
    setPayLinkedPlanId("");
    setPayDate(new Date().toISOString().slice(0, 10));
  }

  async function handleRegisterPayment(e: React.FormEvent) {
    e.preventDefault();
    if (!client) return;
    if (payAmount <= 0) return;
    const amt = Math.round(payAmount * 100) / 100;

    const linkedPlan = payLinkedPlanId
      ? plans.find(
          (p) => p.id === payLinkedPlanId && p.clientId === client.id,
        )
      : undefined;
    if (payLinkedPlanId && !linkedPlan) {
      toast.error(
        tr("Plan introuvable", "الخطة غير موجودة"),
        tr(
          "Choisissez un plan dans la liste ou « Aucun ».",
          "اختر خطة من القائمة أو « لا شيء ».",
        ),
      );
      return;
    }

    try {
      await recordCreditPayment({
        clientId: client.id as Id<"clients">,
        ...(linkedPlan
          ? { planId: linkedPlan.id as Id<"installmentPlans"> }
          : {}),
        amountMad: amt,
        date: payDate,
        note: payNote.trim() || tr("Versement", "دفعة"),
      });
      resetForm();
      onOpenChange(false);
      toast.success(
        tr("Paiement enregistré", "تم تسجيل الدفعة"),
        formatMad(amt, 2, locale),
      );
    } catch (error) {
      toast.error(
        tr("Paiement non enregistré", "لم يتم تسجيل الدفعة"),
        error instanceof Error ? error.message : "Une erreur est survenue.",
      );
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) resetForm();
        onOpenChange(next);
      }}
    >
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="bg-secondary-container text-on-secondary-container flex h-10 w-10 items-center justify-center rounded-xl">
              <Banknote className="size-5 stroke-[1.75]" aria-hidden />
            </div>
            <div>
              <DialogTitle className="text-xl font-bold">
                {tr("Enregistrer un paiement", "تسجيل دفعة")}
              </DialogTitle>
              <DialogDescription>
                {client?.fullName ?? ""}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {client ? (
          <form onSubmit={handleRegisterPayment} className="space-y-4">
            {clientSummary ? (
              <div className="bg-surface-container-low rounded-xl px-4 py-3 text-sm">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-on-surface-variant font-medium">
                    {tr("Solde actuel", "الرصيد الحالي")}
                  </span>
                  <span
                    className={cn(
                      "font-bold tabular-nums",
                      clientSummary.soldeMad < -0.009 && "text-error",
                      clientSummary.soldeMad > 0.009 && "text-secondary",
                    )}
                  >
                    {formatMad(clientSummary.soldeMad, 2, locale)}
                  </span>
                </div>
                <p className="text-on-surface-variant mt-2 text-[11px] font-medium">
                  {tr(
                    "Le client peut payer plus que le dû — l’excédent devient un avoir (solde positif).",
                    "يمكن للعميل الدفع أكثر من المستحق — الفائض يصبح رصيدًا دائنًا.",
                  )}
                </p>
              </div>
            ) : null}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="text-on-surface-variant mb-2 ml-1 block text-[10px] font-bold uppercase">
                  {tr("Montant (MAD)", "المبلغ (درهم)")}
                </label>
                <MadPriceField
                  value={payAmount}
                  onValueChange={setPayAmount}
                  min={0.01}
                  labelFr="Montant"
                  labelAr="المبلغ"
                  wrapperClassName="max-w-full"
                  className="text-lg font-bold"
                />
              </div>
              <div>
                <label className="text-on-surface-variant mb-2 ml-1 block text-[10px] font-bold uppercase">
                  {tr("Date", "التاريخ")}
                </label>
                <FrenchDateInput
                  value={payDate}
                  onValueChange={setPayDate}
                  className="bg-surface-container-low h-11 rounded-xl"
                  required
                />
              </div>
              <div className="sm:col-span-2">
                <label className="text-on-surface-variant mb-2 ml-1 block text-[10px] font-bold uppercase">
                  {tr("Note", "ملاحظة")}
                </label>
                <Input
                  value={payNote}
                  onChange={(e) => setPayNote(e.target.value)}
                  placeholder={tr("Paiement partiel, Chèque…", "دفع جزئي، شيك…")}
                  className="bg-surface-container-low h-11 rounded-xl"
                />
              </div>
              <div className="sm:col-span-2">
                <label
                  htmlFor="pay-link-plan-dialog"
                  className="text-on-surface-variant mb-2 ml-1 block text-[10px] font-bold uppercase"
                >
                  {tr("Affecter à un plan (optionnel)", "ربط بخطة (اختياري)")}
                </label>
                <select
                  id="pay-link-plan-dialog"
                  value={payLinkedPlanId}
                  onChange={(e) => setPayLinkedPlanId(e.target.value)}
                  className="border-input bg-surface-container-low h-11 w-full rounded-xl border px-3 text-sm"
                >
                  <option value="">
                    {tr("Aucun — solde global", "لا شيء — الرصيد الإجمالي")}
                  </option>
                  {linkableActivePlans.map((p) => {
                    const rem = planRemainingForStore(
                      p,
                      creditStore.entriesByClient,
                    );
                    return (
                      <option key={p.id} value={p.id}>
                        {p.title} — {formatMad(rem, 2, locale)}
                      </option>
                    );
                  })}
                </select>
              </div>
            </div>
            {payPreview && payAmount > 0 ? (
              <p
                className={cn(
                  "rounded-xl px-3 py-2 text-xs font-semibold",
                  payPreview.nextSoldeMad > 0.009
                    ? "bg-secondary-container/40 text-on-secondary-container"
                    : "bg-surface-container-low text-on-surface-variant",
                )}
              >
                {payPreview.nextSoldeMad > 0.009
                  ? tr(
                      `Solde après paiement : ${formatMad(payPreview.nextSoldeMad, 2, locale)} (avoir)`,
                      `الرصيد بعد الدفع: ${formatMad(payPreview.nextSoldeMad, 2, locale)} (دائن)`,
                    )
                  : tr(
                      `Solde après paiement : ${formatMad(payPreview.nextSoldeMad, 2, locale)}`,
                      `الرصيد بعد الدفع: ${formatMad(payPreview.nextSoldeMad, 2, locale)}`,
                    )}
              </p>
            ) : null}
            <DialogFooter className="gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                className="rounded-xl font-bold"
              >
                {tr("Annuler", "إلغاء")}
              </Button>
              <Button type="submit" className="rounded-xl font-bold">
                {tr("Enregistrer", "حفظ")}
              </Button>
            </DialogFooter>
          </form>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
