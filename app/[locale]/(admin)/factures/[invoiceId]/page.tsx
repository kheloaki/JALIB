import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";

import { InvoiceDetailsPage } from "@/components/invoices/invoice-details-page";
import { STORE_NAME } from "@/lib/brand/constants";

interface InvoiceDetailPageProps {
  params: Promise<{
    locale: string;
    invoiceId: string;
  }>;
}

export async function generateMetadata({ params }: InvoiceDetailPageProps) {
  const { locale, invoiceId } = await params;
  const t = await getTranslations({ locale, namespace: "invoices" });

  return {
    title: `${t("invoiceNumber")} ${invoiceId}`,
    description:
      locale === "ar"
        ? `تفاصيل الفاتورة ${invoiceId} — ${STORE_NAME}.`
        : `Détails de la facture ${invoiceId} — ${STORE_NAME}.`,
  };
}

export default async function FactureDetailsPage({
  params,
}: InvoiceDetailPageProps) {
  const { invoiceId } = await params;

  if (!invoiceId) {
    notFound();
  }

  return <InvoiceDetailsPage invoiceId={invoiceId} />;
}
