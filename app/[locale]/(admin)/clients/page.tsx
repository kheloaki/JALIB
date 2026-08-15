import { getTranslations } from "next-intl/server";

import { ClientsPage } from "@/components/clients/clients-page";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "clients" });

  return {
    title: t("title"),
    description:
      locale === "ar"
        ? "إدارة العملاء — الاسم والهاتف."
        : "Gérer les clients — nom et téléphone.",
  };
}

export default function ClientsRoutePage() {
  return <ClientsPage />;
}
