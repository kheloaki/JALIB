import { getTranslations } from "next-intl/server";

import { DashboardPage } from "@/components/dashboard/dashboard-page";
import { STORE_NAME } from "@/lib/brand/constants";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "dashboard" });

  return {
    title: t("title"),
    description:
      locale === "ar"
        ? `ملخص المشرف: العملاء الحاليين، الاعتمادات، الفواتير والوصول السريع — ${STORE_NAME}.`
        : `Synthèse admin : encours, crédits, factures et accès rapide — ${STORE_NAME}.`,
  };
}

export default function DashboardRoutePage() {
  return <DashboardPage />;
}
