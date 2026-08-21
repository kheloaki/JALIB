/** Rasterize text to ESC/POS bitmap so Arabic prints correctly on thermal printers. */

import {
  arabicCanvasDirection,
  arabicCanvasFontCss,
  ensureArabicCanvasFont,
} from "@/lib/pdf/arabic-canvas-font";
import { THERMAL_PRINTER_PROFILE } from "@/lib/print/thermal-printer-profile";

const ARABIC_RE =
  /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/;

export function needsThermalRaster(text: string): boolean {
  return ARABIC_RE.test(text);
}

export type ThermalRasterLine = {
  width: number;
  height: number;
  /** Packed 1-bit rows, MSB left, row-major. */
  bytes: Uint8Array;
};

type RasterizeOptions = {
  /** Printable dots (WD8260 = 576). */
  maxWidth?: number;
  fontSize?: number;
  align?: "left" | "center" | "right";
  bold?: boolean;
  /** Force RTL paragraph (Arabic product names). */
  rtl?: boolean;
};

/** Thermal heads ignore light gray — treat mid-gray as black for denser print. */
function isMostlyDark(
  data: Uint8ClampedArray,
  index: number,
  threshold = 210,
): boolean {
  const r = data[index] ?? 255;
  const g = data[index + 1] ?? 255;
  const b = data[index + 2] ?? 255;
  const a = data[index + 3] ?? 255;
  if (a < 20) return false;
  return (r + g + b) / 3 < threshold;
}

function roundUpToByte(width: number): number {
  return Math.max(8, Math.ceil(width / 8) * 8);
}

function canvasToMonoBitmap(canvas: HTMLCanvasElement): ThermalRasterLine {
  const width = canvas.width;
  const height = canvas.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D unavailable.");
  const image = ctx.getImageData(0, 0, width, height);
  const rowBytes = Math.ceil(width / 8);
  const bytes = new Uint8Array(rowBytes * height);

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const i = (y * width + x) * 4;
      if (!isMostlyDark(image.data, i)) continue;
      const byteIndex = y * rowBytes + (x >> 3);
      bytes[byteIndex] |= 0x80 >> (x & 7);
    }
  }

  return { width, height, bytes };
}

function drawDenseText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
): void {
  // Fake bold + slight thicken so WD8260 heats enough dots.
  ctx.fillText(text, x, y);
  ctx.fillText(text, x + 1, y);
  ctx.fillText(text, x, y + 1);
}

/**
 * Draw one receipt line as a monochrome bitmap (browser shapes Arabic correctly).
 * Always uses full printer width so alignment matches the WD8260 head.
 */
export async function rasterizeThermalText(
  text: string,
  options: RasterizeOptions = {},
): Promise<ThermalRasterLine> {
  const maxWidth = roundUpToByte(
    options.maxWidth ?? THERMAL_PRINTER_PROFILE.dotsPerLine,
  );
  const fontSize = options.fontSize ?? 30;
  const align = options.align ?? "left";
  const rtl =
    options.rtl ?? arabicCanvasDirection(text) === "rtl";
  const bold = options.bold ?? needsThermalRaster(text);

  await ensureArabicCanvasFont();

  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("Canvas 2D unavailable.");

  const font = arabicCanvasFontCss(fontSize, bold);
  const padY = Math.ceil(fontSize * 0.35);
  const height = Math.ceil(fontSize + padY * 2);

  canvas.width = maxWidth;
  canvas.height = height;

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, maxWidth, height);
  ctx.fillStyle = "#000000";
  ctx.font = font;
  ctx.textBaseline = "middle";
  ctx.direction = rtl ? "rtl" : "ltr";
  ctx.imageSmoothingEnabled = false;

  // Match HTML thermal ticket: LTR frame — left/center/right anchors.
  let x = 4;
  if (align === "center") x = maxWidth / 2;
  else if (align === "right") x = maxWidth - 4;

  ctx.textAlign =
    align === "center" ? "center" : align === "right" ? "right" : "left";
  drawDenseText(ctx, text, x, height / 2);

  return canvasToMonoBitmap(canvas);
}

/**
 * Label left + value right (same as HTML / PDF ticket), Arabic shaped per side.
 */
export async function rasterizeThermalColumns(
  left: string,
  right: string,
  options: { maxWidth?: number; fontSize?: number; bold?: boolean } = {},
): Promise<ThermalRasterLine> {
  const maxWidth = roundUpToByte(
    options.maxWidth ?? THERMAL_PRINTER_PROFILE.dotsPerLine,
  );
  const fontSize = options.fontSize ?? 28;
  const leftRtl = needsThermalRaster(left);
  const rightRtl = needsThermalRaster(right);
  const bold = options.bold ?? (leftRtl || rightRtl);

  await ensureArabicCanvasFont();

  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("Canvas 2D unavailable.");

  const font = arabicCanvasFontCss(fontSize, bold);
  const padY = Math.ceil(fontSize * 0.35);
  const height = Math.ceil(fontSize + padY * 2);

  canvas.width = maxWidth;
  canvas.height = height;
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, maxWidth, height);
  ctx.fillStyle = "#000000";
  ctx.font = font;
  ctx.textBaseline = "middle";
  ctx.imageSmoothingEnabled = false;

  ctx.direction = leftRtl ? "rtl" : "ltr";
  ctx.textAlign = "left";
  drawDenseText(ctx, left, 4, height / 2);

  ctx.direction = rightRtl ? "rtl" : "ltr";
  ctx.textAlign = "right";
  drawDenseText(ctx, right, maxWidth - 4, height / 2);

  return canvasToMonoBitmap(canvas);
}
