import { defineRouting } from "next-intl/routing";

export const routing = defineRouting({
  // Supported locales
  locales: ["fr", "ar"],

  // Default locale when no locale matches
  defaultLocale: "fr",

  // Use locale prefix always (e.g., /fr/dashboard, /ar/dashboard)
  localePrefix: "always",
});
