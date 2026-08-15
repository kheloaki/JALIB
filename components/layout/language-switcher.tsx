"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useLocale } from "next-intl";
import { Globe } from "lucide-react";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { routing } from "@/i18n/routing";
import { cn } from "@/lib/utils";

export const localeLabels: Record<string, string> = {
  fr: "Français",
  ar: "العربية",
};

export const localeFlags: Record<string, string> = {
  fr: "🇫🇷",
  ar: "🇲🇦",
};

export function useSwitchLocale() {
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  return (newLocale: string) => {
    if (newLocale === locale) return;
    const currentPath = pathname ?? "";
    const newPath = currentPath.replace(`/${locale}`, `/${newLocale}`);
    const qs = searchParams.toString();
    router.push(qs ? `${newPath}?${qs}` : newPath);
  };
}

export function LanguageSwitcher({
  variant = "sidebar",
}: {
  variant?: "sidebar" | "surface";
}) {
  const locale = useLocale();
  const switchLocale = useSwitchLocale();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={cn(
          "inline-flex h-9 w-full items-center gap-2 rounded-xl px-3 text-sm transition-colors focus-visible:outline-none",
          variant === "sidebar"
            ? "text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent focus-visible:ring-2 focus-visible:ring-sidebar-ring group-data-[collapsible=icon]:mx-auto group-data-[collapsible=icon]:size-9 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:gap-0 group-data-[collapsible=icon]:px-0"
            : "text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high focus-visible:ring-2 focus-visible:ring-primary/25",
        )}
      >
        <Globe className="size-4 group-data-[collapsible=icon]:size-5" />
        <span className="hidden sm:inline group-data-[collapsible=icon]:hidden">
          {localeFlags[locale]} {localeLabels[locale]}
        </span>
        <span className="sm:hidden group-data-[collapsible=icon]:hidden">
          {localeFlags[locale]}
        </span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {routing.locales.map((loc) => (
          <DropdownMenuItem
            key={loc}
            onClick={() => switchLocale(loc)}
            className={locale === loc ? "bg-accent" : ""}
          >
            <span className="mr-2">{localeFlags[loc]}</span>
            {localeLabels[loc]}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
