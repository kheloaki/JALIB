import { formatDateLongFr, formatWeekdayFr } from "@/lib/dates/format-date";
import { statusPillClass } from "@/lib/ui/status-pill";
import { cn } from "@/lib/utils";
import { isLedgerPayment, isLedgerReturn } from "@/lib/credits/compute";
import type { LedgerEntry, LedgerStatus } from "@/lib/credits/types";

export type HistoryKindFilter = "all" | "payment" | "invoice" | "return";
export type HistoryStatusFilter = "all" | LedgerStatus;
export type HistorySourceFilter = "all" | "plan" | "pos" | "return" | "other";
export type HistoryVerificationFilter = "all" | "verified" | "unverified";

export function ledgerEntryIsFromPos(e: LedgerEntry): boolean {
  if (isLedgerReturn(e)) return false;
  if (e.source === "pos") return true;
  if (e.planId) return false;
  const ref = e.ref.toLowerCase();
  const note = e.note.toLowerCase();
  return ref.includes("vente pos") || note.includes("achat pos");
}

export function ledgerEntryMatchesSourceFilter(
  e: LedgerEntry,
  filter: HistorySourceFilter,
): boolean {
  if (filter === "all") return true;
  const fromReturn = isLedgerReturn(e);
  const fromPlan = Boolean(e.planId);
  const fromPos = ledgerEntryIsFromPos(e);
  if (filter === "plan") return fromPlan;
  if (filter === "pos") return fromPos;
  if (filter === "return") return fromReturn;
  return !fromPlan && !fromPos && !fromReturn;
}

export function ledgerSourceLabel(e: LedgerEntry): { short: string; title: string } {
  if (isLedgerReturn(e)) {
    return {
      short: "Retour",
      title: "Retour de marchandise ou ajustement de facture",
    };
  }
  if (e.planId || e.source === "plan") {
    return { short: "Plan", title: "Paiement en plusieurs fois / échéancier" };
  }
  if (e.source === "pos" || ledgerEntryIsFromPos(e)) {
    return { short: "POS", title: "Vente à crédit depuis la caisse" };
  }
  return {
    short: "Autre",
    title: "Saisie manuelle ou autre origine (sans plan ni POS)",
  };
}

export function ledgerKindLabel(e: LedgerEntry, isAr = false): string {
  if (isLedgerReturn(e)) return isAr ? "إرجاع" : "Retour";
  if (isLedgerPayment(e)) return isAr ? "دفعة" : "Paiement";
  return isAr ? "فاتورة / دين" : "Facture / dette";
}

export function ledgerAmountSign(e: LedgerEntry): string {
  return e.kind === "invoice" ? "−" : "+";
}

export function ledgerRowClass(e: LedgerEntry): string {
  if (isLedgerReturn(e)) {
    return "bg-orange-50 hover:bg-orange-100/80";
  }
  if (isLedgerPayment(e)) {
    return "bg-secondary-container/35 hover:bg-secondary-container/50";
  }
  return "hover:bg-surface-container-low/40";
}

export function ledgerAmountClass(e: LedgerEntry): string {
  if (isLedgerReturn(e)) return "text-orange-600";
  if (isLedgerPayment(e)) return "text-secondary";
  return "text-on-surface";
}

export function ledgerIconClass(e: LedgerEntry): string {
  if (isLedgerReturn(e)) return "bg-orange-100 text-orange-600";
  if (isLedgerPayment(e)) return "bg-secondary-container text-on-secondary-container";
  return "bg-surface-container-high text-on-surface-variant";
}

export function formatLedgerDate(iso: string, _locale = "fr-FR"): string {
  return formatDateLongFr(iso);
}

export function formatLedgerTime(time?: string | null): string | null {
  const t = time?.trim();
  if (!t) return null;
  const match = t.match(/^(\d{1,2}):(\d{2})/);
  if (!match) return t;
  return `${match[1]!.padStart(2, "0")}:${match[2]}`;
}

/** Resolve HH:mm from explicit time or createdAt epoch. */
export function resolveLedgerTime(entry: {
  time?: string | null;
  createdAt?: number | null;
}): string | null {
  const fromField = formatLedgerTime(entry.time);
  if (fromField) return fromField;
  if (entry.createdAt == null || !Number.isFinite(entry.createdAt)) return null;
  try {
    return new Intl.DateTimeFormat("fr-FR", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
      timeZone: "Africa/Casablanca",
    }).format(new Date(entry.createdAt));
  } catch {
    return null;
  }
}

