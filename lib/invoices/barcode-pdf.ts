import type { jsPDF } from "jspdf";

import {
  collectEan13BarRuns,
  encodeEan13SvgPattern,
  normalizeInvoiceBarcode,
} from "@/lib/invoices/barcode";

function drawEan13Bars(
  doc: jsPDF,
  pattern: string,
  xLeft: number,
  yTop: number,
  moduleWidthMm: number,
  barHeightMm: number,
  guardExtraMm: number,
) {
  doc.setFillColor(0, 0, 0);
  for (const run of collectEan13BarRuns(pattern)) {
    doc.rect(
      xLeft + run.startModule * moduleWidthMm,
      yTop,
      run.moduleCount * moduleWidthMm,
      run.isGuard ? barHeightMm + guardExtraMm : barHeightMm,
      "F",
    );
  }
}

/** Draw a compact EAN-13 barcode aligned to the right edge (xRight). Returns bottom Y. */
export function drawCompactEan13BarcodePdf(
  doc: jsPDF,
  raw: string,
  xRight: number,
  yTop: number,
): number {
  const barcode = normalizeInvoiceBarcode(raw);
  const pattern = encodeEan13SvgPattern(barcode);
  if (!pattern) return yTop;

  const moduleWidthMm = 0.25;
  const barHeightMm = 7;
  const quietZoneMm = 1.4;
  const guardExtraMm = 0.8;
  const totalWidthMm = quietZoneMm * 2 + pattern.length * moduleWidthMm;
  const xLeft = xRight - totalWidthMm;

  drawEan13Bars(
    doc,
    pattern,
    xLeft + quietZoneMm,
    yTop,
    moduleWidthMm,
    barHeightMm,
    guardExtraMm,
  );

  doc.setFont("courier", "normal");
  doc.setFontSize(6);
  doc.setTextColor(71, 85, 105);
  doc.text(barcode, xRight - totalWidthMm / 2, yTop + barHeightMm + 2.8, {
    align: "center",
  });

  return yTop + barHeightMm + 4.5;
}

/** Receipt barcode at scannable module width (not stretched to full ticket). */
export function drawReceiptEan13BarcodePdf(
  doc: jsPDF,
  raw: string,
  centerX: number,
  yTop: number,
  contentWidthMm: number,
): number {
  const barcode = normalizeInvoiceBarcode(raw);
  const pattern = encodeEan13SvgPattern(barcode);
  if (!pattern) return yTop;

  const quietZoneMm = 1.2;
  const maxDrawable = Math.max(20, contentWidthMm - quietZoneMm * 2);
  // Keep modules ≥ 0.28mm so thermal/PDF stays scannable
  const moduleWidthMm = Math.min(0.33, maxDrawable / pattern.length);
  const barHeightMm = 12;
  const guardExtraMm = 1.2;
  const barsWidthMm = pattern.length * moduleWidthMm;
  const xLeft = centerX - barsWidthMm / 2;

  drawEan13Bars(
    doc,
    pattern,
    xLeft,
    yTop,
    moduleWidthMm,
    barHeightMm,
    guardExtraMm,
  );

  doc.setFont("courier", "normal");
  doc.setFontSize(7);
  doc.setTextColor(0, 0, 0);
  doc.text(barcode, centerX, yTop + barHeightMm + 3.2, { align: "center" });

  return yTop + barHeightMm + 5;
}
