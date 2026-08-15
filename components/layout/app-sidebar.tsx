"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useQuery } from "convex/react";
import type { FunctionReference } from "convex/server";
import { LogOut, Menu, Settings } from "lucide-react";
import { useTranslations, useLocale } from "next-intl";
import { useAuthActions } from "@convex-dev/auth/react";

import { StoreLogo } from "@/components/brand/store-logo";
import {
  ADMIN_MAIN_NAV,
  isAdminNavItemActive,
} from "@/components/layout/admin-nav";
import { adminNavLucideIcon } from "@/components/layout/admin-nav-icons";
import { UserAvatarImage } from "@/components/users/user-avatar-image";
import { api } from "@/convex/_generated/api";
import { canAccessPath } from "@/lib/auth/permissions";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  useSidebar,
} from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";

const navIconClass =
  "size-[18px] shrink-0 stroke-[1.5] group-data-[collapsible=icon]:size-[18px]";

const navLabelClass = "truncate group-data-[collapsible=icon]:hidden";

export function AppSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const locale = useLocale();
  const t = useTranslations("navigation");
  const tAuth = useTranslations("auth");
  const { signOut } = useAuthActions();
  const { toggleSidebar } = useSidebar();
  const currentUserQuery = (
    api as unknown as {
      authz?: { currentUser?: FunctionReference<"query", "public"> };
    }
  ).authz?.currentUser;
  const currentUser = useQuery(currentUserQuery as FunctionReference<"query">);
  const permissions = currentUser?.permissions ?? [];
  const canOpenSettings = Boolean(currentUser?.role);

  const getTranslatedLabel = (key: string) => {
    const keyMap: Record<string, string> = {
      "Tableau de Bord": t("dashboard"),
      "Inventaire": t("stock"),
      "Liste d'achats": t("procurement"),
      "Point de Vente": t("pos"),
      Crédits: t("credits"),
      Factures: t("invoices"),
      Clients: t("clients"),
      Audit: t.has("audit")
        ? t("audit")
        : locale === "ar"
          ? "التدقيق"
          : "Audit",
    };
    return keyMap[key] || key;
  };

  const getLocalizedHref = (href: string) => {
    if (href === "#") return href;
    return `/${locale}${href}`;
  };

  const navItems = ADMIN_MAIN_NAV.filter((item) => {
    if (item.href === "#") return true;
    return canAccessPath(item.href, permissions);
  });

  return (
    <Sidebar
      side={locale === "ar" ? "right" : "left"}
      collapsible="icon"
      variant="sidebar"
      className="z-50 border-none [--sidebar-width:16rem] [--sidebar-width-icon:5rem]"
    >
      <SidebarHeader className="px-3 pb-2 pt-4 group-data-[collapsible=icon]:px-0 group-data-[collapsible=icon]:pb-1 group-data-[collapsible=icon]:pt-3">
        <div className="pf-sidebar-expanded-only flex items-center justify-between gap-2">
          <div className="min-w-0 flex-1">
            <StoreLogo
              variant="full"
              size="sm"
              className="max-h-11 w-full"
              priority
            />
          </div>
          <button
            type="button"
            onClick={toggleSidebar}
            className="text-sidebar-foreground/45 hover:text-sidebar-foreground flex size-9 shrink-0 items-center justify-center rounded-xl transition-colors hover:bg-white/[0.06]"
            aria-label={locale === "ar" ? "طي القائمة" : "Réduire le menu"}
          >
            <Menu className="size-[18px] stroke-[1.5]" aria-hidden />
          </button>
        </div>

        <div className="pf-sidebar-collapsed-only hidden justify-center">
          <button
            type="button"
            onClick={toggleSidebar}
            className="pf-sidebar-logo-btn"
            aria-label={locale === "ar" ? "فتح القائمة" : "Ouvrir le menu"}
          >
            <StoreLogo variant="icon" size="sm" className="size-9" priority />
          </button>
        </div>
      </SidebarHeader>

      <SidebarContent className="overflow-hidden! px-0 group-data-[collapsible=icon]:flex-none group-data-[collapsible=icon]:flex group-data-[collapsible=icon]:flex-col group-data-[collapsible=icon]:items-center group-data-[collapsible=icon]:px-0">
        <SidebarGroup className="group-data-[collapsible=icon]:w-full group-data-[collapsible=icon]:py-0">
          <SidebarGroupContent>
            <div className="pf-sidebar-nav-well">
              <SidebarMenu className="gap-1 group-data-[collapsible=icon]:items-center group-data-[collapsible=icon]:gap-2.5">
                {navItems.map((item) => {
                  const localizedHref = getLocalizedHref(item.href);
                  const active = isAdminNavItemActive(pathname, localizedHref);
                  const isPlaceholder = item.href === "#";
                  const NavIcon = adminNavLucideIcon(item.icon);
                  const translatedLabel = getTranslatedLabel(item.label);

                  return (
                    <SidebarMenuItem key={item.label} className="group-data-[collapsible=icon]:flex group-data-[collapsible=icon]:justify-center">
                      {isPlaceholder ? (
                        <SidebarMenuButton
                          isActive={false}
                          tooltip={translatedLabel}
                          size="lg"
                          className="group-data-[collapsible=icon]:size-11! group-data-[collapsible=icon]:rounded-full! group-data-[collapsible=icon]:p-0!"
                          type="button"
                        >
                          <NavIcon className={navIconClass} aria-hidden />
                          <span className={cn("text-[13px] font-medium", navLabelClass)}>
                            {translatedLabel}
                          </span>
                        </SidebarMenuButton>
                      ) : (
                        <SidebarMenuButton
                          isActive={active}
                          tooltip={translatedLabel}
                          size="lg"
                          className="group-data-[collapsible=icon]:size-11! group-data-[collapsible=icon]:rounded-full! group-data-[collapsible=icon]:p-0!"
                          render={<Link href={localizedHref} />}
                        >
                          <NavIcon className={navIconClass} aria-hidden />
                          <span className={cn("text-[13px] font-medium", navLabelClass)}>
                            {translatedLabel}
                          </span>
                        </SidebarMenuButton>
                      )}
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </div>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="pf-sidebar-collapsed-only mt-auto hidden flex-col items-center gap-2 px-0 pb-3 pt-2">
        <SidebarMenu className="items-center gap-2">
          {canOpenSettings ? (
            <SidebarMenuItem className="flex justify-center">
              <SidebarMenuButton
                isActive={pathname?.includes("/parametres") ?? false}
                tooltip={t("settings")}
                size="lg"
                className="group-data-[collapsible=icon]:size-11! group-data-[collapsible=icon]:rounded-full! group-data-[collapsible=icon]:p-0!"
                render={<Link href={`/${locale}/parametres`} />}
              >
                <Settings className={navIconClass} aria-hidden />
                <span className="sr-only">{t("settings")}</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ) : null}
          <SidebarMenuItem className="flex justify-center">
            <SidebarMenuButton
              tooltip={tAuth("logout")}
              size="lg"
              className="group-data-[collapsible=icon]:size-11! group-data-[collapsible=icon]:rounded-full! group-data-[collapsible=icon]:p-0!"
              type="button"
              onClick={() => {
                void signOut().finally(() => {
                  router.replace(`/${locale}`);
                });
              }}
            >
              <LogOut className={navIconClass} aria-hidden />
              <span className="sr-only">{tAuth("logout")}</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>

      <SidebarFooter className="pf-sidebar-expanded-only mt-auto space-y-3 px-0 pb-3 pt-2">
        <div className="pf-sidebar-profile flex items-center gap-2.5">
          <div className="size-9 shrink-0 overflow-hidden rounded-full ring-2 ring-white/10">
            <UserAvatarImage
              image={currentUser?.image}
              alt={currentUser?.name ?? ""}
              size={36}
              className="size-9"
            />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sidebar-foreground truncate text-[13px] font-semibold">
              {currentUser?.name || (locale === "ar" ? "ضيف" : "Guest")}
            </p>
            <p className="text-sidebar-foreground/45 truncate text-[11px]">
              {currentUser?.email ?? currentUser?.role?.name ?? ""}
            </p>
          </div>
          {canOpenSettings ? (
            <Link
              href={`/${locale}/parametres`}
              className="text-sidebar-foreground/40 hover:text-sidebar-foreground shrink-0 p-1 transition-colors"
              aria-label={t("settings")}
            >
              <Settings className="size-4 stroke-[1.5]" aria-hidden />
            </Link>
          ) : null}
          <button
            type="button"
            onClick={() => {
              void signOut().finally(() => {
                router.replace(`/${locale}`);
              });
            }}
            className="text-sidebar-foreground/40 hover:text-sidebar-foreground shrink-0 p-1 transition-colors"
            aria-label={tAuth("logout")}
          >
            <LogOut className="size-4 stroke-[1.5]" aria-hidden />
          </button>
        </div>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
