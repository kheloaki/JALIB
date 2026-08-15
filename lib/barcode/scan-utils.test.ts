import { describe, expect, it } from "vitest";

import {
  createScanGate,
  noteScanAbsence,
  noteScanPresence,
  resetScanGate,
} from "@/lib/barcode/scan-gate";
import {
  computeEanCheckDigit,
  formatBarcodeLabel,
  isValidEanLike,
  normalizeScannedValue,
  validateScannedCandidate,
  zxingFormatToDetectorFormat,
} from "@/lib/barcode/scan-utils";

describe("normalizeScannedValue", () => {
  it("trims and strips spaces", () => {
    expect(normalizeScannedValue("  123 456  ")).toBe("123456");
  });

  it("returns empty for blank", () => {
    expect(normalizeScannedValue("   ")).toBe("");
  });
});

describe("EAN checksum", () => {
  it("validates a known EAN-13", () => {
    // 5901234123457 — classic test vector with valid check digit 7
    expect(isValidEanLike("5901234123457")).toBe(true);
  });

  it("rejects wrong check digit", () => {
    expect(isValidEanLike("5901234123450")).toBe(false);
  });

  it("computes check digit", () => {
    expect(computeEanCheckDigit("590123412345")).toBe(7);
  });
});

describe("validateScannedCandidate", () => {
  it("accepts internal numeric store codes without EAN checksum when format unknown", () => {
    expect(validateScannedCandidate("123456789012")).toBe(true);
  });

  it("requires checksum for labeled ean_13", () => {
    expect(validateScannedCandidate("5901234123457", "ean_13")).toBe(true);
    expect(validateScannedCandidate("5901234123450", "ean_13")).toBe(false);
  });

  it("accepts QR payloads", () => {
    expect(
      validateScannedCandidate("https://example.com/p/1", "qr_code"),
    ).toBe(true);
  });

  it("accepts Code 128 alphanumeric", () => {
    expect(validateScannedCandidate("SKU-AB_12", "code_128")).toBe(true);
  });

  it("accepts short upc_e digits", () => {
    expect(validateScannedCandidate("123456", "upc_e")).toBe(true);
  });
});

describe("scan gate — duplicate / rearm", () => {
  const config = { rearmAbsentMs: 450, cooldownMs: 900 };

  it("accepts first scan then ignores while disarmed", () => {
    const gate = createScanGate();
    const a = noteScanPresence(gate, "AAA", 1000, config, true);
    expect(a).toEqual({ action: "accept", value: "AAA" });
    const b = noteScanPresence(gate, "AAA", 1100, config, true);
    expect(b.action).toBe("ignore_disarmed");
  });

  it("rearms after absence window", () => {
    const gate = createScanGate();
    noteScanPresence(gate, "AAA", 1000, config, true);
    expect(noteScanAbsence(gate, 1200, config, true)).toBe(false);
    expect(noteScanAbsence(gate, 1600, config, true)).toBe(true);
    expect(gate.armed).toBe(true);
    const next = noteScanPresence(gate, "BBB", 1700, config, true);
    expect(next).toEqual({ action: "accept", value: "BBB" });
  });

  it("cooldown blocks same value even if rearmed early", () => {
    const gate = createScanGate();
    noteScanPresence(gate, "AAA", 1000, config, true);
    noteScanAbsence(gate, 1600, config, true);
    const again = noteScanPresence(gate, "AAA", 1700, config, true);
    expect(again.action).toBe("ignore_cooldown");
  });

  it("single-shot mode stays armed but still cools down", () => {
    const gate = createScanGate();
    const a = noteScanPresence(gate, "AAA", 1000, config, false);
    expect(a.action).toBe("accept");
    expect(gate.armed).toBe(true);
    const b = noteScanPresence(gate, "AAA", 1100, config, false);
    expect(b.action).toBe("ignore_cooldown");
  });

  it("reset clears state", () => {
    const gate = createScanGate();
    noteScanPresence(gate, "AAA", 1000, config, true);
    resetScanGate(gate);
    expect(gate.armed).toBe(true);
    expect(gate.lastAcceptedValue).toBeNull();
  });
});

describe("format helpers", () => {
  it("labels formats", () => {
    expect(formatBarcodeLabel("ean_13")).toBe("EAN-13");
    expect(formatBarcodeLabel("qr_code")).toBe("QR");
  });

  it("maps zxing format enums", () => {
    expect(zxingFormatToDetectorFormat(11)).toBe("qr_code");
    expect(zxingFormatToDetectorFormat(7)).toBe("ean_13");
    expect(zxingFormatToDetectorFormat(4)).toBe("code_128");
  });
});
