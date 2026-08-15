import type { LedgerEntry } from "@/lib/credits/types";
import type {
  InstallmentScheduleRule,
  RecurringInstallmentScheduleRule,
  ScheduleSlotSnapshot,
} from "@/lib/credits/installments/types";
import { allocatePlanPaymentsFifo } from "@/lib/credits/installments/schedule";

const EPS = 0.02;

export type ManualScheduleDraftRow = {
  dueDate: string;
  amountRaw: string;
};

/** `exact` : création de plan (somme = capital à étaler). `coversRemaining` : calendrier existant après paiements (somme ≥ reste dû). */
export type ManualScheduleSumPolicy = "exact" | "coversRemaining";

export type ParseManualSlotsOptions = {
  sumPolicy: ManualScheduleSumPolicy;
};

/** Tri identique à celui utilisé pour le FIFO (date, montant). */
export function compareScheduleSlots(
  a: ScheduleSlotSnapshot,
  b: ScheduleSlotSnapshot,
): number {
  const c = a.dueDate.localeCompare(b.dueDate);
  if (c !== 0) return c;
  if (a.expectedMad !== b.expectedMad) return a.expectedMad - b.expectedMad;
  return 0;
}

export type ScheduleDraftRowInput = {
  id: string;
  dueDate: string;
  amountRaw: string;
};

/**
 * Lignes valides (date + montant) triées comme les créneaux FIFO — pour prévisualisation
 * sans contrôle de somme.
 */
export function buildSortedValidScheduleDraftItems(
  rows: readonly ScheduleDraftRowInput[],
): { rowId: string; dueDate: string; expectedMad: number }[] {
  const items: { rowId: string; dueDate: string; expectedMad: number }[] = [];
  for (const row of rows) {
    const trimmed = row.dueDate.trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) continue;
    const d = new Date(trimmed);
    if (Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== trimmed) continue;
    const amount = Number.parseFloat(row.amountRaw.replace(",", "."));
    if (!Number.isFinite(amount) || amount <= 0) continue;
    items.push({
      rowId: row.id,
      dueDate: row.dueDate.trim(),
      expectedMad: Math.round(amount * 100) / 100,
    });
  }
  items.sort((a, b) => {
    const c = a.dueDate.localeCompare(b.dueDate);
    if (c !== 0) return c;
    if (a.expectedMad !== b.expectedMad) return a.expectedMad - b.expectedMad;
    return a.rowId.localeCompare(b.rowId);
  });
  return items;
}

function isLastDraftRowComplete(row: ScheduleDraftRowInput | undefined): boolean {
  if (!row) return false;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(row.dueDate.trim())) return false;
  const n = Number.parseFloat(row.amountRaw.replace(",", "."));
  return Number.isFinite(n) && n > 0;
}

export function isScheduleDraftLastRowComplete(
  rows: readonly ScheduleDraftRowInput[],
): boolean {
  return isLastDraftRowComplete(rows[rows.length - 1]);
}

/** Somme des max(0, attendu − payé FIFO) par ligne — ce qu’il reste à couvrir sur le calendrier. */
export function unpaidScheduledTotalMad(
  expectedPerSlot: readonly { expectedMad: number }[],
  allocatedPerSlot: readonly number[],
): number {
  let s = 0;
  for (let i = 0; i < expectedPerSlot.length; i++) {
    const exp = expectedPerSlot[i]!.expectedMad;
    const a = allocatedPerSlot[i] ?? 0;
    s += Math.max(0, Math.round((exp - a) * 100) / 100);
  }
  return Math.round(s * 100) / 100;
}

/**
 * Nouvelle ligne autorisée si la dernière ligne est complète et, lorsque `coverTargetMad` est
 * renseigné, la somme des lignes valides est strictement inférieure à la cible (ex. reste dû).
 * Passer `null` pour la cible désactive le plafond (ex. formulaire création avant total valide).
 */
export function canAddManualScheduleRow(
  rows: readonly ScheduleDraftRowInput[],
  coverTargetMad: number | null,
): boolean {
  if (!isLastDraftRowComplete(rows[rows.length - 1])) return false;
  if (coverTargetMad === null) return true;
  const cap = Math.round(Math.max(0, coverTargetMad) * 100) / 100;
  if (cap <= EPS) return false;
  const items = buildSortedValidScheduleDraftItems(rows);
  const sum =
    Math.round(items.reduce((s, it) => s + it.expectedMad, 0) * 100) / 100;
  return sum < cap - EPS;
}

/**
 * Build sorted slot snapshots from admin-entered rows.
 * - `exact` : la somme doit égaler `referenceMad` (ex. reste après acompte à la création du plan).
 * - `coversRemaining` : la somme doit être ≥ `referenceMad` (reste dû actuel), pour rester cohérent
 *   avec des paiements déjà enregistrés (FIFO sur les lignes).
 */
