#!/usr/bin/env node
/**
 * Restore a matjar-backup CSV folder into the Convex *dev* deployment.
 *
 * Usage:
 *   node scripts/restore-backup-to-dev.mjs /path/to/matjar-backup-YYYY-MM-DD
 *
 * Converts CSVs → typed JSONL, packs a Convex snapshot ZIP, then
 * `npx convex import --replace-all -y` (required: backup _ids collide with
 * existing auth table ids on a non-empty deployment).
 *
 * WARNING: wipes the whole DEV deployment (including auth sessions).
 * Re-login afterward; authAccounts are not in the backup.
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { zipSync, strToU8 } from "fflate";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

const BACKUP_TABLES = [
  "roles",
  "permissions",
  "rolePermissions",
  "users",
  "settings",
  "productCategories",
  "brands",
  "clients",
  "products",
  "productPriceHistory",
  "invoices",
  "invoiceLines",
  "invoicePayments",
  "creditLedgerEntries",
  "creditLedgerUpdateRequests",
  "installmentPlans",
  "returns",
  "returnLines",
  "procurementLists",
  "procurementListItems",
  "alerts",
  "posCartDrafts",
  "auditEvents",
];

const STRING_FIELDS = new Set([
  "_id",
  "phone",
  "barcode",
  "number",
  "date",
  "time",
  "fullName",
  "name",
  "email",
  "legacyId",
  "key",
  "ref",
  "note",
  "title",
  "description",
  "badge",
  "categoryLabel",
  "normalizedName",
  "imageUrl",
  "imageAlt",
  "imageStorageId",
  "logoUrl",
  "logoAlt",
  "clientNameSnapshot",
  "cashierNameSnapshot",
  "verifiedByUserNameSnapshot",
  "productNameSnapshot",
  "paymentType",
  "status",
  "kind",
  "source",
  "reason",
  "stockDisposition",
  "verificationMethod",
  "createdAtIso",
  "actorUserName",
  "action",
  "entityType",
  "entityId",
  "summary",
  "payloadJson",
]);

const NULLABLE_EMPTY = new Set(["creditLimitMadCents", "costMadCents"]);

const BOOL_FIELDS = new Set([
  "isCashOnly",
  "stockLow",
  "active",
  "soldByWeight",
  "isAnonymous",
  "parkedByAssist",
]);

const NUMBER_FIELDS = new Set([
  "_creationTime",
  "createdAt",
  "updatedAt",
  "recordedAt",
  "verifiedAt",
  "publishedAt",
  "completedAt",
  "emailVerificationTime",
  "phoneVerificationTime",
  "qty",
  "returnedQty",
  "qtyReturned",
  "lineIndex",
  "stockQty",
  "sortOrder",
  "quantity",
  "assignedUsersCount",
  "intervalMonths",
  "dueDayOfMonth",
  "itemCount",
  "sellPriceMadCents",
  "costMadCents",
  "creditLimitMadCents",
  "initialSoldeMadCents",
  "amountMadCents",
  "totalMadCents",
  "monthlyMadCents",
  "refundTotalMadCents",
  "expectedMadCents",
  "expectedPaymentMadCents",
]);

function parseCsv(text) {
  if (!text || !text.trim()) return { headers: [], rows: [] };
  const rows = [];
  let row = [];
  let cell = "";
  let i = 0;
  let inQuotes = false;
  while (i < text.length) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          cell += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i += 1;
        continue;
      }
      cell += ch;
      i += 1;
      continue;
    }
    if (ch === '"') {
      inQuotes = true;
      i += 1;
      continue;
    }
    if (ch === ",") {
      row.push(cell);
      cell = "";
      i += 1;
      continue;
    }
    if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i += 1;
      row.push(cell);
      cell = "";
      if (row.some((c) => c.length > 0) || row.length > 1) rows.push(row);
      row = [];
      i += 1;
      continue;
    }
    cell += ch;
    i += 1;
  }
  if (cell.length > 0 || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }
  if (rows.length === 0) return { headers: [], rows: [] };
  const headers = rows[0].map((h) => h.trim());
  const data = rows.slice(1).map((r) => {
    const obj = {};
    for (let j = 0; j < headers.length; j += 1) {
      obj[headers[j]] = r[j] ?? "";
    }
    return obj;
  });
  return { headers, rows: data };
}

function looksLikeJson(value) {
  const t = value.trim();
  return (
    (t.startsWith("{") && t.endsWith("}")) ||
    (t.startsWith("[") && t.endsWith("]"))
  );
}

function coerceValue(key, raw) {
  if (raw === undefined || raw === null) return undefined;
  const value = typeof raw === "string" ? raw : String(raw);
  if (value === "") {
    if (NULLABLE_EMPTY.has(key)) return null;
    return undefined;
  }

  if (STRING_FIELDS.has(key) || /Id$/.test(key) || /Json$/.test(key)) {
    return value;
  }

  if (BOOL_FIELDS.has(key)) {
    if (value === "true") return true;
    if (value === "false") return false;
  }
  if (value === "true") return true;
  if (value === "false") return false;

  // Nested objects/arrays stored as JSON in the CSV export.
  if (
    key === "value" ||
    key === "lines" ||
    key === "scheduleRule" ||
    key === "scheduleSlots"
  ) {
    if (looksLikeJson(value)) {
      try {
        return JSON.parse(value);
      } catch {
        /* fall through */
      }
    }
    if (key === "value" && /^-?\d+(\.\d+)?$/.test(value)) return Number(value);
  }

  if (NUMBER_FIELDS.has(key) || key.endsWith("Cents") || key.endsWith("At")) {
    const n = Number(value);
    if (Number.isFinite(n)) return n;
  }

  return value;
}

