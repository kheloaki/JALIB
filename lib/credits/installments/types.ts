export type InstallmentPlanStatus =
  | "active"
  | "completed"
  /** Soldé, rangé hors de la liste principale (brouillon / archives). */
  | "draft"
  | "cancelled";

/** Calendrier saisi ligne par ligne (dates et montants libres). */
export type ManualInstallmentScheduleRule = {
  kind: "manual";
};

/** Ancien mode récurrent (généré automatiquement) — conservé pour les plans déjà enregistrés. */
export type RecurringInstallmentScheduleRule = {
  kind: "recurring";
  expectedPaymentMad: number;
  intervalMonths: number;
  dueDayOfMonth: number;
};

export type InstallmentScheduleRule =
  | ManualInstallmentScheduleRule
  | RecurringInstallmentScheduleRule;

/** Créneaux figés (régénérés à la création / mise à jour de la règle). */
export type ScheduleSlotSnapshot = {
  dueDate: string;
  expectedMad: number;
};

export type InstallmentPlan = {
  id: string;
  clientId: string;
  /** Reference label shown in UI (e.g., INV-1024 / Achat TV). */
  title: string;
  totalMad: number;
  /** Kept for older saved plans; new plans always use 0 (no fixed monthly amount). */
  monthlyMad: number;
  /** ISO date YYYY-MM-DD */
  startDate: string;
  /** ISO date YYYY-MM-DD */
  nextDueDate: string;
  status: InstallmentPlanStatus;
  invoiceEntryId: string;
  invoiceId?: string;
  /**
   * Règle optionnelle : tableau de dates + montants. Alerte si, après la date d’échéance,
   * le montant attendu n’est pas couvert (paiements du plan comptés du plus ancien au plus récent).
   */
  scheduleRule?: InstallmentScheduleRule | null;
  scheduleSlots?: ScheduleSlotSnapshot[] | null;
};

export type InstallmentsStore = {
  plans: InstallmentPlan[];
};
