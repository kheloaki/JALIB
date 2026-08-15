import {
  Sk,
  SkButton,
  SkCircle,
  SkLine,
  SkPfTabs,
  SkShellTabs,
  SkTableHead,
  SkTableRows,
  SkWhiteCard,
} from "@/components/skeletons/skeleton-ui";
import { cn } from "@/lib/utils";

/* ── Dashboard ── */
export function DashboardPageSkeleton() {
  return (
    <section className="space-y-4">
      <div className="space-y-2">
        <Sk className="h-6 w-40 rounded-lg" />
        <SkLine className="w-56" />
      </div>
      <div className="flex gap-2 overflow-hidden">
        {Array.from({ length: 7 }).map((_, i) => (
          <Sk key={i} className="h-9 w-24 shrink-0 rounded-full" />
        ))}
      </div>
      <div className="flex gap-3 overflow-hidden">
        {Array.from({ length: 4 }).map((_, i) => (
          <SkWhiteCard key={i} className="min-w-[180px] flex-1 p-4">
            <SkLine className="w-24" />
            <Sk className="mt-4 h-8 w-28 rounded-lg" />
          </SkWhiteCard>
        ))}
      </div>
      <SkWhiteCard className="h-[280px] p-5">
        <SkLine className="w-40" />
        <div className="mt-8 flex h-[180px] items-end justify-between gap-2">
          {Array.from({ length: 14 }).map((_, i) => (
            <Sk
              key={i}
              className={cn(
                "w-full max-w-[24px] rounded-t-md",
                i % 3 === 0 ? "h-24" : i % 3 === 1 ? "h-12" : "h-6",
              )}
            />
          ))}
        </div>
      </SkWhiteCard>
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
        <SkWhiteCard className="h-40 p-5">
          <Sk className="h-full w-full rounded-lg" />
        </SkWhiteCard>
        <SkWhiteCard className="h-40 p-5">
          <Sk className="h-full w-full rounded-lg" />
        </SkWhiteCard>
      </div>
      <div className="grid gap-4 xl:grid-cols-2">
        <SkWhiteCard className="h-72 p-5">
          <SkLine className="w-44" />
          <div className="mt-5 space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <Sk key={i} className="h-20 w-full rounded-xl" />
            ))}
          </div>
        </SkWhiteCard>
        <SkWhiteCard className="h-72 p-5">
          <SkLine className="w-44" />
          <div className="mt-5 space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <Sk key={i} className="h-20 w-full rounded-xl" />
            ))}
          </div>
        </SkWhiteCard>
      </div>
      <SkWhiteCard className="h-72 p-5">
        <SkLine className="w-44" />
        <div className="mt-5 space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Sk key={i} className="h-10 w-full rounded-xl" />
          ))}
        </div>
      </SkWhiteCard>
    </section>
  );
}

/* ── Credits ── */
export function CreditsPageSkeleton() {
  return (
    <>
      <SkPfTabs count={5} />
      <CreditsSummaryCardSkeleton />
      <CreditsClientsTableSkeleton />
    </>
  );
}

export function CreditsSummaryCardSkeleton() {
  return (
    <SkWhiteCard>
      <div className="flex items-start justify-between gap-4 border-b border-primary/10 bg-primary/5 p-5">
        <div className="min-w-0 flex-1 space-y-3">
          <SkLine className="w-36" />
          <Sk className="h-9 w-40 rounded-lg" />
          <SkLine className="w-28" />
        </div>
        <Sk className="size-12 shrink-0 rounded-2xl bg-primary/15" />
      </div>
      <div className="grid grid-cols-3 gap-px bg-sidebar-border/50">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="space-y-2 bg-white px-3 py-4 text-center">
            <SkLine className="mx-auto w-12" />
            <Sk className="mx-auto h-4 w-16 rounded-md" />
          </div>
        ))}
      </div>
    </SkWhiteCard>
  );
}

