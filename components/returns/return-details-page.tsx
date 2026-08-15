"use client";

import Link from "next/link";
import { useMemo } from "react";
import { useQuery } from "convex/react";
import { ArrowLeft, ExternalLink, PackageCheck, RotateCcw } from "lucide-react";
import { useLocale } from "next-intl";

import { ReturnDetailsPageSkeleton } from "@/components/skeletons";
import { buttonVariants } from "@/components/ui/button";
import { api } from "@/convex/_generated/api";
import { returnDetailFromConvex } from "@/lib/convex/mappers";
import { formatMad } from "@/lib/money/mad";
import { formatReturnRef } from "@/lib/returns/format-return-ref";
import type { ReturnReason, StockDisposition } from "@/lib/returns/types";
import { formatDateTimeFr } from "@/lib/dates/format-date";
import { cn } from "@/lib/utils";

function reasonLabel(
  reason: ReturnReason,
  tr: (fr: string, ar: string) => string,
) {
  switch (reason) {
    case "Endommagé":
      return tr("Endommagé", "تالف");
    case "Mauvais article":
      return tr("Mauvais article", "صنف خاطئ");
    case "Choix du client":
      return tr("Choix du client", "خيار الزبون");
    case "Autre":
      return tr("Autre", "آخر");
    default:
      return reason;
  }
}

function stockLabel(
  disposition: StockDisposition,
  tr: (fr: string, ar: string) => string,
) {
  return disposition === "Disponible"
    ? tr("Stock disponible", "مخزون متاح")
    : tr("Stock invendable", "مخزون غير قابل للبيع");
}

