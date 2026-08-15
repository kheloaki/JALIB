#!/usr/bin/env node
/**
 * Import / sync Jamaa clients from DATA CLIENTS/*.xlsx into Convex.
 * - Inserts clients that are missing
 * - Updates clients whose name / phone / solde differ
 * Maps export "Solde" → client initialSoldeMad (negative = dette).
 *
 * Usage:
 *   node scripts/import-jamaa-clients.mjs --prod
 *   node scripts/import-jamaa-clients.mjs --dry-run
 *   JAMAA_CLIENTS_DIR="..." node scripts/import-jamaa-clients.mjs
 *   node scripts/import-jamaa-clients.mjs              # local/dev deployment
 */

import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";

const require = createRequire(import.meta.url);
const XLSX = require("xlsx");

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
/** Prefer env, then repo DATA CLIENTS, then sibling Downloads — never symlink into Next root. */
const DATA_DIR = [
  process.env.JAMAA_CLIENTS_DIR,
  path.join(ROOT, "DATA CLIENTS"),
  path.join(path.dirname(ROOT), "Clients  JAMAA"),
  path.join(ROOT, "Clients  JAMAA"),
].find((p) => p && fs.existsSync(p));

const args = new Set(process.argv.slice(2));
const useProd = args.has("--prod");
const dryRun = args.has("--dry-run");
const BATCH = 80;

function parseNum(value) {
  if (value == null || value === "") return null;
  const n = Number(String(value).replace(/\s/g, "").replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

function looksLikePhone(raw) {
  const digits = String(raw || "").replace(/\D/g, "");
  return digits.length >= 8 && digits.length <= 15;
}

function normalizePhone(raw) {
  return String(raw || "")
    .trim()
    .replace(/\s+/g, " ");
}

function nameKey(name) {
  return name.trim().toLowerCase().replace(/\s+/g, " ");
}

function legacyIdForName(name) {
  const key = nameKey(name);
  const hash = createHash("sha1").update(key).digest("hex").slice(0, 12);
  return `jamaa-client:${hash}`;
}

function placeholderPhone(legacyId) {
  // Unique non-empty phone for rows without a real GSM.
  const digits = legacyId.replace(/\D/g, "").slice(0, 10).padStart(10, "0");
  return `00${digits}`;
}

function loadClients() {
  if (!DATA_DIR || !fs.existsSync(DATA_DIR)) {
    throw new Error(
      `Missing clients folder. Set JAMAA_CLIENTS_DIR or place "DATA CLIENTS" in the repo root.`,
    );
  }
  console.log(`Using clients data: ${DATA_DIR}`);
  const files = fs
    .readdirSync(DATA_DIR)
    .filter((f) => f.endsWith(".xlsx"))
    .sort((a, b) => {
      const na = Number((a.match(/\((\d+)\)/) || [])[1] || 0);
      const nb = Number((b.match(/\((\d+)\)/) || [])[1] || 0);
      return na - nb || a.localeCompare(b);
    });

  const byLegacy = new Map();
  let rawRows = 0;
  let withPhone = 0;
  let withoutPhone = 0;

  for (const file of files) {
    const wb = XLSX.readFile(path.join(DATA_DIR, file), { cellDates: true });
    const sheet = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(sheet, { defval: null, raw: false });
    for (const row of rows) {
      rawRows += 1;
      const fullName = String(row.__EMPTY_1 || "").trim().replace(/\s+/g, " ");
      if (!fullName || fullName === "Nom") continue;

      const solde = parseNum(row.__EMPTY_3) ?? 0;
      const gsm = normalizePhone(row.__EMPTY_5);
      const hasPhone = looksLikePhone(gsm);
      const legacyId = legacyIdForName(fullName);
      const phone = hasPhone ? gsm.replace(/\s+/g, "") : placeholderPhone(legacyId);

      if (hasPhone) withPhone += 1;
      else withoutPhone += 1;

      // Prefer first occurrence if any name collision across sheets.
      if (byLegacy.has(legacyId)) continue;

      byLegacy.set(legacyId, {
        legacyId,
        fullName,
        phone,
        initialSoldeMad: Math.round(solde * 100) / 100,
        isCashOnly: false,
        creditLimitMad: null,
      });
    }
  }

  return {
    clients: [...byLegacy.values()],
    rawRows,
    files: files.length,
    withPhone,
    withoutPhone,
  };
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

function main() {
  const { clients, rawRows, files, withPhone, withoutPhone } = loadClients();
  console.log(
    JSON.stringify(
      {
        files,
        rawRows,
        uniqueClients: clients.length,
        withPhone,
        withoutPhone,
        prod: useProd,
        dryRun,
        soldeSample: clients
          .filter((c) => c.initialSoldeMad !== 0)
          .slice(0, 3)
          .map((c) => ({
            name: c.fullName,
            solde: c.initialSoldeMad,
            phone: c.phone,
          })),
      },
      null,
      2,
    ),
  );

  if (dryRun) {
    console.log("Dry run only — no Convex writes.");
    return;
  }

  let inserted = 0;
  let updated = 0;
  let skipped = 0;
  for (let i = 0; i < clients.length; i += BATCH) {
    const slice = clients.slice(i, i + BATCH);
    const result = convexRun("jamaaClientImport:importBatch", {
      clients: slice,
    });
    inserted += result.inserted ?? 0;
    updated += result.updated ?? 0;
    skipped += result.skipped ?? 0;
    console.log(
      `import ${Math.min(i + BATCH, clients.length)}/${clients.length}`,
      result,
    );
  }

  console.log(
    JSON.stringify(
      { done: true, inserted, updated, skipped, total: clients.length },
      null,
      2,
    ),
  );
}

main();
