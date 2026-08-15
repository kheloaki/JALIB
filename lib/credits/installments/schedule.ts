import { isLedgerPayment } from "@/lib/credits/compute";
import type { LedgerEntry } from "@/lib/credits/types";
import type {
  InstallmentPlan,
  ScheduleSlotSnapshot,
} from "@/lib/credits/installments/types";

const EPS = 0.005;

/**
 * Répartition FIFO des paiements du plan sur les créneaux (ordre chronologique).
 */
export function allocatePlanPaymentsFifo(
  planId: string,
  slots: readonly ScheduleSlotSnapshot[],
  entries: readonly LedgerEntry[],
): number[] {
  const alloc = slots.map(() => 0);
  const payments = entries
    .filter((e) => e.planId === planId && isLedgerPayment(e))
    .slice()
    .sort((a, b) => a.date.localeCompare(b.date));

  let slotIdx = 0;
  for (const pay of payments) {
    let left = pay.amountMad;
    while (left > EPS && slotIdx < slots.length) {
      const need = slots[slotIdx]!.expectedMad - alloc[slotIdx]!;
      if (need <= EPS) {
        slotIdx += 1;
        continue;
      }
      const add = Math.min(left, need);
      alloc[slotIdx] = Math.round((alloc[slotIdx]! + add) * 100) / 100;
      left = Math.round((left - add) * 100) / 100;
      if (alloc[slotIdx]! >= slots[slotIdx]!.expectedMad - EPS) {
        slotIdx += 1;
      }
    }
  }
  return alloc;
}

export type ScheduleBreach = {
  slotIndex: number;
  dueDate: string;
  expectedMad: number;
  allocatedMad: number;
};

/**
 * Retard : date du jour strictement après la date d’échéance, et créneau pas entièrement payé.
 */
export function findScheduleBreaches(
  slots: readonly ScheduleSlotSnapshot[],
  allocated: readonly number[],
  todayIso: string,
): ScheduleBreach[] {
  const out: ScheduleBreach[] = [];
  for (let i = 0; i < slots.length; i++) {
    const slot = slots[i]!;
    const got = allocated[i] ?? 0;
    if (got >= slot.expectedMad - EPS) continue;
    if (todayIso <= slot.dueDate) continue;
    out.push({
      slotIndex: i,
      dueDate: slot.dueDate,
      expectedMad: slot.expectedMad,
      allocatedMad: got,
    });
  }
  return out;
}

/** Prochaine échéance contractuelle encore ouverte (pour affichage / nextDueDate). */
export function nextOpenScheduleDueDate(
  slots: readonly ScheduleSlotSnapshot[],
  allocated: readonly number[],
): string | null {
  for (let i = 0; i < slots.length; i++) {
    if ((allocated[i] ?? 0) < slots[i]!.expectedMad - EPS) {
      return slots[i]!.dueDate;
    }
  }
  return null;
}

export function planHasActiveSchedule(plan: InstallmentPlan): boolean {
  return Boolean(
    plan.scheduleSlots &&
      plan.scheduleSlots.length > 0 &&
      plan.status === "active",
  );
}