export function formatWeekday(iso: string, _locale = "fr-FR"): string {
  return formatWeekdayFr(iso);
}

/** Tone for accounting outstanding (positive = debt). */
export function balanceTone(mad: number): "ok" | "warn" | "debt" {
  if (mad <= 0) return "ok";
  if (mad < 2000) return "warn";
  return "debt";
}

/**
 * Tone for client-facing solde (encaissé − achats).
 * Negative = owes (red); positive = client credit; zero = settled.
 */
export function soldeTone(soldeMad: number): "credit" | "settled" | "debt" {
  if (soldeMad > 0.009) return "credit";
  if (soldeMad < -0.009) return "debt";
  return "settled";
}

export function soldeToneClass(soldeMad: number): string {
  const tone = soldeTone(soldeMad);
  if (tone === "debt") return "text-error";
  if (tone === "credit") return "text-secondary";
  return "text-on-surface";
}

export const ledgerBadgeBaseClass = cn(
  statusPillClass,
  "px-2.5 py-1 text-[11px] font-bold",
);

export function statusBadgeClass(s: LedgerEntry["status"]): string {
  switch (s) {
    case "valide":
      return "bg-secondary-container text-on-secondary-container";
    case "impayé":
      return "bg-error-container text-on-error-container";
    case "solde":
      return "bg-secondary-container text-on-secondary-container";
    default:
      return "bg-surface-container-high text-on-surface-variant";
  }
}

export function verificationLabel(
  verified: boolean | null | undefined,
  isAr = false,
): string {
  if (verified === true) return isAr ? "تم التحقق" : "Vérifié";
  if (verified === false) return isAr ? "غير محقق" : "Non vérifié";
  return "—";
}

export function verificationBadgeClass(
  verified: boolean | null | undefined,
): string {
  if (verified === true) {
    return "bg-secondary-container text-on-secondary-container";
  }
  if (verified === false) {
    return "bg-tertiary-container text-on-tertiary-container";
  }
  return "text-on-surface-variant";
}

export function statusLabel(
  s: LedgerEntry["status"],
  isAr = false,
  options?: { feminine?: boolean },
): string {
  const feminine = options?.feminine ?? false;
  switch (s) {
    case "valide":
      return isAr ? "مؤكد" : "Validé";
    case "impayé":
      return isAr ? "غير مدفوعة" : feminine ? "Impayée" : "Impayé";
    case "solde":
      return isAr ? "مسددة" : feminine ? "Soldée" : "Soldé";
    default:
      return s;
  }
}

export function filterLedgerEntries(
  rows: LedgerEntry[],
  options: {
    kind: HistoryKindFilter;
    status: HistoryStatusFilter;
    source: HistorySourceFilter;
    verification?: HistoryVerificationFilter;
    search: string;
    dateFrom: string;
    dateTo: string;
    scopeAll: boolean;
    clients: { id: string; fullName: string; phone: string }[];
  },
): LedgerEntry[] {
  let filtered = rows;
  if (options.kind !== "all") {
    filtered = filtered.filter((r) => {
      if (options.kind === "payment") return isLedgerPayment(r);
      if (options.kind === "return") return isLedgerReturn(r);
      return r.kind === options.kind;
    });
  }
  if (options.status !== "all") {
    filtered = filtered.filter((r) => r.status === options.status);
  }
  if (options.source !== "all") {
    filtered = filtered.filter((r) =>
      ledgerEntryMatchesSourceFilter(r, options.source),
    );
  }
  if (options.verification && options.verification !== "all") {
    filtered = filtered.filter((r) => {
      if (r.kind !== "invoice") return false;
      if (options.verification === "verified") return r.invoiceVerified === true;
      return r.invoiceVerified === false;
    });
  }
  const q = options.search.trim().toLowerCase();
  if (q) {
    filtered = filtered.filter((r) => {
      if (r.ref.toLowerCase().includes(q) || r.note.toLowerCase().includes(q)) {
        return true;
      }
      if (options.scopeAll) {
        const c = options.clients.find((x) => x.id === r.clientId);
        const name = c?.fullName.toLowerCase() ?? "";
        const phone = c?.phone.toLowerCase() ?? "";
        return name.includes(q) || phone.includes(q);
      }
      return false;
    });
  }
  if (options.dateFrom.trim()) {
    filtered = filtered.filter((r) => r.date >= options.dateFrom.trim());
  }
  if (options.dateTo.trim()) {
    filtered = filtered.filter((r) => r.date <= options.dateTo.trim());
  }
  return filtered;
}
