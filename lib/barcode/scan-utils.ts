/**
 * Shared barcode scan primitives — validation, formats, errors, detector typing.
 * No React / camera I/O here.
 */

export type BarcodeCornerPoint = { x: number; y: number };

export type BarcodeBoundingBox = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type BarcodeDetectorResult = {
  rawValue: string;
  format?: string;
  cornerPoints?: BarcodeCornerPoint[];
  boundingBox?: BarcodeBoundingBox;
};

export type BarcodeDetectorShape = {
  detect: (source: CanvasImageSource) => Promise<BarcodeDetectorResult[]>;
};

export const DETECT_FORMATS = [
  "qr_code",
  "data_matrix",
  "aztec",
  "pdf417",
  "ean_13",
  "ean_8",
  "code_128",
  "code_39",
  "code_93",
  "codabar",
  "itf",
  "upc_a",
  "upc_e",
] as const;

export type DetectFormat = (typeof DETECT_FORMATS)[number];

export const TWO_D_FORMATS = new Set<string>([
  "qr_code",
  "data_matrix",
  "aztec",
  "pdf417",
]);

/** Formats where the detector claims a retail EAN/UPC symbology. */
export const EAN_UPC_FORMATS = new Set<string>([
  "ean_13",
  "ean_8",
  "upc_a",
  "upc_e",
]);

/** Default: decode at most ~11×/s — not every animation frame. */
export const CAMERA_DETECT_INTERVAL_MS = 90;

/** After accept (continuous mode), barcode must leave view this long to rearm. */
export const SCAN_REARM_ABSENT_MS = 450;

/** Ignore identical accepted value for this long even if rearmed (double-beep guard). */
export const SCAN_COOLDOWN_MS = 900;

export type ScanEngineConfig = {
  detectIntervalMs: number;
  rearmAbsentMs: number;
  cooldownMs: number;
};

export const DEFAULT_SCAN_ENGINE_CONFIG: ScanEngineConfig = {
  detectIntervalMs: CAMERA_DETECT_INTERVAL_MS,
  rearmAbsentMs: SCAN_REARM_ABSENT_MS,
  cooldownMs: SCAN_COOLDOWN_MS,
};

export function computeEanCheckDigit(payload: string): number | null {
  if (!/^\d+$/.test(payload)) return null;
  let sum = 0;
  const reversed = payload.split("").reverse();
  for (let i = 0; i < reversed.length; i += 1) {
    const digit = Number(reversed[i]);
    const weight = i % 2 === 0 ? 3 : 1;
    sum += digit * weight;
  }
  return (10 - (sum % 10)) % 10;
}

export function isValidEanLike(raw: string): boolean {
  if (!/^\d+$/.test(raw)) return false;
  if (raw.length !== 8 && raw.length !== 12 && raw.length !== 13) return false;
  const payload = raw.slice(0, -1);
  const check = Number(raw.at(-1));
  const expected = computeEanCheckDigit(payload);
  return expected != null && check === expected;
}

export function normalizeScannedValue(raw: string): string {
  return raw.trim().replace(/\s+/g, "");
}

export function isLikelyTwoDValue(raw: string): boolean {
  return raw.length > 0 && raw.length <= 4096;
}

/**
 * Permissive 1D check for store / Code-128 style codes.
 * Does NOT require EAN checksum — use {@link isValidEanLike} when format is EAN/UPC.
 */
export function isLikelyOneDValue(raw: string): boolean {
  if (!raw) return false;
  if (/^\d+$/.test(raw)) {
    return raw.length >= 4 && raw.length <= 32;
  }
  return /^[A-Za-z0-9\-_.+/ ]{3,64}$/.test(raw);
}

/**
 * Accepts detector results without blocking legitimate internal store barcodes.
 * Hard checksum only when the decoder labels the symbology as EAN/UPC.
 */
export function validateScannedCandidate(
  raw: string,
  format?: string,
): boolean {
  const value = normalizeScannedValue(raw);
  if (!value) return false;

  if (format && TWO_D_FORMATS.has(format)) {
    return isLikelyTwoDValue(value);
  }

  if (format && EAN_UPC_FORMATS.has(format)) {
    // UPC-E payloads are often short; accept plausible lengths without hard reject.
    if (format === "upc_e" && /^\d{6,8}$/.test(value)) return true;
    return isValidEanLike(value);
  }

  return isLikelyOneDValue(value) || isLikelyTwoDValue(value);
}

export function formatBarcodeLabel(format?: string): string {
  if (!format) return "";
  const map: Record<string, string> = {
    qr_code: "QR",
    data_matrix: "Data Matrix",
    aztec: "Aztec",
    pdf417: "PDF417",
    ean_13: "EAN-13",
    ean_8: "EAN-8",
    upc_a: "UPC-A",
    upc_e: "UPC-E",
    code_128: "Code 128",
    code_39: "Code 39",
    code_93: "Code 93",
    codabar: "Codabar",
    itf: "ITF",
  };
  return map[format] ?? format.replace(/_/g, " ").toUpperCase();
}

/** Map @zxing/library BarcodeFormat enum → BarcodeDetector format ids. */
export function zxingFormatToDetectorFormat(
  fmt: number | undefined,
): string | undefined {
  if (fmt == null) return undefined;
  switch (fmt) {
    case 0:
      return "aztec"; // AZTEC
    case 1:
      return "codabar";
    case 2:
      return "code_39";
    case 3:
      return "code_93";
    case 4:
      return "code_128";
    case 5:
      return "data_matrix";
    case 6:
      return "ean_8";
    case 7:
      return "ean_13";
    case 8:
      return "itf";
    case 10:
      return "pdf417";
    case 11:
      return "qr_code";
    case 14:
      return "upc_a";
    case 15:
      return "upc_e";
    default:
      return undefined;
  }
}

export type CameraErrorMessages = {
  insecureContext: string;
  generic: string;
  notAllowed: string;
  notFound: string;
  notReadable: string;
};

export function cameraErrorMessage(
  error: unknown,
  messages: CameraErrorMessages,
): string {
  if (typeof window !== "undefined" && !window.isSecureContext) {
    return messages.insecureContext;
  }
  if (!error || typeof error !== "object") {
    return messages.generic;
  }
  const name = (error as { name?: string }).name;
  if (name === "NotAllowedError" || name === "SecurityError") {
    return messages.notAllowed;
  }
  if (name === "NotFoundError" || name === "OverconstrainedError") {
    return messages.notFound;
  }
  if (name === "NotReadableError") {
    return messages.notReadable;
  }
  return messages.generic;
}

export function getBarcodeDetectorCtor():
  | (new (opts: { formats: string[] }) => BarcodeDetectorShape)
  | null {
  if (typeof window === "undefined") return null;
  const Ctor = (
    window as unknown as {
      BarcodeDetector?: new (opts: {
        formats: string[];
      }) => BarcodeDetectorShape;
    }
  ).BarcodeDetector;
  return Ctor ?? null;
}

export function prefersReducedMotion(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export type LastDetection = {
  value: string;
  format?: string;
  cornerPoints?: BarcodeCornerPoint[];
  boundingBox?: BarcodeBoundingBox;
  /** Video intrinsic size when corners/box were measured (for overlay mapping). */
  sourceWidth: number;
  sourceHeight: number;
  at: number;
};
