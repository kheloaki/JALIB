import type { BarcodeDetectorResult } from "@/lib/barcode/scan-utils";

/** Transforms tried when the live video frame does not decode. */
export type BarcodeDetectVariant =
  | "normal"
  | "mirrorX"
  | "mirrorY"
  | "rotate180"
  | "invert"
  | "mirrorXInvert"
  | "rotate90"
  | "rotate270";

/** Extra passes after a failed normal detect (rotated across frames for speed). */
export const BARCODE_DETECT_VARIANTS: Exclude<
  BarcodeDetectVariant,
  "normal"
>[] = [
  "mirrorX",
  "mirrorY",
  "rotate180",
  "invert",
  "mirrorXInvert",
  "rotate90",
  "rotate270",
];

type DetectorLike = {
  detect: (source: CanvasImageSource) => Promise<BarcodeDetectorResult[]>;
};

/** Draw a flipped / rotated / inverted frame for a second-pass decode. */
export function paintBarcodeVideoVariant(
  video: HTMLVideoElement,
  canvas: HTMLCanvasElement,
  variant: Exclude<BarcodeDetectVariant, "normal">,
): boolean {
  const w = video.videoWidth;
  const h = video.videoHeight;
  if (w < 2 || h < 2) return false;

  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return false;

  const sideways = variant === "rotate90" || variant === "rotate270";
  canvas.width = sideways ? h : w;
  canvas.height = sideways ? w : h;

  ctx.save();
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  switch (variant) {
    case "mirrorX":
      ctx.translate(w, 0);
      ctx.scale(-1, 1);
      ctx.drawImage(video, 0, 0, w, h);
      break;
    case "mirrorY":
      ctx.translate(0, h);
      ctx.scale(1, -1);
      ctx.drawImage(video, 0, 0, w, h);
      break;
    case "rotate180":
      ctx.translate(w, h);
      ctx.rotate(Math.PI);
      ctx.drawImage(video, 0, 0, w, h);
      break;
    case "invert":
      ctx.drawImage(video, 0, 0, w, h);
      ctx.globalCompositeOperation = "difference";
      ctx.fillStyle = "#fff";
      ctx.fillRect(0, 0, w, h);
      ctx.globalCompositeOperation = "source-over";
      break;
    case "mirrorXInvert":
      ctx.translate(w, 0);
      ctx.scale(-1, 1);
      ctx.drawImage(video, 0, 0, w, h);
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.globalCompositeOperation = "difference";
      ctx.fillStyle = "#fff";
      ctx.fillRect(0, 0, w, h);
      ctx.globalCompositeOperation = "source-over";
      break;
    case "rotate90":
      ctx.translate(h, 0);
      ctx.rotate(Math.PI / 2);
      ctx.drawImage(video, 0, 0, w, h);
      break;
    case "rotate270":
      ctx.translate(0, w);
      ctx.rotate(-Math.PI / 2);
      ctx.drawImage(video, 0, 0, w, h);
      break;
  }

  ctx.restore();
  return true;
}

/**
 * Detect barcode on the live frame, then one flipped/rotated/inverted
 * variant (round-robin) so mirrored or upside-down codes still scan.
 */
export async function detectBarcodeWithVariants(
  detector: DetectorLike,
  video: HTMLVideoElement,
  canvas: HTMLCanvasElement,
  variantCursor: number,
): Promise<{
  results: BarcodeDetectorResult[];
  variant: BarcodeDetectVariant;
  nextCursor: number;
}> {
  try {
    const normal = await detector.detect(video);
    if (normal.length > 0) {
      return { results: normal, variant: "normal", nextCursor: variantCursor };
    }
  } catch {
    /* try variants */
  }

  const list = BARCODE_DETECT_VARIANTS;
  const variant = list[variantCursor % list.length]!;
  const nextCursor = variantCursor + 1;

  if (!paintBarcodeVideoVariant(video, canvas, variant)) {
    return { results: [], variant, nextCursor };
  }

  try {
    const results = await detector.detect(canvas);
    return { results, variant, nextCursor };
  } catch {
    return { results: [], variant, nextCursor };
  }
}
