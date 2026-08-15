import { describe, expect, it } from "vitest";

import {
  collectEan13BarRuns,
  computeEan13CheckDigit,
  EAN13_MODULE_COUNT,
  encodeEan13SvgPattern,
  isValidEan13,
} from "@/lib/invoices/barcode";

describe("EAN-13 invoice barcode", () => {
  it("validates check digit and encodes 95 modules", () => {
    const payload = "209000000019";
    const check = computeEan13CheckDigit(payload);
    const value = `${payload}${check}`;
    expect(isValidEan13(value)).toBe(true);

    const pattern = encodeEan13SvgPattern(value);
    expect(pattern).not.toBeNull();
    expect(pattern).toHaveLength(EAN13_MODULE_COUNT);
    expect(pattern!.startsWith("101")).toBe(true);
    expect(pattern!.endsWith("101")).toBe(true);
    expect(pattern!.slice(45, 50)).toBe("01010");
  });

  it("uses exactly 6 right-hand digits (not 7)", () => {
    const value = `209000000019${computeEan13CheckDigit("209000000019")}`;
    const pattern = encodeEan13SvgPattern(value)!;
    // Right data starts at module 50 and spans 42 modules (6×7)
    expect(pattern.slice(50, 92)).toHaveLength(42);
    expect(pattern.slice(92)).toBe("101");
  });

  it("merges consecutive black modules into runs", () => {
    const value = `209000000019${computeEan13CheckDigit("209000000019")}`;
    const pattern = encodeEan13SvgPattern(value)!;
    const runs = collectEan13BarRuns(pattern);
    const covered = runs.reduce((sum, run) => sum + run.moduleCount, 0);
    const ones = [...pattern].filter((bit) => bit === "1").length;
    expect(covered).toBe(ones);
    expect(runs.length).toBeLessThan(ones);
  });
});
