import { getTranslations } from "next-intl/server";

import { PosDashboard } from "./pos-dashboard";
import { STORE_NAME } from "@/lib/brand/constants";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "pos" });

  return {
    title: t("title"),
    description:
      locale === "ar"
        ? `نقطة البيع السريعة — ${STORE_NAME}.`
        : `Point de vente rapide — ${STORE_NAME}.`,
  };
}

export default function PosPage() {
  return <PosDashboard />;
}
