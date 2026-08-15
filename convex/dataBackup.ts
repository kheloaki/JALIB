import { ConvexError, v } from "convex/values";

import { internal } from "./_generated/api";
import {
  action,
  internalAction,
  internalQuery,
  type ActionCtx,
} from "./_generated/server";
import { requirePermission } from "./authz";

function backupFail(message: string): never {
  throw new ConvexError(message);
}
import {
  BACKUP_TABLES,
  MAX_ZIP_ATTACHMENT_BYTES,
  backupFilename,
  buildBackupZip,
  docsToCsv,
  flattenDoc,
  formatCountsSummary,
  parseBackupRecipients,
  sanitizeUserDoc,
  u8ToBase64,
  type BackupTableName,
} from "./dataBackupHelpers";

const DEFAULT_FROM = "Jamaa Market <onboarding@resend.dev>";
const PAGE_SIZE = 200;

const backupTableValidator = v.union(
  v.literal("clients"),
  v.literal("productCategories"),
  v.literal("brands"),
  v.literal("products"),
  v.literal("productPriceHistory"),
  v.literal("invoices"),
  v.literal("invoiceLines"),
  v.literal("invoicePayments"),
  v.literal("creditLedgerEntries"),
  v.literal("creditLedgerUpdateRequests"),
  v.literal("installmentPlans"),
  v.literal("returns"),
  v.literal("returnLines"),
  v.literal("procurementLists"),
  v.literal("procurementListItems"),
  v.literal("alerts"),
  v.literal("settings"),
  v.literal("posCartDrafts"),
  v.literal("users"),
  v.literal("roles"),
  v.literal("permissions"),
  v.literal("rolePermissions"),
  v.literal("auditEvents"),
);

const backupResultValidator = v.object({
  ok: v.literal(true),
  mode: v.union(v.literal("attachment"), v.literal("storage_link")),
  filename: v.string(),
  zipBytes: v.number(),
  recipientCount: v.number(),
  counts: v.record(v.string(), v.number()),
});

export const assertManageSettings = internalQuery({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    await requirePermission(ctx, "admin.manage_settings");
    return null;
  },
});

export const dumpPage = internalQuery({
  args: {
    table: backupTableValidator,
    cursor: v.union(v.string(), v.null()),
    numItems: v.number(),
  },
  returns: v.object({
    rows: v.array(v.record(v.string(), v.any())),
    continueCursor: v.string(),
    isDone: v.boolean(),
  }),
  handler: async (ctx, args) => {
    const numItems = Math.min(Math.max(args.numItems, 1), 500);
    const table = args.table as BackupTableName;
    const result = await ctx.db.query(table).order("asc").paginate({
      numItems,
      cursor: args.cursor,
    });

    const rows = result.page.map((doc) => {
      const raw = doc as unknown as Record<string, unknown>;
      if (table === "users") return sanitizeUserDoc(raw);
      return flattenDoc(raw);
    });

    return {
      rows,
      continueCursor: result.continueCursor,
      isDone: result.isDone,
    };
  },
});

type BackupResult = {
  ok: true;
  mode: "attachment" | "storage_link";
  filename: string;
  zipBytes: number;
  recipientCount: number;
  counts: Record<string, number>;
};

async function collectTable(
  ctx: Pick<ActionCtx, "runQuery">,
  table: BackupTableName,
): Promise<Record<string, unknown>[]> {
  const rows: Record<string, unknown>[] = [];
  let cursor: string | null = null;
  for (;;) {
    const page: {
      rows: Record<string, unknown>[];
      continueCursor: string;
      isDone: boolean;
    } = await ctx.runQuery(internal.dataBackup.dumpPage, {
      table,
      cursor,
      numItems: PAGE_SIZE,
    });
    rows.push(...page.rows);
    if (page.isDone) break;
    cursor = page.continueCursor;
  }
  return rows;
}

