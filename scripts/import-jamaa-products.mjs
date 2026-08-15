#!/usr/bin/env node
/**
 * Import Jamaa legacy products from DATA PRODUCTS JAMAA/*.xlsx into Convex.
 *
 * Usage:
 *   node scripts/import-jamaa-products.mjs --prod --clear
 *   node scripts/import-jamaa-products.mjs              # local/dev deployment
 *   node scripts/import-jamaa-products.mjs --dry-run
 */

import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const XLSX = require("xlsx");

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
/** Prefer env, then sibling Downloads folder — never symlink into the Next app root (Turbopack panics). */
const DATA_DIR = [
  process.env.JAMAA_PRODUCTS_DIR,
  path.join(path.dirname(ROOT), "DATA PRODUCTS JAMAA"),
  path.join(ROOT, "DATA PRODUCTS JAMAA"),
].find((p) => p && fs.existsSync(p));

const args = new Set(process.argv.slice(2));
const useProd = args.has("--prod");
const clearFirst = args.has("--clear");
const dryRun = args.has("--dry-run");
const BATCH = 80;

function parseNum(value) {
  if (value == null || value === "") return null;
  const n = Number(String(value).replace(/\s/g, "").replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

function legacyFromHref(href) {
  const m = String(href || "").match(/\/article\/(\d+)\//);
  return m ? m[1] : null;
}

function loadProducts() {
  if (!DATA_DIR || !fs.existsSync(DATA_DIR)) {
    throw new Error(
      `Missing Jamaa products folder. Set JAMAA_PRODUCTS_DIR or place "DATA PRODUCTS JAMAA" next to the repo (not as a symlink inside it).`,
    );
  }
  const files = fs
    .readdirSync(DATA_DIR)
    .filter((f) => f.endsWith(".xlsx"))
    .sort();

  const byLegacy = new Map();
  let rawRows = 0;

  for (const file of files) {
    const wb = XLSX.readFile(path.join(DATA_DIR, file), { cellDates: true });
    const sheet = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(sheet, { defval: null, raw: false });
    for (const row of rows) {
      rawRows += 1;
      const legacyArticleId = legacyFromHref(row["field-name href"]);
      const name = String(row["field-name"] || "").trim();
      const barcode = String(row["field-sequence"] || "")
        .trim()
        .replace(/\s+/g, "");
      const sellPriceMad = parseNum(row["field-prix_unitaire"]);
      const costPriceMad = parseNum(row["field-prix_achat"]);
      const stockQty = parseNum(row["field-qReel"]);
      if (!legacyArticleId || !name || !barcode) continue;
      if (sellPriceMad == null) continue;

      // Prefer first occurrence; skip exact barcode/name duplicates later pages
      if (byLegacy.has(legacyArticleId)) continue;

      byLegacy.set(legacyArticleId, {
        legacyArticleId,
        name,
        barcode,
        sellPriceMad,
        costPriceMad: costPriceMad ?? 0,
        stockQty: stockQty ?? 0,
      });
    }
  }

  // Deduplicate barcodes (keep first legacy id)
  const seenBarcode = new Set();
  const products = [];
  for (const product of byLegacy.values()) {
    const key = product.barcode.toUpperCase();
    if (seenBarcode.has(key)) continue;
    seenBarcode.add(key);
    products.push(product);
  }

  return { products, rawRows, files: files.length };
}

function convexRun(functionPath, jsonArgs) {
  const cmdArgs = ["convex", "run"];
  if (useProd) cmdArgs.push("--prod");
  cmdArgs.push(functionPath);
  if (jsonArgs !== undefined) {
    cmdArgs.push(JSON.stringify(jsonArgs));
  }
  const result = spawnSync("npx", cmdArgs, {
    cwd: ROOT,
    encoding: "utf8",
    maxBuffer: 10 * 1024 * 1024,
  });
  if (result.status !== 0) {
    const err = (result.stderr || result.stdout || "").trim();
    throw new Error(
      `convex run ${functionPath} failed (${result.status}): ${err}`,
    );
  }
  const out = (result.stdout || "").trim();
  try {
    return JSON.parse(out);
  } catch {
    return out;
  }
}

async function main() {
  const { products, rawRows, files } = loadProducts();
  console.log(
    JSON.stringify(
      {
        files,
        rawRows,
        uniqueProducts: products.length,
        prod: useProd,
        clearFirst,
        dryRun,
        sample: products.slice(0, 2),
      },
      null,
      2,
    ),
  );

  if (dryRun) {
    console.log("Dry run only — no Convex writes.");
    return;
  }

  if (clearFirst) {
    let rounds = 0;
    let totalDeleted = 0;
    for (;;) {
      const result = convexRun("jamaaProductImport:clearCatalogBatch", {
        limit: 150,
      });
      rounds += 1;
      totalDeleted += result.productsDeleted ?? 0;
      console.log(`clear round ${rounds}`, result);
      if (result.done) break;
      if (rounds > 500) throw new Error("Clear did not finish");
    }
    console.log(`Cleared ${totalDeleted} products`);
  }

  let inserted = 0;
  let updated = 0;
  let skipped = 0;
  for (let i = 0; i < products.length; i += BATCH) {
    const slice = products.slice(i, i + BATCH);
    const result = convexRun("jamaaProductImport:importBatch", {
      products: slice,
    });
    inserted += result.inserted ?? 0;
    updated += result.updated ?? 0;
    skipped += result.skipped ?? 0;
    console.log(
      `import ${Math.min(i + BATCH, products.length)}/${products.length}`,
      result,
    );
  }

  console.log(
    JSON.stringify(
      { done: true, inserted, updated, skipped, total: products.length },
      null,
      2,
    ),
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
