import { getTranslations } from "next-intl/server";

import { InvoicesPage } from "@/components/invoices/invoices-page";
import { STORE_NAME } from "@/lib/brand/constants";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "invoices" });

  return {
    title: t("title"),
    description:
      locale === "ar"
        ? `قائمة الفواتير، الفلاتر والمعاينة — ${STORE_NAME}.`
        : `Liste des factures, filtres et aperçu ticket — ${STORE_NAME}.`,
  };
}

export default function FacturesPage() {
  return <InvoicesPage />;
}
