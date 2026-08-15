"use client";

import { useMemo, useState } from "react";
import { useLocale } from "next-intl";
import { useMutation } from "convex/react";
import {
  Archive,
  CalendarClock,
  Layers,
  RotateCcw,
} from "lucide-react";

import { PlanLinkedLedgerList } from "@/components/credits/plan-linked-ledger-list";
import { PlanScheduleRuleDialog } from "@/components/credits/plan-schedule-rule-dialog";
import { isLedgerPayment } from "@/lib/credits/compute";
import type {
  InstallmentPlan,
  InstallmentScheduleRule,
  ScheduleSlotSnapshot,
} from "@/lib/credits/installments/types";
import type { Client } from "@/lib/clients/types";
import type { CreditStore, LedgerEntry } from "@/lib/credits/types";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toaster";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { formatMad } from "@/lib/money/mad";
import { cn } from "@/lib/utils";

type PlansListTab = "main" | "draft";

export function CreditsClientPlansPanel({
  client,
  plans,
  creditStore,
  entries,
  tr,
  onOpenInstallmentPay,
}: {
  client: Client;
  plans: InstallmentPlan[];
  creditStore: CreditStore;
  entries: LedgerEntry[];
  tr: (fr: string, ar: string) => string;
  onOpenInstallmentPay: (plan: InstallmentPlan) => void;
}) {
  const locale = useLocale();
  const toast = useToast();
  const setInstallmentPlanStatus = useMutation(api.installmentPlans.setStatus);
  const updatePlanScheduleRule = useMutation(
    api.installmentPlans.updateScheduleRule,
  );
  const [plansListTab, setPlansListTab] = useState<PlansListTab>("main");
  const [scheduleRuleEditPlan, setScheduleRuleEditPlan] =
    useState<InstallmentPlan | null>(null);

  const plansMain = useMemo(
    () =>
      plans
        .filter(
          (p) =>
            p.clientId === client.id &&
            (p.status === "active" || p.status === "completed"),
        )
        .sort((a, b) => b.startDate.localeCompare(a.startDate)),
    [plans, client.id],
  );

  const plansDraft = useMemo(
    () =>
      plans
        .filter((p) => p.clientId === client.id && p.status === "draft")
        .sort((a, b) => b.startDate.localeCompare(a.startDate)),
    [plans, client.id],
  );

  const paidByPlanId = useMemo(() => {
    const map = new Map<string, number>();
    for (const e of entries) {
      if (!e.planId) continue;
      if (!isLedgerPayment(e)) continue;
      map.set(e.planId, (map.get(e.planId) ?? 0) + e.amountMad);
    }
    return map;
  }, [entries]);

  const ledgerEntriesByPlanId = useMemo(() => {
    const m = new Map<string, LedgerEntry[]>();
    for (const e of entries) {
      if (!e.planId) continue;
      const list = m.get(e.planId);
      if (list) list.push(e);
      else m.set(e.planId, [e]);
    }
    for (const list of m.values()) {
      list.sort((a, b) => b.date.localeCompare(a.date));
    }
    return m;
  }, [entries]);

  async function sendCompletedPlanToDraft(planId: string) {
    const plan = plans.find((p) => p.id === planId);
    if (!plan || plan.status !== "completed") return;
    try {
      await setInstallmentPlanStatus({
        planId: planId as Id<"installmentPlans">,
        status: "draft",
      });
      setPlansListTab("draft");
    } catch (error) {
      toast.error(
        tr("Plan non archivé", "لم يتم أرشفة الخطة"),
        error instanceof Error ? error.message : "Une erreur est survenue.",
      );
    }
  }

  async function restorePlanFromDraft(planId: string) {
    const plan = plans.find((p) => p.id === planId);
    if (!plan || plan.status !== "draft") return;
    try {
      await setInstallmentPlanStatus({
        planId: planId as Id<"installmentPlans">,
        status: "completed",
      });
      setPlansListTab("main");
    } catch (error) {
      toast.error(
        tr("Plan non récupéré", "لم تتم استعادة الخطة"),
        error instanceof Error ? error.message : "Une erreur est survenue.",
      );
    }
  }

  async function applyScheduleRule(
    planId: string,
    rule: InstallmentScheduleRule | null,
    slots: ScheduleSlotSnapshot[] | null,
  ) {
    await updatePlanScheduleRule({
      planId: planId as Id<"installmentPlans">,
      rule,
      slots,
    });
  }

  if (plansMain.length === 0 && plansDraft.length === 0) {
    return null;
  }

  return (
    <div className="bg-surface-container-lowest border-sidebar-border rounded-xl border p-6 shadow-sm">
      <div className="mb-4 flex items-center gap-3">
        <div className="bg-primary-fixed text-primary flex h-10 w-10 items-center justify-center rounded-xl p-2">
          <Layers className="size-5 stroke-[1.75]" aria-hidden />
        </div>
        <h3 className="text-lg font-bold">
          {tr("Plans de remboursement", "خطط السداد")}
        </h3>
      </div>

      <div className="mb-4 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <p className="text-on-surface-variant max-w-md text-xs leading-relaxed">
          {plansListTab === "main"
            ? tr(
                "Plans en cours ou soldés.",
                "خطط جارية أو مسددة.",
              )
            : tr(
                "Plans soldés rangés à part.",
                "خطط مسددة مؤرشفة.",
              )}
        </p>
        <div
          className="bg-surface-container-low flex w-full shrink-0 gap-1 rounded-xl p-1 sm:w-auto"
          role="tablist"
        >
          <button
            type="button"
            role="tab"
            aria-selected={plansListTab === "main"}
            onClick={() => setPlansListTab("main")}
            className={cn(
              "flex flex-1 items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-xs font-bold transition-colors sm:flex-initial sm:min-w-[11rem]",
              plansListTab === "main"
                ? "bg-primary text-on-primary shadow-sm"
                : "text-on-surface-variant hover:bg-surface-container-high",
            )}
          >
            {tr("Liste principale", "القائمة الرئيسية")}
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={plansListTab === "draft"}
            onClick={() => setPlansListTab("draft")}
            className={cn(
              "flex flex-1 items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-xs font-bold transition-colors sm:flex-initial sm:min-w-[11rem]",
              plansListTab === "draft"
                ? "bg-primary text-on-primary shadow-sm"
                : "text-on-surface-variant hover:bg-surface-container-high",
            )}
          >
            <Archive className="size-3.5 stroke-[1.75] opacity-90" aria-hidden />
            {tr("Brouillon", "مسودة")}
          </button>
        </div>
      </div>

      {plansListTab === "main" ? (
        <div className="space-y-3">
          {plansMain.map((p) => {
            const paid = paidByPlanId.get(p.id) ?? 0;
            const remaining = Math.max(
              0,
              Math.round((p.totalMad - paid) * 100) / 100,
            );
            return (
              <div
                key={p.id}
                className="border-sidebar-border bg-surface-container-lowest flex flex-col rounded-2xl border p-4"
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <p className="text-on-surface truncate text-sm font-bold">
                      {p.title}
                    </p>
                    <p className="text-on-surface-variant mt-1 text-xs">
                      {tr("Total", "الإجمالي")}{" "}
                      {formatMad(p.totalMad, 2, locale)} • {tr("Payé", "المدفوع")}{" "}
                      <span className="font-bold tabular-nums text-green-600 dark:text-green-400">
                        {formatMad(paid, 2, locale)}
                      </span>{" "}
                      • {tr("Reste", "المتبقي")}{" "}
                      <span className="text-error font-bold tabular-nums">
                        {formatMad(remaining, 2, locale)}
                      </span>
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={cn(
                        "rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-wider",
                        p.status === "completed"
                          ? "bg-secondary-container text-on-secondary-container"
                          : "bg-tertiary-fixed-dim/20 text-tertiary",
                      )}
                    >
                      {p.status === "completed"
                        ? tr("Soldé", "مسدد")
                        : tr("Actif", "نشط")}
                    </span>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={p.status !== "active"}
                      onClick={() => setScheduleRuleEditPlan(p)}
                      className="h-9 gap-1.5 rounded-xl font-bold"
                    >
                      <CalendarClock className="size-3.5 stroke-[1.75]" aria-hidden />
                      {tr("Calendrier", "الجدول")}
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      disabled={p.status !== "active" || remaining <= 0}
                      onClick={() => onOpenInstallmentPay(p)}
                      className="h-9 min-w-18 rounded-xl font-bold"
                    >
                      {tr("Payer", "ادفع")}
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={p.status !== "completed"}
                      onClick={() => void sendCompletedPlanToDraft(p.id)}
                      className="text-on-surface-variant h-9 gap-1.5 rounded-xl border-dashed font-bold"
                    >
                      <Archive className="size-3.5 stroke-[1.75]" aria-hidden />
                      {tr("Brouillon", "مسودة")}
                    </Button>
                  </div>
                </div>
                <PlanLinkedLedgerList
                  planId={p.id}
                  ledgerByPlanId={ledgerEntriesByPlanId}
                />
              </div>
            );
          })}
        </div>
      ) : (
        <div className="space-y-3">
          {plansDraft.map((p) => {
            const paid = paidByPlanId.get(p.id) ?? 0;
            return (
              <div
                key={p.id}
                className="border-sidebar-border bg-surface-container-lowest flex flex-col rounded-2xl border p-4"
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <p className="text-on-surface truncate text-sm font-bold">
                      {p.title}
                    </p>
                    <p className="text-on-surface-variant mt-1 text-xs">
                      {formatMad(p.totalMad, 2, locale)} • {formatMad(paid, 2, locale)}
                    </p>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    onClick={() => void restorePlanFromDraft(p.id)}
                    className="h-9 gap-1.5 rounded-xl font-bold"
                  >
                    <RotateCcw className="size-3.5 stroke-[1.75]" aria-hidden />
                    {tr("Récupérer", "استعادة")}
                  </Button>
                </div>
                <PlanLinkedLedgerList
                  planId={p.id}
                  ledgerByPlanId={ledgerEntriesByPlanId}
                />
              </div>
            );
          })}
        </div>
      )}

      <PlanScheduleRuleDialog
        plan={scheduleRuleEditPlan}
        open={Boolean(scheduleRuleEditPlan)}
        onOpenChange={(open) => {
          if (!open) setScheduleRuleEditPlan(null);
        }}
        creditStore={creditStore}
        onApply={applyScheduleRule}
      />
    </div>
  );
}
