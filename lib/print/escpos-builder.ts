/** ESC/POS builder tuned for WD8260 80mm Font A (576 dots / 48 cols). */

import {
  encodeEscPosTicketColumns,
  encodeEscPosTicketText,
  hasArabicForEscPos,
} from "@/lib/print/escpos-arabic-codepage";
import {
  needsThermalRaster,
  rasterizeThermalColumns,
  rasterizeThermalText,
  type ThermalRasterLine,
} from "@/lib/print/escpos-text-raster";
import { THERMAL_PRINTER_PROFILE } from "@/lib/print/thermal-printer-profile";

const ESC = 0x1b;
const GS = 0x1d;
const LF = 0x0a;

const COLS = THERMAL_PRINTER_PROFILE.charsPerLine;
const DOTS = THERMAL_PRINTER_PROFILE.dotsPerLine;
const DEFAULT_CODE_PAGE: number =
  THERMAL_PRINTER_PROFILE.asciiCodePage.codePage;

function encodeUtf8(text: string): Uint8Array {
  return new TextEncoder().encode(text);
}

export class EscPosBuilder {
  private chunks: Uint8Array[] = [];
  private activeCodePage: number = DEFAULT_CODE_PAGE;

  private push(...bytes: number[]) {
    this.chunks.push(Uint8Array.from(bytes));
  }

  private pushBytes(bytes: Uint8Array) {
    this.chunks.push(bytes);
  }

  /** ESC t n — select character code table. */
  selectCodePage(n: number): this {
    if (this.activeCodePage === n) return this;
    this.push(ESC, 0x74, n & 0xff);
    this.activeCodePage = n;
    return this;
  }

  init(): this {
    this.push(ESC, 0x40); // ESC @
    this.activeCodePage = -1;
    this.selectCodePage(DEFAULT_CODE_PAGE);
    this.push(ESC, 0x52, 0x00); // international character set USA
    // Compact line spacing for WD8260 80mm tickets.
    this.push(ESC, 0x33, 50);
    return this;
  }

  align(mode: "left" | "center" | "right"): this {
    const n = mode === "center" ? 1 : mode === "right" ? 2 : 0;
    this.push(ESC, 0x61, n);
    return this;
  }

  bold(on: boolean): this {
    this.push(ESC, 0x45, on ? 1 : 0);
    return this;
  }

  doubleHeight(on: boolean): this {
    this.push(GS, 0x21, on ? 0x10 : 0x00);
    return this;
  }

  /** Native Font A with the correct code page for FR / AR / ASCII. */
  private tryNativeLine(
    value: string,
    options: {
      align?: "left" | "center" | "right";
      bold?: boolean;
    } = {},
  ): boolean {
    const encoded = encodeEscPosTicketText(value);
    if (!encoded) return false;
    if (options.align) this.align(options.align);
    if (options.bold) this.bold(true);
    this.selectCodePage(encoded.codePage);
    this.pushBytes(encoded.bytes);
    this.push(LF);
    if (options.bold) this.bold(false);
    this.selectCodePage(DEFAULT_CODE_PAGE);
    return true;
  }

  text(value: string): this {
    const encoded = encodeEscPosTicketText(value);
    if (encoded) {
      this.selectCodePage(encoded.codePage);
      this.pushBytes(encoded.bytes);
      this.selectCodePage(DEFAULT_CODE_PAGE);
      return this;
    }
    // Last resort: ASCII strip (should be rare).
    this.selectCodePage(DEFAULT_CODE_PAGE);
    this.pushBytes(
      encodeUtf8(value.normalize("NFKD").replace(/[^\x20-\x7E]/g, "?")),
    );
    return this;
  }

  line(value = ""): this {
    if (!value) {
      this.push(LF);
      return this;
    }
    if (this.tryNativeLine(value)) return this;
    this.text(value);
    this.push(LF);
    return this;
  }

  /** Monochrome bitmap line (soft font — only when code page cannot encode). */
  raster(image: ThermalRasterLine): this {
    this.selectCodePage(DEFAULT_CODE_PAGE);
    const widthBytes = Math.ceil(image.width / 8);
    const xL = widthBytes & 0xff;
    const xH = (widthBytes >> 8) & 0xff;
    const yL = image.height & 0xff;
    const yH = (image.height >> 8) & 0xff;
    this.push(GS, 0x76, 0x30, 0x00, xL, xH, yL, yH);
    this.pushBytes(image.bytes);
    this.push(LF);
    return this;
  }