async function sendResendEmail(args: {
  apiKey: string;
  from: string;
  to: string[];
  subject: string;
  text: string;
  html: string;
  attachment?: { filename: string; contentBase64: string };
}): Promise<void> {
  const body: Record<string, unknown> = {
    from: args.from,
    to: args.to,
    subject: args.subject,
    text: args.text,
    html: args.html,
  };
  if (args.attachment) {
    body.attachments = [
      {
        filename: args.attachment.filename,
        content: args.attachment.contentBase64,
      },
    ];
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${args.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    backupFail(
      `Resend a échoué (${response.status}): ${detail || response.statusText}. Vérifiez AUTH_EMAIL_FROM (domaine vérifié) et AUTH_RESEND_API_KEY.`,
    );
  }
}

async function executeBackup(ctx: ActionCtx): Promise<BackupResult> {
  const apiKey = process.env.AUTH_RESEND_API_KEY;
  if (!apiKey) {
    backupFail(
      "AUTH_RESEND_API_KEY n’est pas configuré sur ce déploiement Convex.",
    );
  }

  const recipients = parseBackupRecipients(process.env.BACKUP_EMAIL_TO);
  if (recipients.length === 0) {
    backupFail(
      "BACKUP_EMAIL_TO est manquant sur ce déploiement (production uniquement).",
    );
  }

  const from = process.env.AUTH_EMAIL_FROM ?? DEFAULT_FROM;
  const counts: Record<string, number> = {};
  const csvFiles: Record<string, string> = {};

  try {
    for (const table of BACKUP_TABLES) {
      const rows = await collectTable(ctx, table);
      counts[table] = rows.length;
      csvFiles[`${table}.csv`] = docsToCsv(rows);
    }
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    backupFail(`Lecture des tables impossible: ${detail}`);
  }

  let filename: string;
  let zipBytes: Uint8Array;
  try {
    filename = backupFilename();
    zipBytes = buildBackupZip(csvFiles);
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    backupFail(`Création du ZIP impossible: ${detail}`);
  }

  const summary = formatCountsSummary(counts);
  const subject = `Jamaa Market — sauvegarde données ${filename.replace(".zip", "")}`;

  const baseText = [
    "Sauvegarde quotidienne Matjar / Jamaa Market.",
    "",
    `Fichier: ${filename}`,
    `Taille ZIP: ${zipBytes.byteLength} octets`,
    "",
    "Lignes par table:",
    summary,
  ].join("\n");

  if (zipBytes.byteLength <= MAX_ZIP_ATTACHMENT_BYTES) {
    const contentBase64 = u8ToBase64(zipBytes);
    await sendResendEmail({
      apiKey,
      from,
      to: recipients,
      subject,
      text: `${baseText}\n\nLe ZIP est en pièce jointe.`,
      html: `<p>Sauvegarde quotidienne <strong>Matjar / Jamaa Market</strong>.</p>
<p>Fichier: <code>${filename}</code> (${zipBytes.byteLength} octets)</p>
<pre>${summary}</pre>
<p>Le ZIP est en pièce jointe.</p>`,
      attachment: { filename, contentBase64 },
    });

    return {
      ok: true,
      mode: "attachment",
      filename,
      zipBytes: zipBytes.byteLength,
      recipientCount: recipients.length,
      counts,
    };
  }

  let downloadUrl: string | null;
  try {
    const storageId = await ctx.storage.store(
      new Blob([new Uint8Array(zipBytes)], { type: "application/zip" }),
    );
    downloadUrl = await ctx.storage.getUrl(storageId);
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    backupFail(`Stockage du ZIP impossible: ${detail}`);
  }
  if (!downloadUrl) {
    backupFail("Impossible de créer le lien de téléchargement du ZIP.");
  }

  await sendResendEmail({
    apiKey,
    from,
    to: recipients,
    subject,
    text: `${baseText}\n\nZIP trop volumineux pour une pièce jointe.\nTéléchargement: ${downloadUrl}`,
    html: `<p>Sauvegarde quotidienne <strong>Matjar / Jamaa Market</strong>.</p>
<p>Fichier: <code>${filename}</code> (${zipBytes.byteLength} octets)</p>
<pre>${summary}</pre>
<p>ZIP trop volumineux pour une pièce jointe.</p>
<p><a href="${downloadUrl}">Télécharger la sauvegarde</a></p>`,
  });

  return {
    ok: true,
    mode: "storage_link",
    filename,
    zipBytes: zipBytes.byteLength,
    recipientCount: recipients.length,
    counts,
  };
}

/**
 * Cron entrypoint. Skips quietly when BACKUP_EMAIL_TO is unset so the job can
 * stay registered on every deployment while only production (with the env set)
 * actually sends mail.
 */
export const runDailyBackup = internalAction({
  args: {},
  returns: v.union(
    backupResultValidator,
    v.object({
      ok: v.literal(false),
      skipped: v.literal(true),
      reason: v.string(),
    }),
  ),
  handler: async (ctx) => {
    const recipients = parseBackupRecipients(process.env.BACKUP_EMAIL_TO);
    if (recipients.length === 0) {
      console.info(
        "Daily backup skipped: BACKUP_EMAIL_TO is not set on this deployment.",
      );
      return {
        ok: false as const,
        skipped: true as const,
        reason: "BACKUP_EMAIL_TO unset",
      };
    }
    return await executeBackup(ctx);
  },
});

/** Manual trigger from Paramètres (admin.manage_settings). */
export const sendNow = action({
  args: {},
  returns: backupResultValidator,
  handler: async (ctx): Promise<BackupResult> => {
    try {
      await ctx.runQuery(internal.dataBackup.assertManageSettings, {});
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      if (/Not authenticated|Unauthorized/i.test(detail)) {
        backupFail(
          "Permission refusée: il faut admin.manage_settings pour envoyer la sauvegarde.",
        );
      }
      backupFail(`Contrôle d’accès impossible: ${detail}`);
    }
    return await executeBackup(ctx);
  },
});
