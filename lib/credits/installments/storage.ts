import type { InstallmentsStore } from "@/lib/credits/installments/types";

const STORAGE_KEY = "matjar:credits:installments:v1";

function safeParse(text: string): unknown {
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return null;
  }
}

export function readInstallmentsStore(): InstallmentsStore {
  if (typeof window === "undefined") return { plans: [] };
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) return { plans: [] };
  const parsed = safeParse(raw);
  if (!parsed || typeof parsed !== "object") return { plans: [] };
  const store = parsed as Partial<InstallmentsStore>;
  if (!Array.isArray(store.plans)) return { plans: [] };
  return store as InstallmentsStore;
}

export function writeInstallmentsStore(next: InstallmentsStore) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
}

