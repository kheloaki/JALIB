import type { QuickContactClient } from "@/lib/alerts/types";
import { STORE_NAME } from "@/lib/brand/constants";

export function whatsappHref(phoneDigits: string, message: string): string {
  const n = phoneDigits.replace(/\D/g, "");
  if (!n) return "#";
  return `https://wa.me/${n}?text=${encodeURIComponent(message)}`;
}

export function creditOverLimitMessageFr(client: QuickContactClient): string {
  const lim = client.limitDh.toLocaleString("fr-FR");
  return `Bonjour ${client.name}, nous vous informons que votre crédit chez ${STORE_NAME} a dépassé la limite de ${lim} DH. Merci de régulariser.`;
}

type QuickContactClientLocalized = QuickContactClient & {
  gender?: "male" | "female" | "other";
  preferredLocale?: string;
};

function arabicSalutation(client: QuickContactClientLocalized): string {
  if (client.gender === "female") return "عزيزتي العميلة";
  if (client.gender === "male") return "عزيزي العميل";
  return "عميلنا الكريم";
}

export function creditOverLimitMessageAr(client: QuickContactClient): string {
  const localized = client as QuickContactClientLocalized;
  const locale = localized.preferredLocale?.trim() || "ar-MA";
  const lim = client.limitDh.toLocaleString(locale);
  const nameAr = client.nameAr ?? client.name;
  const salute = arabicSalutation(localized);
  return `السلام عليكم ${salute} ${nameAr}، نخبركم أن رصيدكم في ${STORE_NAME} تجاوز الحد المسموح به (${lim} درهم). المرجو تسوية الوضعية.`;
}
