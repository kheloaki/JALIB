import type { Client } from "@/lib/clients/types";

/** Temporary browser persistence; replace with Convex (or API) once the frontend is settled. */
const STORAGE_KEY = "matjar_clients_v1";

function parseCreditLimitMad(
  raw: unknown,
): number | null | undefined {
  if (raw === undefined) return undefined;
  if (raw === null) return null;
  if (typeof raw === "number" && Number.isFinite(raw) && raw >= 0) {
    return Math.floor(raw);
  }
  return undefined;
}

function parseCashOnly(raw: unknown): boolean | undefined {
  if (raw === undefined) return undefined;
  return raw === true;
}

function normalizeClient(input: unknown): Client | null {
  if (!input || typeof input !== "object") return null;
  const o = input as Record<string, unknown>;
  if (
    typeof o.id !== "string" ||
    typeof o.fullName !== "string" ||
    typeof o.phone !== "string"
  ) {
    return null;
  }
  const lim = parseCreditLimitMad(o.creditLimitMad);
  const creditLimitMad = lim === undefined ? null : lim;
  const cashOnlyRaw = parseCashOnly(o.isCashOnly);
  const isCashOnly = cashOnlyRaw ?? false;
  const initialRaw = o.initialSoldeMad;
  const initialSoldeMad =
    typeof initialRaw === "number" && Number.isFinite(initialRaw)
      ? Math.round(initialRaw * 100) / 100
      : 0;
  return {
    id: o.id,
    fullName: o.fullName,
    phone: o.phone,
    isCashOnly,
    creditLimitMad,
    initialSoldeMad,
  };
}

export function readClients(): Client[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((row) => normalizeClient(row))
      .filter((c): c is Client => c !== null);
  } catch {
    return [];
  }
}

export function writeClients(clients: Client[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(clients));
  } catch {
    // ignore quota / private mode
  }
}