export function CreditsClientsTableSkeleton() {
  return (
    <SkWhiteCard>
      <div className="flex items-center justify-between border-b border-[rgba(61,43,31,0.08)] px-6 py-5">
        <Sk className="h-6 w-40 rounded-lg" />
        <Sk className="h-6 w-20 rounded-full" />
      </div>
      <SkTableHead cols={4} />
      <SkTableRows cols={4} rows={7} />
    </SkWhiteCard>
  );
}

export function CreditsLedgerPanelSkeleton() {
  return (
    <SkWhiteCard>
      <div className="border-b border-[rgba(61,43,31,0.08)] px-6 py-5">
        <Sk className="h-6 w-48 rounded-lg" />
      </div>
      <SkTableHead cols={6} />
      <SkTableRows cols={6} rows={8} />
    </SkWhiteCard>
  );
}

/* ── Clients ── */
export function ClientsPageSkeleton() {
  return (
    <div className="bg-surface text-on-background flex min-h-0 flex-1 flex-col overflow-auto">
      <main className="w-full flex-1 px-4 py-6 sm:px-6 md:py-8">
        <header className="mb-6 flex items-center justify-between gap-4">
          <Sk className="h-8 w-32 rounded-lg" />
          <SkButton className="size-10 rounded-xl" />
        </header>
        <SkWhiteCard>
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[rgba(61,43,31,0.08)] px-4 py-4 sm:px-6">
            <div className="flex items-center gap-3">
              <Sk className="h-6 w-36 rounded-lg" />
              <Sk className="h-6 w-10 rounded-full" />
            </div>
            <Sk className="h-10 w-44 rounded-xl" />
          </div>
          <SkTableHead cols={5} />
          <SkTableRows cols={5} rows={8} />
        </SkWhiteCard>
      </main>
    </div>
  );
}

export function ClientsGridSkeleton() {
  return (
    <div className="grid gap-4 p-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {Array.from({ length: 8 }).map((_, i) => (
        <SkWhiteCard key={i} className="p-4">
          <div className="flex items-center gap-3">
            <SkCircle className="size-12" />
            <div className="min-w-0 flex-1 space-y-2">
              <SkLine className="w-3/4" />
              <SkLine className="w-1/2" />
            </div>
          </div>
          <Sk className="mt-4 h-9 w-full rounded-xl" />
        </SkWhiteCard>
      ))}
    </div>
  );
}

/* ── Invoices ── */
export function InvoicesPageSkeleton() {
  return (
    <div className="bg-surface text-on-surface flex min-h-0 flex-1 flex-col">
      <main className="flex-1 overflow-auto p-4 sm:p-8">
        <div className="flex w-full flex-col gap-8 xl:flex-row xl:items-start">
          <div className="min-w-0 flex-1 space-y-6">
            <Sk className="h-8 w-32 rounded-lg" />
            <SkWhiteCard className="p-4 sm:p-6">
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="space-y-2">
                    <SkLine className="w-16" />
                    <Sk className="h-11 w-full rounded-xl" />
                  </div>
                ))}
              </div>
              <div className="mt-4 flex gap-3">
                <SkButton className="w-32" />
                <SkButton className="w-36" />
              </div>
            </SkWhiteCard>
            <SkWhiteCard>
              <SkTableHead cols={7} />
              <SkTableRows cols={7} rows={4} />
              <div className="flex items-center justify-between border-t border-[rgba(61,43,31,0.08)] px-4 py-3">
                <SkLine className="w-24" />
                <div className="flex gap-2">
                  <SkCircle className="size-8" />
                  <SkCircle className="size-8" />
                </div>
              </div>
            </SkWhiteCard>
          </div>
          <div className="hidden w-full max-w-md shrink-0 xl:block">
            <InvoiceReceiptSkeleton />
          </div>
        </div>
      </main>
    </div>
  );
}

