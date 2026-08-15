import type { Client } from "@/lib/clients/types";

const STORAGE_KEY = "matjar:pos:recent-clients:v1";
const MAX_RECENT = 12;

function reviveClient(raw: unknown): Client | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  if (typeof o.id !== "string" || typeof o.fullName !== "string") return null;
  if (typeof o.phone !== "string") return null;
  if (typeof o.isCashOnly !== "boolean") return null;
  const creditLimitMad =
    o.creditLimitMad === null
      ? null
      : typeof o.creditLimitMad === "number" && Number.isFinite(o.creditLimitMad)
        ? o.creditLimitMad
        : null;
  const initialSoldeMad =
    typeof o.initialSoldeMad === "number" && Number.isFinite(o.initialSoldeMad)
      ? o.initialSoldeMad
      : 0;
  return {
    id: o.id,
    fullName: o.fullName,
    phone: o.phone,
    isCashOnly: o.isCashOnly,
    creditLimitMad,
    initialSoldeMad,
  };
}

export function readRecentPosClients(): Client[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const out: Client[] = [];
    for (const item of parsed) {
      const client = reviveClient(item);
      if (client) out.push(client);
    }
    return out.slice(0, MAX_RECENT);
  } catch {
    return [];
  }
}

export function rememberRecentPosClient(client: Client): void {
  if (typeof window === "undefined") return;
  try {
    const next = [
      client,
      ...readRecentPosClients().filter((c) => c.id !== client.id),
    ].slice(0, MAX_RECENT);
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // quota / private mode
  }
}
