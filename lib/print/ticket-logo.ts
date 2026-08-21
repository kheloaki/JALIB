/**
 * Ticket logo for PDF download + WD8260 ESC/POS.
 * Print assets are dark ink on transparent PNG — jsPDF paints alpha as black
 * (logo vanishes). Flatten onto white and threshold for thermal.
 */

import { STORE_LOGO_PRINT_PATH } from "@/lib/brand/constants";
import type { ThermalRasterLine } from "@/lib/print/escpos-text-raster";
import { THERMAL_PRINTER_PROFILE } from "@/lib/print/thermal-printer-profile";

export type TicketLogoPdf = {
  dataUrl: string;
  format: "JPEG" | "PNG";
  widthMm: number;
  heightMm: number;
};

const PX_PER_MM = 96 / 25.4;

function roundUpToByte(width: number): number {
  return Math.max(8, Math.ceil(width / 8) * 8);
}

async function loadLogoImage(
  src = STORE_LOGO_PRINT_PATH,
): Promise<HTMLImageElement> {
  const response = await fetch(src);
  if (!response.ok) throw new Error(`Logo fetch failed: ${src}`);
  const blob = await response.blob();
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error("Logo read failed"));
    reader.readAsDataURL(blob);
  });
  const image = new Image();
  image.src = dataUrl;
  await new Promise<void>((resolve, reject) => {
    image.onload = () => resolve();
    image.onerror = () => reject(new Error("Logo decode failed"));
  });
  return image;
}

/**
 * Draw logo on opaque white (fixes PDF transparency + thermal contrast).
 * Darkens near-black ink so WD8260 heats solid dots.
 */
function drawLogoOnWhite(
  image: HTMLImageElement,
  targetWidthPx: number,
  targetHeightPx: number,
  options: { darken?: boolean } = {},
): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(targetWidthPx));
  canvas.height = Math.max(1, Math.round(targetHeightPx));
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("Canvas 2D unavailable.");

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(image, 0, 0, canvas.width, canvas.height);

  if (options.darken) {
    const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = pixels.data;
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i] ?? 255;
      const g = data[i + 1] ?? 255;
      const b = data[i + 2] ?? 255;
      const a = data[i + 3] ?? 255;
      if (a < 8) {
        data[i] = 255;
        data[i + 1] = 255;
        data[i + 2] = 255;
        data[i + 3] = 255;
        continue;
      }
      const lum = (r + g + b) / 3;
      if (lum < 200) {
        data[i] = 0;
        data[i + 1] = 0;
        data[i + 2] = 0;
        data[i + 3] = 255;
      } else {
        data[i] = 255;
        data[i + 1] = 255;
        data[i + 2] = 255;
        data[i + 3] = 255;
      }
    }
    ctx.putImageData(pixels, 0, 0);
  }

  return canvas;
}

function canvasToMonoBitmap(canvas: HTMLCanvasElement): ThermalRasterLine {
  const width = roundUpToByte(canvas.width);
  const height = canvas.height;
  const padded = document.createElement("canvas");
  padded.width = width;
  padded.height = height;
  const ctx = padded.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("Canvas 2D unavailable.");
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, width, height);
  const offsetX = Math.floor((width - canvas.width) / 2);
  ctx.drawImage(canvas, offsetX, 0);

  const image = ctx.getImageData(0, 0, width, height);
  const rowBytes = Math.ceil(width / 8);
  const bytes = new Uint8Array(rowBytes * height);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const i = (y * width + x) * 4;
      const r = image.data[i] ?? 255;
      const g = image.data[i + 1] ?? 255;
      const b = image.data[i + 2] ?? 255;
      if ((r + g + b) / 3 >= 200) continue;
      const byteIndex = y * rowBytes + (x >> 3);
      bytes[byteIndex] |= 0x80 >> (x & 7);
    }
  }
  return { width, height, bytes };
}

/** Opaque JPEG logo for jsPDF (no alpha → no black rectangle). */
export async function loadTicketLogoForPdf(
  maxHeightMm = 16,
  src = STORE_LOGO_PRINT_PATH,
): Promise<TicketLogoPdf | null> {
  if (typeof document === "undefined") return null;
  try {
    const image = await loadLogoImage(src);
    const ratio = image.naturalWidth / Math.max(1, image.naturalHeight);
    const heightMm = maxHeightMm;
    const widthMm = heightMm * ratio;
    const heightPx = Math.round(heightMm * PX_PER_MM * 3);
    const widthPx = Math.round(widthMm * PX_PER_MM * 3);
    const canvas = drawLogoOnWhite(image, widthPx, heightPx, { darken: true });
    return {
      dataUrl: canvas.toDataURL("image/jpeg", 0.95),
      format: "JPEG",
      widthMm,
      heightMm,
    };
  } catch {
    return null;
  }
}

/** Centered mono bitmap for WD8260 GS v 0. */
export async function loadTicketLogoForThermal(
  maxHeightDots = 140,
): Promise<ThermalRasterLine | null> {
  if (typeof document === "undefined") return null;
  try {
    const image = await loadLogoImage();
    const maxWidth = THERMAL_PRINTER_PROFILE.dotsPerLine;
    const ratio = image.naturalWidth / Math.max(1, image.naturalHeight);
    let height = Math.min(maxHeightDots, Math.round(maxWidth / ratio));
    let width = Math.round(height * ratio);
    if (width > maxWidth - 16) {
      width = maxWidth - 16;
      height = Math.round(width / ratio);
    }
    const canvas = drawLogoOnWhite(image, width, height, { darken: true });
    return canvasToMonoBitmap(canvas);
  } catch {
    return null;
  }
}
