import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";

import { ReturnDetailsPage } from "@/components/returns/return-details-page";
import { STORE_NAME } from "@/lib/brand/constants";

interface ReturnDetailRouteProps {
  params: Promise<{
    locale: string;
    returnId: string;
  }>;
}

export async function generateMetadata({ params }: ReturnDetailRouteProps) {
  const { locale, returnId } = await params;
  const t = await getTranslations({ locale, namespace: "returns" });

  return {
    title: `${t("title")} — ${returnId}`,
    description:
      locale === "ar"
        ? `تفاصيل الإرجاع — ${STORE_NAME}.`
        : `Détails du retour — ${STORE_NAME}.`,
  };
}

export default async function RetourDetailsRoute({
  params,
}: ReturnDetailRouteProps) {
  const { returnId } = await params;

  if (!returnId) {
    notFound();
  }

  return <ReturnDetailsPage returnId={returnId} />;
}
