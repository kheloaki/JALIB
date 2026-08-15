import { getTranslations } from "next-intl/server";

import { AuditPage } from "@/components/audit/audit-page";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "navigation" });
  const title = t.has("audit")
    ? t("audit")
    : locale === "ar"
      ? "التدقيق"
      : "Audit";

  return {
    title,
    description:
      locale === "ar"
        ? "سجل الإجراءات والتعديلات في المتجر."
        : "Historique des actions et modifications du magasin.",
  };
}

export default function AuditRoutePage() {
  return <AuditPage />;
}
