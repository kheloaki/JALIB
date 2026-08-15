/** ~1.1 MB base64 string ≈ ~850 KB binaire — objectif pour rester sous quota localStorage. */
const MAX_DATA_URL_CHARS = 1_150_000;
const DEFAULT_MAX_EDGE = 1200;
const INITIAL_QUALITY = 0.82;

export type CompressedPhotoResult = {
  dataUrl: string;
  originalBytes: number;
  compressedBytes: number;
  format: "webp" | "jpeg";
  /** True when Tinify API produced the result. */
  tinify: boolean;
};

export function formatImageBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return "—";
  if (bytes < 1024) return `${Math.round(bytes)} o`;
  if (bytes < 1024 * 1024) {
    const kb = bytes / 1024;
    return `${kb < 10 ? kb.toFixed(1) : Math.round(kb)} Ko`;
  }
  const mb = bytes / (1024 * 1024);
  return `${mb < 10 ? mb.toFixed(2) : Math.round(mb)} Mo`;
}

/** Approximate binary size of a data URL. */
export function estimateDataUrlBytes(dataUrl: string): number | null {
  const trimmed = dataUrl.trim();
  if (!trimmed.startsWith("data:")) return null;
  const comma = trimmed.indexOf(",");
  if (comma < 0) return null;
  const meta = trimmed.slice(0, comma);
  const payload = trimmed.slice(comma + 1);
  if (meta.includes(";base64")) {
    const padding = payload.endsWith("==") ? 2 : payload.endsWith("=") ? 1 : 0;
    return Math.max(0, Math.floor((payload.length * 3) / 4) - padding);
  }
  try {
    return new TextEncoder().encode(decodeURIComponent(payload)).length;
  } catch {
    return payload.length;
  }
}

function detectImageFormat(
  src: string,
): "webp" | "jpeg" | "png" | "other" {
  const s = src.trim().toLowerCase();
  if (s.startsWith("data:image/webp") || s.includes(".webp")) return "webp";
  if (
    s.startsWith("data:image/jpeg") ||
    s.startsWith("data:image/jpg") ||
    s.includes(".jpg") ||
    s.includes(".jpeg")
  ) {
    return "jpeg";
  }
  if (s.startsWith("data:image/png") || s.includes(".png")) return "png";
  return "other";
}

/**
 * Resolve stored image size for edit UI: data URLs locally, remote via HEAD/GET.
 */
export async function resolveImageByteSize(
  src: string,
): Promise<{ bytes: number; format: "webp" | "jpeg" | "png" | "other" } | null> {
  const trimmed = src.trim();
  if (!trimmed || trimmed.startsWith("/product-placeholder")) return null;

  const format = detectImageFormat(trimmed);

  if (trimmed.startsWith("data:")) {
    const bytes = estimateDataUrlBytes(trimmed);
    if (bytes == null) return null;
    return { bytes, format };
  }

  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    try {
      const head = await fetch(trimmed, { method: "HEAD", mode: "cors" });
      const len = head.headers.get("content-length");
      if (head.ok && len) {
        const bytes = Number(len);
        if (Number.isFinite(bytes) && bytes > 0) {
          return { bytes, format };
        }
      }
    } catch {
      // fall through to GET
    }
    try {
      const res = await fetch(trimmed, { method: "GET", mode: "cors" });
      if (!res.ok) return null;
      const blob = await res.blob();
      if (blob.size > 0) {
        return { bytes: blob.size, format };
      }
    } catch {
      return null;
    }
  }

  return null;
}

function loadImageElement(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Impossible de lire l’image."));
    };
    img.src = url;
  });
}

async function bitmapFromFile(file: File): Promise<ImageBitmap | HTMLImageElement> {
  try {
    if (typeof createImageBitmap === "function") {
      return await createImageBitmap(file);
    }
  } catch {
    // fallback below
  }
  return loadImageElement(file);
}

function drawScaled(
  source: ImageBitmap | HTMLImageElement,
  maxEdge: number,
): HTMLCanvasElement {
  const w =
    source instanceof HTMLImageElement
      ? source.naturalWidth || source.width
      : source.width;
  const h =
    source instanceof HTMLImageElement
      ? source.naturalHeight || source.height
      : source.height;
  if (w <= 0 || h <= 0) throw new Error("Dimensions d’image invalides.");

  let tw = w;
  let th = h;
  if (w > maxEdge || h > maxEdge) {
    if (w >= h) {
      tw = maxEdge;
      th = Math.max(1, Math.round((h * maxEdge) / w));
    } else {
      th = maxEdge;
      tw = Math.max(1, Math.round((w * maxEdge) / h));
    }
  }

  const canvas = document.createElement("canvas");
  canvas.width = tw;
  canvas.height = th;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas indisponible.");
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(source, 0, 0, tw, th);
  return canvas;
}

