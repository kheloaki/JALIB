"use client";

import Image from "next/image";

import {
  isUserAvatarDataUrl,
  resolveUserAvatarSrc,
} from "@/lib/users/user-avatar";
import { cn } from "@/lib/utils";

type UserAvatarImageProps = {
  image?: string | null;
  alt?: string;
  size?: number;
  className?: string;
  priority?: boolean;
};

export function UserAvatarImage({
  image,
  alt = "",
  size = 36,
  className,
  priority,
}: UserAvatarImageProps) {
  const src = resolveUserAvatarSrc(image);

  if (isUserAvatarDataUrl(src)) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt={alt}
        width={size}
        height={size}
        className={cn("object-cover", className)}
        decoding="async"
      />
    );
  }

  return (
    <Image
      src={src}
      alt={alt}
      width={size}
      height={size}
      priority={priority}
      className={cn("object-cover", className)}
    />
  );
}
