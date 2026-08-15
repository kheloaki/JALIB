const STORAGE_PREFIX = "matjar:notification-prompt:v1:";

export type NotificationPromptStatus = "dismissed" | "granted" | "skipped";

export function getNotificationPromptStatus(
  userId: string,
): NotificationPromptStatus | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(`${STORAGE_PREFIX}${userId}`);
  if (raw === "dismissed" || raw === "granted" || raw === "skipped") {
    return raw;
  }
  return null;
}

export function setNotificationPromptStatus(
  userId: string,
  status: NotificationPromptStatus,
) {
  if (typeof window === "undefined") return;
  localStorage.setItem(`${STORAGE_PREFIX}${userId}`, status);
}
