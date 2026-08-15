#!/usr/bin/env node
/**
 * Mirror Open Food Facts product images into Convex file storage.
 * Usage: node scripts/mirror-product-images.mjs [--prod] [--limit 20]
 */
import { execSync } from "node:child_process";

const args = process.argv.slice(2);
const useProd = args.includes("--prod");
const limitArg = args.find((a) => a.startsWith("--limit="));
const limit = limitArg ? Number(limitArg.split("=")[1]) : 20;

const convexFlags = useProd ? "--prod" : "";
let batch = 0;
let totalMirrored = 0;
let totalFailed = 0;

console.log(
  `Mirroring product images to Convex storage${useProd ? " (production)" : " (dev)"}…`,
);

while (true) {
  batch += 1;
  const raw = execSync(
    `npx convex run ${convexFlags} productImageMirrorActions:mirrorProductImagesBatch '${JSON.stringify({ limit })}'`.trim(),
    { encoding: "utf8", stdio: ["pipe", "pipe", "inherit"] },
  );
  const result = JSON.parse(raw);
  totalMirrored += result.mirrored;
  totalFailed += result.failed;

  console.log(
    `batch ${batch}: mirrored=${result.mirrored} failed=${result.failed} pending=${result.pending}`,
  );
  if (result.errors?.length) {
    for (const err of result.errors) {
      console.log(`  · ${err}`);
    }
  }

  if (result.pending === 0 || result.attempted === 0) {
    break;
  }
}

console.log(
  `\nDone. mirrored=${totalMirrored} failed=${totalFailed} batches=${batch}`,
);
