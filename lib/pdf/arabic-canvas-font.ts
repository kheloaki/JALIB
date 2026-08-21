/**
 * Shared ticket fonts for PDF canvas + thermal raster fallback.
 * Same files as public/fonts — FR uses Noto Sans, AR uses Noto Sans Arabic.
 */

export const TICKET_LATIN_FONT_FAMILY = "MatjarTicketLatin";
export const TICKET_ARABIC_FONT_FAMILY = "MatjarTicketArabic";

/** @deprecated alias */
export const ARABIC_FONT_FAMILY = TICKET_ARABIC_FONT_FAMILY;

export const TICKET_LATIN_FONT_URL_REGULAR = "/fonts/NotoSans-Regular.ttf";
export const TICKET_LATIN_FONT_URL_BOLD = "/fonts/NotoSans-Bold.ttf";
export const ARABIC_FONT_URL_REGULAR = "/fonts/NotoSansArabic-Regular.ttf";
export const ARABIC_FONT_URL_BOLD = "/fonts/NotoSansArabic-Bold.ttf";

const ARABIC_BLOCK_RE =
  /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/;

let fontReady: Promise<void> | null = null;
let fontsLoaded = false;

export function isArabicCanvasFontReady(): boolean {
  return (
    fontsLoaded &&
    typeof document !== "undefined" &&
    typeof document.createElement === "function"
  );
}

export async function ensureArabicCanvasFont(): Promise<void> {
  if (typeof document === "undefined") return;
  if (fontsLoaded) return;
  if (!fontReady) {
    fontReady = (async () => {
      const faces = await Promise.all([
        new FontFace(
          TICKET_LATIN_FONT_FAMILY,
          `url(${TICKET_LATIN_FONT_URL_REGULAR})`,
          { weight: "400" },
        ).load(),
        new FontFace(
          TICKET_LATIN_FONT_FAMILY,
          `url(${TICKET_LATIN_FONT_URL_BOLD})`,
          { weight: "700" },
        ).load(),
        new FontFace(
          TICKET_ARABIC_FONT_FAMILY,
          `url(${ARABIC_FONT_URL_REGULAR})`,
          { weight: "400" },
        ).load(),
        new FontFace(
          TICKET_ARABIC_FONT_FAMILY,
          `url(${ARABIC_FONT_URL_BOLD})`,
          { weight: "700" },
        ).load(),
      ]);
      for (const face of faces) document.fonts.add(face);
      await document.fonts.ready;
      fontsLoaded = true;
    })().catch((error) => {
      fontReady = null;
      fontsLoaded = false;
      throw error;
    });
  }
  await fontReady;
}

/** First strong character decides paragraph direction. */
export function arabicCanvasDirection(text: string): "ltr" | "rtl" {
  for (const ch of text) {
    if (ARABIC_BLOCK_RE.test(ch)) return "rtl";
    if (/[A-Za-z\u00C0-\u024F]/.test(ch)) return "ltr";
  }
  return "ltr";
}

export function needsArabicTicketFont(text: string): boolean {
  return ARABIC_BLOCK_RE.test(text);
}

export function arabicCanvasFontCss(
  fontSizePx: number,
  bold: boolean,
): string {
  const weight = bold ? "700" : "400";
  return `${weight} ${fontSizePx}px "${TICKET_ARABIC_FONT_FAMILY}", "${TICKET_LATIN_FONT_FAMILY}", "Noto Sans Arabic", "Noto Sans", sans-serif`;
}
