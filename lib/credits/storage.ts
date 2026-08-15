/** Crédits & mouvements — localStorage pour l’instant ; Convex plus tard. */
import type { CreditStore, LedgerEntry } from "@/lib/credits/types";

const STORAGE_KEY = "matjar_credits_v1";

function emptyStore(): CreditStore {
  return { entriesByClient: {} };
}

export function readCreditStore(): CreditStore {
  if (typeof window === "undefined") return emptyStore();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return emptyStore();
    const parsed: unknown = JSON.parse(raw);
    if (
      typeof parsed !== "object" ||
      parsed === null ||
      !("entriesByClient" in parsed)
    ) {
      return emptyStore();
    }
    const o = parsed as { entriesByClient: unknown };
    if (typeof o.entriesByClient !== "object" || o.entriesByClient === null) {
      return emptyStore();
    }
    return { entriesByClient: o.entriesByClient as Record<string, LedgerEntry[]> };
  } catch {
    return emptyStore();
  }
}

export function writeCreditStore(store: CreditStore): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  } catch {
    // ignore
  }
}
