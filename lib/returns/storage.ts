import type { ReturnsStore } from "@/lib/returns/types";

const RETURNS_STORE_KEY = "matjar:returns:store:v1";

function safeParse(text: string): unknown {
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return null;
  }
}

export function readReturnsStore(): ReturnsStore {
  if (typeof window === "undefined") return { returns: [] };
  const raw = window.localStorage.getItem(RETURNS_STORE_KEY);
  if (!raw) return { returns: [] };
  const parsed = safeParse(raw);
  if (!parsed || typeof parsed !== "object") return { returns: [] };
  const store = parsed as Partial<ReturnsStore>;
  if (!Array.isArray(store.returns)) return { returns: [] };
  return store as ReturnsStore;
}

export function writeReturnsStore(next: ReturnsStore) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(RETURNS_STORE_KEY, JSON.stringify(next));
}

