"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useQuery } from "convex/react";
import { useTranslations } from "next-intl";

import { api } from "@/convex/_generated/api";
import {
  getStockTabVisibility,
  parseStockTab,
  resolveVisibleStockTab,
  type StockPageTab,
} from "@/lib/stock/stock-tabs";

export function useStockPageTabs() {
  const t = useTranslations("stock");
  const router = useRouter();
  const searchParams = useSearchParams();
  const currentUser = useQuery(api.authz.currentUser);
  const permissions = currentUser?.permissions ?? [];
  const visibility = getStockTabVisibility(permissions);

  const tabFromUrl = parseStockTab(searchParams.get("tab"));
  const [tab, setTab] = useState<StockPageTab>(tabFromUrl);

  useEffect(() => {
    setTab(tabFromUrl);
  }, [tabFromUrl]);

  function selectTab(next: StockPageTab) {
    setTab(next);
    const params = new URLSearchParams(searchParams.toString());
    if (next === "catalog") {
      params.delete("tab");
    } else {
      params.set("tab", next);
    }
    const qs = params.toString();
    router.replace(qs ? `?${qs}` : "?", { scroll: false });
  }

  const visibleTab = resolveVisibleStockTab(tab, permissions);

  const tabs: { id: StockPageTab; label: string; show: boolean }[] = [
    { id: "catalog", label: t("tabCatalog"), show: visibility.canCatalog },
    { id: "brands", label: t("tabBrands"), show: visibility.canManageBrands },
    {
      id: "replenishment",
      label: t("tabReplenishment"),
      show: visibility.canReplenish,
    },
    {
      id: "procurement",
      label: t("tabProcurement"),
      show: visibility.canProcurement,
    },
    { id: "returns", label: t("tabReturns"), show: visibility.canReturns },
  ];

  return { visibleTab, selectTab, tabs };
}
