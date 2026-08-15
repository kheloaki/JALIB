import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { PriceCheckPage } from "@/components/price-check/price-check-page";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "priceCheck" });
  return {
    title: t("title"),
    description: t("description"),
  };
}

export default function PrixPage() {
  return <PriceCheckPage />;
}
