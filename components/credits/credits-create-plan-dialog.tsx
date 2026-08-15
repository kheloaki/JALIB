"use client";

import { useMemo, useState } from "react";
import { useLocale } from "next-intl";
import { useMutation } from "convex/react";
import { CalendarClock, Layers, Plus } from "lucide-react";

import { MadPriceField } from "@/components/money/mad-price-field";
import type { Client } from "@/lib/clients/types";
import {
  buildSortedValidScheduleDraftItems,
  canAddManualScheduleRow,
  clampScheduleDraftRowForNewPlan,
  formatDraftExpectedMadInput,
  parseAndBuildManualSlots,
} from "@/lib/credits/installments/manual-schedule";
import type { InstallmentScheduleRule, ScheduleSlotSnapshot } from "@/lib/credits/installments/types";
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
import { addMonthsIso } from "@/lib/dates/add-months";
import { formatDateFr, formatTodayDateFr } from "@/lib/dates/format-date";
import { formatMad } from "@/lib/money/mad";

export function CreditsCreatePlanDialog({
  client,
  open,
  onOpenChange,
  tr,
}: {
  client: Client | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tr: (fr: string, ar: string) => string;
}) {
  const locale = useLocale();
  const toast = useToast();
  const createInstallmentPlanMutation = useMutation(api.installmentPlans.create);

  const [planTitle, setPlanTitle] = useState("");
  const [planTotal, setPlanTotal] = useState("");
  const [planUpfront, setPlanUpfront] = useState("");
  const [planStartDate, setPlanStartDate] = useState(() =>
    new Date().toISOString().slice(0, 10),
  );
  const [planScheduleEnabled, setPlanScheduleEnabled] = useState(false);
  const [planScheduleRows, setPlanScheduleRows] = useState<
    { id: string; dueDate: string; amount: string }[]
  >([]);

  const planCreateScheduleTargetPrincipal = useMemo(() => {
    const total = Number.parseFloat(planTotal.replace(",", "."));
    const up =
      planUpfront.trim() === ""
        ? 0
        : Number.parseFloat(planUpfront.replace(",", "."));
    if (!Number.isFinite(total) || total <= 0) return null;
    if (!Number.isFinite(up) || up < 0 || up > total) return null;
    return Math.round((total - up) * 100) / 100;
  }, [planTotal, planUpfront]);

  const planScheduleRowsMapped = useMemo(
    () =>
      planScheduleRows.map((r) => ({
        id: r.id,
        dueDate: r.dueDate,
        amountRaw: r.amount,
      })),
    [planScheduleRows],
  );

  const planScheduleRowsValidSum = useMemo(() => {
    const items = buildSortedValidScheduleDraftItems(planScheduleRowsMapped);
    return Math.round(items.reduce((s, it) => s + it.expectedMad, 0) * 100) / 100;
  }, [planScheduleRowsMapped]);

  const canAddPlanScheduleRow = useMemo(() => {
    if (!planScheduleEnabled) return false;
    return canAddManualScheduleRow(
      planScheduleRowsMapped,
      planCreateScheduleTargetPrincipal,
    );
  }, [
    planScheduleEnabled,
    planScheduleRowsMapped,
    planCreateScheduleTargetPrincipal,
  ]);

  function resetForm() {
    setPlanTitle("");
    setPlanTotal("");
    setPlanUpfront("");
    setPlanStartDate(new Date().toISOString().slice(0, 10));
    setPlanScheduleEnabled(false);
    setPlanScheduleRows([]);
  }

  function commitPlanScheduleRowAmount(rowId: string, raw: string) {
    setPlanScheduleRows((prev) => {
      const trimmed = raw.trim();
      if (trimmed === "" || trimmed === "." || trimmed === ",") {
        return prev.map((r) => (r.id === rowId ? { ...r, amount: raw } : r));
      }
      const n = Number.parseFloat(raw.replace(",", "."));
      if (!Number.isFinite(n) || n <= 0) {
        return prev.map((r) => (r.id === rowId ? { ...r, amount: raw } : r));
      }
      const principal = planCreateScheduleTargetPrincipal;
      const total = Number.parseFloat(planTotal.replace(",", "."));
      if (principal === null || !Number.isFinite(total) || total <= 0) {
        return prev.map((r) => (r.id === rowId ? { ...r, amount: raw } : r));
      }
      const draftRows = prev.map((r) => ({
        id: r.id,
        dueDate: r.dueDate,
        amountRaw: r.id === rowId ? String(n) : r.amount,
      }));
      const capped = clampScheduleDraftRowForNewPlan({
        rows: draftRows,
        targetRowId: rowId,
        proposedMad: n,
        principalAfterUpfront: principal,
        planTotalMad: total,
      });
      const nextRaw =
        Math.abs(capped - n) <= 0.02 ? raw : formatDraftExpectedMadInput(capped);
      return prev.map((r) => (r.id === rowId ? { ...r, amount: nextRaw } : r));
    });
  }

  function parsePositive(raw: string): number | null {
    const n = Number.parseFloat(raw.replace(",", "."));
    if (!Number.isFinite(n) || n <= 0) return null;
    return Math.round(n * 100) / 100;
  }

  function parseNonNegative(raw: string): number | null {
    if (!raw.trim()) return 0;
    const n = Number.parseFloat(raw.replace(",", "."));
    if (!Number.isFinite(n) || n < 0) return null;
    return Math.round(n * 100) / 100;
  }

  async function createInstallmentPlan(e: React.FormEvent) {
    e.preventDefault();
    if (!client) return;

    const total = parsePositive(planTotal);
    const upfront = parseNonNegative(planUpfront);
    if (total === null || upfront === null) return;
    if (upfront > total) return;
    const startDate = planStartDate;

    const title =
      planTitle.trim() || `Plan ${formatTodayDateFr()}`;
    const remainingAfterUpfront = Math.round((total - upfront) * 100) / 100;
    const completed = remainingAfterUpfront <= 0;

    let scheduleRule: InstallmentScheduleRule | null = null;
    let scheduleSlots: ScheduleSlotSnapshot[] | null = null;
    let firstDue = addMonthsIso(startDate, 1);

    if (planScheduleEnabled && !completed) {
      const built = parseAndBuildManualSlots(
        planScheduleRows.map((r) => ({
          dueDate: r.dueDate,
          amountRaw: r.amount,
        })),
        remainingAfterUpfront,
        { sumPolicy: "exact" },
      );
      if (!built.ok) {
        toast.error(tr("Échéancier", "جدول الأقساط"), built.error);
        return;
      }
      scheduleRule = { kind: "manual" };
      scheduleSlots = built.slots;
      firstDue = scheduleSlots[0]!.dueDate;
    }

    try {
      await createInstallmentPlanMutation({
        clientId: client.id as Id<"clients">,
        title,
        totalMad: total,
        upfrontMad: upfront,
        startDate,
        scheduleRule,
        scheduleSlots,
      });
      resetForm();
      onOpenChange(false);
      toast.success(
        tr("Plan créé", "تم إنشاء الخطة"),
        completed
          ? tr("Le plan est déjà soldé.", "تم تسديد الخطة بالفعل.")
          : tr(`Première échéance : ${formatDateFr(firstDue)}`, `أول استحقاق: ${formatDateFr(firstDue)}`),
      );
    } catch (error) {
      toast.error(
        tr("Plan non créé", "لم يتم إنشاء الخطة"),
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
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="bg-primary-fixed text-primary flex h-10 w-10 items-center justify-center rounded-xl">
              <Layers className="size-5 stroke-[1.75]" aria-hidden />
            </div>
            <div>
              <DialogTitle className="text-xl font-bold">
                {tr("Payer en plusieurs fois", "الدفع بالتقسيط")}
              </DialogTitle>
              <DialogDescription>
                {client
                  ? `${client.fullName} — ${tr("créer un plan de remboursement", "إنشاء خطة سداد")}`
                  : ""}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {client ? (
          <form onSubmit={createInstallmentPlan} className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label className="text-on-surface-variant mb-2 ml-1 block text-[10px] font-bold uppercase">
                  {tr("Référence / Titre", "المرجع / العنوان")}
                </label>
                <Input
                  value={planTitle}
                  onChange={(e) => setPlanTitle(e.target.value)}
                  placeholder="Ex. Achat TV / INV-40291"
                  className="bg-surface-container-low h-11 rounded-xl"
                />
              </div>
              <div>
                <label className="text-on-surface-variant mb-2 ml-1 block text-[10px] font-bold uppercase">
                  {tr("Total (MAD)", "الإجمالي (درهم)")}
                </label>
                <MadPriceField
                  value={Number.parseFloat(planTotal.replace(",", ".")) || 0}
                  onValueChange={(v) => setPlanTotal(v > 0 ? String(v) : "")}
                  min={0.01}
                  labelFr="Total"
                  labelAr="الإجمالي"
                  wrapperClassName="max-w-full"
                  className="font-bold"
                />
              </div>
              <div>
                <label className="text-on-surface-variant mb-2 ml-1 block text-[10px] font-bold uppercase">
                  {tr("Acompte (MAD)", "الدفعة المقدمة (درهم)")}
                </label>
                <MadPriceField
                  value={Number.parseFloat(planUpfront.replace(",", ".")) || 0}
                  onValueChange={(v) => setPlanUpfront(v > 0 ? String(v) : "")}
                  min={0}
                  labelFr="Acompte"
                  labelAr="الدفعة المقدمة"
                  wrapperClassName="max-w-full"
                  className="font-bold"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="text-on-surface-variant mb-2 ml-1 block text-[10px] font-bold uppercase">
                  {tr("Date de départ", "تاريخ البداية")}
                </label>
                <div className="relative">
                  <CalendarClock
                    className="text-outline pointer-events-none absolute top-1/2 left-3 size-5 -translate-y-1/2"
                    aria-hidden
                  />
                  <FrenchDateInput
                    value={planStartDate}
                    onValueChange={setPlanStartDate}
                    className="bg-surface-container-low h-11 rounded-xl pl-11"
                    required
                  />
                </div>
              </div>
            </div>

            <div className="border-sidebar-border bg-surface-container-low/50 space-y-4 rounded-xl border border-dashed p-4">
              <label className="flex cursor-pointer items-start gap-3">
                <input
                  type="checkbox"
                  checked={planScheduleEnabled}
                  onChange={(e) => {
                    const on = e.target.checked;
                    setPlanScheduleEnabled(on);
                    if (on && planScheduleRows.length === 0) {
                      setPlanScheduleRows([
                        {
                          id: `row:${crypto.randomUUID()}`,
                          dueDate: addMonthsIso(planStartDate, 1),
                          amount: "",
                        },
                      ]);
                    }
                    if (!on) setPlanScheduleRows([]);
                  }}
                  className="text-primary mt-1 size-4 rounded"
                />
                <span className="text-sm font-bold">
                  {tr("Calendrier des échéances (optionnel)", "جدول الاستحقاقات (اختياري)")}
                </span>
              </label>
              {planScheduleEnabled ? (
                <div className="space-y-3">
                  <div className="overflow-hidden rounded-xl border">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-surface-container-high/60">
                        <tr>
                          <th className="px-3 py-2 font-bold">
                            {tr("Date", "التاريخ")}
                          </th>
                          <th className="px-3 py-2 text-right font-bold">
                            {tr("Montant", "المبلغ")}
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {planScheduleRows.map((row) => (
                          <tr key={row.id} className="border-t">
                            <td className="p-2">
                              <FrenchDateInput
                                value={row.dueDate}
                                onValueChange={(dueDate) =>
                                  setPlanScheduleRows((prev) =>
                                    prev.map((r) =>
                                      r.id === row.id
                                        ? { ...r, dueDate }
                                        : r,
                                    ),
                                  )
                                }
                                className="h-10 rounded-lg text-xs"
                              />
                            </td>
                            <td className="p-2">
                              <MadPriceField
                                value={Number.parseFloat(row.amount.replace(",", ".")) || 0}
                                onValueChange={(v) =>
                                  commitPlanScheduleRowAmount(
                                    row.id,
                                    v > 0 ? String(v) : "",
                                  )
                                }
                                min={0.01}
                                compact
                                labelFr="Montant"
                                labelAr="المبلغ"
                                wrapperClassName="w-full min-w-[5rem]"
                              />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={!canAddPlanScheduleRow}
                    onClick={() => {
                      if (!canAddPlanScheduleRow) return;
                      setPlanScheduleRows((prev) => {
                        const last = prev[prev.length - 1];
                        const nextDate = last?.dueDate
                          ? addMonthsIso(last.dueDate, 1)
                          : addMonthsIso(planStartDate, 1);
                        return [
                          ...prev,
                          {
                            id: `row:${crypto.randomUUID()}`,
                            dueDate: nextDate,
                            amount: "",
                          },
                        ];
                      });
                    }}
                    className="gap-1.5 rounded-xl font-bold"
                  >
                    <Plus className="size-4" />
                    {tr("Ajouter une ligne", "إضافة سطر")}
                  </Button>
                  {planCreateScheduleTargetPrincipal != null &&
                  planScheduleRowsValidSum >=
                    planCreateScheduleTargetPrincipal - 0.02 ? (
                    <p className="text-on-surface-variant text-xs">
                      {tr(
                        `Somme couvre le reste (${formatMad(planCreateScheduleTargetPrincipal, 2, locale)}).`,
                        `المجموع يغطي المتبقي (${formatMad(planCreateScheduleTargetPrincipal, 2, locale)}).`,
                      )}
                    </p>
                  ) : null}
                </div>
              ) : null}
            </div>

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
                {tr("Créer plan", "إنشاء خطة")}
              </Button>
            </DialogFooter>
          </form>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
