import { POS_CASHIER_AVATAR_SRC } from "@/components/pos/constants";

export const DEFAULT_USER_AVATAR_SRC = POS_CASHIER_AVATAR_SRC;

export function resolveUserAvatarSrc(image?: string | null): string {
  const trimmed = image?.trim() ?? "";
  return trimmed.length > 0 ? trimmed : DEFAULT_USER_AVATAR_SRC;
}

export function isUserAvatarDataUrl(src: string): boolean {
  return src.startsWith("data:image/");
}

export function hasCustomUserAvatar(image?: string | null): boolean {
  const trimmed = image?.trim() ?? "";
  return trimmed.length > 0 && trimmed !== DEFAULT_USER_AVATAR_SRC;
}
