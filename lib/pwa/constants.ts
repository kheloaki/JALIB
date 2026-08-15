export const PWA_SW_PATH = "/sw.js";

/** Set in `.env.local`: NEXT_PUBLIC_VAPID_PUBLIC_KEY */
export function getVapidPublicKey(): string | null {
  const key = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY?.trim();
  return key && key.length > 0 ? key : null;
}

export function isPushSupported(): boolean {
  if (typeof window === "undefined") return false;
  return (
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

export function isStandaloneDisplay(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

export function isIosDevice(): boolean {
  if (typeof navigator === "undefined") return false;
  return (
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
  );
}

/** Web push can be requested on this device/browser (iOS requires installed PWA). */
export function canRequestPushNotifications(): boolean {
  if (!isPushSupported()) return false;
  if (!getVapidPublicKey()) return false;
  if (isIosDevice() && !isStandaloneDisplay()) return false;
  return true;
}