export function InvoiceReceiptSkeleton() {
  return (
    <SkWhiteCard className="p-4">
      <div className="mb-4 flex gap-2">
        <Sk className="h-9 flex-1 rounded-lg" />
        <Sk className="h-9 flex-1 rounded-lg" />
      </div>
      <div className="space-y-3 rounded-xl border border-dashed border-[rgba(61,43,31,0.12)] p-4">
        <SkLine className="mx-auto w-32" />
        <SkLine className="mx-auto w-24" />
        <div className="space-y-2 pt-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex justify-between gap-4">
              <SkLine className="w-1/2" />
              <SkLine className="w-16" />
            </div>
          ))}
        </div>
        <Sk className="mt-4 h-10 w-full rounded-lg" />
      </div>
    </SkWhiteCard>
  );
}

export function InvoiceDetailsPageSkeleton() {
  return (
    <div className="bg-surface text-on-surface flex min-h-0 flex-1 flex-col">
      <main className="flex-1 overflow-auto p-4 sm:p-8">
        <div className="w-full space-y-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-3">
              <SkButton className="w-44" />
              <Sk className="h-8 w-48 rounded-lg" />
            </div>
            <div className="flex gap-2">
              <SkButton className="w-28" />
              <SkButton className="w-28" />
            </div>
          </div>
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
            <SkWhiteCard className="p-6">
              <SkTableHead cols={5} />
              <SkTableRows cols={5} rows={5} />
            </SkWhiteCard>
            <div className="space-y-4">
              <SkWhiteCard className="p-5 space-y-3">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="flex justify-between gap-4">
                    <SkLine className="w-24" />
                    <SkLine className="w-20" />
                  </div>
                ))}
              </SkWhiteCard>
              <InvoiceReceiptSkeleton />
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

/* ── Alerts ── */
export function AlertsPageSkeleton() {
  return (
    <>
          <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div className="space-y-3">
              <SkLine className="w-32" />
              <Sk className="h-10 w-72 max-w-full rounded-lg" />
            </div>
            <div className="flex gap-3">
              <SkButton className="w-28" />
              <SkButton className="w-36" />
            </div>
          </div>
          <div className="mb-6 grid gap-4 sm:grid-cols-2">
            {Array.from({ length: 2 }).map((_, i) => (
              <SkWhiteCard key={i} className="p-5">
                <SkLine className="w-24" />
                <Sk className="mt-2 h-9 w-16 rounded-lg" />
              </SkWhiteCard>
            ))}
          </div>
          <SkShellTabs count={4} />
          <div className="mt-6 space-y-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <SkWhiteCard key={i} className="p-6">
                <div className="flex gap-4">
                  <SkCircle className="size-12 shrink-0" />
                  <div className="min-w-0 flex-1 space-y-3">
                    <Sk className="h-5 w-2/3 max-w-xs rounded-lg" />
                    <SkLine className="w-full" />
                    <SkLine className="w-4/5" />
                    <div className="flex gap-2 pt-1">
                      <SkButton className="h-9 w-24" />
                      <SkButton className="h-9 w-24" />
                    </div>
                  </div>
                </div>
              </SkWhiteCard>
            ))}
          </div>
    </>
  );
}

/* ── Stock ── */
export function StockPageTabsSkeleton() {
  return (
    <div className="border-outline-variant/30 bg-surface sticky top-0 z-20 border-b px-4 py-3 sm:px-6 lg:px-8">
      <SkShellTabs count={4} />
    </div>
  );
}

export function StockCatalogSkeleton({ grid = false }: { grid?: boolean }) {
  return (
    <main className="w-full flex-1 space-y-6 px-4 py-6 sm:px-6 lg:px-8">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap gap-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Sk key={i} className="h-9 w-24 rounded-full" />
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <SkButton className="w-28" />
          <SkButton className="w-28" />
          <Sk className="h-10 w-36 rounded-xl" />
        </div>
      </div>
      {grid ? <StockProductGridSkeleton /> : <StockProductTableSkeleton />}
    </main>
  );
}

