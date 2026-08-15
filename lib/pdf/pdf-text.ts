import type { jsPDF } from "jspdf";
import type { CellHookData } from "jspdf-autotable";
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { ArabicShaper } = require("arabic-persian-reshaper") as {
  ArabicShaper: { convertArabic: (text: string) => string };
};

import type { DocumentLocale } from "@/lib/i18n/document-labels";
import {
  applyPdfFont,
  type DocumentPdfFonts,
  PDF_LATIN_FONT,
} from "@/lib/pdf/document-pdf-font";

/** Arabic letters only (excludes Arabic-Indic digits). */
const ARABIC_LETTER_RE =
  /[\u0621-\u064A\u0671-\u06D5\u06EE-\u06EF\u06FA-\u06FF\u08A0-\u08FF]/;
/** Presentation forms produced by arabic-persian-reshaper / PDF shaping. */
const ARABIC_PRESENTATION_RE = /[\uFB50-\uFDFF\uFE70-\uFEFF]/;

export function hasArabicLetters(text: string): boolean {
  return ARABIC_LETTER_RE.test(text);
}

export function hasArabicPresentationForms(text: string): boolean {
  return ARABIC_PRESENTATION_RE.test(text);
}

/** True when the cell must use NotoSansArabic (raw or already-shaped). */
export function needsArabicPdfFont(text: string): boolean {
  return hasArabicLetters(text) || hasArabicPresentationForms(text);
}

export function isLatinDominant(text: string): boolean {
  return !needsArabicPdfFont(text);
}

export function fontForPdfText(
  text: string,
  _locale: DocumentLocale,
  fonts: DocumentPdfFonts,
): string {
  // Mixed FR/AR documents: pick font from the text itself, not UI locale.
  if (needsArabicPdfFont(text)) return fonts.body;
  return PDF_LATIN_FONT;
}

/**
 * Shape Arabic letters for PDF rendering (connected forms).
 * Mixed FR/AR strings: shape each Arabic run only — shaping the whole
 * `"1 U سكر"` string makes autoTable clip to the leading digits.
 */
export function shapeArabicForPdf(text: string): string {
  if (!text || !hasArabicLetters(text)) return text;
  // Already fully presentation-form (no unshaped letters left).
  if (!ARABIC_LETTER_RE.test(text.replace(ARABIC_PRESENTATION_RE, ""))) {
    return text;
  }
  return text.replace(
    /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]+/g,
    (run) => {
      if (!hasArabicLetters(run)) return run;
      return ArabicShaper.convertArabic(run);
    },
  );
}

/** Prepare Arabic text for jsPDF with NotoSansArabic. */
export function prepareArabicPdfText(text: string): string {
  return shapeArabicForPdf(text);
}

export function preparePdfText(text: string, _locale: DocumentLocale): string {
  if (!hasArabicLetters(text)) return text;
  return shapeArabicForPdf(text);
}

/** Arabic / presentation-form code points (for run splitting). */
const ARABIC_BLOCK_RE =
  /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/;

export type PdfScriptRun = { text: string; arabic: boolean };

/**
 * Split mixed FR/AR text so each run can use the right PDF font.
 * jsPDF drops Latin letters / mangling `()` when a whole mixed string is
 * drawn with the Arabic font in one call.
 */
export function splitPdfScriptRuns(text: string): PdfScriptRun[] {
  if (!text) return [];
  const runs: PdfScriptRun[] = [];
  let i = 0;
  while (i < text.length) {
    const arabic = ARABIC_BLOCK_RE.test(text[i]!);
    let j = i + 1;
    while (j < text.length && ARABIC_BLOCK_RE.test(text[j]!) === arabic) {
      j += 1;
    }
    runs.push({ text: text.slice(i, j), arabic });
    i = j;
  }
  return runs;
}

function extractAutoTableCellText(raw: unknown): string {
  if (raw == null) return "";
  if (typeof raw === "string" || typeof raw === "number") return String(raw);
  if (typeof raw === "object" && "content" in raw) {
    return String((raw as { content: unknown }).content);
  }
  return String(raw);
}

function cellTextColor(
  value: unknown,
): [number, number, number] | undefined {
  if (
    Array.isArray(value) &&
    value.length >= 3 &&
    typeof value[0] === "number"
  ) {
    return [value[0], value[1], value[2]];
  }
  return undefined;
}

/**
 * Draw exact product / label text with Noto for Arabic runs and Helvetica
 * for Latin/punctuation — avoids jsPDF clipping mixed strings to digits.
 */
