import sharp from "sharp";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.join(__dirname, "..", "public");
const assetsDir =
  "/Users/khalilakirar/.cursor/projects/Users-khalilakirar-Downloads-MATJAR-main/assets";

async function removeBlackBg(inputPath) {
  const { data, info } = await sharp(inputPath)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const threshold = 35;
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    if (r <= threshold && g <= threshold && b <= threshold) {
      data[i + 3] = 0;
    }
  }

  return sharp(data, {
    raw: { width: info.width, height: info.height, channels: 4 },
  }).png();
}

async function cropToContent(pipeline, padding = 12) {
  const { data, info } = await pipeline.clone().raw().toBuffer({ resolveWithObject: true });
  let minX = info.width;
  let minY = info.height;
  let maxX = 0;
  let maxY = 0;

  for (let y = 0; y < info.height; y++) {
    for (let x = 0; x < info.width; x++) {
      const alpha = data[(y * info.width + x) * 4 + 3];
      if (alpha > 0) {
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
      }
    }
  }

  if (maxX < minX) return pipeline;

  const left = Math.max(0, minX - padding);
  const top = Math.max(0, minY - padding);
  const width = Math.min(info.width - left, maxX - minX + 1 + padding * 2);
  const height = Math.min(info.height - top, maxY - minY + 1 + padding * 2);

  return pipeline.extract({ left, top, width, height });
}

async function processLogo(inputPath, outputName, { padding = 12, maxWidth, maxHeight } = {}) {
  let pipeline = await removeBlackBg(inputPath);
  pipeline = await cropToContent(pipeline, padding);

  if (maxWidth || maxHeight) {
    pipeline = pipeline.resize({
      width: maxWidth,
      height: maxHeight,
      fit: "inside",
      withoutEnlargement: false,
    });
  }

  const outPath = path.join(publicDir, outputName);
  await pipeline.png().toFile(outPath);
  const meta = await sharp(outPath).metadata();
  console.log(
    `${outputName}: ${meta.width}x${meta.height}, hasAlpha=${meta.hasAlpha}`,
  );
}

const wordmarkSource = path.join(
  assetsDir,
  "Untitled_design-12-a825a2b0-c328-4754-9cea-8d44427d43a0.png",
);

// Login + Factures only — do not regenerate sidebar icon/full assets here.
await processLogo(wordmarkSource, "jamaa-market-logo-white.png", {
  padding: 8,
  maxWidth: 400,
});