export function StockProductTableSkeleton() {
  return (
    <SkWhiteCard>
      <SkTableHead cols={7} />
      <SkTableRows cols={7} rows={8} />
    </SkWhiteCard>
  );
}

export function StockProductGridSkeleton() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {Array.from({ length: 8 }).map((_, i) => (
        <SkWhiteCard key={i} className="overflow-hidden">
          <Sk className="aspect-square w-full rounded-none" />
          <div className="space-y-2 p-4">
            <SkLine className="w-3/4" />
            <SkLine className="w-1/2" />
            <Sk className="h-8 w-20 rounded-full" />
          </div>
        </SkWhiteCard>
      ))}
    </div>
  );
}

export function StockReplenishmentSkeleton() {
  return (
    <main className="w-full flex-1 space-y-6 px-4 py-6 sm:px-6 lg:px-8">
      <SkWhiteCard className="p-5 space-y-4">
        <Sk className="h-6 w-48 rounded-lg" />
        <div className="grid gap-3 sm:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Sk key={i} className="h-11 w-full rounded-xl" />
          ))}
        </div>
        <SkButton className="w-40" />
      </SkWhiteCard>
      <SkWhiteCard>
        <SkTableHead cols={5} />
        <SkTableRows cols={5} rows={6} />
      </SkWhiteCard>
    </main>
  );
}

/* ── Parameters ── */
export function ParametersPageSkeleton() {
  return (
    <div className="bg-surface text-on-surface flex min-h-0 flex-1 flex-col overflow-hidden">
      <div className="border-outline-variant/30 bg-surface sticky top-0 z-20 border-b px-4 py-3 sm:px-8">
        <header className="mb-3 space-y-2">
          <SkLine className="w-28" />
          <Sk className="h-8 w-44 rounded-lg" />
        </header>
        <SkShellTabs count={4} />
      </div>
      <ParametersGeneralFormSkeleton />
    </div>
  );
}

export function ParametersGeneralFormSkeleton() {
  return (
    <SkWhiteCard className="space-y-6 p-5 sm:p-6">
        <div className="grid gap-4 sm:grid-cols-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <div
              key={i}
              className={cn("space-y-2", i === 0 && "sm:col-span-2")}
            >
              <SkLine className="w-24" />
              <Sk className="h-10 w-full rounded-xl" />
            </div>
          ))}
        </div>
        <Sk className="h-24 w-full rounded-xl" />
        <SkButton className="w-36" />
      </SkWhiteCard>
  );
}

export function RolesListSkeleton() {
  return (
    <div className="grid gap-3">
      {Array.from({ length: 4 }).map((_, i) => (
        <SkWhiteCard key={i} className="p-4">
          <div className="mb-3 flex items-start justify-between">
            <Sk className="size-10 rounded-xl" />
            <Sk className="h-5 w-16 rounded-full" />
          </div>
          <Sk className="h-5 w-32 rounded-lg" />
          <SkLine className="mt-2 w-full" />
        </SkWhiteCard>
      ))}
    </div>
  );
}

export function RolesUsersListSkeleton() {
  return (
    <SkWhiteCard className="overflow-hidden">
      {Array.from({ length: 4 }).map((_, i) => (
        <div
          key={i}
          className="flex flex-col gap-3 border-b border-[rgba(61,43,31,0.06)] p-4 last:border-0 sm:flex-row sm:items-center sm:justify-between"
        >
          <div className="min-w-0 flex-1 space-y-2">
            <SkLine className="w-40" />
            <SkLine className="w-56" />
          </div>
          <Sk className="h-10 w-44 rounded-xl" />
        </div>
      ))}
    </SkWhiteCard>
  );
}

