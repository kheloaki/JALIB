# Daily data backup (Resend)

Every day at **03:00 Africa/Casablanca** (`0 2 * * *` UTC), Convex exports all business tables as CSV files, packs them into a ZIP, and emails the result via Resend.

## Convex environment variables

Set on the **production** deployment only (`npx convex env set … --prod`).  
Do **not** set `BACKUP_EMAIL_TO` on the dev deployment — the daily cron skips when that variable is missing.

| Variable | Required | Purpose |
|----------|----------|---------|
| `AUTH_RESEND_API_KEY` | yes | Same Resend API key as password-reset emails |
| `AUTH_EMAIL_FROM` | recommended | Verified sender, e.g. `Jamaa Market <noreply@yourdomain.com>` |
| `BACKUP_EMAIL_TO` | yes (prod) | One or more recipients, comma-separated |

Example:

```bash
npx convex env set BACKUP_EMAIL_TO "marketjamaa@gmail.com" --prod
# several recipients:
# npx convex env set BACKUP_EMAIL_TO "marketjamaa@gmail.com,other@example.com" --prod

# Ensure dev does not email backups:
# npx convex env unset BACKUP_EMAIL_TO
```

## Manual send

Paramètres → Général → **Envoyer maintenant** (requires `admin.manage_settings`).

## Payload

ZIP named `matjar-backup-YYYY-MM-DD.zip` with one CSV per table (clients, products, invoices, credits, returns, procurement, roles, …). Auth sessions, push subscriptions, and image binaries are excluded.

If the ZIP exceeds ~28 MB, the email contains a Convex storage download link instead of an attachment.