export function drawPdfMixedText(
  doc: jsPDF,
  text: string,
  x: number,
  y: number,
  fonts: DocumentPdfFonts,
  options: {
    align?: "left" | "center" | "right";
    fontSize?: number;
    maxWidth?: number;
    color?: [number, number, number];
  } = {},
): void {
  const fontSize = options.fontSize ?? 10;
  const align = options.align ?? "left";
  doc.setFontSize(fontSize);
  if (options.color) doc.setTextColor(...options.color);

  if (!needsArabicPdfFont(text)) {
    doc.setFont(PDF_LATIN_FONT, "normal");
    doc.text(text, x, y, { align, maxWidth: options.maxWidth });
    return;
  }

  const runs = splitPdfScriptRuns(text).map((run) => {
    if (run.arabic) {
      const shaped = shapeArabicForPdf(run.text);
      // LTR embedding keeps exact logical order (parens / mixed Latin)
      // — plain Noto draw lets jsPDF BiDi drop or reorder characters.
      const draw = `\u202A${shaped}\u202C`;
      doc.setFont(fonts.body, "normal");
      return {
        draw,
        font: fonts.body,
        width: doc.getTextWidth(shaped),
      };
    }
    doc.setFont(PDF_LATIN_FONT, "normal");
    return {
      draw: run.text,
      font: PDF_LATIN_FONT,
      width: doc.getTextWidth(run.text),
    };
  });
  const total = runs.reduce((sum, run) => sum + run.width, 0);
  const maxWidth = options.maxWidth ?? Number.POSITIVE_INFINITY;

  let cursor = x;
  if (align === "right") cursor = x - Math.min(total, maxWidth);
  else if (align === "center") cursor = x - Math.min(total, maxWidth) / 2;

  let remaining = maxWidth;
  for (const run of runs) {
    if (remaining <= 0.2) break;
    doc.setFont(run.font, "normal");
    doc.text(run.draw, cursor, y);
    const used = Math.min(run.width, remaining);
    cursor += used;
    remaining -= used;
  }
}

export function prepareAutoTableCellForLocale(
  data: CellHookData,
  locale: DocumentLocale,
  fonts: DocumentPdfFonts,
): void {
  const text = extractAutoTableCellText(data.cell.raw);
  if (!text) return;

  if (needsArabicPdfFont(text)) {
    // Keep shaped text for autoTable width/height; actual paint is didDrawCell.
    const shaped = shapeArabicForPdf(text);
    data.cell.text = shaped.includes("\n") ? shaped.split("\n") : [shaped];
    data.cell.styles.font = fonts.body;
    if (data.section === "head") {
      data.cell.styles.fontStyle = "bold";
    } else if (data.cell.styles.fontStyle === "bold") {
      data.cell.styles.fontStyle = "normal";
    }
    if (locale === "ar") {
      data.cell.styles.halign = data.cell.styles.halign ?? "right";
    }
    return;
  }

  data.cell.styles.font = PDF_LATIN_FONT;
}

export function createAutoTableLocaleHooks(
  locale: DocumentLocale,
  fonts: DocumentPdfFonts,
  extra?: (data: CellHookData) => void,
) {
  return {
    didParseCell: (data: CellHookData) => {
      prepareAutoTableCellForLocale(data, locale, fonts);
      extra?.(data);
    },
    willDrawCell: (data: CellHookData) => {
      const text = extractAutoTableCellText(data.cell.raw);
      // Suppress broken single-font paint; didDrawCell redraws mixed runs.
      if (text && needsArabicPdfFont(text)) {
        data.cell.text = [];
      }
    },
    didDrawCell: (data: CellHookData) => {
      const text = extractAutoTableCellText(data.cell.raw);
      if (!text || !needsArabicPdfFont(text)) return;

      const padding = 1.2;
      const fontSize =
        typeof data.cell.styles.fontSize === "number"
          ? data.cell.styles.fontSize
          : 10;
      const halign = data.cell.styles.halign;
      const align =
        halign === "right" || halign === "center" ? halign : "left";
      const x =
        align === "right"
          ? data.cell.x + data.cell.width - padding
          : align === "center"
            ? data.cell.x + data.cell.width / 2
            : data.cell.x + padding;
      const y = data.cell.y + data.cell.height / 2 + fontSize * 0.12;
      drawPdfMixedText(data.doc, text, x, y, fonts, {
        align,
        fontSize,
        maxWidth: Math.max(4, data.cell.width - padding * 2),
        color: cellTextColor(data.cell.styles.textColor),
      });
    },
  };
}

