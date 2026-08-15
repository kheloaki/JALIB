import { strToU8, zipSync } from "fflate";

/** Keep ZIP under this before Base64 so Resend (~40MB) stays reliable. */
export const MAX_ZIP_ATTACHMENT_BYTES = 28 * 1024 * 1024;

export const BACKUP_TABLES = [
  "clients",
  "productCategories",
  "brands",
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
  "settings",
  "posCartDrafts",
  "users",
  "roles",
  "permissions",
  "rolePermissions",
  "auditEvents",
] as const;

export type BackupTableName = (typeof BACKUP_TABLES)[number];

export function parseBackupRecipients(raw: string | undefined): string[] {
  if (!raw?.trim()) return [];
  return raw
    .split(/[,;\s]+/)
    .map((email) => email.trim())
    .filter((email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email));
}

export function escapeCsvCell(value: unknown): string {
  if (value === null || value === undefined) return "";
  const text =
    typeof value === "string"
      ? value
      : typeof value === "number" || typeof value === "boolean"
        ? String(value)
        : JSON.stringify(value);
  if (/[",\n\r]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

export function docsToCsv(rows: Record<string, unknown>[]): string {
  if (rows.length === 0) return "";
  const headerSet = new Set<string>();
  for (const row of rows) {
    for (const key of Object.keys(row)) headerSet.add(key);
  }
  const headers = [...headerSet];
  const lines = [headers.map(escapeCsvCell).join(",")];
  for (const row of rows) {
    lines.push(headers.map((h) => escapeCsvCell(row[h])).join(","));
  }
  return lines.join("\n");
}

/** Flatten a Convex document for CSV (nested values as JSON). */
export function flattenDoc(doc: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(doc)) {
    if (value === undefined) continue;
    if (
      value === null ||
      typeof value === "string" ||
      typeof value === "number" ||
      typeof value === "boolean"
    ) {
      out[key] = value;
    } else {
      out[key] = JSON.stringify(value);
    }
  }
  return out;
}

/** Users export: no auth secrets — identity fields only. */
export function sanitizeUserDoc(doc: Record<string, unknown>): Record<string, unknown> {
  return flattenDoc({
    _id: doc._id,
    _creationTime: doc._creationTime,
    name: doc.name ?? null,
    email: doc.email ?? null,
    phone: doc.phone ?? null,
    roleId: doc.roleId ?? null,
    updatedAt: doc.updatedAt ?? null,
  });
}

export function buildBackupZip(
  files: Record<string, string>,
): Uint8Array {
  const entries: Record<string, Uint8Array> = {};
  for (const [name, content] of Object.entries(files)) {
    entries[name] = strToU8(content);
  }
  return zipSync(entries, { level: 6 });
}

export function u8ToBase64(bytes: Uint8Array): string {
  const chunk = 0x8000;
  let binary = "";
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

export function backupFilename(date = new Date()): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  return `matjar-backup-${y}-${m}-${d}.zip`;
}

export function formatCountsSummary(
  counts: Record<string, number>,
): string {
  return Object.entries(counts)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([table, count]) => `- ${table}: ${count}`)
    .join("\n");
}
