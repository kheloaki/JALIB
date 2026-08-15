"use client";

import Link from "next/link";
import { useCallback, useMemo, useState } from "react";
import { flushSync } from "react-dom";
import { useMutation, useQuery } from "convex/react";
import { ArrowLeft, Building2, ReceiptText, Trash2 } from "lucide-react";
import { useLocale } from "next-intl";
import { useRouter } from "next/navigation";

import {
  InvoiceReceiptPreview,
  type InvoiceReceiptMode,
} from "@/components/invoices/invoice-receipt-preview";
import { InvoiceReceiptActions } from "@/components/invoices/invoice-receipt-actions";
import { InvoiceDetailsPageSkeleton } from "@/components/skeletons";
import { Button, buttonVariants } from "@/components/ui/button";
import { ConfirmDeleteDialog } from "@/components/ui/confirm-delete-dialog";
import { useToast } from "@/components/ui/toaster";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { canDeleteInvoices } from "@/lib/auth/permissions";
import { invoiceFromConvex } from "@/lib/convex/mappers";
import {
  invoicePaidMad,
  invoiceRemainingMad,
  invoiceRemainingQty,
} from "@/lib/invoices/storage";
import { formatDateFr } from "@/lib/dates/format-date";
import { formatMad } from "@/lib/money/mad";
import { printElementById } from "@/lib/print/wait-for-print-images";
import { cn } from "@/lib/utils";