/** @deprecated Prefer createAutoTableLocaleHooks (includes mixed-script paint). */
export function createAutoTableLocaleHook(
  locale: DocumentLocale,
  fonts: DocumentPdfFonts,
  extra?: (data: CellHookData) => void,
) {
  return createAutoTableLocaleHooks(locale, fonts, extra).didParseCell;
}

/** @deprecated Use prepareAutoTableCellForLocale */
export function applyAutoTableCellFont(
  data: CellHookData,
  locale: DocumentLocale,
  fonts: DocumentPdfFonts,
): void {
  prepareAutoTableCellForLocale(data, locale, fonts);
}

type PdfTextLineOptions = {
  align?: "left" | "center" | "right";
  maxWidth?: number;
};

export function writePdfTextLine(
  doc: jsPDF,
  text: string,
  x: number,
  y: number,
  locale: DocumentLocale,
  fonts: DocumentPdfFonts,
  options: PdfTextLineOptions = {},
): void {
  const font = fontForPdfText(text, locale, fonts);
  const content =
    font === fonts.body ? prepareArabicPdfText(text) : text;
  doc.setFont(font, "normal");
  doc.text(content, x, y, {
    align: options.align,
    maxWidth: options.maxWidth,
  });
}

export function writePdfArabicFooter(
  doc: jsPDF,
  arabicLine: string,
  metaLine: string,
  y: number,
  locale: DocumentLocale,
  fonts: DocumentPdfFonts,
  pageCenterX: number,
  maxWidth: number,
): number {
  applyPdfFont(doc, fonts, "normal");
  doc.setFontSize(7);

  if (locale === "ar") {
    writePdfTextLine(doc, arabicLine, pageCenterX, y, locale, fonts, {
      align: "center",
      maxWidth,
    });
    y += 4;
    doc.setFont(PDF_LATIN_FONT, "normal");
    doc.text(metaLine, pageCenterX, y, { align: "center", maxWidth });
    return y;
  }

  doc.setFont(fonts.body, "normal");
  doc.text(`${arabicLine} ${metaLine}`.trim(), pageCenterX, y, {
    align: "center",
    maxWidth,
  });
  return y;
}

type PdfCenteredOptions = {
  fontSize?: number;
  style?: "normal" | "bold";
  maxWidth?: number;
  pageCenterX?: number;
};

export function writePdfCentered(
  doc: jsPDF,
  text: string,
  y: number,
  locale: DocumentLocale,
  fonts: DocumentPdfFonts,
  options: PdfCenteredOptions = {},
): void {
  const fontSize = options.fontSize ?? 10;
  const style = options.style ?? "normal";
  const pageCenterX =
    options.pageCenterX ?? doc.internal.pageSize.getWidth() / 2;
  const maxWidth = options.maxWidth ?? doc.internal.pageSize.getWidth();
  const font = fontForPdfText(text, locale, fonts);
  const content =
    font === fonts.body ? prepareArabicPdfText(text) : text;

  doc.setFontSize(fontSize);
  doc.setFont(font, style);
  doc.text(content, pageCenterX, y, { align: "center", maxWidth });
}

type PdfRowOptions = {
  fontSize?: number;
  margin?: number;
  pageWidth?: number;
  rightBold?: boolean;
  mutedRgb?: [number, number, number];
};

export function writePdfRow(
  doc: jsPDF,
  left: string,
  right: string,
  y: number,
  locale: DocumentLocale,
  fonts: DocumentPdfFonts,
  options: PdfRowOptions = {},
): void {
  const fontSize = options.fontSize ?? 7;
  const margin = options.margin ?? 5;
  const pageWidth = options.pageWidth ?? doc.internal.pageSize.getWidth();
  const contentWidth = pageWidth - margin * 2;
  const muted = options.mutedRgb ?? [71, 85, 105];
  const rightBold = options.rightBold ?? true;

  doc.setFontSize(fontSize);
  doc.setTextColor(...muted);

  const leftFont = fontForPdfText(left, locale, fonts);
  doc.setFont(leftFont, "normal");
  doc.text(
    leftFont === fonts.body ? prepareArabicPdfText(left) : left,
    margin,
    y,
    { maxWidth: contentWidth * 0.45 },
  );

  doc.setTextColor(0, 0, 0);
  const rightFont = fontForPdfText(right, locale, fonts);
  doc.setFont(rightFont, rightBold ? "bold" : "normal");
  doc.text(
    rightFont === fonts.body ? prepareArabicPdfText(right) : right,
    pageWidth - margin,
    y,
    {
      align: "right",
      maxWidth: contentWidth * 0.55,
    },
  );
}

