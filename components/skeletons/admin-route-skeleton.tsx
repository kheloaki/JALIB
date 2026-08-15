"use client";

import {
  AlertsPageSkeleton,
  ClientsPageSkeleton,
  CreditsPageSkeleton,
  DashboardPageSkeleton,
  InvoiceDetailsPageSkeleton,
  InvoicesPageSkeleton,
  ParametersPageSkeleton,
  PosPageSkeleton,
  ReturnDetailsPageSkeleton,
  RolesPageSkeleton,
  StockCatalogSkeleton,
} from "@/components/skeletons/page-skeletons";

function StockPageSkeleton() {
  return (
    <div className="bg-surface flex min-h-0 flex-1 flex-col">
      <StockCatalogSkeleton />
    </div>
  );
}

export function AdminRouteSkeleton({ pathname }: { pathname: string | null }) {
  const path = pathname ?? "";

  if (path.includes("/pos")) {
    return <PosPageSkeleton />;
  }
  if (path.includes("/credits")) {
    return <CreditsPageSkeleton />;
  }
  if (path.includes("/clients")) {
    return <ClientsPageSkeleton />;
  }
  if (path.includes("/factures/")) {
    return <InvoiceDetailsPageSkeleton />;
  }
  if (path.includes("/factures")) {
    return <InvoicesPageSkeleton />;
  }
  if (path.includes("/alertes")) {
    return (
      <div className="bg-surface flex min-h-0 flex-1 flex-col">
        <main className="flex-1 overflow-auto px-4 py-6 pb-12 sm:px-8">
          <div className="w-full">
            <AlertsPageSkeleton />
          </div>
        </main>
      </div>
    );
  }
  if (path.includes("/retours/")) {
    return <ReturnDetailsPageSkeleton />;
  }
  if (path.includes("/stock") || path.includes("/achats") || path.includes("/retours")) {
    return <StockPageSkeleton />;
  }
  if (path.includes("/parametres")) {
    return <ParametersPageSkeleton />;
  }
  if (path.includes("/roles")) {
    return <RolesPageSkeleton />;
  }

  return (
    <main className="admin-page flex-1 overflow-auto">
      <DashboardPageSkeleton />
    </main>
  );
}
