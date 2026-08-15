"use client";

import { useLocale } from "next-intl";

import { PosOnScreenKeyboard } from "@/components/pos/pos-on-screen-keyboard";

/** Renders the on-screen keyboard above the POS layout (including the cart). */
export function PosKeyboardHost() {
  const locale = useLocale();
  const isAr = locale === "ar";
  const tr = (fr: string, ar: string) => (isAr ? ar : fr);

  return <PosOnScreenKeyboard tr={tr} />;
}
