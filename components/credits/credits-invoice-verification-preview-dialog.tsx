"use client";

import { useMemo } from "react";
import Link from "next/link";
import { useQuery } from "convex/react";
import {
  CheckCircle2,
  ExternalLink,
  Loader2,
  ReceiptText,
  UserRound,
} from "lucide-react";

import { InvoiceBarcode } from "@/components/invoices/invoice-barcode";
import { Sk, SkLine } from "@/components/skeletons";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { invoiceFromConvex } from "@/lib/convex/mappers";
import {
  invoicePaidMad,
  invoiceRemainingMad,
  invoiceRemainingQty,
} from "@/lib/invoices/storage";
import { formatDateFr } from "@/lib/dates/format-date";
import { formatPosDh } from "@/lib/pos/format-pos-dh";
import { statusPillClass } from "@/lib/ui/status-pill";
import { cn } from "@/lib/utils";

export type CreditInvoiceVerificationRow = {
  id: Id<"invoices">;
  number: string;
  barcode: string;
  date: string;
  time: string;
  clientName: string;
  clientId?: Id<"clients">;
  totalMad: number;
  status: "paid" | "pending" | "returned";
};

type CreditsInvoiceVerificationPreviewDialogProps = {
  invoice: CreditInvoiceVerificationRow | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  locale: string;
  tr: (fr: string, ar: string) => string;
  onOpenClientFiche?: (clientId: string) => void;
  onVerify: () => void;
  verifying?: boolean;
  verifyMethod?: "manual" | "barcode_scan";
};

function statusLabel(
  status: CreditInvoiceVerificationRow["status"],
  tr: (fr: string, ar: string) => string,
) {
  if (status === "paid") return tr("Soldée", "مسددة");
  if (status === "returned") return tr("Retournée", "مرتجعة");
  return tr("En cours", "قيد السداد");
}