export function writePdfAligned(
  doc: jsPDF,
  text: string,
  x: number,
  y: number,
  locale: DocumentLocale,
  fonts: DocumentPdfFonts,
  options: {
    align?: "left" | "center" | "right";
    fontSize?: number;
    style?: "normal" | "bold";
    maxWidth?: number;
    color?: [number, number, number];
  } = {},
): void {
  const fontSize = options.fontSize ?? 7;
  const style = options.style ?? "normal";
  const font = fontForPdfText(text, locale, fonts);
  const content =
    font === fonts.body ? prepareArabicPdfText(text) : text;

  doc.setFontSize(fontSize);
  if (options.color) doc.setTextColor(...options.color);
  doc.setFont(font, style);
  doc.text(content, x, y, {
    align: options.align,
    maxWidth: options.maxWidth,
  });
}

export function writePdfTotalLine(
  doc: jsPDF,
  amount: string,
  currencyWord: string,
  y: number,
  locale: DocumentLocale,
  fonts: DocumentPdfFonts,
  options: { fontSize?: number; pageCenterX?: number } = {},
): void {
  const fontSize = options.fontSize ?? 12;
  const pageCenterX =
    options.pageCenterX ?? doc.internal.pageSize.getWidth() / 2;

  doc.setFontSize(fontSize);
  doc.setTextColor(0, 0, 0);

  if (locale === "ar") {
    doc.setFont(PDF_LATIN_FONT, "bold");
    const amountWidth = doc.getTextWidth(amount);
    doc.setFont(fonts.body, "bold");
    const currencyPrepared = prepareArabicPdfText(currencyWord);
    const currencyWidth = doc.getTextWidth(currencyPrepared);
    const gap = 1.5;
    const startX = pageCenterX - (amountWidth + gap + currencyWidth) / 2;
    doc.setFont(PDF_LATIN_FONT, "bold");
    doc.text(amount, startX, y);
    doc.setFont(fonts.body, "bold");
    doc.text(currencyPrepared, startX + amountWidth + gap, y);
    return;
  }

  doc.setFont(fonts.body, "bold");
  doc.text(`${amount} ${currencyWord}`, pageCenterX, y, { align: "center" });
}

export function writePdfLatinText(
  doc: jsPDF,
  text: string,
  x: number,
  y: number,
  options: {
    align?: "left" | "center" | "right";
    fontSize?: number;
    style?: "normal" | "bold";
    maxWidth?: number;
    color?: [number, number, number];
  } = {},
): void {
  doc.setFontSize(options.fontSize ?? 7);
  if (options.color) doc.setTextColor(...options.color);
  doc.setFont(PDF_LATIN_FONT, options.style ?? "normal");
  doc.text(text, x, y, {
    align: options.align,
    maxWidth: options.maxWidth,
  });
}

export function writePdfArabicText(
  doc: jsPDF,
  text: string,
  x: number,
  y: number,
  fonts: DocumentPdfFonts,
  options: {
    align?: "left" | "center" | "right";
    fontSize?: number;
    style?: "normal" | "bold";
    maxWidth?: number;
    color?: [number, number, number];
  } = {},
): void {
  doc.setFontSize(options.fontSize ?? 7);
  if (options.color) doc.setTextColor(...options.color);
  doc.setFont(fonts.body, options.style ?? "normal");
  doc.text(prepareArabicPdfText(text), x, y, {
    align: options.align,
    maxWidth: options.maxWidth,
  });
}

export function writePdfReceiptText(
  doc: jsPDF,
  text: string,
  x: number,
  y: number,
  locale: DocumentLocale,
  fonts: DocumentPdfFonts,
  options: {
    align?: "left" | "center" | "right";
    fontSize?: number;
    style?: "normal" | "bold";
    maxWidth?: number;
    color?: [number, number, number];
    forceLatin?: boolean;
  } = {},
): void {
  if (options.forceLatin || !needsArabicPdfFont(text)) {
    writePdfLatinText(doc, text, x, y, options);
    return;
  }
  writePdfArabicText(doc, text, x, y, fonts, options);
}
