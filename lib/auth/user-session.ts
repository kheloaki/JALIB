"use client";

export type AuthUserSession = {
  name: string;
  role?: string;
};

export const AUTH_USER_SESSION_KEY = "matjar:auth:user:v1";
export const AUTH_USER_SESSION_EVENT = "matjar:auth:user-updated";
let lastAuthUserRaw: string | null | undefined;
let lastAuthUserSnapshot: AuthUserSession | null = null;

function parseAuthUser(raw: string | null): AuthUserSession | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<AuthUserSession>;
    if (!parsed || typeof parsed !== "object") return null;
    if (typeof parsed.name !== "string" || !parsed.name.trim()) return null;
    return {
      name: parsed.name.trim(),
      role:
        typeof parsed.role === "string" && parsed.role.trim()
          ? parsed.role.trim()
          : undefined,
    };
  } catch {
    return null;
  }
}

export function getAuthUserSessionSnapshot(): AuthUserSession | null {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(AUTH_USER_SESSION_KEY);
  if (raw === lastAuthUserRaw) return lastAuthUserSnapshot;
  lastAuthUserRaw = raw;
  lastAuthUserSnapshot = parseAuthUser(raw);
  return lastAuthUserSnapshot;
}

export function subscribeAuthUserSession(onStoreChange: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  const onStorage = (event: StorageEvent) => {
    if (event.key !== AUTH_USER_SESSION_KEY) return;
    onStoreChange();
  };
  const onSameTab = (event: Event) => {
    const custom = event as CustomEvent<{ key?: string }>;
    if (custom.detail?.key !== AUTH_USER_SESSION_KEY) return;
    onStoreChange();
  };
  window.addEventListener("storage", onStorage);
  window.addEventListener(AUTH_USER_SESSION_EVENT, onSameTab as EventListener);
  return () => {
    window.removeEventListener("storage", onStorage);
    window.removeEventListener(
      AUTH_USER_SESSION_EVENT,
      onSameTab as EventListener,
    );
  };
}

export function writeAuthUserSession(user: AuthUserSession): void {
  if (typeof window === "undefined") return;
  const raw = JSON.stringify({
    name: user.name.trim(),
    role: user.role?.trim() || undefined,
  });
  window.localStorage.setItem(AUTH_USER_SESSION_KEY, raw);
  // Keep snapshot cache coherent for immediate same-tab reads.
  lastAuthUserRaw = raw;
  lastAuthUserSnapshot = parseAuthUser(raw);
  window.dispatchEvent(
    new CustomEvent(AUTH_USER_SESSION_EVENT, {
      detail: { key: AUTH_USER_SESSION_KEY },
    }),
  );
}