function rowToDoc(row) {
  const doc = {};
  for (const [key, raw] of Object.entries(row)) {
    if (!key) continue;
    const coerced = coerceValue(key, raw);
    if (coerced !== undefined) doc[key] = coerced;
  }
  return doc;
}

function main() {
  const backupDir = process.argv[2];
  if (!backupDir) {
    console.error(
      "Usage: node scripts/restore-backup-to-dev.mjs /path/to/matjar-backup-YYYY-MM-DD",
    );
    process.exit(1);
  }
  const absBackup = path.resolve(backupDir);
  if (!fs.existsSync(absBackup)) {
    console.error(`Backup folder not found: ${absBackup}`);
    process.exit(1);
  }

  const workDir = fs.mkdtempSync(path.join(os.tmpdir(), "matjar-restore-"));
  console.log(`Work dir: ${workDir}`);
  console.log(`Backup:   ${absBackup}`);
  console.log(`Target:   Convex DEV (--replace-all)\n`);

  const zipEntries = {};
  const counts = {};

  for (const table of BACKUP_TABLES) {
    const csvPath = path.join(absBackup, `${table}.csv`);
    let docs = [];
    if (fs.existsSync(csvPath)) {
      const raw = fs.readFileSync(csvPath, "utf8");
      const { rows } = parseCsv(raw);
      docs = rows.map(rowToDoc).filter((d) => d._id);
    }
    counts[table] = docs.length;
    const jsonl =
      docs.map((d) => JSON.stringify(d)).join("\n") + (docs.length ? "\n" : "");
    zipEntries[`${table}/documents.jsonl`] = strToU8(jsonl);
    console.log(`  packed ${table}: ${docs.length}`);
  }

  const zipPath = path.join(workDir, "matjar-restore.zip");
  const zipped = zipSync(zipEntries, { level: 6 });
  fs.writeFileSync(zipPath, zipped);
  console.log(`\nZIP: ${zipPath} (${zipped.byteLength} bytes)`);
  console.log("Importing with --replace-all (wipes DEV)…\n");

  const result = spawnSync(
    "npx",
    ["convex", "import", "--replace-all", "-y", zipPath],
    {
      cwd: ROOT,
      encoding: "utf8",
      stdio: "inherit",
      env: process.env,
    },
  );

  if (result.status !== 0) {
    console.error(`\nImport failed (exit ${result.status})`);
    process.exit(result.status ?? 1);
  }

  console.log("\nDone. Imported counts:");
  for (const [table, count] of Object.entries(counts)) {
    console.log(`  ${table}: ${count}`);
  }
  console.log(`
Next steps:
- authAccounts were not in the backup, so password login may need a fresh sign-up
  or password reset for an imported email (e.g. khalilakirar@gmail.com).
- Open the app against this DEV deployment and verify clients / products / factures.
`);
}

main();
