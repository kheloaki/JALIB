import { getTranslations } from "next-intl/server";

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
        ? "الصندوق وسلة التسوق — واجهة نقطة البيع"
        : "Caisse et panier — interface POS",
  };
}

export default function PosLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return children;
}
