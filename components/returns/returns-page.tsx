"use client";

import { useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useQuery } from "convex/react";
import { useLocale } from "next-intl";
import { Plus } from "lucide-react";

import { useAdminChrome } from "@/components/layout/admin-chrome-context";
import { AdminFilterSummary } from "@/components/layout/admin-filter-summary";
import { NewReturnDialog } from "@/components/returns/new-return-dialog";
import { ReturnsItemsTable } from "@/components/returns/returns-items-table";
import { Button } from "@/components/ui/button";
import { api } from "@/convex/_generated/api";
import { returnItemFromConvex } from "@/lib/convex/mappers";

export function ReturnsPage() {
  return <ReturnsPageContent />;
}

export function ReturnsPageContent() {
  const locale = useLocale();
  const isAr = locale === "ar";
  const tr = (fr: string, ar: string) => (isAr ? ar : fr);
  const { headerSearchQuery, setHeaderSearchQuery } = useAdminChrome();
  const searchParams = useSearchParams();
  const urlInvoiceId = searchParams.get("invoiceId")?.trim() ?? "";
  const urlRef = searchParams.get("ref")?.trim().toLowerCase() ?? "";
  const [newReturnOpen, setNewReturnOpen] = useState(false);

  const returnItemRows = useQuery(api.returns.listReturnItems, { limit: 200 });

  const returnItems = useMemo(
    () => (returnItemRows ?? []).map(returnItemFromConvex),
    [returnItemRows],
  );

  const filteredItems = useMemo(() => {
    let rows = returnItems;
    if (urlInvoiceId) {
      rows = rows.filter((row) => row.invoiceId === urlInvoiceId);
    }
    if (urlRef) {
      rows = rows.filter((row) => {
        const hay = [
          row.invoiceNumber,
          row.productName,
          row.returnId,
          row.note ?? "",
        ]
          .join(" ")
          .toLowerCase();
        return hay.includes(urlRef);
      });
    }
    const q = headerSearchQuery.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((row) => {
      const hay = [
        row.invoiceNumber,
        row.clientName,
        row.productName,
        row.reason,
        row.stockDisposition,
        row.createdAtIso.slice(0, 10),
        row.note ?? "",
      ]
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [headerSearchQuery, returnItems, urlInvoiceId, urlRef]);

  const hydrated = returnItemRows !== undefined;

  return (
    <div className="bg-surface text-on-surface flex min-h-0 flex-1 flex-col">
      <main className="flex-1 overflow-auto p-4 sm:p-8">
        <div className="w-full space-y-6">
          <div className="border-sidebar-border bg-surface-container-lowest flex flex-col gap-4 rounded-xl border p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between sm:p-6">
            <div className="min-w-0">
              <p className="text-on-surface-variant text-sm">
                {tr(
                  "Articles retournés liés aux factures clients.",
                  "المنتجات المرتجعة المرتبطة بفواتير العملاء.",
                )}
              </p>
            </div>
            <Button
              type="button"
              onClick={() => setNewReturnOpen(true)}
              className="from-primary to-primary-container text-on-primary h-11 rounded-xl bg-linear-to-br px-5 font-black shadow-[0_8px_20px_rgba(61,43,31,0.18)]"
            >
              <Plus className="size-4 stroke-[2.5]" aria-hidden />
              {tr("Nouveau retour", "إرجاع جديد")}
            </Button>
          </div>

          <AdminFilterSummary
            filteredCount={filteredItems.length}
            totalCount={returnItems.length}
            searchQuery={headerSearchQuery}
            onClearSearch={() => setHeaderSearchQuery("")}
            extraActive={Boolean(urlInvoiceId || urlRef)}
            extraLabel={
              urlInvoiceId
                ? tr("Facture liée", "فاتورة مرتبطة")
                : urlRef
                  ? tr("Référence URL", "مرجع الرابط")
                  : undefined
            }
            itemLabel={tr("ligne", "سطر")}
            itemLabelPlural={tr("lignes", "أسطر")}
          />

          <ReturnsItemsTable
            rows={filteredItems}
            hydrated={hydrated}
            tr={tr}
          />
        </div>
      </main>

      <NewReturnDialog
        open={newReturnOpen}
        onOpenChange={setNewReturnOpen}
        tr={tr}
      />
    </div>
  );
}
