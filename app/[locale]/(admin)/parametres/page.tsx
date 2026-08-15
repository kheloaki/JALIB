import { getTranslations } from "next-intl/server";

import { ParametersPage } from "@/components/settings/parameters-page";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "navigation" });

  return {
    title: t("settings"),
    description:
      locale === "ar"
        ? "إعدادات التطبيق العامة: معلومات المتجر والتفضيلات."
        : "Paramètres globaux de l'application : magasin et préférences.",
  };
}

export default function ParametersRoutePage() {
  return <ParametersPage />;
}
