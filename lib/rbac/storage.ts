import type { RbacStore } from "@/lib/rbac/types";
import { createDefaultRbacStore } from "@/lib/rbac/constants";

const RBAC_STORE_KEY = "matjar:rbac:store:v1";

function safeParse(text: string): unknown {
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return null;
  }
}

export function readRbacStore(): RbacStore {
  if (typeof window === "undefined") return createDefaultRbacStore();
  const raw = window.localStorage.getItem(RBAC_STORE_KEY);
  if (!raw) return createDefaultRbacStore();
  const parsed = safeParse(raw);
  if (!parsed || typeof parsed !== "object") return createDefaultRbacStore();

  // We keep validation intentionally light for this demo module.
  const store = parsed as Partial<RbacStore>;
  if (!Array.isArray(store.roles) || !Array.isArray(store.permissions)) {
    return createDefaultRbacStore();
  }
  if (!store.rolePermissionsByRoleId || typeof store.rolePermissionsByRoleId !== "object") {
    return createDefaultRbacStore();
  }
  return store as RbacStore;
}

export function writeRbacStore(next: RbacStore) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(RBAC_STORE_KEY, JSON.stringify(next));
}

