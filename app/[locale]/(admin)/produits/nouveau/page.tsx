import { redirect } from "next/navigation";

export default async function NouveauProduitRedirectPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  redirect(`/${locale}/stock?add=1`);
}
