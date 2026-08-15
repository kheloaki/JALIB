"use client";

import {
  collectEan13BarRuns,
  encodeEan13SvgPattern,
  normalizeInvoiceBarcode,
} from "@/lib/invoices/barcode";

type InvoiceBarcodeProps = {
  value: string;
  className?: string;
  size?: "sm" | "md";
};

const BARCODE_PRESETS = {
  sm: {
    moduleWidth: 2,
    barHeight: 36,
    fontSize: 11,
    quietZone: 8,
    textGap: 12,
    guardExtra: 8,
  },
  md: {
    moduleWidth: 2,
    barHeight: 64,
    fontSize: 13,
    quietZone: 10,
    textGap: 14,
    guardExtra: 10,
  },
} as const;

export function InvoiceBarcode({
  value,
  className,
  size = "md",
}: InvoiceBarcodeProps) {
  const barcode = normalizeInvoiceBarcode(value);
  const pattern = encodeEan13SvgPattern(barcode);

  if (!pattern) return null;

  const preset = BARCODE_PRESETS[size];
  const { moduleWidth, barHeight, fontSize, quietZone, textGap, guardExtra } =
    preset;
  const runs = collectEan13BarRuns(pattern);
  const barsWidth = pattern.length * moduleWidth;
  const width = quietZone * 2 + barsWidth;
  const height = barHeight + guardExtra + textGap + fontSize;
  const textY = barHeight + guardExtra + textGap;

  // Standard EAN-13 HRI: leading digit | left 6 | right 6
  const leading = barcode[0]!;
  const leftGroup = barcode.slice(1, 7);
  const rightGroup = barcode.slice(7, 13);
  const leftTextX = quietZone + (3 + 21) * moduleWidth; // mid left data
  const rightTextX = quietZone + (3 + 42 + 5 + 21) * moduleWidth; // mid right data
  const leadingX = Math.max(fontSize * 0.35, quietZone * 0.45);

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      width={width}
      height={height}
      className={className}
      role="img"
      aria-label={`Code-barres facture ${barcode}`}
      shapeRendering="crispEdges"
      preserveAspectRatio="xMidYMid meet"
    >
      {runs.map((run) => (
        <rect
          key={run.startModule}
          x={quietZone + run.startModule * moduleWidth}
          y={0}
          width={run.moduleCount * moduleWidth}
          height={run.isGuard ? barHeight + guardExtra : barHeight}
          fill="currentColor"
        />
      ))}
      <text
        x={leadingX}
        y={textY}
        textAnchor="middle"
        fontSize={fontSize}
        fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace"
        fill="currentColor"
      >
        {leading}
      </text>
      <text
        x={leftTextX}
        y={textY}
        textAnchor="middle"
        fontSize={fontSize}
        fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace"
        letterSpacing={moduleWidth * 0.35}
        fill="currentColor"
      >
        {leftGroup}
      </text>
      <text
        x={rightTextX}
        y={textY}
        textAnchor="middle"
        fontSize={fontSize}
        fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace"
        letterSpacing={moduleWidth * 0.35}
        fill="currentColor"
      >
        {rightGroup}
      </text>
    </svg>
  );
}
