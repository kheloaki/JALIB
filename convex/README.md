# Matjar Convex Backend

This directory contains the initial Convex backend skeleton for the Matjar/Sovereign admin app.

The current Next.js UI still reads from the existing browser storage modules. Convex is wired into the React tree so feature screens can be migrated incrementally without changing page behavior first.

## Planned Migration Order

1. Clients and products
2. POS checkout, invoices, and stock updates
3. Credit ledger and installment plans
4. Returns
5. Alerts and dashboard summaries
6. Auth-backed users and RBAC enforcement

Run `npx convex codegen` after changing Convex function modules or the schema.
If the project is not linked yet, start with `npx convex dev`; it will create
the deployment config and populate `NEXT_PUBLIC_CONVEX_URL`.

## Daily data backup (Resend)

See [docs/data-backup.md](../docs/data-backup.md). Requires `AUTH_RESEND_API_KEY`,
`AUTH_EMAIL_FROM`, and `BACKUP_EMAIL_TO` (comma-separated recipients).