/* ── Roles full page ── */
export function RolesPageSkeleton() {
  return (
    <div className="bg-surface text-on-surface flex min-h-0 flex-1 flex-col overflow-hidden">
      <main className="min-h-0 flex-1 overflow-auto">
        <div className="grid w-full gap-6 p-4 sm:p-6 lg:grid-cols-[320px_minmax(0,1fr)] xl:grid-cols-[360px_minmax(0,1fr)] xl:p-8">
          <section className="min-w-0 space-y-4">
            <div className="space-y-2 px-1">
              <SkLine className="w-24" />
              <Sk className="h-8 w-40 rounded-lg" />
            </div>
            {Array.from({ length: 4 }).map((_, i) => (
              <SkWhiteCard key={i} className="p-4">
                <div className="mb-3 flex items-start justify-between">
                  <Sk className="size-10 rounded-xl" />
                  <Sk className="h-5 w-16 rounded-full" />
                </div>
                <Sk className="h-5 w-32 rounded-lg" />
                <SkLine className="mt-2 w-full" />
              </SkWhiteCard>
            ))}
          </section>
          <section className="min-w-0 space-y-4">
            <SkWhiteCard className="p-5">
              <Sk className="h-7 w-48 rounded-lg" />
              <SkLine className="mt-2 w-64" />
            </SkWhiteCard>
            <SkWhiteCard className="p-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between border-b border-[rgba(61,43,31,0.06)] py-3 last:border-0"
                >
                  <SkLine className="w-40" />
                  <Sk className="h-6 w-11 rounded-full" />
                </div>
              ))}
            </SkWhiteCard>
            <SkWhiteCard>
              <SkTableHead cols={4} />
              <SkTableRows cols={4} rows={4} />
            </SkWhiteCard>
          </section>
        </div>
      </main>
    </div>
  );
}

/* ── Returns ── */
export function ReturnsPageSkeleton() {
  return (
    <div className="bg-surface text-on-surface flex min-h-0 flex-1 flex-col">
      <main className="flex-1 overflow-auto p-4 sm:p-8">
        <div className="w-full space-y-6">
          <SkWhiteCard className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-6">
            <div className="space-y-2">
              <Sk className="h-8 w-32 rounded-lg" />
              <SkLine className="w-64 max-w-full" />
            </div>
            <SkButton className="h-11 w-40" />
          </SkWhiteCard>
          <ReturnsItemsTableSkeleton />
        </div>
      </main>
    </div>
  );
}

export function ReturnsItemsTableSkeleton() {
  return (
    <SkWhiteCard>
      <SkTableHead cols={8} />
      <SkTableRows cols={8} rows={7} />
    </SkWhiteCard>
  );
}

export function ReturnDetailsPageSkeleton() {
  return (
    <div className="bg-surface text-on-surface flex min-h-0 flex-1 flex-col">
      <main className="flex-1 overflow-auto p-4 sm:p-8">
        <div className="w-full space-y-6">
          <SkButton className="w-44" />
          <SkWhiteCard className="p-6 space-y-4">
            <Sk className="h-8 w-56 rounded-lg" />
            <div className="grid gap-4 sm:grid-cols-2">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="space-y-2">
                  <SkLine className="w-20" />
                  <Sk className="h-5 w-32 rounded-md" />
                </div>
              ))}
            </div>
          </SkWhiteCard>
          <SkWhiteCard>
            <SkTableHead cols={5} />
            <SkTableRows cols={5} rows={4} />
          </SkWhiteCard>
        </div>
      </main>
    </div>
  );
}

/* ── Procurement ── */
export function ProcurementBonsTableSkeleton() {
  return (
    <div className="flex flex-col gap-3">
      <SkLine className="w-36" />
      <SkWhiteCard>
        <SkTableHead cols={6} />
        <SkTableRows cols={6} rows={6} />
      </SkWhiteCard>
    </div>
  );
}

export function ProcurementPageSkeleton() {
  return (
    <div className="flex h-full min-h-0 flex-1 flex-col gap-4 p-4 md:p-6">
      <SkWhiteCard className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <div className="border-sidebar-border border-b px-4 py-4 md:px-6">
          <div className="flex items-center gap-2">
            <Sk className="size-10 shrink-0 rounded-xl" />
            <div className="space-y-2">
              <SkLine className="w-24" />
              <Sk className="h-6 w-44 rounded-lg" />
            </div>
          </div>
          <SkLine className="mt-3 w-full max-w-md" />
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 md:px-6">
          <ProcurementBonsTableSkeleton />
        </div>
      </SkWhiteCard>
    </div>
  );
}

