"use client";

import { useQuery } from "convex/react";
import { useTranslations } from "next-intl";

import { DashboardPeriodKpis } from "@/components/dashboard/dashboard-period-kpis";
import { DashboardPageSkeleton } from "@/components/skeletons";
import { api } from "@/convex/_generated/api";
import { canViewRevenue } from "@/lib/auth/permissions";

export function DashboardPage() {
  return <DashboardPageContent />;
}

function DashboardPageContent() {
  const t = useTranslations("dashboard");
  const currentUser = useQuery(api.authz.currentUser);
  const permissions = currentUser?.permissions ?? [];
  const showRevenueMetrics = canViewRevenue(permissions);
  const hydrated = currentUser !== undefined;

  return (
    <div className="admin-page flex min-h-0 flex-1 flex-col text-foreground">
      <main className="w-full flex-1 overflow-auto px-5 py-6 sm:px-8">
        {!hydrated ? (
          <DashboardPageSkeleton />
        ) : showRevenueMetrics ? (
          <DashboardPeriodKpis enabled />
        ) : (
          <div className="pf-card p-8 text-center">
            <p className="text-xl font-bold tracking-tight">{t("title")}</p>
            <p className="text-muted-foreground mt-2 text-sm">
              {t("overviewDescription")}
            </p>
          </div>
        )}
      </main>
    </div>
  );
}