export function CreditsInvoiceVerificationPreviewDialog({
  invoice,
  open,
  onOpenChange,
  locale,
  tr,
  onOpenClientFiche,
  onVerify,
  verifying = false,
}: CreditsInvoiceVerificationPreviewDialogProps) {
  const invoiceRow = useQuery(
    api.invoices.getWithLines,
    invoice && open ? { invoiceId: invoice.id } : "skip",
  );

  const fullInvoice = useMemo(
    () => (invoiceRow ? invoiceFromConvex(invoiceRow) : null),
    [invoiceRow],
  );

  const loadingDetails = invoice != null && open && invoiceRow === undefined;
  const paidMad = fullInvoice ? invoicePaidMad(fullInvoice) : 0;
  const remainingMad = fullInvoice ? invoiceRemainingMad(fullInvoice) : 0;
  const displayStatus = fullInvoice?.status ?? invoice?.status ?? "pending";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[92dvh] max-w-lg flex-col gap-0 overflow-hidden rounded-2xl p-0 sm:max-w-xl">
        {invoice ? (
          <>
            <DialogHeader className="border-sidebar-border shrink-0 space-y-2 border-b px-5 pt-5 pb-4 text-start">
              <div className="flex items-start justify-between gap-3">
                <div className="bg-primary/10 text-primary flex size-11 shrink-0 items-center justify-center rounded-xl">
                  <ReceiptText className="size-5 stroke-[1.75]" aria-hidden />
                </div>
                <span
                  className={cn(
                    statusPillClass,
                    "px-2.5 py-1 text-[10px] font-bold uppercase",
                    displayStatus === "paid" &&
                      "bg-secondary-container text-on-secondary-container",
                    displayStatus === "pending" &&
                      "bg-tertiary-fixed text-on-tertiary-fixed",
                    displayStatus === "returned" &&
                      "bg-surface-container-high text-on-surface-variant",
                  )}
                >
                  {statusLabel(displayStatus, tr)}
                </span>
              </div>
              <DialogTitle className="font-mono text-xl font-black">
                {invoice.number}
              </DialogTitle>
              <DialogDescription className="text-on-surface text-sm font-semibold">
                {invoice.clientName}
              </DialogDescription>
              <p className="text-on-surface-variant text-xs tabular-nums">
                {formatDateFr(invoice.date)} · {invoice.time}
              </p>
            </DialogHeader>

            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-4">
              <div className="grid grid-cols-3 gap-2">
                <StatBox
                  label={tr("Total TTC", "الإجمالي")}
                  value={formatPosDh(invoice.totalMad, 2, locale)}
                  emphasis
                />
                <StatBox
                  label={tr("Encaissé", "المحصّل")}
                  value={formatPosDh(paidMad, 2, locale)}
                  tone="secondary"
                />
                <StatBox
                  label={tr("Reste dû", "المتبقي")}
                  value={formatPosDh(remainingMad, 2, locale)}
                  tone={remainingMad > 0 ? "warning" : "ok"}
                />
              </div>

              {loadingDetails ? (
                <ul className="border-sidebar-border divide-sidebar-border divide-y rounded-xl border">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <li
                      key={i}
                      className="flex items-start justify-between gap-2 px-3 py-2.5"
                    >
                      <div className="min-w-0 flex-1 space-y-2">
                        <SkLine className="w-3/4" />
                        <SkLine className="h-2.5 w-1/2" />
                      </div>
                      <Sk className="h-4 w-16 shrink-0 rounded-md" />
                    </li>
                  ))}
                </ul>
              ) : fullInvoice ? (
                <>
                  <div>
                    <p className="text-outline mb-2 text-[10px] font-bold tracking-widest uppercase">
                      {tr("Articles", "الأصناف")}
                    </p>
                    <ul className="border-sidebar-border divide-sidebar-border divide-y rounded-xl border">
                      {fullInvoice.lines.map((line, idx) => (
                        <li
                          key={`${line.nameAr}:${idx}`}
                          className="flex items-start justify-between gap-2 px-3 py-2.5"
                        >
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-semibold">{line.nameAr}</p>
                            <p className="text-on-surface-variant mt-0.5 text-xs tabular-nums">
                              {invoiceRemainingQty(line)} ×{" "}
                              {formatPosDh(line.unitPriceMad, 2, locale)}
                            </p>
                          </div>
                          <p className="shrink-0 text-sm font-bold tabular-nums">
                            {formatPosDh(
                              invoiceRemainingQty(line) * line.unitPriceMad,
                              2,
                              locale,
                            )}
                          </p>
                        </li>
                      ))}
                    </ul>
                  </div>

                  {fullInvoice.paymentHistory.length > 0 ? (
                    <div>
                      <p className="text-outline mb-2 text-[10px] font-bold tracking-widest uppercase">
                        {tr("Paiements", "المدفوعات")}
                      </p>
                      <ul className="border-sidebar-border divide-sidebar-border divide-y rounded-xl border">
                        {fullInvoice.paymentHistory.map((payment) => (
                          <li
                            key={payment.id}
                            className="flex items-center justify-between gap-2 px-3 py-2"
                          >
                            <div className="min-w-0">
                              <p className="truncate text-xs font-medium">
                                {payment.note}
                              </p>
                              <p className="text-on-surface-variant text-[10px] tabular-nums">
                                {formatDateFr(payment.date)}
                              </p>
                            </div>
                            <p className="text-secondary shrink-0 text-sm font-bold tabular-nums">
                              {formatPosDh(payment.amountMad, 2, locale)}
                            </p>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}

                  <p className="text-on-surface-variant text-xs">
                    {tr("Caissier", "أمين الصندوق")}:{" "}
                    <span className="font-semibold">{fullInvoice.cashierId}</span>
                  </p>
                </>
              ) : null}

              <div className="border-sidebar-border bg-surface-container-low/60 rounded-xl border px-3 py-3">
                <InvoiceBarcode
                  value={invoice.barcode}
                  className="h-auto w-full text-on-surface"
                />
              </div>
            </div>

            <DialogFooter className="border-sidebar-border shrink-0 flex-col gap-2 border-t px-5 py-4 sm:flex-row sm:justify-between">
              <div className="flex flex-wrap gap-2">
                {invoice.clientId && onOpenClientFiche ? (
                  <Button
                    type="button"
                    variant="outline"
                    className="border-primary/30 bg-primary/10 text-primary hover:bg-primary/15 gap-1.5 rounded-xl font-bold"
                    disabled={verifying}
                    onClick={() => onOpenClientFiche(invoice.clientId!)}
                  >
                    <UserRound className="size-4 stroke-[1.75]" aria-hidden />
                    {tr("Fiche client", "بطاقة العميل")}
                  </Button>
                ) : null}
                <Link
                  href={`/${locale}/factures/${invoice.id}`}
                  target="_blank"
                  className="border-input bg-background hover:bg-accent inline-flex h-9 items-center gap-1.5 rounded-xl border px-3 text-xs font-bold"
                >
                  <ExternalLink className="size-3.5" aria-hidden />
                  {tr("Facture complète", "الفاتورة الكاملة")}
                </Link>
              </div>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  className="rounded-xl font-bold"
                  disabled={verifying}
                  onClick={() => onOpenChange(false)}
                >
                  {tr("Fermer", "إغلاق")}
                </Button>
                <Button
                  type="button"
                  className="from-secondary to-on-secondary-container gap-1.5 rounded-xl bg-linear-to-br font-black text-white"
                  disabled={verifying}
                  onClick={onVerify}
                >
                  {verifying ? (
                    <>
                      <Loader2 className="size-4 animate-spin" aria-hidden />
                      {tr("Vérification…", "جاري التحقق…")}
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="size-4 stroke-[1.75]" aria-hidden />
                      {tr("Vérifier", "تحقق")}
                    </>
                  )}
                </Button>
              </div>
            </DialogFooter>
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function StatBox({
  label,
  value,
  emphasis,
  tone,
}: {
  label: string;
  value: string;
  emphasis?: boolean;
  tone?: "secondary" | "warning" | "ok";
}) {
  return (
    <div
      className={cn(
        "rounded-xl border px-2.5 py-2",
        emphasis
          ? "border-primary/20 bg-primary/8"
          : "border-sidebar-border/70 bg-surface-container-low/60",
      )}
    >
      <p className="text-on-surface-variant text-[9px] font-bold tracking-wide uppercase">
        {label}
      </p>
      <p
        className={cn(
          "mt-0.5 text-sm font-black tabular-nums",
          emphasis && "text-primary",
          tone === "secondary" && "text-secondary",
          tone === "warning" && "text-tertiary",
          tone === "ok" && "text-secondary",
        )}
      >
        {value}
      </p>
    </div>
  );
}
