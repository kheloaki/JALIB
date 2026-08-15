# Perf baseline — DEV only (`calculating-marten-824`)

Sampled via `npx convex run perfBaseline:tableCounts` (no `--prod`).

| Table | Count |
|-------|------:|
| products (active) | 1,159 |
| clients | 2 |
| invoices | 16 |
| invoiceLines | 45 |
| creditLedgerEntries | 15 |
| installmentPlans | 1 |

**Note:** Dev is much smaller than production (~7.4k products / ~1.4k clients). Use this deployment to validate query shapes; re-measure on prod later without deploying these functions until ready.

## Targets (from plan)

| Metric | Target |
|--------|--------|
| First usable POS | &lt; 2s |
| Normal page query | &lt; 500ms |
| Initial payload | &lt; 500KB preferred |
| Ordinary queries | never thousands of rows |

## Phase 1 changes on DEV (this session)

- `invoices.listSummaries` + paginated UI (20–50); `getWithLines` only for selection/print/PDF
- `invoices.findByBarcode` / `findByNumber`
- `dashboard.lowStockProducts` + `products.listLowStock` via `by_active_and_stockQty`
- Alerts feed uses `listLowStock` instead of full `listActive`; ledger/plan limits reduced to 200