export function parseAndBuildManualSlots(
  rows: readonly ManualScheduleDraftRow[],
  referenceMad: number,
  opts: ParseManualSlotsOptions,
): { ok: true; slots: ScheduleSlotSnapshot[] } | { ok: false; error: string } {
  const rem = Math.round(Math.max(0, referenceMad) * 100) / 100;
  if (rem <= 0) {
    return { ok: false, error: "Plus rien à répartir sur le calendrier." };
  }

  const nonEmpty = rows.filter(
    (r) => r.dueDate.trim() !== "" || r.amountRaw.trim() !== "",
  );
  if (nonEmpty.length === 0) {
    return {
      ok: false,
      error: "Ajoutez au moins une ligne avec une date et un montant.",
    };
  }

  const slots: ScheduleSlotSnapshot[] = [];
  for (let i = 0; i < nonEmpty.length; i++) {
    const r = nonEmpty[i]!;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(r.dueDate.trim())) {
      return {
        ok: false,
        error: `Ligne ${i + 1} : date invalide (format AAAA-MM-JJ).`,
      };
    }
    const amount = Number.parseFloat(r.amountRaw.replace(",", "."));
    if (!Number.isFinite(amount) || amount <= 0) {
      return {
        ok: false,
        error: `Ligne ${i + 1} : indiquez un montant supérieur à 0.`,
      };
    }
    slots.push({
      dueDate: r.dueDate.trim(),
      expectedMad: Math.round(amount * 100) / 100,
    });
  }

  slots.sort(compareScheduleSlots);

  const sum = Math.round(slots.reduce((s, x) => s + x.expectedMad, 0) * 100) / 100;
  if (opts.sumPolicy === "exact") {
    if (Math.abs(sum - rem) > EPS) {
      return {
        ok: false,
        error: `Somme des lignes : ${sum.toFixed(2)} MAD — doit égaler le reste à étaler : ${rem.toFixed(2)} MAD (après acompte).`,
      };
    }
  } else {
    if (sum + EPS < rem) {
      return {
        ok: false,
        error: `Somme des lignes : ${sum.toFixed(2)} MAD — doit couvrir au moins le reste dû actuel : ${rem.toFixed(2)} MAD (les paiements déjà enregistrés comptent sur les premières lignes).`,
      };
    }
  }

  return { ok: true, slots };
}

export function isRecurringScheduleRule(
  r: InstallmentScheduleRule,
): r is RecurringInstallmentScheduleRule {
  return r.kind !== "manual";
}

/** Chaîne pour champ « montant convenu » après plafonnement. */
export function formatDraftExpectedMadInput(n: number): string {
  const x = Math.round(Math.max(0.01, n) * 100) / 100;
  if (Number.isInteger(x)) return String(x);
  return x.toFixed(2);
}

/** Reste à couvrir sur le brouillon (FIFO) pour un plan déjà existant. */
export function scheduleDraftUnpaidTotalMad(
  planId: string,
  rows: readonly ScheduleDraftRowInput[],
  entries: readonly LedgerEntry[],
): { unpaid: number; slots: ScheduleSlotSnapshot[]; alloc: number[] } | null {
  const items = buildSortedValidScheduleDraftItems(rows);
  if (items.length === 0) return null;
  const slots: ScheduleSlotSnapshot[] = items.map((it) => ({
    dueDate: it.dueDate,
    expectedMad: it.expectedMad,
  }));
  const alloc = allocatePlanPaymentsFifo(planId, slots, entries);
  const unpaid = unpaidScheduledTotalMad(slots, alloc);
  return { unpaid, slots, alloc };
}

export type ClampScheduleDraftRowArgs = {
  planId: string;
  planRemainingMad: number;
  planTotalMad: number;
  rows: readonly ScheduleDraftRowInput[];
  entries: readonly LedgerEntry[];
  targetRowId: string;
  proposedMad: number;
};

/**
 * Ramène un montant convenu saisi pour qu’après FIFO la somme des restes sur les lignes ne
 * dépasse pas le reste dû du plan (ni le total du plan).
 */
export function clampScheduleDraftRowExpectedMad(
  args: ClampScheduleDraftRowArgs,
): number {
  const rem = Math.round(Math.max(0, args.planRemainingMad) * 100) / 100;
  const totalCap = Math.round(Math.max(args.planTotalMad, rem, 0.01) * 100) / 100;
  let v = Math.round(Math.max(0.01, Math.min(args.proposedMad, totalCap)) * 100) / 100;

  const rowsWith = (amt: number) =>
    args.rows.map((r) =>
      r.id === args.targetRowId
        ? { ...r, amountRaw: formatDraftExpectedMadInput(amt) }
        : r,
    );

  for (let i = 0; i < 48; i++) {
    const snap = scheduleDraftUnpaidTotalMad(args.planId, rowsWith(v), args.entries);
    if (snap === null) return 0.01;
    if (snap.unpaid <= rem + EPS) return Math.round(v * 100) / 100;
    const ratio = rem / Math.max(snap.unpaid, EPS);
    v = Math.round(v * ratio * 100) / 100;
    v = Math.max(0.01, Math.min(v, totalCap));
  }
  return Math.max(0.01, Math.min(v, rem, totalCap));
}

/**
 * Plafond à la création du plan (pas encore de planId / FIFO) : la somme des lignes valides ne
 * doit pas dépasser le capital à étaler après acompte ni le total du plan.
 */
export function clampScheduleDraftRowForNewPlan(args: {
  rows: readonly ScheduleDraftRowInput[];
  targetRowId: string;
  proposedMad: number;
  principalAfterUpfront: number;
  planTotalMad: number;
}): number {
  const cap = Math.round(Math.max(args.principalAfterUpfront, 0.01) * 100) / 100;
  const totalCap = Math.round(Math.max(args.planTotalMad, cap) * 100) / 100;
  const draft = args.rows.map((r) =>
    r.id === args.targetRowId
      ? { ...r, amountRaw: formatDraftExpectedMadInput(args.proposedMad) }
      : r,
  );
  const items = buildSortedValidScheduleDraftItems(draft);
  const sumOther = items
    .filter((it) => it.rowId !== args.targetRowId)
    .reduce((s, it) => s + it.expectedMad, 0);
  const maxP = Math.round((cap - sumOther) * 100) / 100;
  return Math.round(
    Math.max(0.01, Math.min(args.proposedMad, maxP, totalCap)) * 100,
  ) / 100;
}
