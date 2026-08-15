"use client";

import { useCallback, useMemo, useState } from "react";
import { CheckCircle2, Plus } from "lucide-react";

import { MadPriceField } from "@/components/money/mad-price-field";
import type { CreditStore } from "@/lib/credits/types";
import type {
  InstallmentPlan,
  InstallmentScheduleRule,
  ScheduleSlotSnapshot,
} from "@/lib/credits/installments/types";
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
import { planRemainingForStore } from "@/lib/credits/installments/plan-remaining";
import {
  buildSortedValidScheduleDraftItems,
  clampScheduleDraftRowExpectedMad,
  formatDraftExpectedMadInput,
  isScheduleDraftLastRowComplete,
  parseAndBuildManualSlots,
  scheduleDraftUnpaidTotalMad,
  unpaidScheduledTotalMad,
} from "@/lib/credits/installments/manual-schedule";
import { allocatePlanPaymentsFifo } from "@/lib/credits/installments/schedule";
import { addMonthsIso } from "@/lib/dates/add-months";
import { formatMad } from "@/lib/money/mad";
import { cn } from "@/lib/utils";

const SLOT_EPS = 0.02;

type PlanScheduleRuleDialogProps = {
  plan: InstallmentPlan | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  creditStore: CreditStore;
  onApply: (
    planId: string,
    rule: InstallmentScheduleRule | null,
    slots: ScheduleSlotSnapshot[] | null,
  ) => Promise<void> | void;
};

type UiRow = { id: string; dueDate: string; amountRaw: string };

function newRow(dueDate: string): UiRow {
  return { id: `row:${crypto.randomUUID()}`, dueDate, amountRaw: "" };
}

