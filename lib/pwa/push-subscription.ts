import { getVapidPublicKey } from "@/lib/pwa/constants";

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export type PushSubscriptionPayload = {
  endpoint: string;
  expirationTime: number | null;
  p256dh: string;
  auth: string;
};

function encodeKey(buffer: ArrayBuffer | null): string {
  if (!buffer) return "";
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return window.btoa(binary);
}

export async function getServiceWorkerRegistration(): Promise<ServiceWorkerRegistration | null> {
  if (!("serviceWorker" in navigator)) return null;
  return navigator.serviceWorker.ready;
}

export async function subscribeToPushNotifications(): Promise<PushSubscriptionPayload> {
  const vapidPublicKey = getVapidPublicKey();
  if (!vapidPublicKey) {
    throw new Error("Push notifications are not configured on this server.");
  }

  const permission = await Notification.requestPermission();
  if (permission !== "granted") {
    throw new Error("Notification permission was denied.");
  }

  const registration = await getServiceWorkerRegistration();
  if (!registration) {
    throw new Error("Service worker is not ready.");
  }

  let subscription = await registration.pushManager.getSubscription();
  if (!subscription) {
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidPublicKey) as BufferSource,
    });
  }

  const p256dh = subscription.getKey("p256dh");
  const auth = subscription.getKey("auth");
  if (!p256dh || !auth) {
    throw new Error("Invalid push subscription keys.");
  }

  return {
    endpoint: subscription.endpoint,
    expirationTime: subscription.expirationTime,
    p256dh: encodeKey(p256dh),
    auth: encodeKey(auth),
  };
}

export async function unsubscribeFromPushNotifications(): Promise<void> {
  const registration = await getServiceWorkerRegistration();
  if (!registration) return;
  const subscription = await registration.pushManager.getSubscription();
  if (subscription) await subscription.unsubscribe();
}

export async function hasActivePushSubscription(): Promise<boolean> {
  const registration = await getServiceWorkerRegistration();
  if (!registration) return false;
  const subscription = await registration.pushManager.getSubscription();
  return subscription != null;
}
