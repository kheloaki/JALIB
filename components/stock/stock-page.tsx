"use client";

import { Suspense } from "react";

import { StockCatalogSkeleton } from "@/components/skeletons";
import { ProcurementPanel } from "@/components/procurement/procurement-page";
import { ReturnsPageContent } from "@/components/returns/returns-page";
import { StockBrandsTab } from "@/components/stock/stock-brands-tab";
import { StockCatalogTab } from "@/components/stock/stock-catalog-tab";
import { StockReplenishmentTab } from "@/components/stock/stock-replenishment-tab";
import { useStockPageTabs } from "@/hooks/use-stock-page-tabs";

export type { StockPageTab } from "@/lib/stock/stock-tabs";

function StockPageContent() {
  const { visibleTab } = useStockPageTabs();

  return (
    <div className="bg-surface text-on-background flex min-h-0 flex-1 flex-col">
      {visibleTab === "catalog" ? (
        <StockCatalogTab />
      ) : visibleTab === "brands" ? (
        <StockBrandsTab />
      ) : visibleTab === "replenishment" ? (
        <div className="flex min-h-0 flex-1 flex-col">
          <StockReplenishmentTab />
        </div>
      ) : visibleTab === "returns" ? (
        <ReturnsPageContent />
      ) : (
        <ProcurementPanel />
      )}
    </div>
  );
}

export function StockPage() {
  return (
    <Suspense
      fallback={
        <div className="bg-surface flex min-h-0 flex-1 flex-col">
          <StockCatalogSkeleton />
        </div>
      }
    >
      <StockPageContent />
    </Suspense>
  );
}
