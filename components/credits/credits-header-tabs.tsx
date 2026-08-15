"use client";

import { Suspense } from "react";
import { useLocale } from "next-intl";

import { PfTab, PfTabList } from "@/components/layout/pf-tabs";
import { useCreditsPageTabs } from "@/hooks/use-credits-page-tabs";

function CreditsHeaderTabsContent() {
  const locale = useLocale();
  const isAr = locale === "ar";
  const { visibleTab, selectTab, tabs } = useCreditsPageTabs();

  return (
    <PfTabList
      className="pf-tabs-header max-w-full min-w-0 flex-1"
      aria-label={isAr ? "تنقل الاعتمادات" : "Navigation crédits"}
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

export function CreditsHeaderTabs() {
  return (
    <Suspense fallback={null}>
      <CreditsHeaderTabsContent />
    </Suspense>
  );
}
