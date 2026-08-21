/**
 * Jamaa Market default thermal printer: WDLink WD8260 (80mm ESC/POS).
 * Specs: 576 dots/line, Font A 12×24 → 48 chars/line, paper 79.5±0.5mm.
 *
 * Built-in fonts (manufacturer sheet): Font A 12×24, Font B 9×17.
 * Ticket text uses Font A via ESC/POS code pages (not soft TTF):
 * - French / Latin → WPC1252
 * - Arabic → WPC1256
 * - ASCII → PC437
 */

export const THERMAL_PRINTER_MODEL = "WD8260";

export const THERMAL_PRINTER_PROFILE = {
  model: THERMAL_PRINTER_MODEL,
  brand: "WDLink",
  /** Roll paper width (mm). */
  paperWidthMm: 80,
  /** Effective print width from manufacturer sheet. */
  printWidthMm: 80,
  /** Browser / PDF content width after small side margin. */
  ticketContentWidthMm: 76,
  /** Horizontal margin for browser print (@page). */
  pageMarginMm: 2,
  /** Dot density for GS v 0 bitmaps. */
  dotsPerLine: 576,
  /** Font A (12×24) columns: 576 / 12. */
  charsPerLine: 48,
  /** French labels, amounts formatting accents (ESC t n). */
  latinCodePage: {
    codePage: 16,
    encoding: "windows-1252",
    label: "WPC1252",
  },
  /** Arabic product / client names (ESC t n). */
  arabicCodePage: {
    codePage: 50,
    encoding: "windows-1256",
    label: "WPC1256",
  },
  /** Pure ASCII digits / separators. */
  asciiCodePage: {
    codePage: 0,
    encoding: "ascii",
    label: "PC437",
  },
  /** Web Serial baud when using USB-COM adapters. */
  serialBaudRate: 115200,
  /** USB transferOut chunk size (bytes). */
  usbChunkBytes: 512,
} as const;

export type ThermalPrinterProfile = typeof THERMAL_PRINTER_PROFILE;
