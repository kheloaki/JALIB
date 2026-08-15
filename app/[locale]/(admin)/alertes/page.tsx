import { getTranslations } from "next-intl/server";

import { AlertsPage } from "@/components/alerts/alerts-page";
import { STORE_NAME } from "@/lib/brand/constants";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "alerts" });

  return {
    title: locale === "ar" ? "مركز التنبيهات" : "Centre d'alertes",
    description:
      locale === "ar"
        ? `تنبيهات الائتمان والمدفوعات المتأخرة والمخزون — إدارة المخاطر ${STORE_NAME}.`
        : `Alertes crédit, impayés et stock — gestion des risques ${STORE_NAME}.`,
  };
}

export default function AlertesPage() {
  return <AlertsPage />;
}