export function ReturnDetailsPage({ returnId }: { returnId: string }) {
  const locale = useLocale();
  const isAr = locale === "ar";
  const tr = (fr: string, ar: string) => (isAr ? ar : fr);
  const normalizedReturnId = decodeURIComponent(returnId);

  const returnRow = useQuery(api.returns.getById, {
    returnId: normalizedReturnId,
  });

  const detail = useMemo(
    () => (returnRow ? returnDetailFromConvex(returnRow) : null),
    [returnRow],
  );

  const isLoading = returnRow === undefined;
  const returnRef = detail ? formatReturnRef(detail.id) : returnId;

  if (isLoading) {
    return <ReturnDetailsPageSkeleton />;
  }

  return (
    <div className="bg-surface text-on-surface flex min-h-0 flex-1 flex-col">
        <main className="flex-1 overflow-auto p-4 sm:p-8">
          <div className="w-full space-y-6">
            <div className="space-y-2">
              <Link
                href={`/${locale}/stock?tab=returns`}
                className={cn(
                  buttonVariants({ variant: "outline" }),
                  "w-fit gap-2 rounded-xl",
                )}
              >
                <ArrowLeft className="size-4 stroke-[1.75]" aria-hidden />
                {tr("Retour aux retours", "العودة إلى المرتجعات")}
              </Link>
              <div className="flex flex-wrap items-center gap-3">
                <div className="bg-primary/10 text-primary flex size-11 items-center justify-center rounded-xl">
                  <RotateCcw className="size-5 stroke-[1.75]" aria-hidden />
                </div>
                <div>
                  <h1 className="text-2xl font-black tracking-tight">
                    {tr("Retour", "إرجاع")} #{returnRef}
                  </h1>
                  {detail ? (
                    <p className="text-on-surface-variant text-sm font-medium">
                      {formatDateTimeFr(detail.createdAtIso)}
                    </p>
                  ) : null}
                </div>
              </div>
            </div>

            {!detail ? (
              <div className="border-sidebar-border bg-surface-container-lowest rounded-2xl border p-8 text-center shadow-sm">
                <p className="text-on-surface text-lg font-bold">
                  {tr("Retour introuvable", "الإرجاع غير موجود")}
                </p>
              </div>
            ) : (
              <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
                <section className="border-sidebar-border bg-surface-container-lowest space-y-6 rounded-2xl border p-6 shadow-sm">
                  <div className="grid gap-6 sm:grid-cols-2">
                    <div>
                      <p className="text-outline text-[10px] font-bold tracking-widest uppercase">
                        {tr("Client", "العميل")}
                      </p>
                      {detail.clientId ? (
                        <Link
                          href={`/${locale}/clients?clientId=${encodeURIComponent(detail.clientId)}`}
                          className="text-primary mt-2 inline-flex items-center gap-1.5 text-lg font-bold hover:underline"
                        >
                          {detail.clientName}
                          <ExternalLink className="size-4" aria-hidden />
                        </Link>
                      ) : (
                        <p className="mt-2 text-lg font-bold">{detail.clientName}</p>
                      )}
                    </div>
                    <div>
                      <p className="text-outline text-[10px] font-bold tracking-widest uppercase">
                        {tr("Facture", "الفاتورة")}
                      </p>
                      <Link
                        href={`/${locale}/factures/${detail.invoiceId}`}
                        className="text-primary mt-2 inline-flex items-center gap-1.5 text-lg font-bold hover:underline"
                      >
                        {detail.invoiceNumber}
                        <ExternalLink className="size-4" aria-hidden />
                      </Link>
                    </div>
                    <div>
                      <p className="text-outline text-[10px] font-bold tracking-widest uppercase">
                        {tr("Motif", "السبب")}
                      </p>
                      <p className="mt-2 text-lg font-bold">
                        {reasonLabel(detail.reason, tr)}
                      </p>
                    </div>
                    <div>
                      <p className="text-outline text-[10px] font-bold tracking-widest uppercase">
                        {tr("Gestion du stock", "إدارة المخزون")}
                      </p>
                      <p className="mt-2 flex items-center gap-2 text-lg font-bold">
                        <PackageCheck className="text-outline size-5" aria-hidden />
                        {stockLabel(detail.stockDisposition, tr)}
                      </p>
                    </div>
                  </div>

                  {detail.note ? (
                    <div className="border-sidebar-border bg-surface-container-low rounded-xl border p-4">
                      <p className="text-outline text-[10px] font-bold tracking-widest uppercase">
                        {tr("Note", "ملاحظة")}
                      </p>
                      <p className="text-on-surface mt-2 text-sm leading-relaxed">
                        {detail.note}
                      </p>
                    </div>
                  ) : null}

                  <div>
                    <h2 className="text-lg font-black">
                      {tr("Articles retournés", "المنتجات المرتجعة")}
                    </h2>
                    <div className="border-sidebar-border mt-3 overflow-hidden rounded-xl border">
                      <table className="w-full border-collapse text-left text-sm">
                        <thead className="bg-surface-container-low/80">
                          <tr>
                            <th className="text-on-surface-variant px-4 py-3 text-[10px] font-bold tracking-wider uppercase">
                              {tr("Produit", "المنتج")}
                            </th>
                            <th className="text-on-surface-variant px-4 py-3 text-right text-[10px] font-bold tracking-wider uppercase">
                              {tr("Qté", "الكمية")}
                            </th>
                            <th className="text-on-surface-variant px-4 py-3 text-right text-[10px] font-bold tracking-wider uppercase">
                              {tr("Prix unit.", "سعر الوحدة")}
                            </th>
                            <th className="text-on-surface-variant px-4 py-3 text-right text-[10px] font-bold tracking-wider uppercase">
                              {tr("Montant", "المبلغ")}
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-sidebar-border divide-y">
                          {detail.lines.map((line) => (
                            <tr key={`${line.lineIndex}-${line.productName}`}>
                              <td className="px-4 py-3 font-semibold">
                                {line.productName}
                              </td>
                              <td className="px-4 py-3 text-right font-bold tabular-nums">
                                {line.qtyReturned}
                              </td>
                              <td className="text-on-surface-variant px-4 py-3 text-right tabular-nums">
                                {formatMad(line.unitPriceMad, 2, locale)}
                              </td>
                              <td className="px-4 py-3 text-right font-black tabular-nums">
                                {formatMad(line.lineRefundMad, 2, locale)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </section>

                <aside className="border-sidebar-border bg-inverse-surface text-inverse-on-surface h-fit rounded-2xl border p-6 shadow-sm">
                  <p className="text-[11px] font-black tracking-widest uppercase opacity-60">
                    {tr("Remboursement total", "إجمالي الاسترداد")}
                  </p>
                  <p className="text-secondary-fixed mt-3 text-4xl font-black tabular-nums">
                    {formatMad(detail.refundTotalMad, 2, locale)}
                  </p>
                  <p className="mt-4 text-sm opacity-80">
                    {detail.lines.length}{" "}
                    {tr(
                      detail.lines.length === 1 ? "article" : "articles",
                      detail.lines.length === 1 ? "منتج" : "منتجات",
                    )}
                  </p>
                  <Link
                    href={`/${locale}/factures/${detail.invoiceId}`}
                    className={cn(
                      buttonVariants({ variant: "secondary" }),
                      "mt-6 inline-flex w-full justify-center rounded-xl font-bold",
                    )}
                  >
                    {tr("Voir la facture", "عرض الفاتورة")}
                  </Link>
                </aside>
              </div>
            )}
          </div>
        </main>
      </div>
  );
}
