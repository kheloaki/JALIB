import { describe, expect, it } from "vitest";

import {
  hasArabicLetters,
  hasArabicPresentationForms,
  needsArabicPdfFont,
  shapeArabicForPdf,
  splitPdfScriptRuns,
} from "@/lib/pdf/pdf-text";

describe("pdf arabic font detection", () => {
  it("detects unshaped Arabic letters", () => {
    expect(hasArabicLetters("1 U زيت")).toBe(true);
    expect(needsArabicPdfFont("1 U زيت")).toBe(true);
  });

  it("keeps Arabic font for already-shaped presentation forms", () => {
    const shaped = shapeArabicForPdf("زيت");
    expect(hasArabicLetters(shaped)).toBe(false);
    expect(hasArabicPresentationForms(shaped)).toBe(true);
    expect(needsArabicPdfFont(shaped)).toBe(true);
    // Must not double-shape into garbage.
    expect(shapeArabicForPdf(shaped)).toBe(shaped);
  });

  it("shapes only Arabic runs inside mixed qty + name strings", () => {
    const shaped = shapeArabicForPdf("20 U سكر");
    expect(shaped.startsWith("20 U ")).toBe(true);
    expect(hasArabicPresentationForms(shaped)).toBe(true);
    expect(hasArabicLetters(shaped)).toBe(false);
  });

  it("keeps Arabic + plain qty (no punctuation) fully shaped", () => {
    const shaped = shapeArabicForPdf("سكر 20");
    expect(hasArabicPresentationForms(shaped)).toBe(true);
    expect(shaped.endsWith(" 20")).toBe(true);
    expect(hasArabicLetters(shaped)).toBe(false);
  });

  it("splits Arabic and Latin/punctuation into separate runs", () => {
    const runs = splitPdfScriptRuns("منتج (خاص)");
    expect(runs.map((r) => r.text).join("")).toBe("منتج (خاص)");
    expect(runs.some((r) => r.arabic && r.text.includes("منتج"))).toBe(true);
    expect(runs.some((r) => !r.arabic && r.text.includes("("))).toBe(true);
  });

  it("treats pure latin as latin", () => {
    expect(needsArabicPdfFont("1 U 330 ml")).toBe(false);
    expect(needsArabicPdfFont("02/08/2026")).toBe(false);
  });
});
