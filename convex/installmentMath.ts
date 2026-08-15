import type { Doc, Id } from "./_generated/dataModel";

const EPS_CENTS = 1;

function ledgerEntryIsPayment(
  entry: Pick<Doc<"creditLedgerEntries">, "kind" | "source">,
) {
  return entry.kind === "payment" && entry.source !== "return";
}

function pad2(value: number) {
  return String(value).padStart(2, "0");
}

export function addMonthsIso(dateIso: string, months: number): string {
  const [yearRaw, monthRaw, dayRaw] = dateIso.split("-");
  const year = Number(yearRaw);
  const month = Number(monthRaw);
  const day = Number(dayRaw);
  if (
    !Number.isFinite(year) ||
    !Number.isFinite(month) ||
    !Number.isFinite(day)
  ) {
    return dateIso;
  }

  const targetMonthIndex = year * 12 + (month - 1) + months;
  const targetYear = Math.floor(targetMonthIndex / 12);
  const targetMonthZero = targetMonthIndex % 12;
  const targetMonth = targetMonthZero + 1;
  const lastDay = new Date(targetYear, targetMonth, 0).getDate();
  const targetDay = Math.min(day, lastDay);

  return `${targetYear}-${pad2(targetMonth)}-${pad2(targetDay)}`;
}

export function planPaidMadCents(
  planId: Id<"installmentPlans">,
  entries: readonly Doc<"creditLedgerEntries">[],
) {
  return entries.reduce((sum, entry) => {
    if (entry.planId !== planId || !ledgerEntryIsPayment(entry)) return sum;
    return sum + entry.amountMadCents;
  }, 0);
}

export function planRemainingMadCents(
  plan: Pick<Doc<"installmentPlans">, "_id" | "totalMadCents">,
  entries: readonly Doc<"creditLedgerEntries">[],
) {
  return Math.max(0, plan.totalMadCents - planPaidMadCents(plan._id, entries));
}

export function nextOpenScheduleDueDate(
  planId: Id<"installmentPlans">,
  slots: NonNullable<Doc<"installmentPlans">["scheduleSlots"]>,
  entries: readonly Doc<"creditLedgerEntries">[],
) {
  const allocation = slots.map(() => 0);
  const payments = entries
    .filter((entry) => entry.planId === planId && ledgerEntryIsPayment(entry))
    .slice()
    .sort((a, b) => a.date.localeCompare(b.date));

  let slotIndex = 0;
  for (const payment of payments) {
    let left = payment.amountMadCents;
    while (left > EPS_CENTS && slotIndex < slots.length) {
      const slot = slots[slotIndex]!;
      const need = slot.expectedMadCents - allocation[slotIndex]!;
      if (need <= EPS_CENTS) {
        slotIndex += 1;
        continue;
      }
      const add = Math.min(left, need);
      allocation[slotIndex] = allocation[slotIndex]! + add;
      left -= add;
      if (allocation[slotIndex]! >= slot.expectedMadCents - EPS_CENTS) {
        slotIndex += 1;
      }
    }
  }

  for (let index = 0; index < slots.length; index += 1) {
    if ((allocation[index] ?? 0) < slots[index]!.expectedMadCents - EPS_CENTS) {
      return slots[index]!.dueDate;
    }
  }
  return null;
}

export function nextDueDateAfterPlanPayment(
  plan: Pick<
    Doc<"installmentPlans">,
    "_id" | "nextDueDate" | "scheduleSlots"
  >,
  entries: readonly Doc<"creditLedgerEntries">[],
) {
  if (plan.scheduleSlots?.length) {
    return (
      nextOpenScheduleDueDate(plan._id, plan.scheduleSlots, entries) ??
      plan.scheduleSlots[plan.scheduleSlots.length - 1]!.dueDate
    );
  }
  return addMonthsIso(plan.nextDueDate, 1);
}
