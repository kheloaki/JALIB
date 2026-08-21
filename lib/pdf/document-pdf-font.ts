import type { jsPDF } from "jspdf";

import type { DocumentLocale } from "@/lib/i18n/document-labels";

import { ensureArabicCanvasFont } from "@/lib/pdf/arabic-canvas-font";

export const PDF_ARABIC_FONT = "NotoSansArabic";
/** Ticket / document Latin — same Noto family as thermal soft fallback. */
export const PDF_LATIN_FONT = "NotoSans";

const ARABIC_REGULAR_FILE = "NotoSansArabic-Regular.ttf";
const ARABIC_BOLD_FILE = "NotoSansArabic-Bold.ttf";
const LATIN_REGULAR_FILE = "NotoSans-Regular.ttf";
const LATIN_BOLD_FILE = "NotoSans-Bold.ttf";

const fontCache = new Map<string, string>();

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

async function loadFontBase64(path: string): Promise<string> {
  const cached = fontCache.get(path);
  if (cached) return cached;

  const response = await fetch(path);
  if (!response.ok) {
    throw new Error(`Failed to load PDF font: ${path}`);
  }
  const base64 = arrayBufferToBase64(await response.arrayBuffer());
  fontCache.set(path, base64);
  return base64;
}

async function registerTicketFonts(doc: jsPDF): Promise<void> {
  const [arRegular, arBold, laRegular, laBold] = await Promise.all([
    loadFontBase64(`/fonts/${ARABIC_REGULAR_FILE}`),
    loadFontBase64(`/fonts/${ARABIC_BOLD_FILE}`),
    loadFontBase64(`/fonts/${LATIN_REGULAR_FILE}`),
    loadFontBase64(`/fonts/${LATIN_BOLD_FILE}`),
  ]);

  doc.addFileToVFS(ARABIC_REGULAR_FILE, arRegular);
  doc.addFileToVFS(ARABIC_BOLD_FILE, arBold);
  doc.addFont(ARABIC_REGULAR_FILE, PDF_ARABIC_FONT, "normal");
  doc.addFont(ARABIC_BOLD_FILE, PDF_ARABIC_FONT, "bold");

  doc.addFileToVFS(LATIN_REGULAR_FILE, laRegular);
  doc.addFileToVFS(LATIN_BOLD_FILE, laBold);
  doc.addFont(LATIN_REGULAR_FILE, PDF_LATIN_FONT, "normal");
  doc.addFont(LATIN_BOLD_FILE, PDF_LATIN_FONT, "bold");
}

export type DocumentPdfFonts = {
  body: string;
  bold: string;
};

export async function setupDocumentPdfFont(
  doc: jsPDF,
  _locale: DocumentLocale,
): Promise<DocumentPdfFonts> {
  await registerTicketFonts(doc);
  await ensureArabicCanvasFont().catch(() => undefined);
  return { body: PDF_ARABIC_FONT, bold: PDF_ARABIC_FONT };
}

export function applyPdfFont(
  doc: jsPDF,
  fonts: DocumentPdfFonts,
  style: "normal" | "bold" = "normal",
): void {
  doc.setFont(fonts.body, style === "bold" ? "bold" : "normal");
}