export function PlanScheduleRuleDialog({
  plan,
  open,
  onOpenChange,
  creditStore,
  onApply,
}: PlanScheduleRuleDialogProps) {
  const toast = useToast();
  const planKey = useMemo(() => {
    if (!open || !plan) return "closed";
    const slotsKey =
      plan.scheduleSlots
        ?.map((slot) => `${slot.dueDate}:${slot.expectedMad}`)
        .join("|") ?? "none";
    return `${plan.id}:${slotsKey}`;
  }, [open, plan]);
  const defaultRows = useMemo<UiRow[]>(() => {
    if (!open || !plan) return [];
    if (plan.scheduleSlots?.length) {
      return plan.scheduleSlots.map((s) => ({
        id: `row:${crypto.randomUUID()}`,
        dueDate: s.dueDate,
        amountRaw: String(s.expectedMad),
      }));
    }
    const start = addMonthsIso(new Date().toISOString().slice(0, 10), 1);
    return [newRow(start)];
  }, [open, plan]);
  const [rowDraft, setRowDraft] = useState<{
    key: string;
    rows: UiRow[];
  } | null>(null);
  const rows = rowDraft?.key === planKey ? rowDraft.rows : defaultRows;
  const setRowsForCurrentPlan = useCallback(
    (updater: (prev: UiRow[]) => UiRow[]) => {
      setRowDraft({ key: planKey, rows: updater(rows) });
    },
    [planKey, rows],
  );

  const remaining = useMemo(() => {
    if (!plan) return 0;
    return planRemainingForStore(plan, creditStore.entriesByClient);
  }, [plan, creditStore.entriesByClient]);

  const totalPaidOnPlan = useMemo(() => {
    if (!plan) return 0;
    return Math.max(
      0,
      Math.round((plan.totalMad - remaining) * 100) / 100,
    );
  }, [plan, remaining]);

  const previewParsed = useMemo(() => {
    if (!plan || !open || remaining <= 0) return null;
    return parseAndBuildManualSlots(
      rows.map((r) => ({ dueDate: r.dueDate, amountRaw: r.amountRaw })),
      remaining,
      { sumPolicy: "coversRemaining" },
    );
  }, [plan, open, remaining, rows]);

  const fifoPreview = useMemo(() => {
    if (!plan || !open) return null;
    const items = buildSortedValidScheduleDraftItems(rows);
    if (items.length === 0) {
      return { items, alloc: [] as number[] };
    }
    const slots: ScheduleSlotSnapshot[] = items.map((it) => ({
      dueDate: it.dueDate,
      expectedMad: it.expectedMad,
    }));
    const entries = creditStore.entriesByClient[plan.clientId] ?? [];
    const alloc = allocatePlanPaymentsFifo(plan.id, slots, entries);
    return { items, alloc };
  }, [plan, open, rows, creditStore.entriesByClient]);

  const byRowId = useMemo(() => {
    const map = new Map<
      string,
      { expectedMad: number; allocated: number; remaining: number }
    >();
    if (!fifoPreview) return map;
    const { items, alloc } = fifoPreview;
    for (let i = 0; i < items.length; i++) {
      const it = items[i]!;
      const a = alloc[i] ?? 0;
      map.set(it.rowId, {
        expectedMad: it.expectedMad,
        allocated: a,
        remaining: Math.round((it.expectedMad - a) * 100) / 100,
      });
    }
    return map;
  }, [fifoPreview]);

  const sumScheduled = useMemo(() => {
    if (!fifoPreview?.items.length) return 0;
    return Math.round(
      fifoPreview.items.reduce((s, it) => s + it.expectedMad, 0) * 100,
    ) / 100;
  }, [fifoPreview]);

  const sumAllocatedToLines = useMemo(() => {
    if (!fifoPreview?.alloc.length) return 0;
    return Math.round(fifoPreview.alloc.reduce((s, x) => s + x, 0) * 100) / 100;
  }, [fifoPreview]);

  /** Ce qu’il reste à couvrir sur les lignes du tableau (après FIFO), à comparer au reste dû du plan. */
  const unpaidOnCalendar = useMemo(() => {
    if (!fifoPreview?.items.length) return 0;
    return unpaidScheduledTotalMad(
      fifoPreview.items.map((it) => ({ expectedMad: it.expectedMad })),
      fifoPreview.alloc,
    );
  }, [fifoPreview]);

  const canAddLine = useMemo(() => {
    if (!plan || remaining <= SLOT_EPS) return false;
    if (!isScheduleDraftLastRowComplete(rows)) return false;
    return unpaidOnCalendar < remaining - SLOT_EPS;
  }, [plan, remaining, rows, unpaidOnCalendar]);

  function updateRow(id: string, patch: Partial<Pick<UiRow, "dueDate" | "amountRaw">>) {
    setRowsForCurrentPlan((prev) =>
      prev.map((r) => (r.id === id ? { ...r, ...patch } : r)),
    );
  }

  function commitAmountRawChange(rowId: string, raw: string) {
    if (!plan) return;
    setRowsForCurrentPlan((prev) => {
      const trimmed = raw.trim();
      if (trimmed === "" || trimmed === "." || trimmed === ",") {
        return prev.map((r) => (r.id === rowId ? { ...r, amountRaw: raw } : r));
      }
      const n = Number.parseFloat(raw.replace(",", "."));
      if (!Number.isFinite(n) || n <= 0) {
        return prev.map((r) => (r.id === rowId ? { ...r, amountRaw: raw } : r));
      }
      const entries = creditStore.entriesByClient[plan.clientId] ?? [];
      const draftInput = prev.map((r) => ({
        id: r.id,
        dueDate: r.dueDate,
        amountRaw: r.id === rowId ? String(n) : r.amountRaw,
      }));
      const capped = clampScheduleDraftRowExpectedMad({
        planId: plan.id,
        planRemainingMad: remaining,
        planTotalMad: plan.totalMad,
        rows: draftInput,
        entries,
        targetRowId: rowId,
        proposedMad: n,
      });
      const nextRaw =
        Math.abs(capped - n) <= SLOT_EPS ? raw : formatDraftExpectedMadInput(capped);
      return prev.map((r) => (r.id === rowId ? { ...r, amountRaw: nextRaw } : r));
    });
  }

  function addRow() {
    if (!canAddLine) return;
    const last = rows[rows.length - 1];
    const nextDate = last?.dueDate
      ? addMonthsIso(last.dueDate, 1)
      : addMonthsIso(new Date().toISOString().slice(0, 10), 1);
    setRowsForCurrentPlan((prev) => [...prev, newRow(nextDate)]);
  }

  async function handleSave() {
    if (!plan) return;
    if (plan.status !== "active") {
      toast.error("Plan inactif", "Seuls les plans actifs peuvent porter un calendrier.");
      return;
    }
    if (remaining <= 0) {
      toast.error("Plan soldé", "Plus de capital à répartir.");
      return;
    }
    const built = parseAndBuildManualSlots(
      rows.map((r) => ({ dueDate: r.dueDate, amountRaw: r.amountRaw })),
      remaining,
      { sumPolicy: "coversRemaining" },
    );
    if (!built.ok) {
      toast.error("Calendrier invalide", built.error);
      return;
    }
    const entries = creditStore.entriesByClient[plan.clientId] ?? [];
    const snap = scheduleDraftUnpaidTotalMad(
      plan.id,
      rows.map((r) => ({ id: r.id, dueDate: r.dueDate, amountRaw: r.amountRaw })),
      entries,
    );
    if (snap && snap.unpaid > remaining + SLOT_EPS) {
      toast.error(
        "Montants trop élevés",
        `Les lignes demandent encore ${formatMad(snap.unpaid)} à couvrir, au-delà du reste dû du plan (${formatMad(remaining)}). Réduisez les montants des lignes à venir.`,
      );
      return;
    }
    const rule: InstallmentScheduleRule = { kind: "manual" };
    try {
      await onApply(plan.id, rule, built.slots);
      toast.success("Calendrier enregistré", `${built.slots.length} échéance(s).`);
      onOpenChange(false);
    } catch (error) {
      toast.error(
        "Calendrier non enregistré",
        error instanceof Error ? error.message : "Une erreur est survenue.",
      );
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="border-sidebar-border bg-surface-container-lowest text-on-surface max-h-[min(92vh,860px)] max-w-[min(100vw-1.5rem,42rem)] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle className="text-xl font-black">
            Calendrier des échéances
          </DialogTitle>
          <DialogDescription className="text-left">
            Les paiements enregistrés sur ce plan (<strong>Enregistrer un paiement</strong> lié au
            plan ou <strong>Payer</strong>) sont répartis sur les lignes dans l’ordre des dates (
            <strong>FIFO</strong>). Les lignes entièrement couvertes passent en{" "}
            <strong>lecture seule</strong> ; le tableau des soldes ci-dessous se met à jour avec
            chaque paiement. Les montants « à venir » sont plafonnés pour que le total encore à
            couvrir sur les lignes ne dépasse pas le <strong>reste dû</strong>.
          </DialogDescription>
        </DialogHeader>

        {plan ? (
          <div className="space-y-4 text-sm">
            <p className="text-on-surface font-semibold">{plan.title}</p>

            {/* Récap type calculateur */}
            <div className="bg-surface-container-low border-outline-variant/30 grid grid-cols-2 gap-3 rounded-xl border p-4 sm:grid-cols-4">
              <div>
                <p className="text-on-surface-variant text-[10px] font-bold tracking-wider uppercase">
                  Total plan
                </p>
                <p className="text-on-surface mt-1 text-base font-black tabular-nums">
                  {formatMad(plan.totalMad)}
                </p>
              </div>
              <div>
                <p className="text-on-surface-variant text-[10px] font-bold tracking-wider uppercase">
                  Déjà payé
                </p>
                <p className="mt-1 text-base font-black tabular-nums text-green-700 dark:text-green-400">
                  {formatMad(totalPaidOnPlan)}
                </p>
              </div>
              <div>
                <p className="text-on-surface-variant text-[10px] font-bold tracking-wider uppercase">
                  Reste dû
                </p>
                <p className="text-error mt-1 text-base font-black tabular-nums">
                  {formatMad(remaining)}
                </p>
              </div>
              <div>
                <p className="text-on-surface-variant text-[10px] font-bold tracking-wider uppercase">
                  Somme lignes
                </p>
                <p className="text-primary mt-1 text-base font-black tabular-nums">
                  {formatMad(sumScheduled)}
                </p>
                <p className="text-on-surface-variant mt-0.5 text-[10px] leading-tight">
                  Affecté FIFO : {formatMad(sumAllocatedToLines)}
                </p>
                <p className="text-on-surface-variant mt-1 text-[10px] font-bold leading-tight">
                  Encore à couvrir sur les lignes :{" "}
                  <span className="text-on-surface tabular-nums">
                    {formatMad(unpaidOnCalendar)}
                  </span>
                </p>
              </div>
            </div>

            <div className="border-outline-variant/40 max-w-full overflow-x-auto rounded-xl border">
              <table className="w-full min-w-[640px] text-left text-xs">
                <thead className="bg-surface-container-high/80">
                  <tr>
                    <th className="text-on-surface-variant w-8 px-2 py-2 font-bold"> </th>
                    <th className="text-on-surface-variant px-3 py-2 font-bold">
                      Date d&apos;échéance
                    </th>
                    <th className="text-on-surface-variant px-3 py-2 text-right font-bold">
                      Montant convenu
                    </th>
                    <th className="text-on-surface-variant px-3 py-2 text-right font-bold">
                      Payé (FIFO)
                    </th>
                    <th className="text-on-surface-variant px-3 py-2 text-right font-bold">
                      Reste ligne
                    </th>
                    <th className="text-on-surface-variant px-3 py-2 font-bold">Statut</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => {
                    const meta = byRowId.get(row.id);
                    const hasSlot = meta !== undefined;
                    const fullyPaid =
                      hasSlot && meta.remaining <= SLOT_EPS && meta.expectedMad > 0;
                    const partial =
                      hasSlot &&
                      meta.allocated > SLOT_EPS &&
                      meta.remaining > SLOT_EPS;
                    return (
                      <tr
                        key={row.id}
                        className={cn(
                          "border-outline-variant/20 border-t transition-colors",
                          fullyPaid &&
                            "bg-green-50/90 dark:bg-green-950/25",
                          partial &&
                            "bg-amber-50/80 dark:bg-amber-950/20",
                        )}
                      >
                        <td className="px-2 py-2 text-center align-middle">
                          {fullyPaid ? (
                            <CheckCircle2
                              className="text-green-600 mx-auto size-5 dark:text-green-400"
                              aria-label="Ligne soldée"
                            />
                          ) : null}
                        </td>
                        <td className="p-2 align-middle">
                          <FrenchDateInput
                            value={row.dueDate}
                            disabled={fullyPaid}
                            onValueChange={(dueDate) =>
                              updateRow(row.id, { dueDate })
                            }
                            className={cn(
                              "bg-surface-container-low h-10 rounded-lg text-xs font-medium",
                              fullyPaid && "cursor-not-allowed opacity-80",
                            )}
                          />
                        </td>
                        <td className="p-2 align-middle">
                          <MadPriceField
                            value={Number.parseFloat(row.amountRaw.replace(",", ".")) || 0}
                            onValueChange={(v) =>
                              commitAmountRawChange(row.id, v > 0 ? String(v) : "")
                            }
                            min={0.01}
                            max={plan.totalMad}
                            disabled={fullyPaid}
                            compact
                            labelFr="Montant"
                            labelAr="المبلغ"
                            wrapperClassName="w-full min-w-[5rem]"
                          />
                        </td>
                        <td className="text-on-surface px-3 py-2 text-right align-middle font-bold tabular-nums">
                          {hasSlot ? formatMad(meta.allocated) : "—"}
                        </td>
                        <td
                          className={cn(
                            "px-3 py-2 text-right align-middle font-black tabular-nums",
                            hasSlot && meta.remaining > SLOT_EPS
                              ? "text-error"
                              : "text-on-surface-variant",
                          )}
                        >
                          {hasSlot ? formatMad(Math.max(0, meta.remaining)) : "—"}
                        </td>
                        <td className="px-3 py-2 align-middle">
                          {!hasSlot ? (
                            <span className="text-on-surface-variant text-[10px] font-bold uppercase">
                              Brouillon
                            </span>
                          ) : fullyPaid ? (
                            <span className="inline-block rounded-full bg-green-200 px-2 py-0.5 text-[10px] font-black text-green-900 uppercase dark:bg-green-900/50 dark:text-green-100">
                              Soldé
                            </span>
                          ) : partial ? (
                            <span className="inline-block rounded-full bg-amber-200 px-2 py-0.5 text-[10px] font-black text-amber-900 uppercase dark:bg-amber-900/50 dark:text-amber-100">
                              Partiel
                            </span>
                          ) : (
                            <span className="text-on-surface-variant text-[10px] font-bold uppercase">
                              À venir
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-1.5 rounded-xl font-bold"
              disabled={!canAddLine}
              title={
                !canAddLine && remaining > SLOT_EPS
                  ? "Le reste sur les lignes couvre déjà le reste dû du plan, ou la dernière ligne est incomplète."
                  : undefined
              }
              onClick={addRow}
            >
              <Plus className="size-4" />
              Ajouter une ligne
            </Button>

            {!canAddLine && remaining > SLOT_EPS && rows.length > 0 ? (
              <p className="text-on-surface-variant text-xs leading-relaxed">
                {unpaidOnCalendar >= remaining - SLOT_EPS ? (
                  <>
                    Les lignes non encore payées totalisent déjà{" "}
                    <strong className="text-on-surface">{formatMad(unpaidOnCalendar)}</strong>, ce qui
                    couvre le <strong className="text-on-surface">reste dû</strong> du plan (
                    {formatMad(remaining)}). Réduisez une ligne à venir pour en ajouter une autre.
                  </>
                ) : (
                  <>
                    Complétez la <strong className="text-on-surface">date</strong> et le{" "}
                    <strong className="text-on-surface">montant</strong> de la dernière ligne avant
                    d&apos;en ajouter une autre.
                  </>
                )}
              </p>
            ) : null}

            {previewParsed?.ok ? (
              unpaidOnCalendar <= remaining + SLOT_EPS ? (
                <p className="text-secondary text-xs font-semibold">
                  Somme des lignes couvre le reste dû — prêt à enregistrer (les paiements déjà passés
                  comptent sur les premières lignes).
                </p>
              ) : (
                <p className="text-error text-xs font-semibold">
                  Le total encore à couvrir sur les lignes ({formatMad(unpaidOnCalendar)}) dépasse
                  le reste dû ({formatMad(remaining)}). Réduisez un montant convenu sur une ligne à
                  venir.
                </p>
              )
            ) : previewParsed && !previewParsed.ok ? (
              <p className="text-error text-xs font-medium">{previewParsed.error}</p>
            ) : remaining <= 0 ? (
              <p className="text-on-surface-variant text-xs">Ce plan n’a plus de reste à caler.</p>
            ) : (
              <p className="text-on-surface-variant text-xs">
                La somme des montants valides doit être ≥ {formatMad(remaining)} (reste dû actuel).
              </p>
            )}
          </div>
        ) : null}

        <DialogFooter className="flex flex-col gap-2 sm:flex-row sm:justify-end">
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Fermer
            </Button>
            <Button
              type="button"
              className="from-primary to-primary-container bg-linear-to-br font-bold"
              onClick={handleSave}
            >
              Enregistrer
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
