"use client";

import Link from "next/link";
import { useLocale } from "next-intl";
import { useQuery } from "convex/react";
import { useState } from "react";
import {
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  Bell,
  CalendarX,
  Package,
  Smartphone,
} from "lucide-react";

import { buttonVariants } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { api } from "@/convex/_generated/api";
import { canAccessAlerts } from "@/lib/auth/permissions";
import type { AlertItem } from "@/lib/alerts/types";
import { useAlertFeed } from "@/hooks/use-alert-feed";
import { cn } from "@/lib/utils";

const PREVIEW_LIMIT = 6;

function alertIcon(item: AlertItem) {
  if (item.category === "credit_over" || item.category === "installment_missed") {
    return AlertTriangle;
  }
  if (item.category === "credit_warn") return AlertCircle;
  if (item.category === "unpaid") return CalendarX;
  return Package;
}

function alertTone(item: AlertItem) {
  if (item.category === "credit_over" || item.category === "installment_missed") {
    return "text-error bg-error-container/40";
  }
  if (item.category === "credit_warn") {
    return "text-tertiary bg-tertiary-fixed/30";
  }
  if (item.category === "stock") {
    return "text-secondary bg-secondary-container/40";
  }
  return "text-on-surface-variant bg-surface-container-high";
}

function AlertPreviewRow({ item }: { item: AlertItem }) {
  const Icon = alertIcon(item);
  return (
    <div className="hover:bg-surface-container-low flex gap-3 rounded-xl px-3 py-2.5 transition-colors">
      <div
        className={cn(
          "flex size-9 shrink-0 items-center justify-center rounded-full",
          alertTone(item),
        )}
      >
        <Icon className="size-4 stroke-[1.75]" aria-hidden />
      </div>
      <div className="min-w-0 flex-1">
        <p className="line-clamp-1 text-xs font-bold">{item.title}</p>
        <p className="text-on-surface-variant line-clamp-2 text-[11px] leading-snug">
          {item.detail}
        </p>
        <p className="text-outline mt-1 text-[10px] font-medium">
          {item.badge}
        </p>
      </div>
    </div>
  );
}

export function AdminAlertsBell() {
  const locale = useLocale();
  const isAr = locale === "ar";
  const tr = (fr: string, ar: string) => (isAr ? ar : fr);
  const currentUser = useQuery(api.authz.currentUser);
  const canViewAlerts = canAccessAlerts(currentUser?.permissions ?? []);
  const [menuOpen, setMenuOpen] = useState(false);
  // Heavy alert feed only when the dropdown is open — keeps POS / other pages snappy.
  const { alerts, stats, isLoading } = useAlertFeed({
    enabled: canViewAlerts && menuOpen,
  });

  if (!canViewAlerts) return null;

  const preview = alerts.slice(0, PREVIEW_LIMIT);
  const remaining = Math.max(0, alerts.length - preview.length);
  const countLabel = stats.total > 99 ? "99+" : String(stats.total);

  return (
    <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
      <DropdownMenuTrigger
        className="pf-icon-btn relative outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
        aria-label={tr("Alertes", "التنبيهات")}
        title={tr("Alertes", "التنبيهات")}
      >
        <Bell className="size-[18px] stroke-[1.5]" aria-hidden />
        {menuOpen && stats.total > 0 ? (
          <span className="bg-error text-on-error absolute -top-0.5 -right-0.5 flex min-h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-black tabular-nums">
            {countLabel}
          </span>
        ) : null}
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        sideOffset={8}
        className="border-border bg-card w-[min(calc(100vw-2rem),22rem)] rounded-2xl p-0 shadow-[0_8px_32px_rgba(122,21,24,0.12)] ring-1 ring-[rgba(122,21,24,0.06)]"
      >
        <div className="border-border border-b px-4 py-3">
          <div className="flex items-center justify-between gap-2">
            <div>
              <p className="text-sm font-black">
                {tr("Alertes", "التنبيهات")}
              </p>
              <p className="text-on-surface-variant text-xs">
                {isLoading
                  ? tr("Chargement…", "جاري التحميل…")
                  : stats.total === 0
                    ? tr("Aucune alerte active", "لا توجد تنبيهات نشطة")
                    : tr(
                        `${stats.total} alerte${stats.total > 1 ? "s" : ""} active${stats.total > 1 ? "s" : ""}`,
                        `${stats.total} تنبيه${stats.total > 1 ? "ات" : ""} نشط${stats.total > 1 ? "ة" : ""}`,
                      )}
              </p>
            </div>
            {stats.critical > 0 ? (
              <span className="bg-error-container text-on-error-container rounded-full px-2 py-0.5 text-[10px] font-black uppercase">
                {stats.critical} {tr("urgent", "عاجل")}
              </span>
            ) : null}
          </div>
        </div>

        <div className="max-h-80 overflow-y-auto px-1 py-2">
          {isLoading ? (
            <p className="text-on-surface-variant px-3 py-6 text-center text-sm">
              {tr("Chargement…", "جاري التحميل…")}
            </p>
          ) : preview.length === 0 ? (
            <p className="text-on-surface-variant px-3 py-6 text-center text-sm">
              {tr("Rien à signaler pour le moment.", "لا يوجد شيء للإبلاغ عنه حاليًا.")}
            </p>
          ) : (
            preview.map((item) => (
              <AlertPreviewRow key={item.id} item={item} />
            ))
          )}
          {remaining > 0 ? (
            <p className="text-on-surface-variant px-3 py-2 text-center text-[11px] font-medium">
              {tr(
                `+ ${remaining} autre${remaining > 1 ? "s" : ""} alerte${remaining > 1 ? "s" : ""}`,
                `+ ${remaining} تنبيه${remaining > 1 ? "ات" : ""} أخرى`,
              )}
            </p>
          ) : null}
        </div>

        <div className="border-border border-t p-3 space-y-2">
          <Link
            href={`/${locale}/parametres`}
            className={cn(
              buttonVariants({ variant: "outline" }),
              "h-9 w-full gap-2 rounded-xl text-xs font-bold",
            )}
          >
            <Smartphone className="size-3.5 stroke-[1.75]" aria-hidden />
            {tr("Installer / notifications", "تثبيت / إشعارات")}
          </Link>
          <Link
            href={`/${locale}/alertes`}
            className={cn(
              buttonVariants({ variant: "default" }),
              "h-10 w-full gap-2 rounded-xl font-bold",
            )}
          >
            {tr("Voir tout", "عرض الكل")}
            <ArrowRight className="size-4 stroke-[1.75]" aria-hidden />
          </Link>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