function canvasToJpegBlob(
  canvas: HTMLCanvasElement,
  quality: number,
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) reject(new Error("Compression locale impossible."));
        else resolve(blob);
      },
      "image/jpeg",
      quality,
    );
  });
}

async function compressLocally(
  file: File,
  maxEdge: number,
  originalBytes: number,
): Promise<CompressedPhotoResult> {
  const source = await bitmapFromFile(file);
  try {
    let edge = maxEdge;
    let canvas = drawScaled(source, edge);
    let quality = INITIAL_QUALITY;
    let dataUrl = canvas.toDataURL("image/jpeg", quality);

    const shrink = () => {
      edge = Math.max(480, Math.floor(edge * 0.85));
      canvas = drawScaled(source, edge);
    };

    while (dataUrl.length > MAX_DATA_URL_CHARS && quality > 0.48) {
      quality -= 0.06;
      dataUrl = canvas.toDataURL("image/jpeg", quality);
    }
    while (dataUrl.length > MAX_DATA_URL_CHARS && edge > 480) {
      shrink();
      quality = Math.min(quality + 0.04, INITIAL_QUALITY);
      dataUrl = canvas.toDataURL("image/jpeg", quality);
      while (dataUrl.length > MAX_DATA_URL_CHARS && quality > 0.45) {
        quality -= 0.05;
        dataUrl = canvas.toDataURL("image/jpeg", quality);
      }
    }

    if (dataUrl.length > MAX_DATA_URL_CHARS) {
      throw new Error(
        "Photo trop lourde après compression. Essayez une autre image ou un cadrage plus serré.",
      );
    }

    const compressedBytes =
      estimateDataUrlBytes(dataUrl) ?? Math.round(dataUrl.length * 0.75);

    return {
      dataUrl,
      originalBytes,
      compressedBytes,
      format: "jpeg",
      tinify: false,
    };
  } finally {
    if (source instanceof ImageBitmap) {
      source.close();
    }
  }
}

async function tinifyViaApi(
  blob: Blob,
  originalBytes: number,
  filename = "photo.jpg",
): Promise<CompressedPhotoResult | null> {
  try {
    const form = new FormData();
    form.append("file", blob, filename);
    const res = await fetch("/api/compress-image", {
      method: "POST",
      body: form,
    });
    if (res.status === 503) {
      // Key not configured — silent fallback to local JPEG.
      return null;
    }
    if (!res.ok) {
      const body = (await res.json().catch(() => null)) as {
        message?: string;
      } | null;
      throw new Error(
        body?.message ?? "Compression Tinify impossible. Réessayez.",
      );
    }
    const body = (await res.json()) as {
      dataUrl?: string;
      originalBytes?: number;
      compressedBytes?: number;
      format?: "webp" | "jpeg";
      tinify?: boolean;
    };
    if (!body.dataUrl) {
      throw new Error("Réponse de compression invalide.");
    }
    if (body.dataUrl.length > MAX_DATA_URL_CHARS) {
      throw new Error(
        "Photo encore trop lourde après Tinify. Essayez un cadrage plus serré.",
      );
    }
    return {
      dataUrl: body.dataUrl,
      originalBytes: body.originalBytes ?? originalBytes,
      compressedBytes:
        body.compressedBytes ??
        estimateDataUrlBytes(body.dataUrl) ??
        Math.round(body.dataUrl.length * 0.75),
      format: body.format === "jpeg" ? "jpeg" : "webp",
      tinify: body.tinify !== false,
    };
  } catch (error) {
    if (error instanceof Error && error.message.includes("Tinify")) {
      throw error;
    }
    // Network / unexpected — try local fallback.
    console.warn("Tinify compress failed, falling back to local JPEG", error);
    return null;
  }
}

/**
 * Auto-compress on upload: Tinify → WebP when TINIFY_API_KEY is set,
 * otherwise local JPEG resize. Returns data URL + byte sizes for the UI.
 */
export async function compressProductPhotoFile(
  file: File,
  options?: { maxEdge?: number },
): Promise<CompressedPhotoResult> {
  if (!file.type.startsWith("image/")) {
    throw new Error("Choisissez un fichier image (JPEG, PNG, WebP…).");
  }

  const originalBytes = file.size;
  const maxEdge = options?.maxEdge ?? DEFAULT_MAX_EDGE;

  // Downscale client-side first to cut Tinify bandwidth / cost.
  const source = await bitmapFromFile(file);
  let preBlob: Blob;
  try {
    const canvas = drawScaled(source, maxEdge);
    preBlob = await canvasToJpegBlob(canvas, 0.92);
  } finally {
    if (source instanceof ImageBitmap) {
      source.close();
    }
  }

  const tinified = await tinifyViaApi(preBlob, originalBytes, "photo.jpg");
  if (tinified) return tinified;

  // Fallback: local JPEG from the already-scaled canvas path.
  return compressLocally(
    new File([preBlob], "photo.jpg", { type: "image/jpeg" }),
    maxEdge,
    originalBytes,
  );
}
