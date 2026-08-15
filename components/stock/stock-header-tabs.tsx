"use client";

import { Suspense } from "react";
import { useLocale } from "next-intl";

import { PfTab, PfTabList } from "@/components/layout/pf-tabs";
import { useStockPageTabs } from "@/hooks/use-stock-page-tabs";

function StockHeaderTabsContent() {
  const locale = useLocale();
  const isAr = locale === "ar";
  const { visibleTab, selectTab, tabs } = useStockPageTabs();

  return (
    <PfTabList
      className="pf-tabs-header max-w-full min-w-0 flex-1"
      aria-label={isAr ? "تنقل المخزون" : "Navigation stock"}
    >
      {tabs
        .filter((item) => item.show)
        .map((item) => (
          <PfTab
            key={item.id}
            active={visibleTab === item.id}
            onClick={() => selectTab(item.id)}
          >
            {item.label}
          </PfTab>
        ))}
    </PfTabList>
  );
}

export function StockHeaderTabs() {
  return (
    <Suspense fallback={null}>
      <StockHeaderTabsContent />
    </Suspense>
  );
}