export function InvoiceDetailsPage({ invoiceId }: { invoiceId: string }) {
  const locale = useLocale();
  const isAr = locale === "ar";
  const tr = (fr: string, ar: string) => (isAr ? ar : fr);
  const router = useRouter();
  const toast = useToast();
  const normalizedInvoiceId = decodeURIComponent(invoiceId);
  const invoiceRow = useQuery(api.invoices.getWithLines, {
    invoiceId: normalizedInvoiceId,
  });
  const currentUser = useQuery(api.authz.currentUser);
  const canDelete = canDeleteInvoices(currentUser?.permissions ?? []);
  const removeInvoice = useMutation(api.invoices.remove);
  const hasClientAccess = (currentUser?.permissions ?? []).some(
    (permission) =>
      permission === "clients.view" || permission === "clients.manage",
  );
  const invoice = useMemo(
    () => (invoiceRow ? invoiceFromConvex(invoiceRow) : null),
    [invoiceRow],
  );
  const clientRow = useQuery(
    api.clients.findByFullName,
    hasClientAccess && invoice?.clientName
      ? { fullName: invoice.clientName }
      : "skip",
  );
  const clientPhone = clientRow?.phone ?? null;
  const isLoadingInvoice = invoiceRow === undefined;
  const [receiptMode, setReceiptMode] =
    useState<InvoiceReceiptMode>("client");
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  function printMode(mode: InvoiceReceiptMode) {
    flushSync(() => {
      setReceiptMode(mode);
    });
    void printElementById("invoice-print-area");
  }

  const prepareOwnerCopy = useCallback(() => {
    flushSync(() => {
      setReceiptMode("owner");
    });
  }, []);

  async function handleConfirmDelete() {
    if (!invoice) return;
    setDeleting(true);
    try {
      await removeInvoice({ invoiceId: invoice.id as Id<"invoices"> });
      toast.success(
        tr("Facture supprimée", "تم حذف الفاتورة"),
        `#${invoice.number}`,
      );
      router.replace(`/${locale}/factures`);
    } catch (error) {
      toast.error(
        tr("Suppression impossible", "تعذر الحذف"),
        error instanceof Error ? error.message : "DELETE_FAILED",
      );
    } finally {
      setDeleting(false);
    }
  }
  if (isLoadingInvoice) {
    return <InvoiceDetailsPageSkeleton />;
  }

  return (
    <div className="bg-surface text-on-surface flex min-h-0 flex-1 flex-col">
        <main className="flex-1 overflow-auto p-4 sm:p-8">
          <div className="admin-page-scroll-content w-full space-y-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="space-y-2">
                <Link
                  href={`/${locale}/factures`}
                  className={cn(
                    buttonVariants({ variant: "outline" }),
                    "w-fit gap-2 rounded-xl",
                  )}
                >
                  <ArrowLeft className="size-4 stroke-[1.75]" aria-hidden />
                  {tr("Retour aux factures", "العودة إلى الفواتير")}
                </Link>
                <div>
                  <h1 className="text-2xl font-black tracking-tight">
                    {tr("Détails facture", "تفاصيل الفاتورة")}
                  </h1>
                </div>
              </div>
              {invoice ? (
                <div className="grid gap-2 sm:flex sm:items-center">
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full gap-2 rounded-xl font-bold sm:w-auto"
                    onClick={() => printMode("client")}
                  >
                    <ReceiptText className="size-4 stroke-[1.75]" aria-hidden />
                    {tr("Ticket client", "تذكرة الزبون")}
                  </Button>
                  <Button
                    type="button"
                    className="w-full gap-2 rounded-xl font-bold sm:w-auto"
                    onClick={() => printMode("owner")}
                  >
                    <Building2 className="size-4 stroke-[1.75]" aria-hidden />
                    {tr("Copie interne", "نسخة المتجر")}
                  </Button>
                  {canDelete ? (
                    <Button
                      type="button"
                      variant="destructive"
                      className="w-full gap-2 rounded-xl font-bold sm:w-auto"
                      onClick={() => setDeleteOpen(true)}
                    >
                      <Trash2 className="size-4 stroke-[1.75]" aria-hidden />
                      {tr("Supprimer", "حذف")}
                    </Button>
                  ) : null}
                </div>
              ) : null}
            </div>

            {!invoice ? (
              <div className="border-sidebar-border bg-surface-container-lowest rounded-2xl border p-8 text-center shadow-sm">
                <p className="text-on-surface text-lg font-bold">
                  {isLoadingInvoice
                    ? tr("Chargement de la facture…", "جاري تحميل الفاتورة…")
                    : tr("Facture introuvable", "الفاتورة غير موجودة")}
                </p>
                <p className="text-on-surface-variant mt-2 text-sm">
                  {isLoadingInvoice
                    ? tr(
                        "Lecture des lignes et paiements depuis Convex.",
                        "تتم قراءة العناصر والمدفوعات من Convex.",
                      )
                    : tr(
                        "Cette facture n'existe pas dans Convex.",
                        "هذه الفاتورة غير موجودة في Convex.",
                      )}
                </p>
              </div>
            ) : (
              <section className="border-sidebar-border bg-surface-container-lowest rounded-2xl border p-6 shadow-sm">
                  <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-4">
                    <div>
                      <p className="text-outline text-[10px] font-bold tracking-widest uppercase">
                        {tr("Facture", "الفاتورة")}
                      </p>
                      <p className="mt-2 text-xl font-black">{invoice.number}</p>
                    </div>
                    <div>
                      <p className="text-outline text-[10px] font-bold tracking-widest uppercase">
                        {tr("Client", "العميل")}
                      </p>
                      <p className="mt-2 text-lg font-bold">{invoice.clientName}</p>
                      {clientPhone ? (
                        <p className="text-on-surface-variant mt-0.5 text-sm font-medium tabular-nums">
                          {clientPhone}
                        </p>
                      ) : null}
                    </div>
                    <div>
                      <p className="text-outline text-[10px] font-bold tracking-widest uppercase">
                        {tr("Montant payé", "المبلغ المدفوع")}
                      </p>
                      <p className="mt-2 text-xl font-black text-emerald-700">
                        {formatMad(invoicePaidMad(invoice), 2, locale)}
                      </p>
                    </div>
                    <div>
                      <p className="text-outline text-[10px] font-bold tracking-widest uppercase">
                        {tr("Reste dû", "المتبقي المستحق")}
                      </p>
                      <p className="mt-2 text-xl font-black text-rose-700">
                        {formatMad(invoiceRemainingMad(invoice), 2, locale)}
                      </p>
                    </div>
                  </div>

                  <div className="mt-8 grid gap-6 xl:grid-cols-[minmax(0,1fr)_min(100%,380px)]">
                    <div className="min-w-0 space-y-4">
                      <div>
                        <h2 className="text-lg font-black">{tr("Articles", "العناصر")}</h2>
                        <div className="mt-3 overflow-hidden rounded-2xl border border-slate-200">
                          <table className="w-full text-left text-sm">
                            <thead className="bg-surface-container-low/80">
                              <tr>
                                <th className="px-4 py-3 text-[10px] font-bold tracking-widest uppercase">
                                  {tr("Produit", "المنتج")}
                                </th>
                                <th className="px-4 py-3 text-[10px] font-bold tracking-widest uppercase">
                                  {tr("Qté", "الكمية")}
                                </th>
                                <th className="px-4 py-3 text-[10px] font-bold tracking-widest uppercase">
                                  {tr("Prix", "السعر")}
                                </th>
                              </tr>
                            </thead>
                            <tbody>
                              {invoice.lines.map((line, idx) => (
                                <tr key={`${line.nameAr}-${idx}`} className="border-t border-slate-200">
                                  <td className="px-4 py-3 font-medium">{line.nameAr}</td>
                                  <td className="px-4 py-3">
                                    {invoiceRemainingQty(line)}
                                    {(line.returnedQty ?? 0) > 0 ? (
                                      <span className="text-on-surface-variant ml-2 text-xs">
                                        {tr(" (retourné: ", " (مرتجع: ")}
                                        {line.returnedQty}
                                        {")"}
                                      </span>
                                    ) : null}
                                  </td>
                                  <td className="px-4 py-3 font-bold">
                                    {formatMad(line.unitPriceMad, 2, locale)}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>

                      <div>
                        <h2 className="text-lg font-black">
                          {tr("Historique des paiements", "سجل المدفوعات")}
                        </h2>
                        <div className="mt-3 space-y-3">
                          {invoice.paymentHistory.length === 0 ? (
                            <div className="border-sidebar-border bg-surface-container-low rounded-2xl border p-4 text-sm text-slate-500">
                              {tr(
                                "Aucun paiement enregistré pour cette facture.",
                                "لا توجد مدفوعات مسجلة لهذه الفاتورة.",
                              )}
                            </div>
                          ) : (
                            invoice.paymentHistory.map((payment) => {
                              const isReturnPayment =
                                /retour/i.test(payment.note) ||
                                /retour/i.test(payment.ref) ||
                                /^RT-/i.test(payment.ref);
                              return (
                              <div
                                key={payment.id}
                                className={cn(
                                  "border-sidebar-border rounded-2xl border p-4",
                                  isReturnPayment
                                    ? "border-orange-200 bg-orange-50"
                                    : "bg-surface-container-low",
                                )}
                              >
                                <div className="flex items-start justify-between gap-4">
                                  <div>
                                    <p className="font-bold">{payment.note}</p>
                                    <p className="text-on-surface-variant mt-1 text-sm">
                                      {payment.ref}
                                    </p>
                                  </div>
                                  <div className="text-right">
                                    <p
                                      className={cn(
                                        "font-black",
                                        isReturnPayment
                                          ? "text-orange-600"
                                          : payment.amountMad >= 0
                                            ? "text-emerald-700"
                                            : "text-rose-700",
                                      )}
                                    >
                                      {payment.amountMad >= 0 ? "+" : ""}
                                      {formatMad(payment.amountMad, 2, locale)}
                                    </p>
                                    <p className="text-on-surface-variant mt-1 text-sm">
                                      {formatDateFr(payment.date)}
                                    </p>
                                  </div>
                                </div>
                              </div>
                              );
                            })
                          )}
                        </div>
                      </div>
                    </div>

                    <aside className="border-sidebar-border bg-surface-container-low/40 min-w-0 rounded-2xl border p-4 xl:sticky xl:top-4 xl:self-start">
                      <h2 className="text-outline mb-4 text-xs font-bold tracking-widest uppercase">
                        {tr("Aperçu facture", "معاينة الفاتورة")}
                      </h2>
                      <InvoiceReceiptPreview
                        invoice={invoice}
                        mode={receiptMode}
                        onModeChange={setReceiptMode}
                        layout="sidebar"
                      />
                      <InvoiceReceiptActions
                        invoice={invoice}
                        mode={receiptMode}
                        onPrint={() => printMode(receiptMode)}
                        tr={tr}
                        className="mt-4"
                        clientPhone={clientPhone}
                      />
                    </aside>
                  </div>
                </section>
            )}
          </div>
        </main>

      <ConfirmDeleteDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        entityName={invoice ? `#${invoice.number}` : ""}
        confirmText={invoice?.number ?? ""}
        title={tr("Supprimer cette facture ?", "حذف هذه الفاتورة؟")}
        description={tr(
          "La facture et ses lignes / paiements / crédits liés seront définitivement supprimés. Tapez le numéro exact pour confirmer.",
          "سيتم حذف الفاتورة وعناصرها ومدفوعاتها وائتمانها نهائيًا. اكتب رقم الفاتورة تمامًا للتأكيد.",
        )}
        typePrompt={tr(
          `Tapez « ${invoice?.number ?? ""} » pour confirmer`,
          `اكتب « ${invoice?.number ?? ""} » للتأكيد`,
        )}
        confirmLabel={tr("Supprimer définitivement", "حذف نهائي")}
        cancelLabel={tr("Annuler", "إلغاء")}
        busy={deleting}
        onConfirm={handleConfirmDelete}
      />
      </div>
  );
}