/* ── POS ── */
export function PosPageSkeleton() {
  return (
    <div className="pos-surface relative flex h-full min-h-0 flex-1 flex-col overflow-hidden">
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden md:flex-row md:items-stretch">
        <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
          <div className="hidden gap-2 overflow-x-auto px-4 py-2 md:flex">
            {Array.from({ length: 4 }).map((_, i) => (
              <Sk key={i} className="h-9 w-36 shrink-0 rounded-full" />
            ))}
          </div>
          <div className="border-b border-[rgba(61,43,31,0.08)] px-4 py-3">
            <div className="flex gap-2 overflow-x-auto">
              {Array.from({ length: 5 }).map((_, i) => (
                <Sk key={i} className="h-9 w-24 shrink-0 rounded-full" />
              ))}
            </div>
          </div>
          <div className="grid flex-1 gap-3 overflow-auto p-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <SkWhiteCard key={i} className="overflow-hidden">
                <Sk className="aspect-[4/3] w-full rounded-none" />
                <div className="p-3 space-y-2">
                  <SkLine className="w-3/4" />
                  <Sk className="h-7 w-20 rounded-full bg-primary/15" />
                </div>
              </SkWhiteCard>
            ))}
          </div>
        </div>
        <div className="hidden min-h-0 w-full max-w-[320px] shrink-0 flex-col border-l border-[rgba(61,43,31,0.08)] bg-white md:flex">
          <div className="flex-1 space-y-2 overflow-hidden p-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <SkWhiteCard key={i} className="p-3">
                <div className="flex gap-3">
                  <Sk className="size-12 shrink-0 rounded-xl" />
                  <div className="min-w-0 flex-1 space-y-2">
                    <SkLine className="w-full" />
                    <SkLine className="w-1/2" />
                  </div>
                </div>
              </SkWhiteCard>
            ))}
          </div>
          <div className="space-y-3 border-t border-[rgba(61,43,31,0.08)] p-3">
            <div className="grid grid-cols-2 gap-2">
              <Sk className="h-10 rounded-xl" />
              <Sk className="h-10 rounded-xl" />
            </div>
            <Sk className="h-10 w-full rounded-xl" />
            <Sk className="h-11 w-full rounded-full bg-primary/15" />
          </div>
        </div>
        <div className="flex min-h-0 flex-1 flex-col md:hidden">
          <div className="flex-1 space-y-2 overflow-hidden p-3">
            {Array.from({ length: 2 }).map((_, i) => (
              <SkWhiteCard key={i} className="p-3">
                <SkLine className="w-full" />
              </SkWhiteCard>
            ))}
          </div>
          <div className="space-y-2 border-t border-[rgba(61,43,31,0.08)] bg-white p-3 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
            <div className="grid grid-cols-2 gap-2">
              <Sk className="h-9 rounded-xl" />
              <Sk className="h-9 rounded-xl" />
            </div>
            <Sk className="h-10 w-full rounded-full bg-primary/15" />
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Generic inline ── */
export function InlineTableSkeleton({
  cols = 4,
  rows = 5,
}: {
  cols?: number;
  rows?: number;
}) {
  return (
    <>
      <SkTableHead cols={cols} />
      <SkTableRows cols={cols} rows={rows} />
    </>
  );
}

export function InlineCardSkeleton({ lines = 3 }: { lines?: number }) {
  return (
    <SkWhiteCard className="p-5 space-y-3">
      {Array.from({ length: lines }).map((_, i) => (
        <SkLine key={i} className={cn(i === 0 ? "w-1/3" : "w-full")} />
      ))}
    </SkWhiteCard>
  );
}
