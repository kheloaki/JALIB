"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useQuery } from "convex/react";
import { useAuthActions } from "@convex-dev/auth/react";
import { Globe, LogOut, Settings } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useMemo, useState } from "react";

import { isAdminNavItemActive } from "@/components/layout/admin-nav";
import { adminNavLucideIcon } from "@/components/layout/admin-nav-icons";
import {
  localeFlags,
  localeLabels,
  useSwitchLocale,
} from "@/components/layout/language-switcher";
import { UserAvatarImage } from "@/components/users/user-avatar-image";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { api } from "@/convex/_generated/api";
import { routing } from "@/i18n/routing";
import { canAccessPath } from "@/lib/auth/permissions";
import { cn } from "@/lib/utils";

type NavEntry = {
  id: string;
  href?: string;
  onClick?: () => void;
  icon: string;
  label: string;
  isAccount?: boolean;
  isCenter?: boolean;
};

const SIDE_NAV_ORDER = [
  {
    id: "dashboard",
    href: "/dashboard",
    icon: "dashboard",
    labelKey: "dashboard",
    mobileLabel: { fr: "Accueil", ar: "الرئيسية" },
  },
  { id: "stock", href: "/stock", icon: "inventory_2", labelKey: "stock" },
  { id: "credits", href: "/credits", icon: "payments", labelKey: "credits" },
  {
    id: "factures",
    href: "/factures",
    icon: "description",
    labelKey: "invoices",
  },
  { id: "clients", href: "/clients", icon: "group", labelKey: "clients" },
] as const;

const POS_NAV_ITEM = {
  id: "pos",
  href: "/pos",
  icon: "point_of_sale",
  labelKey: "pos",
} as const;

function MobileNavItemButton({
  entry,
  active,
  onPress,
  accountImage,
}: {
  entry: NavEntry;
  active: boolean;
  onPress?: () => void;
  accountImage?: string | null;
}) {
  const NavIcon = adminNavLucideIcon(entry.icon);
  const isCenter = entry.isCenter ?? false;
  const sharedClass = cn(
    "pf-mobile-nav-item touch-manipulation outline-none transition-transform active:scale-95",
    isCenter && "pf-mobile-nav-item-center",
  );

  const iconShell = (
    <span
      className={cn(
        "pf-mobile-nav-icon",
        isCenter && "pf-mobile-nav-icon-center",
        !isCenter && active && "pf-mobile-nav-icon-active",
        isCenter && active && "pf-mobile-nav-icon-center-active",
      )}
    >
      {entry.isAccount ? (
        <span className="size-7 overflow-hidden rounded-full ring-2 ring-white/15">
          <UserAvatarImage
            image={accountImage}
            alt={entry.label}
            size={28}
            className="size-7"
          />
        </span>
      ) : (
        <NavIcon
          className={cn(
            "stroke-[1.75]",
            isCenter ? "size-5" : "size-[17px]",
          )}
          aria-hidden
        />
      )}
    </span>
  );

  const label = (
    <span
      className={cn(
        "pf-mobile-nav-label",
        isCenter && "pf-mobile-nav-label-center",
        !isCenter && active && "pf-mobile-nav-label-active",
      )}
    >
      {entry.label}
    </span>
  );

  if (entry.href) {
    return (
      <Link
        href={entry.href}
        className={sharedClass}
        aria-current={active ? "page" : undefined}
        aria-label={entry.label}
        onClick={onPress}
      >
        {iconShell}
        {label}
      </Link>
    );
  }

  return (
    <button
      type="button"
      onClick={onPress ?? entry.onClick}
      className={sharedClass}
      aria-label={entry.label}
      aria-pressed={active}
    >
      {iconShell}
      {label}
    </button>
  );
}

