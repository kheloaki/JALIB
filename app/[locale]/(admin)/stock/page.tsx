import { getTranslations } from "next-intl/server";

import { StockPage } from "@/components/stock/stock-page";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "stock" });

  return {
    title: t("title"),
    description:
      locale === "ar"
        ? "كتالوج المنتجات: الكميات، سعر الشراء، سعر البيع والهوامش."
        : "Catalogue produits : quantités, prix d'achat, prix de vente et marges.",
  };
}

export default function StockRoutePage() {
  return <StockPage />;
}
