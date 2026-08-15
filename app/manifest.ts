import type { MetadataRoute } from "next";

import {
  STORE_NAME,
  STORE_NAME_AR,
  STORE_TAGLINE_FR,
} from "@/lib/brand/constants";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: `${STORE_NAME} Admin`,
    short_name: STORE_NAME,
    description: `${STORE_TAGLINE_FR} — ${STORE_NAME} / ${STORE_NAME_AR}`,
    start_url: "/fr/dashboard",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#faf6f1",
    theme_color: "#3d2b1f",
    lang: "fr",
    dir: "ltr",
    categories: ["business", "productivity"],
    icons: [
      {
        src: "/jamaa-market-logo.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/jamaa-market-logo.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
