import { getTranslations } from "next-intl/server";

import { CreditsPage } from "@/components/credits/credits-page";
import { STORE_NAME } from "@/lib/brand/constants";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "credits" });

  return {
    title: t("title"),
    description:
      locale === "ar"
        ? `أرصدة العملاء، المدفوعات وسجل الفواتير — ${STORE_NAME}.`
        : `Encours clients, paiements et historique des factures — ${STORE_NAME}.`,
  };
}

export default function CreditsRoutePage() {
  return <CreditsPage />;
}
