import { NextResponse } from "next/server";

export const runtime = "nodejs";

const MAX_UPLOAD_BYTES = 12 * 1024 * 1024;

function tinifyAuthHeader(apiKey: string): string {
  return `Basic ${Buffer.from(`api:${apiKey}`).toString("base64")}`;
}

/**
 * Shrink + convert to WebP via Tinify.
 * Env: TINIFY_API_KEY (server-only, never NEXT_PUBLIC_).
 */
export async function POST(request: Request) {
  const apiKey = process.env.TINIFY_API_KEY?.trim();
  if (!apiKey) {
    return NextResponse.json(
      {
        error: "TINIFY_API_KEY_MISSING",
        message:
          "Ajoutez TINIFY_API_KEY dans .env.local puis redémarrez le serveur.",
      },
      { status: 503 },
    );
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json(
      { error: "INVALID_BODY", message: "Formulaire image invalide." },
      { status: 400 },
    );
  }

  const file = form.get("file");
  if (!(file instanceof File) || file.size <= 0) {
    return NextResponse.json(
      { error: "NO_FILE", message: "Aucun fichier image reçu." },
      { status: 400 },
    );
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    return NextResponse.json(
      {
        error: "TOO_LARGE",
        message: "Image trop lourde (max 12 Mo avant compression).",
      },
      { status: 413 },
    );
  }

  const originalBytes = file.size;
  const inputBuffer = Buffer.from(await file.arrayBuffer());
  const auth = tinifyAuthHeader(apiKey);

  const shrinkRes = await fetch("https://api.tinify.com/shrink", {
    method: "POST",
    headers: {
      Authorization: auth,
      "Content-Type": file.type || "application/octet-stream",
    },
    body: inputBuffer,
  });

  if (!shrinkRes.ok) {
    const detail = await shrinkRes.text().catch(() => "");
    console.error("Tinify shrink failed", shrinkRes.status, detail);
    return NextResponse.json(
      {
        error: "TINIFY_SHRINK_FAILED",
        message:
          shrinkRes.status === 401
            ? "Clé Tinify invalide."
            : "Compression Tinify impossible. Réessayez.",
      },
      { status: 502 },
    );
  }

  const location = shrinkRes.headers.get("Location");
  if (!location) {
    return NextResponse.json(
      {
        error: "TINIFY_NO_LOCATION",
        message: "Réponse Tinify incomplète.",
      },
      { status: 502 },
    );
  }

  const convertRes = await fetch(location, {
    method: "POST",
    headers: {
      Authorization: auth,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ convert: { type: "image/webp" } }),
  });

  if (!convertRes.ok) {
    const detail = await convertRes.text().catch(() => "");
    console.error("Tinify convert failed", convertRes.status, detail);
    return NextResponse.json(
      {
        error: "TINIFY_CONVERT_FAILED",
        message: "Conversion WebP Tinify impossible.",
      },
      { status: 502 },
    );
  }

  const outBuffer = Buffer.from(await convertRes.arrayBuffer());
  const compressedBytes = outBuffer.length;
  const dataUrl = `data:image/webp;base64,${outBuffer.toString("base64")}`;

  return NextResponse.json({
    dataUrl,
    originalBytes,
    compressedBytes,
    format: "webp" as const,
    tinify: true,
  });
}