export function MobileBottomNav() {
  const pathname = usePathname();
  const router = useRouter();
  const locale = useLocale();
  const t = useTranslations("navigation");
  const tAuth = useTranslations("auth");
  const { signOut } = useAuthActions();
  const switchLocale = useSwitchLocale();
  const currentUser = useQuery(api.authz.currentUser);
  const permissions = currentUser?.permissions ?? [];
  const [menuOpen, setMenuOpen] = useState(false);

  const canOpenSettings = Boolean(currentUser?.role);
  const isParametresActive = pathname?.includes("/parametres") ?? false;

  function localizedHref(href: string) {
    return `/${locale}${href}`;
  }

  const accountLabel =
    currentUser?.name?.split(" ")[0] ??
    (locale === "ar" ? "حساب" : "Compte");

  const navEntries = useMemo<NavEntry[]>(() => {
    const sideItems: NavEntry[] = SIDE_NAV_ORDER.filter((item) =>
      canAccessPath(item.href, permissions),
    ).map((item) => {
      const label =
        "mobileLabel" in item && item.mobileLabel
          ? locale === "ar"
            ? item.mobileLabel.ar
            : item.mobileLabel.fr
          : t(item.labelKey);

      return {
        id: item.id,
        href: localizedHref(item.href),
        icon: item.icon,
        label,
      };
    });

    const posEntry: NavEntry | null = canAccessPath(POS_NAV_ITEM.href, permissions)
      ? {
          id: POS_NAV_ITEM.id,
          href: localizedHref(POS_NAV_ITEM.href),
          icon: POS_NAV_ITEM.icon,
          label: t(POS_NAV_ITEM.labelKey),
          isCenter: true,
        }
      : null;

    const ordered: NavEntry[] = posEntry
      ? (() => {
          const leftCount = Math.ceil(sideItems.length / 2);
          return [
            ...sideItems.slice(0, leftCount),
            posEntry,
            ...sideItems.slice(leftCount),
          ];
        })()
      : [...sideItems];

    ordered.push({
      id: "account",
      icon: "group",
      label: accountLabel,
      isAccount: true,
      onClick: () => setMenuOpen(true),
    });

    return ordered;
  }, [accountLabel, locale, permissions, t]);

  const activeIndex = useMemo(() => {
    const routeIndex = navEntries.findIndex(
      (entry) =>
        entry.href && isAdminNavItemActive(pathname ?? "", entry.href),
    );
    if (routeIndex >= 0) return routeIndex;
    if (isParametresActive || menuOpen) {
      return navEntries.findIndex((entry) => entry.id === "account");
    }
    return 0;
  }, [isParametresActive, menuOpen, navEntries, pathname]);

  return (
    <>
      <nav
        className="pf-mobile-nav md:hidden"
        aria-label={
          locale === "ar" ? "التنقل الرئيسي" : "Navigation principale"
        }
      >
        <div className="pf-mobile-nav-pill">
          {navEntries.map((entry, index) => (
            <MobileNavItemButton
              key={entry.id}
              entry={entry}
              active={index === activeIndex}
              accountImage={entry.isAccount ? currentUser?.image : undefined}
              onPress={
                entry.id === "account" ? () => setMenuOpen(true) : undefined
              }
            />
          ))}
        </div>
      </nav>

      <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
        <SheetContent side="bottom" className="rounded-t-[28px] pb-8">
          <SheetHeader className="text-left">
            <SheetTitle>
              {currentUser?.name ?? (locale === "ar" ? "حسابي" : "Mon compte")}
            </SheetTitle>
            {currentUser?.role?.name ? (
              <p className="text-primary text-sm font-medium">
                {currentUser.role.name}
              </p>
            ) : null}
          </SheetHeader>
          <div className="mt-4 space-y-1">
            {canOpenSettings ? (
              <Link
                href={localizedHref("/parametres")}
                onClick={() => setMenuOpen(false)}
                className={cn(
                  "hover:bg-surface-container-high flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-semibold",
                  isParametresActive && "text-primary bg-primary/5",
                )}
              >
                <Settings className="size-5 stroke-[1.75]" aria-hidden />
                {t("settings")}
              </Link>
            ) : null}

            <div className="pt-1">
              <p className="text-on-surface-variant px-3 py-1 text-xs font-bold tracking-wide uppercase">
                {locale === "ar" ? "اللغة" : "Langue"}
              </p>
              {routing.locales.map((loc) => (
                <button
                  key={loc}
                  type="button"
                  onClick={() => {
                    switchLocale(loc);
                    setMenuOpen(false);
                  }}
                  className={cn(
                    "hover:bg-surface-container-high flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm font-semibold",
                    locale === loc && "text-primary bg-primary/5",
                  )}
                >
                  <Globe className="size-5 stroke-[1.75]" aria-hidden />
                  <span aria-hidden>{localeFlags[loc]}</span>
                  {localeLabels[loc]}
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={() => {
                setMenuOpen(false);
                void signOut().finally(() => {
                  router.replace(`/${locale}`);
                });
              }}
              className="text-error hover:bg-error-container/30 flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm font-semibold"
            >
              <LogOut className="size-5 stroke-[1.75]" aria-hidden />
              {tAuth("logout")}
            </button>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
