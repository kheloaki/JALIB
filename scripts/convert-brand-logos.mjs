import sharp from "sharp";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.join(__dirname, "..", "public");
const sourcesDir = path.join(__dirname, "brand-sources");

function chromaKey(data, info, key, threshold, softness) {
  const [kr, kg, kb] = key;
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const dist = Math.hypot(r - kr, g - kg, b - kb);
    let alpha;
    if (dist <= threshold) alpha = 0;
    else if (dist >= threshold + softness) alpha = 255;
    else alpha = Math.round((255 * (dist - threshold)) / softness);

    if (alpha > 0 && alpha < 255) {
      const a = alpha / 255;
      data[i] = Math.min(255, Math.max(0, Math.round((r - kr * (1 - a)) / a)));
      data[i + 1] = Math.min(
        255,
        Math.max(0, Math.round((g - kg * (1 - a)) / a)),
      );
      data[i + 2] = Math.min(
        255,
        Math.max(0, Math.round((b - kb * (1 - a)) / a)),
      );
    }
    data[i + 3] = Math.min(data[i + 3], alpha);
  }
  return sharp(data, {
    raw: { width: info.width, height: info.height, channels: 4 },
  }).png();
}

const BROWN_LUMA = 0.299 * 121 + 0.587 * 73 + 0.114 * 0;
const LOGO_RED = [206, 22, 32]; // #ce1620 — library red

function luma(r, g, b) {
  return 0.299 * r + 0.587 * g + 0.114 * b;
}

function isGoldStar(r, g, b) {
  const y = luma(r, g, b);
  return y >= 108 && r >= 140 && g >= 95 && g >= r * 0.55 && b < g * 0.75;
}

function isNearWhite(r, g, b) {
  return r >= 220 && g >= 220 && b >= 210;
}

function isBrownInk(r, g, b, a) {
  if (a < 10) return false;
  if (isNearWhite(r, g, b)) return false;
  if (isGoldStar(r, g, b)) return false;
  const y = luma(r, g, b);
  return y < 165 && r >= 55 && r > g + 8 && g >= b && b < 90;
}

function recolorBrownInk(data) {
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const a = data[i + 3];
    if (!isBrownInk(r, g, b, a)) continue;
    const factor = luma(r, g, b) / BROWN_LUMA;
    data[i] = Math.min(255, Math.max(0, Math.round(LOGO_RED[0] * factor)));
    data[i + 1] = Math.min(255, Math.max(0, Math.round(LOGO_RED[1] * factor)));
    data[i + 2] = Math.min(255, Math.max(0, Math.round(LOGO_RED[2] * factor)));
  }
}

function darkenToPrintInk(data) {
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] === 0) continue;
    const lum = luma(data[i], data[i + 1], data[i + 2]);
    const ink = Math.max(18, Math.min(55, Math.round(255 - lum * 0.85)));
    data[i] = Math.round(ink * 0.85);
    data[i + 1] = Math.round(ink * 0.16);
    data[i + 2] = Math.round(ink * 0.18);
  }
}

async function loadKeyed(inputPath, key, threshold, softness) {
  const { data, info } = await sharp(inputPath)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  chromaKey(data, info, key, threshold, softness);
  return { data, info };
}

async function cropToContent(data, info, padding = 12) {
  let minX = info.width;
  let minY = info.height;
  let maxX = 0;
  let maxY = 0;

  for (let y = 0; y < info.height; y++) {
    for (let x = 0; x < info.width; x++) {
      const alpha = data[(y * info.width + x) * 4 + 3];
      if (alpha > 8) {
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
      }
    }
  }

  if (maxX < minX) {
    return sharp(data, {
      raw: { width: info.width, height: info.height, channels: 4 },
    }).png();
  }

  const left = Math.max(0, minX - padding);
  const top = Math.max(0, minY - padding);
  const width = Math.min(info.width - left, maxX - minX + 1 + padding * 2);
  const height = Math.min(info.height - top, maxY - minY + 1 + padding * 2);

  return sharp(data, {
    raw: { width: info.width, height: info.height, channels: 4 },
  })
    .extract({ left, top, width, height })
    .png();
}

async function writeLogo(pipeline, outputName, { maxWidth, maxHeight } = {}) {
  if (maxWidth || maxHeight) {
    pipeline = pipeline.resize({
      width: maxWidth,
      height: maxHeight,
      fit: "inside",
      withoutEnlargement: false,
    });
  }
  const outPath = path.join(publicDir, outputName);
  await pipeline.png({ compressionLevel: 9 }).toFile(outPath);
  const meta = await sharp(outPath).metadata();
  console.log(
    `${outputName}: ${meta.width}x${meta.height}, hasAlpha=${meta.hasAlpha}`,
  );
}

const BROWN = [121, 73, 0];
const WHITE = [255, 255, 255];

const iconDark = path.join(sourcesDir, "logo-icon-dark.png");
const fullDark = path.join(sourcesDir, "logo-full-dark.png");
const stackedLight = path.join(sourcesDir, "logo-stacked-light.png");

// Favicon / PWA — crimson square (maskable).
{
  const { data, info } = await sharp(iconDark)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  recolorBrownInk(data);
  await writeLogo(
    sharp(data, {
      raw: { width: info.width, height: info.height, channels: 4 },
    }).png(),
    "jamaa-market-logo.png",
    { maxWidth: 512, maxHeight: 512 },
  );
}

// Collapsed sidebar icon — white mark, transparent.
{
  const { data, info } = await loadKeyed(iconDark, BROWN, 8, 18);
  const cropped = await cropToContent(data, info, 16);
  await writeLogo(cropped, "jamaa-market-logo-icon.png", {
    maxWidth: 256,
    maxHeight: 256,
  });
}

// Expanded sidebar wordmark — white mark, transparent.
{
  const { data, info } = await loadKeyed(fullDark, BROWN, 8, 18);
  const cropped = await cropToContent(data, info, 10);
  await writeLogo(cropped, "jamaa-market-logo-full.png", {
    maxWidth: 680,
    maxHeight: 220,
  });
}

// Login / light UI — crimson stacked mark on transparent.
{
  const { data, info } = await loadKeyed(stackedLight, WHITE, 8, 22);
  recolorBrownInk(data);
  const cropped = await cropToContent(data, info, 12);
  await writeLogo(cropped, "jamaa-market-logo-white.png", {
    maxWidth: 400,
    maxHeight: 400,
  });
}

// Thermal / on-screen print — dark ink stacked mark.
{
  const { data, info } = await loadKeyed(stackedLight, WHITE, 8, 22);
  darkenToPrintInk(data);
  const cropped = await cropToContent(data, info, 12);
  await writeLogo(cropped, "jamaa-market-logo-print.png", {
    maxWidth: 400,
    maxHeight: 400,
  });
}

// A4 internal invoices — dark ink horizontal wordmark.
{
  const { data, info } = await loadKeyed(fullDark, BROWN, 8, 18);
  darkenToPrintInk(data);
  const cropped = await cropToContent(data, info, 10);
  await writeLogo(cropped, "jamaa-market-logo-print-full.png", {
    maxWidth: 680,
    maxHeight: 220,
  });
}
