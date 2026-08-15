import { redirect } from "next/navigation";

export default async function RolesRoutePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  redirect(`/${locale}/parametres?tab=roles`);
}
