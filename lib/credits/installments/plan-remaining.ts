import { isLedgerPayment } from "@/lib/credits/compute";
import type { CreditStore } from "@/lib/credits/types";
import type { InstallmentPlan } from "@/lib/credits/installments/types";

export function planRemainingForStore(
  plan: InstallmentPlan,
  entriesByClient: CreditStore["entriesByClient"],
): number {
  const entries = entriesByClient[plan.clientId] ?? [];
  let paid = 0;
  for (const e of entries) {
    if (e.planId !== plan.id || !isLedgerPayment(e)) continue;
    paid += e.amountMad;
  }
  return Math.max(0, Math.round((plan.totalMad - paid) * 100) / 100);
}
