/**
 * Draw ticket text (FR + AR) via canvas so PDF downloads match thermal fonts
 * and Arabic stays unflipped in viewers.
 */

import {
  arabicCanvasDirection,
  arabicCanvasFontCss,
  ensureArabicCanvasFont,
  isArabicCanvasFontReady,
} from "@/lib/pdf/arabic-canvas-font";

export {
  ensureArabicCanvasFont as ensurePdfArabicCanvasFont,
  isArabicCanvasFontReady as isPdfArabicCanvasReady,
};

export type PdfArabicCanvasImage = {
  dataUrl: string;
  widthMm: number;
  heightMm: number;
};

const SCALE = 3;
const PX_PER_MM = 96 / 25.4;

function wrapLines(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidthPx: number,
): string[] {
  const trimmed = text.trim();
  if (!trimmed) return [""];
  if (ctx.measureText(trimmed).width <= maxWidthPx) return [trimmed];

  const words = trimmed.split(/\s+/);
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (ctx.measureText(next).width <= maxWidthPx) {
      current = next;
      continue;
    }
    if (current) lines.push(current);
    if (ctx.measureText(word).width <= maxWidthPx) {
      current = word;
      continue;
    }
    let chunk = "";
    for (const ch of word) {
      const trial = chunk + ch;
      if (ctx.measureText(trial).width > maxWidthPx && chunk) {
        lines.push(chunk);
        chunk = ch;
      } else {
        chunk = trial;
      }
    }
    current = chunk;
  }
  if (current) lines.push(current);
  return lines.length > 0 ? lines : [trimmed];
}

/**
 * Rasterize any ticket string (Latin or Arabic) with Noto ticket fonts.
 */
export function rasterizePdfArabicText(
  text: string,
  options: {
    fontSizePt?: number;
    bold?: boolean;
    maxWidthMm?: number;
    color?: [number, number, number];
    align?: "left" | "center" | "right";
  } = {},
): PdfArabicCanvasImage | null {
  if (!isArabicCanvasFontReady() || !text) return null;

  const fontSizePt = options.fontSizePt ?? 10;
  const fontSizePx = fontSizePt * (96 / 72);
  const maxWidthPx =
    options.maxWidthMm != null
      ? Math.max(8, options.maxWidthMm * PX_PER_MM)
      : 2000;
  const bold = options.bold ?? true;
  const [r, g, b] = options.color ?? [0, 0, 0];
  const direction = arabicCanvasDirection(text);
  const align =
    options.align ?? (direction === "rtl" ? "right" : "left");

  const measure = document.createElement("canvas").getContext("2d");
  if (!measure) return null;
  measure.font = arabicCanvasFontCss(fontSizePx, bold);
  const lines = wrapLines(measure, text, maxWidthPx);
  const lineHeight = fontSizePx * 1.35;
  const contentWidth = Math.min(
    maxWidthPx,
    Math.max(...lines.map((line) => measure.measureText(line).width), 8) + 4,
  );
  const contentHeight = Math.ceil(lineHeight * lines.length + fontSizePx * 0.25);

  const canvas = document.createElement("canvas");
  canvas.width = Math.ceil(contentWidth * SCALE);
  canvas.height = Math.ceil(contentHeight * SCALE);
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  ctx.scale(SCALE, SCALE);
  ctx.clearRect(0, 0, contentWidth, contentHeight);
  ctx.font = arabicCanvasFontCss(fontSizePx, bold);
  ctx.fillStyle = `rgb(${r},${g},${b})`;
  ctx.textBaseline = "middle";
  ctx.direction = direction;
  ctx.textAlign =
    align === "center" ? "center" : align === "right" ? "right" : "left";

  lines.forEach((line, index) => {
    const y = lineHeight * (index + 0.5);
    const x =
      align === "center"
        ? contentWidth / 2
        : align === "right"
          ? contentWidth - 2
          : 2;
    ctx.fillText(line, x, y);
  });

  return {
    dataUrl: canvas.toDataURL("image/png"),
    widthMm: contentWidth / PX_PER_MM,
    heightMm: contentHeight / PX_PER_MM,
  };
}
