import { PWA_SW_PATH } from "@/lib/pwa/constants";

let registrationPromise: Promise<ServiceWorkerRegistration | null> | null = null;

export function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) {
    return Promise.resolve(null);
  }
  if (!registrationPromise) {
    registrationPromise = navigator.serviceWorker
      .register(PWA_SW_PATH, { scope: "/" })
      .catch((error) => {
        console.error("Service worker registration failed:", error);
        return null;
      });
  }
  return registrationPromise;
}
