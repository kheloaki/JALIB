import { redirect } from "next/navigation";

export default async function AchatsRoutePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  redirect(`/${locale}/stock?tab=procurement`);
}
