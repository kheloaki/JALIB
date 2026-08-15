import { getTranslations } from "next-intl/server";

import { LoginView } from "@/components/auth/login-view";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "auth" });

  return {
    title: t("loginTitle"),
    description: t("loginDescription"),
  };
}

export default function Home() {
  return <LoginView />;
}
