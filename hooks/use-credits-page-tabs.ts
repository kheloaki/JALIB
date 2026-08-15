"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useQuery } from "convex/react";
import { useLocale } from "next-intl";

import { api } from "@/convex/_generated/api";
import { canVerifyCreditInvoices } from "@/lib/auth/permissions";

export type CreditsPageTab =
  | "clients"
  | "invoices"
  | "payments"
  | "returns"
  | "verification";

const CREDITS_TABS: CreditsPageTab[] = [
  "clients",
  "invoices",
  "payments",
  "returns",
  "verification",
];

function parseCreditsTab(value: string | null): CreditsPageTab {
  return CREDITS_TABS.includes(value as CreditsPageTab)
    ? (value as CreditsPageTab)
    : "clients";
}

export function useCreditsPageTabs() {
  const locale = useLocale();
  const isAr = locale === "ar";
  const router = useRouter();
  const searchParams = useSearchParams();
  const currentUser = useQuery(api.authz.currentUser);
  const canVerify = canVerifyCreditInvoices(currentUser?.permissions ?? []);

  const tabFromUrl = parseCreditsTab(searchParams.get("tab"));
  const [tab, setTab] = useState<CreditsPageTab>(tabFromUrl);

  useEffect(() => {
    setTab(tabFromUrl);
  }, [tabFromUrl]);

  function selectTab(next: CreditsPageTab) {
    setTab(next);
    const params = new URLSearchParams(searchParams.toString());
    if (next === "clients") {
      params.delete("tab");
    } else {
      params.set("tab", next);
    }
    const qs = params.toString();
    router.replace(qs ? `?${qs}` : "?", { scroll: false });
  }

  const visibleTab: CreditsPageTab =
    tab === "verification" && !canVerify ? "clients" : tab;

  const tabs: { id: CreditsPageTab; label: string; show: boolean }[] = [
    { id: "clients", label: isAr ? "العملاء" : "Clients", show: true },
    { id: "invoices", label: isAr ? "الفواتير" : "Factures", show: true },
    { id: "payments", label: isAr ? "المدفوعات" : "Paiements", show: true },
    { id: "returns", label: isAr ? "الإرجاعات" : "Retours", show: true },
    {
      id: "verification",
      label: isAr ? "التحقق" : "Vérification",
      show: canVerify,
    },
  ];

  return { visibleTab, selectTab, tabs };
}
