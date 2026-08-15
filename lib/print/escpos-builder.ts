/** Minimal ESC/POS byte builder for 80mm thermal receipts. */

const ESC = 0x1b;
const GS = 0x1d;
const LF = 0x0a;

function encodeUtf8(text: string): Uint8Array {
  return new TextEncoder().encode(text);
}

export class EscPosBuilder {
  private chunks: Uint8Array[] = [];

  private push(...bytes: number[]) {
    this.chunks.push(Uint8Array.from(bytes));
  }

  private pushBytes(bytes: Uint8Array) {
    this.chunks.push(bytes);
  }

  init(): this {
    this.push(ESC, 0x40); // ESC @
    // UTF-8 / international text — works on most modern 80mm clones
    this.push(ESC, 0x74, 0x00);
    this.push(ESC, 0x52, 0x00); // international character set USA
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

  text(value: string): this {
    this.pushBytes(encodeUtf8(value));
    return this;
  }

  line(value = ""): this {
    if (value) this.text(value);
    this.push(LF);
    return this;
  }

  separator(char = "-", width = 32): this {
    return this.line(char.repeat(width));
  }

  /** Left label + right value on one 32-char line (80mm ~42 cols; keep conservative). */
  columns(left: string, right: string, width = 32): this {
    const leftTrim = left.slice(0, width - 1);
    const rightTrim = right.slice(0, width - leftTrim.length - 1);
    const gap = Math.max(1, width - leftTrim.length - rightTrim.length);
    return this.line(`${leftTrim}${" ".repeat(gap)}${rightTrim}`);
  }

  feed(lines = 1): this {
    for (let i = 0; i < lines; i += 1) this.push(LF);
    return this;
  }

  /**
   * EAN-13 barcode. Value should be 12 or 13 digits.
   * Printer computes checksum when 12 digits are sent.
   */
  ean13(value: string): this {
    const digits = value.replace(/\D/g, "");
    if (digits.length < 12) return this;
    const payload = digits.slice(0, 13);
    this.align("center");
    this.push(GS, 0x68, 60); // height
    this.push(GS, 0x77, 2); // module width
    this.push(GS, 0x48, 2); // HRI below
    this.push(GS, 0x6b, 2); // EAN13
    this.pushBytes(encodeUtf8(payload.slice(0, 12)));
    this.push(0x00);
    this.push(LF);
    return this;
  }

  cut(): this {
    this.feed(3);
    this.push(GS, 0x56, 0x00); // full cut
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
