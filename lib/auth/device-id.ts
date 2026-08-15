const DEVICE_ID_KEY = "matjar.deviceId";

function createDeviceId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `dev_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 12)}`;
}

/** Stable browser/device id persisted in localStorage. */
export function getOrCreateDeviceId(): string {
  if (typeof window === "undefined") return "";
  try {
    const existing = window.localStorage.getItem(DEVICE_ID_KEY);
    if (existing && existing.trim()) return existing.trim();
    const next = createDeviceId();
    window.localStorage.setItem(DEVICE_ID_KEY, next);
    return next;
  } catch {
    return createDeviceId();
  }
}

/** Short human-readable label for the admin devices list. */
export function getDeviceLabel(): string {
  if (typeof navigator === "undefined") return "Navigateur";
  const ua = navigator.userAgent;
  let browser = "Navigateur";
  if (/Edg\//i.test(ua)) browser = "Edge";
  else if (/Chrome\//i.test(ua) && !/Chromium/i.test(ua)) browser = "Chrome";
  else if (/Safari\//i.test(ua) && !/Chrome/i.test(ua)) browser = "Safari";
  else if (/Firefox\//i.test(ua)) browser = "Firefox";

  let device = "Ordinateur";
  if (/iPhone/i.test(ua)) device = "iPhone";
  else if (/iPad/i.test(ua)) device = "iPad";
  else if (/Android/i.test(ua)) device = "Android";
  else if (/Mac OS X/i.test(ua)) device = "Mac";
  else if (/Windows/i.test(ua)) device = "Windows";
  else if (/Linux/i.test(ua)) device = "Linux";

  return `${browser} · ${device}`;
}

export const DEVICE_QR_PREFIX = "matjar-device:";

export function formatDeviceQrPayload(challengeToken: string) {
  return `${DEVICE_QR_PREFIX}${challengeToken}`;
}

export function parseDeviceQrPayload(raw: string) {
  const trimmed = raw.trim();
  if (trimmed.startsWith(DEVICE_QR_PREFIX)) {
    return trimmed.slice(DEVICE_QR_PREFIX.length).trim();
  }
  return trimmed;
}
