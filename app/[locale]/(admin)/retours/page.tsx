import { redirect } from "next/navigation";

export default async function ReturnsRoutePage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { locale } = await params;
  const sp = await searchParams;
  const qs = new URLSearchParams();
  qs.set("tab", "returns");

  for (const key of ["invoiceId", "ref"] as const) {
    const value = sp[key];
    if (typeof value === "string" && value.trim()) {
      qs.set(key, value.trim());
    }
  }

  redirect(`/${locale}/stock?${qs.toString()}`);
}
