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
import {
  isPdfArabicCanvasReady,
  rasterizePdfArabicText,
} from "@/lib/pdf/pdf-arabic-canvas";

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

/**
 * First strong character: Arabic product names use RTL so words stay in
 * catalog order; Latin-leading mixed strings stay LTR.
 */
export function pdfParagraphDirection(text: string): "ltr" | "rtl" {
  for (const ch of text) {
    if (ARABIC_BLOCK_RE.test(ch)) return "rtl";
    if (/[A-Za-z\u00C0-\u024F]/.test(ch)) return "ltr";
  }
  return "ltr";
}

/** Logical runs in left-to-right paint order (RTL names are not mirrored). */
export function getPdfMixedPaintRuns(text: string): PdfScriptRun[] {
  const logical = splitPdfScriptRuns(text);
  if (pdfParagraphDirection(text) === "rtl") {
    return [...logical].reverse();
  }
  return logical;
}

/**
 * jsPDF draws left-to-right in string order. Presentation-form Arabic must
 * be reversed so the name matches the catalog (not letter-flipped).
 */
export function arabicShapedToLtrDrawText(shaped: string): string {
  return `\u202A${reverseGraphemes(shaped)}\u202C`;
}

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
 *
 * Prefer canvas bitmap for Arabic: PDF viewers re-apply BiDi on shaped
 * glyph strings and flip catalog names on ticket downloads.
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
    style?: "normal" | "bold";
    maxWidth?: number;
    color?: [number, number, number];
  } = {},
): void {
  const align = options.align ?? "left";
  const style = options.style ?? "normal";
  const fontSize = options.fontSize ?? 10;
  if (options.fontSize != null) doc.setFontSize(options.fontSize);
  if (options.color) doc.setTextColor(...options.color);

  // Ticket PDFs: paint every string via Noto canvas (FR + AR) when available.
  if (isPdfArabicCanvasReady()) {
    const image = rasterizePdfArabicText(text, {
      fontSizePt: fontSize,
      bold: style === "bold",
      maxWidthMm: options.maxWidth,
      color: options.color,
      align,
    });
    if (image) {
      let drawX = x;
      if (align === "right") drawX = x - image.widthMm;
      else if (align === "center") drawX = x - image.widthMm / 2;
      const drawY = y - image.heightMm * 0.72;
      doc.addImage(
        image.dataUrl,
        "PNG",
        drawX,
        drawY,
        image.widthMm,
        image.heightMm,
      );
      return;
    }
  }

  if (!needsArabicPdfFont(text)) {
    doc.setFont(PDF_LATIN_FONT, style);
    doc.text(text, x, y, { align, maxWidth: options.maxWidth });
    return;
  }

  const runs = getPdfMixedPaintRuns(text).map((run) => {
    if (run.arabic) {
      const shaped = shapeArabicForPdf(run.text);
      doc.setFont(fonts.body, style);
      return {
        draw: arabicShapedToLtrDrawText(shaped),
        font: fonts.body,
        width: doc.getTextWidth(shaped),
      };
    }
    doc.setFont(PDF_LATIN_FONT, style);
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
    doc.setFont(run.font, style);
    // jsPDF supports R2L at runtime; typings omit it.
    doc.text(run.draw, cursor, y, { R2L: false } as Parameters<
      jsPDF["text"]
    >[3]);
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
  drawPdfMixedText(doc, text, x, y, fonts, {
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

  if (arabicLine.trim()) {
    writePdfTextLine(doc, arabicLine.trim(), pageCenterX, y, locale, fonts, {
      align: "center",
      maxWidth,
    });
    y += 4;
  }
  if (metaLine.trim()) {
    writePdfLatinText(doc, metaLine.trim(), pageCenterX, y, {
      align: "center",
      fontSize: 7,
      maxWidth,
    });
  }
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
  drawPdfMixedText(doc, text, pageCenterX, y, fonts, {
    align: "center",
    fontSize,
    style,
    maxWidth,
  });
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

  drawPdfMixedText(doc, left, margin, y, fonts, {
    align: "left",
    fontSize,
    maxWidth: contentWidth * 0.45,
  });

  doc.setTextColor(0, 0, 0);
  drawPdfMixedText(doc, right, pageWidth - margin, y, fonts, {
    align: "right",
    fontSize,
    style: rightBold ? "bold" : "normal",
    maxWidth: contentWidth * 0.55,
  });
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
  drawPdfMixedText(doc, text, x, y, fonts, {
    align: options.align,
    fontSize: options.fontSize ?? 7,
    style: options.style ?? "normal",
    maxWidth: options.maxWidth,
    color: options.color,
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
    const gap = 1.5;
    // Approximate currency width from canvas when ready; else shaped width.
    let currencyWidth = 8;
    if (isPdfArabicCanvasReady()) {
      const sample = rasterizePdfArabicText(currencyWord, {
        fontSizePt: fontSize,
        bold: true,
      });
      currencyWidth = sample?.widthMm ?? currencyWidth;
    } else {
      doc.setFont(fonts.body, "bold");
      currencyWidth = doc.getTextWidth(shapeArabicForPdf(currencyWord));
    }
    const startX = pageCenterX - (amountWidth + gap + currencyWidth) / 2;
    doc.setFont(PDF_LATIN_FONT, "bold");
    doc.text(amount, startX, y);
    drawPdfMixedText(doc, currencyWord, startX + amountWidth + gap, y, fonts, {
      align: "left",
      fontSize,
      style: "bold",
    });
    return;
  }

  drawPdfMixedText(doc, `${amount} ${currencyWord}`, pageCenterX, y, fonts, {
    align: "center",
    fontSize,
    style: "bold",
  });
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
  const fontSize = options.fontSize ?? 7;
  const style = options.style ?? "normal";
  const align = options.align ?? "left";
  if (options.color) doc.setTextColor(...options.color);

  if (isPdfArabicCanvasReady()) {
    const image = rasterizePdfArabicText(text, {
      fontSizePt: fontSize,
      bold: style === "bold",
      maxWidthMm: options.maxWidth,
      color: options.color,
      align,
    });
    if (image) {
      let drawX = x;
      if (align === "right") drawX = x - image.widthMm;
      else if (align === "center") drawX = x - image.widthMm / 2;
      const drawY = y - image.heightMm * 0.72;
      doc.addImage(
        image.dataUrl,
        "PNG",
        drawX,
        drawY,
        image.widthMm,
        image.heightMm,
      );
      return;
    }
  }

  doc.setFontSize(fontSize);
  doc.setFont(PDF_LATIN_FONT, style);
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
  drawPdfMixedText(doc, text, x, y, fonts, {
    align: options.align,
    fontSize: options.fontSize ?? 7,
    style: options.style ?? "normal",
    maxWidth: options.maxWidth,
    color: options.color,
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
