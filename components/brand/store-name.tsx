import { STORE_NAME, STORE_NAME_AR } from "@/lib/brand/constants";
import { cn } from "@/lib/utils";

type StoreNameProps = {
  className?: string;
  locale?: string;
  /** Sidebar wordmark on dark background */
  variant?: "sidebar" | "login" | "default";
};

export function StoreName({
  className,
  locale,
  variant = "default",
}: StoreNameProps) {
  const name = locale === "ar" ? STORE_NAME_AR : STORE_NAME;

  return (
    <span
      className={cn(
        "font-brand font-black tracking-tight",
        locale === "ar" && "font-ar",
        variant === "sidebar" &&
          "text-sidebar-foreground text-[14px] leading-none",
        variant === "login" && "text-on-surface text-2xl leading-tight",
        variant === "default" && "text-foreground text-base leading-tight",
        className,
      )}
    >
      {name}
    </span>
  );
}
