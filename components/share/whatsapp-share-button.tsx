"use client";

import { WhatsAppIcon } from "@/components/icons/whatsapp-icon";
import { cn } from "@/lib/utils";

type WhatsAppShareButtonProps = {
  onClick: (event: React.MouseEvent<HTMLButtonElement>) => void;
  disabled?: boolean;
  busy?: boolean;
  ariaLabel: string;
  className?: string;
};

export function WhatsAppShareButton({
  onClick,
  disabled,
  busy,
  ariaLabel,
  className,
}: WhatsAppShareButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || busy}
      className={cn(
        "text-[#25D366] hover:bg-[#25D366]/10 inline-flex items-center justify-center rounded-lg p-2 transition-colors disabled:opacity-40",
        className,
      )}
      aria-label={ariaLabel}
      title={ariaLabel}
    >
      <WhatsAppIcon className="size-5" />
    </button>
  );
}