  /**
   * Print a line with WD8260 Font A (correct code page for all scripts).
   * Raster fallback only when glyphs are missing from the code pages.
   */
  async lineAuto(
    value: string,
    options: {
      align?: "left" | "center" | "right";
      bold?: boolean;
      fontSize?: number;
      forceRaster?: boolean;
    } = {},
  ): Promise<this> {
    if (!value) {
      this.push(LF);
      return this;
    }
    if (
      !options.forceRaster &&
      this.tryNativeLine(value, {
        align: options.align,
        bold: options.bold,
      })
    ) {
      return this;
    }
    if (needsThermalRaster(value) || hasArabicForEscPos(value) || options.forceRaster) {
      if (options.align) this.align(options.align);
      const image = await rasterizeThermalText(value, {
        align: options.align ?? "left",
        bold: options.bold,
        fontSize: options.fontSize,
        maxWidth: DOTS,
      });
      return this.raster(image);
    }
    if (options.bold) this.bold(true);
    if (options.align) this.align(options.align);
    this.line(value);
    if (options.bold) this.bold(false);
    return this;
  }

  separator(char = "-", width = COLS): this {
    return this.line(char.repeat(width));
  }

  /** Left label + right value on one Font-A line (WD8260 = 48 cols). */
  columns(left: string, right: string, width = COLS): this {
    const encoded = encodeEscPosTicketColumns(left, right, width);
    if (encoded) {
      this.selectCodePage(encoded.codePage);
      this.pushBytes(encoded.bytes);
      this.push(LF);
      this.selectCodePage(DEFAULT_CODE_PAGE);
      return this;
    }
    const leftTrim = left.slice(0, width - 1);
    const rightTrim = right.slice(0, width - leftTrim.length - 1);
    const gap = Math.max(1, width - leftTrim.length - rightTrim.length);
    return this.line(`${leftTrim}${" ".repeat(gap)}${rightTrim}`);
  }

  async columnsAuto(
    left: string,
    right: string,
    options: {
      bold?: boolean;
      fontSize?: number;
      forceRaster?: boolean;
    } = {},
  ): Promise<this> {
    if (!options.forceRaster) {
      const encoded = encodeEscPosTicketColumns(left, right, COLS);
      if (encoded) {
        if (options.bold) this.bold(true);
        this.align("left");
        this.selectCodePage(encoded.codePage);
        this.pushBytes(encoded.bytes);
        this.push(LF);
        if (options.bold) this.bold(false);
        this.selectCodePage(DEFAULT_CODE_PAGE);
        return this;
      }
    }
    if (
      needsThermalRaster(left) ||
      needsThermalRaster(right) ||
      hasArabicForEscPos(left) ||
      hasArabicForEscPos(right) ||
      options.forceRaster
    ) {
      this.align("left");
      const image = await rasterizeThermalColumns(left, right, {
        bold: options.bold,
        fontSize: options.fontSize,
        maxWidth: DOTS,
      });
      return this.raster(image);
    }
    if (options.bold) this.bold(true);
    this.columns(left, right);
    if (options.bold) this.bold(false);
    return this;
  }

  feed(lines = 1): this {
    for (let i = 0; i < lines; i += 1) this.push(LF);
    return this;
  }

  ean13(value: string): this {
    const digits = value.replace(/\D/g, "");
    if (digits.length < 12) return this;
    const payload = digits.slice(0, 13);
    this.selectCodePage(DEFAULT_CODE_PAGE);
    this.align("center");
    this.push(GS, 0x68, 60);
    this.push(GS, 0x77, 2);
    this.push(GS, 0x48, 2);
    this.push(GS, 0x6b, 2);
    this.pushBytes(encodeUtf8(payload.slice(0, 12)));
    this.push(0x00);
    this.push(LF);
    return this;
  }

  cut(): this {
    this.feed(4);
    this.push(GS, 0x56, 0x01);
    return this;
  }

  build(): Uint8Array {
    let total = 0;
    for (const chunk of this.chunks) total += chunk.length;
    const out = new Uint8Array(total);
    let offset = 0;
    for (const chunk of this.chunks) {
      out.set(chunk, offset);
      offset += chunk.length;
    }
    return out;
  }
}

/** Diagnostics label for settings / test ticket. */
export function thermalCodePageSummary(): string {
  const { latinCodePage, arabicCodePage } = THERMAL_PRINTER_PROFILE;
  return `${latinCodePage.label}/${arabicCodePage.label}`;
}

/** @deprecated use thermalCodePageSummary */
export function thermalArabicCodePageLabel(): string {
  return thermalCodePageSummary();
}
