import { STORE_NAME } from "@/lib/brand/constants";

export function procurementListWhatsAppShareMessage(
  listTitle: string | null | undefined,
  locale: string,
): string {
  const isAr = locale === "ar";
  const title = listTitle?.trim();
  if (isAr) {
    return title
      ? `قائمة مشتريات: ${title} — ${STORE_NAME}`
      : `قائمة مشتريات — ${STORE_NAME}`;
  }
  return title
    ? `Liste d'achats : ${title} — ${STORE_NAME}`
    : `Liste d'achats — ${STORE_NAME}`;
}
