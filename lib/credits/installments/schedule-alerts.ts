import type { Client } from "@/lib/clients/types";
import type { CreditStore } from "@/lib/credits/types";
import type { AlertItem } from "@/lib/alerts/types";
import type { InstallmentPlan } from "@/lib/credits/installments/types";
import { formatDateFr } from "@/lib/dates/format-date";
import {
  allocatePlanPaymentsFifo,
  findScheduleBreaches,
} from "@/lib/credits/installments/schedule";

export function buildInstallmentScheduleAlertItems(
  plans: readonly InstallmentPlan[],
  store: CreditStore,
  clients: readonly Client[],
  todayIso: string,
  timeLabel: string,
): AlertItem[] {
  const clientById = new Map(clients.map((c) => [c.id, c]));
  const out: AlertItem[] = [];

  for (const plan of plans) {
    if (plan.status !== "active") continue;
    if (!plan.scheduleSlots?.length) continue;

    const entries = store.entriesByClient[plan.clientId] ?? [];
    const alloc = allocatePlanPaymentsFifo(plan.id, plan.scheduleSlots, entries);
    const breaches = findScheduleBreaches(plan.scheduleSlots, alloc, todayIso);
    const client = clientById.get(plan.clientId);
    const phoneDigits = client?.phone?.replace(/\D/g, "") ?? "";

    for (const b of breaches) {
      const shortBy = Math.round((b.expectedMad - b.allocatedMad) * 100) / 100;
      out.push({
        id: `auto:installment:${plan.id}:slot:${b.slotIndex}:${b.dueDate}`,
        category: "installment_missed",
        variant: phoneDigits.length >= 8 ? "whatsapp_ignore" : "details",
        badge: "Plan crédit • Échéance manquée",
        timeLabel,
        title: `${client?.fullName ?? "Client"} — ${plan.title}`,
        detail: `Échéance du ${formatDateFr(b.dueDate)} : attendu ${b.expectedMad.toLocaleString("fr-FR")} MAD, enregistré ${b.allocatedMad.toLocaleString("fr-FR")} MAD (manque ${shortBy.toLocaleString("fr-FR")} MAD — date dépassée).`,
        clientName: client?.fullName,
        whatsappPhone: phoneDigits.length >= 8 ? phoneDigits : undefined,
      });
    }
  }

  return out;
}
