/**
 * WD8260 Font A via ESC/POS code pages (all ticket text — FR + AR + digits).
 *
 * Epson-compatible tables:
 * - ESC t 16 = WPC1252 (French / Western European)
 * - ESC t 50 = WPC1256 (Arabic)
 * - ESC t  0 = PC437 (ASCII-safe fallback)
 *
 * Soft canvas raster is only used when a glyph cannot be encoded.
 */

import iconv from "iconv-lite";

import { THERMAL_PRINTER_PROFILE } from "@/lib/print/thermal-printer-profile";

const ARABIC_RE =
  /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/;
const NON_ASCII_RE = /[^\x00-\x7F]/;

export function hasArabicForEscPos(text: string): boolean {
  return ARABIC_RE.test(text);
}

export function hasNonAscii(text: string): boolean {
  return NON_ASCII_RE.test(text);
}

function reverseGraphemes(text: string): string {
  try {
    const segmenter = new Intl.Segmenter("ar", { granularity: "grapheme" });
    return Array.from(segmenter.segment(text), (part) => part.segment)
      .reverse()
      .join("");
  } catch {
    return Array.from(text).reverse().join("");
  }
}

function isRtlParagraph(text: string): boolean {
  for (const ch of text) {
    if (ARABIC_RE.test(ch)) return true;
    if (/[A-Za-z\u00C0-\u024F]/.test(ch)) return false;
  }
  return false;
}

/** Visual order for LTR Font A when the line contains Arabic. */
export function prepareTicketVisualOrder(text: string): string {
  const normalized = text.normalize("NFC");
  if (!normalized || !hasArabicForEscPos(normalized)) return normalized;
  if (isRtlParagraph(normalized)) return reverseGraphemes(normalized);
  return normalized.replace(
    /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF]+/g,
    (run) => reverseGraphemes(run),
  );
}

/** @deprecated use prepareTicketVisualOrder */
export const prepareArabicVisualOrder = prepareTicketVisualOrder;

function canEncodeAll(text: string, encoding: string): boolean {
  for (const ch of text) {
    const code = ch.codePointAt(0) ?? 0;
    if (code < 0x80) continue;
    const buf = iconv.encode(ch, encoding);
    if (buf.length === 0) return false;
    const decoded = iconv.decode(buf, encoding);
    if (decoded !== ch) return false;
  }
  return true;
}

export type EscPosCodePagePayload = {
  bytes: Uint8Array;
  codePage: number;
  encoding: string;
  label: string;
};

function tryEncode(
  text: string,
  codePage: number,
  encoding: string,
  label: string,
): EscPosCodePagePayload | null {
  if (!iconv.encodingExists(encoding)) return null;
  if (!canEncodeAll(text, encoding)) return null;
  try {
    return {
      bytes: iconv.encode(text, encoding),
      codePage,
      encoding,
      label,
    };
  } catch {
    return null;
  }
}

/**
 * Pick the best WD8260 Font A code page for this string.
 * Returns null → caller should rasterize.
 */
export function encodeEscPosTicketText(
  text: string,
): EscPosCodePagePayload | null {
  const visual = prepareTicketVisualOrder(text);
  if (!visual) return null;

  const { arabicCodePage, latinCodePage, asciiCodePage } =
    THERMAL_PRINTER_PROFILE;

  if (hasArabicForEscPos(visual)) {
    return tryEncode(
      visual,
      arabicCodePage.codePage,
      arabicCodePage.encoding,
      arabicCodePage.label,
    );
  }

  if (hasNonAscii(visual)) {
    return tryEncode(
      visual,
      latinCodePage.codePage,
      latinCodePage.encoding,
      latinCodePage.label,
    );
  }

  return tryEncode(
    visual,
    asciiCodePage.codePage,
    asciiCodePage.encoding,
    asciiCodePage.label,
  );
}

/** @deprecated use encodeEscPosTicketText */
export function encodeEscPosArabic(
  text: string,
): EscPosCodePagePayload | null {
  return encodeEscPosTicketText(text);
}

export function encodeEscPosTicketColumns(
  left: string,
  right: string,
  width = THERMAL_PRINTER_PROFILE.charsPerLine,
): EscPosCodePagePayload | null {
  const leftVis = prepareTicketVisualOrder(left);
  const rightVis = prepareTicketVisualOrder(right);
  const leftTrim = leftVis.slice(0, Math.max(1, width - 1));
  const rightTrim = rightVis.slice(
    0,
    Math.max(1, width - leftTrim.length - 1),
  );
  const gap = Math.max(1, width - leftTrim.length - rightTrim.length);
  return encodeEscPosTicketText(`${leftTrim}${" ".repeat(gap)}${rightTrim}`);
}

/** @deprecated use encodeEscPosTicketColumns */
export function encodeEscPosArabicColumns(
  left: string,
  right: string,
  width = THERMAL_PRINTER_PROFILE.charsPerLine,
): EscPosCodePagePayload | null {
  return encodeEscPosTicketColumns(left, right, width);
}
