"use client";

import { useDeferredValue, useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { useLocale } from "next-intl";
import {
  ArrowLeft,
  ClipboardList,
  FileText,
  PackageCheck,
  Search,
  ShieldAlert,
  X,
} from "lucide-react";

import { QtyKeypadField } from "@/components/money/qty-keypad-field";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/components/ui/toaster";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { canProcessReturns } from "@/lib/auth/permissions";
import { invoiceFromConvex } from "@/lib/convex/mappers";
import type { Invoice } from "@/lib/invoices/types";
import { formatDateFr, formatTodayDateFr } from "@/lib/dates/format-date";
import { formatMad } from "@/lib/money/mad";
import type { ReturnReason, ReturnableInvoiceSummary, StockDisposition } from "@/lib/returns/types";
import { cn } from "@/lib/utils";

type DialogStep = "search" | "form";
type QtyByLineIndex = Record<number, number>;

const REASONS: ReturnReason[] = [
  "Endommagé",
  "Mauvais article",
  "Choix du client",
  "Autre",
];

function reasonLabel(r: ReturnReason, tr: (fr: string, ar: string) => string) {
  switch (r) {
    case "Endommagé":
      return tr("Endommagé / تالف", "تالف / Endommagé");
    case "Mauvais article":
      return tr("Mauvais article / صنف خاطئ", "صنف خاطئ / Mauvais article");
    case "Choix du client":
      return tr("Choix du client / خيار الزبون", "خيار الزبون / Choix du client");
    case "Autre":
      return tr("Autre / آخر", "آخر / Autre");
    default:
      return r;
  }
}

function invoiceRemainingQty(line: Invoice["lines"][number]): number {
  return Math.max(0, line.qty - (line.returnedQty ?? 0));
}

function ReturnRadioControl({
  checked,
  name,
  onChange,
  activeClassName,
}: {
  checked: boolean;
  name: string;
  onChange: () => void;
  activeClassName: string;
}) {
  return (
    <>
      <input
        type="radio"
        name={name}
        checked={checked}
        onChange={onChange}
        className="peer sr-only"
      />
      <span
        aria-hidden
        className={cn(
          "mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border-2 transition-colors",
          "peer-focus-visible:ring-primary/30 peer-focus-visible:ring-2",
          checked
            ? activeClassName
            : "border-outline-variant bg-surface-container-lowest",
        )}
      >
        <span
          className={cn(
            "size-2 rounded-full bg-white transition-opacity",
            checked ? "opacity-100" : "opacity-0",
          )}
        />
      </span>
    </>
  );
}

export function NewReturnDialog({
  open,
  onOpenChange,
  tr,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tr: (fr: string, ar: string) => string;
}) {
  const locale = useLocale();
  const toast = useToast();
  const createReturn = useMutation(api.returns.create);
  const currentUser = useQuery(api.authz.currentUser);
  const canSubmitReturn = canProcessReturns(currentUser?.permissions ?? []);

  const [step, setStep] = useState<DialogStep>("search");
  const [invoiceSearch, setInvoiceSearch] = useState("");
  const deferredInvoiceSearch = useDeferredValue(invoiceSearch.trim());
  const [selectedInvoiceSummary, setSelectedInvoiceSummary] =
    useState<ReturnableInvoiceSummary | null>(null);
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<string | null>(null);
  const [qtyByLineIndex, setQtyByLineIndex] = useState<QtyByLineIndex>({});
  const [reason, setReason] = useState<ReturnReason>("Endommagé");
  const [stockDisposition, setStockDisposition] =
    useState<StockDisposition>("Invendable");
  const [note, setNote] = useState("");
  const [returnError, setReturnError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const searchResults = useQuery(
    api.returns.searchReturnableInvoices,
    open
      ? {
          ...(deferredInvoiceSearch ? { search: deferredInvoiceSearch } : {}),
          limit: 50,
        }
      : "skip",
  );

  const returnableInvoices = useMemo<ReturnableInvoiceSummary[]>(
    () =>
      (searchResults ?? []).map((invoice) => ({
        id: invoice.id,
        number: invoice.number,
        date: invoice.date,
        time: invoice.time,
        clientName: invoice.clientName,
        paymentType: invoice.paymentType,
        totalMad: invoice.totalMad,
        returnableLinesCount: invoice.returnableLinesCount,
        returnableProductNames: invoice.returnableProductNames,
      })),
    [searchResults],
  );

  const invoiceRow = useQuery(
    api.invoices.getWithLines,
    open && selectedInvoiceId ? { invoiceId: selectedInvoiceId } : "skip",
  );

  const selectedInvoice = useMemo(
    () => (invoiceRow ? invoiceFromConvex(invoiceRow) : null),
    [invoiceRow],
  );

  const returnLines = useMemo(() => {
    if (!selectedInvoice) return [];
    return selectedInvoice.lines.map((line, idx) => {
      const maxReturnableQty = invoiceRemainingQty(line);
      const qtyReturnedRaw = qtyByLineIndex[idx] ?? 0;
      const qtyReturned = Math.max(
        0,
        Math.min(
          maxReturnableQty,
          Number.isFinite(qtyReturnedRaw) ? qtyReturnedRaw : 0,
        ),
      );
      const refund = Math.round(qtyReturned * line.unitPriceMad * 100) / 100;
      return { idx, line, qtyReturned, refund, maxReturnableQty };
    });
  }, [selectedInvoice, qtyByLineIndex]);

  const refundTotal = useMemo(() => {
    const sum = returnLines.reduce((acc, row) => acc + row.refund, 0);
    return Math.round(sum * 100) / 100;
  }, [returnLines]);

  const anyQty = returnLines.some((row) => row.qtyReturned > 0);
  const isCreditClient = selectedInvoice?.paymentType === "credit";
  const invoiceTotal = selectedInvoice?.totalMad ?? 0;
  const newBalanceMad = Math.max(
    0,
    Math.round((invoiceTotal - refundTotal) * 100) / 100,
  );

  useEffect(() => {
    if (!open) {
      setStep("search");
      setInvoiceSearch("");
      setSelectedInvoiceSummary(null);
      setSelectedInvoiceId(null);
      setQtyByLineIndex({});
      setReason("Endommagé");
      setStockDisposition("Invendable");
      setNote("");
      setReturnError(null);
      setSubmitting(false);
    }
  }, [open]);

  function setQty(idx: number, next: number) {
    if (!selectedInvoice) return;
    const max = invoiceRemainingQty(
      selectedInvoice.lines[idx] ?? { nameAr: "", qty: 0, unitPriceMad: 0 },
    );
    const clamped = Math.max(0, Math.min(max, Number.isFinite(next) ? next : 0));
    setQtyByLineIndex((prev) => ({ ...prev, [idx]: clamped }));
  }

  async function confirmReturn() {
    if (!selectedInvoice || !anyQty) return;
    const lines = returnLines
      .filter((row) => row.qtyReturned > 0)
      .map((row) => ({ lineIndex: row.idx, qtyReturned: row.qtyReturned }));

    try {
      setSubmitting(true);
      setReturnError(null);
      await createReturn({
        invoiceId: selectedInvoice.id as Id<"invoices">,
        reason,
        stockDisposition,
        lines,
        note: note.trim() || reasonLabel(reason, tr),
      });
      toast.success(
        tr("Retour enregistré", "تم حفظ الإرجاع"),
        tr(
          `Facture ${selectedInvoice.number} mise à jour.`,
          `تم تحديث الفاتورة ${selectedInvoice.number}.`,
        ),
      );
      onOpenChange(false);
    } catch (error) {
      setReturnError(
        error instanceof Error ? error.message : tr("Une erreur est survenue.", "حدث خطأ."),
      );
    } finally {
      setSubmitting(false);
    }
  }

  function handleSelectInvoice(invoice: ReturnableInvoiceSummary) {
    setSelectedInvoiceSummary(invoice);
    setSelectedInvoiceId(invoice.id);
    setQtyByLineIndex({});
    setReturnError(null);
    setStep("form");
  }

  function handleBack() {
    setReturnError(null);
    if (step === "form") {
      setSelectedInvoiceSummary(null);
      setSelectedInvoiceId(null);
      setQtyByLineIndex({});
      setStep("search");
    }
  }

  const stepTitle =
    step === "search"
      ? tr("Trouver une facture", "البحث عن فاتورة")
      : tr("Retourner des articles", "إرجاع منتجات");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className={cn(
          "flex max-h-[min(94vh,920px)] flex-col gap-0 overflow-hidden rounded-2xl p-0",
          step === "form" ? "max-w-6xl sm:max-w-6xl" : "max-w-2xl sm:max-w-3xl",
        )}
      >
        <div className="border-sidebar-border bg-surface-container-low/40 flex shrink-0 items-start gap-3 border-b px-4 py-4 sm:px-5">
          {step !== "search" ? (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="shrink-0 rounded-xl"
              onClick={handleBack}
              aria-label={tr("Retour", "رجوع")}
            >
              <ArrowLeft className="size-5 stroke-[1.75]" aria-hidden />
            </Button>
          ) : null}
          <div className="min-w-0 flex-1">
            <DialogTitle className="text-lg font-black">{stepTitle}</DialogTitle>
            {selectedInvoiceSummary ? (
              <p className="text-on-surface-variant mt-0.5 text-sm font-medium">
                {selectedInvoiceSummary.clientName} ·{" "}
                {tr("Facture", "الفاتورة")} {selectedInvoiceSummary.number}
              </p>
            ) : (
              <p className="text-on-surface-variant mt-0.5 text-sm font-medium">
                {tr(
                  "Recherchez par facture, client, date d'achat ou article.",
                  "ابحث برقم الفاتورة أو العميل أو تاريخ الشراء أو المنتج.",
                )}
              </p>
            )}
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="shrink-0 rounded-xl"
            onClick={() => onOpenChange(false)}
            aria-label={tr("Fermer", "إغلاق")}
          >
            <X className="size-5 stroke-[1.75]" aria-hidden />
          </Button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-5">
          {step === "search" ? (
            <InvoiceSearchStep
              tr={tr}
              locale={locale}
              invoiceSearch={invoiceSearch}
              onInvoiceSearchChange={setInvoiceSearch}
              invoices={returnableInvoices}
              hydrated={searchResults !== undefined}
              isSearching={invoiceSearch.trim() !== deferredInvoiceSearch}
              onSelectInvoice={handleSelectInvoice}
            />
          ) : null}

          {step === "form" && selectedInvoice ? (
            <ReturnFormStep
              tr={tr}
              locale={locale}
              selectedInvoice={selectedInvoice}
              returnLines={returnLines}
              reason={reason}
              onReasonChange={setReason}
              stockDisposition={stockDisposition}
              onStockDispositionChange={setStockDisposition}
              note={note}
              onNoteChange={setNote}
              refundTotal={refundTotal}
              newBalanceMad={newBalanceMad}
              isCreditClient={isCreditClient}
              invoiceTotal={invoiceTotal}
              anyQty={anyQty}
              canSubmitReturn={canSubmitReturn}
              submitting={submitting}
              returnError={returnError}
              onQtyChange={setQty}
              onConfirm={confirmReturn}
            />
          ) : null}

          {step === "form" && selectedInvoiceId && invoiceRow === null ? (
            <p className="text-on-surface-variant py-12 text-center text-sm">
              {tr("Facture introuvable.", "الفاتورة غير موجودة.")}
            </p>
          ) : null}

          {step === "form" && selectedInvoiceId && invoiceRow === undefined ? (
            <p className="text-on-surface-variant py-12 text-center text-sm">
              {tr("Chargement…", "جاري التحميل…")}
            </p>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function InvoiceSearchStep({
  tr,
  locale,
  invoiceSearch,
  onInvoiceSearchChange,
  invoices,
  hydrated,
  isSearching,
  onSelectInvoice,
}: {
  tr: (fr: string, ar: string) => string;
  locale: string;
  invoiceSearch: string;
  onInvoiceSearchChange: (value: string) => void;
  invoices: ReturnableInvoiceSummary[];
  hydrated: boolean;
  isSearching: boolean;
  onSelectInvoice: (invoice: ReturnableInvoiceSummary) => void;
}) {
  const hasSearch = invoiceSearch.trim().length > 0;

  return (
    <div className="space-y-4">
      <div className="relative">
        <Search
          className="text-outline pointer-events-none absolute top-1/2 left-4 size-5 -translate-y-1/2 stroke-[1.75]"
          aria-hidden
        />
        <Input
          value={invoiceSearch}
          onChange={(e) => onInvoiceSearchChange(e.target.value)}
          placeholder={tr(
            "Facture, client, date ou article…",
            "فاتورة، عميل، تاريخ أو منتج…",
          )}
          className="bg-surface-container-low border-transparent h-11 rounded-xl pl-12"
          autoFocus
        />
      </div>

      <p className="text-on-surface-variant text-xs font-medium">
        {hasSearch
          ? tr(
              "Résultats correspondant à votre recherche.",
              "نتائج مطابقة لبحثك.",
            )
          : tr(
              "Derniers achats avec articles retournables.",
              "آخر المشتريات بمنتجات قابلة للإرجاع.",
            )}
      </p>

      {!hydrated || isSearching ? (
        <p className="text-on-surface-variant py-8 text-center text-sm">
          {tr("Chargement…", "جاري التحميل…")}
        </p>
      ) : invoices.length === 0 ? (
        <p className="text-on-surface-variant py-8 text-center text-sm">
          {hasSearch
            ? tr(
                "Aucune facture trouvée. Essayez un autre nom, numéro ou article.",
                "لم تُعثر على فاتورة. جرّب اسمًا أو رقمًا أو منتجًا آخر.",
              )
            : tr(
                "Aucune facture avec articles retournables.",
                "لا توجد فاتورة بمنتجات قابلة للإرجاع.",
              )}
        </p>
      ) : (
        <ul className="divide-sidebar-border max-h-[min(52vh,480px)] divide-y overflow-y-auto rounded-xl border">
          {invoices.map((invoice) => (
            <li key={invoice.id}>
              <button
                type="button"
                onClick={() => onSelectInvoice(invoice)}
                className="hover:bg-surface-container-low flex w-full items-start gap-3 px-4 py-3 text-left transition-colors"
              >
                <div className="bg-primary/10 text-primary mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-xl">
                  <FileText className="size-5 stroke-[1.75]" aria-hidden />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="truncate text-sm font-black">{invoice.number}</p>
                    <span className="text-on-surface-variant text-xs font-semibold tabular-nums">
                      {formatDateFr(invoice.date)} {invoice.time}
                    </span>
                  </div>
                  <p className="text-on-surface mt-0.5 truncate text-sm font-semibold">
                    {invoice.clientName}
                  </p>
                  {invoice.returnableProductNames.length > 0 ? (
                    <p className="text-on-surface-variant mt-1 line-clamp-2 text-xs leading-relaxed">
                      {invoice.returnableProductNames.join(" · ")}
                    </p>
                  ) : null}
                  <p className="text-outline mt-1 text-[10px] font-bold uppercase">
                    {invoice.returnableLinesCount}{" "}
                    {tr("lignes retournables", "سطور قابلة للإرجاع")}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-sm font-black tabular-nums">
                    {formatMad(invoice.totalMad, 2, locale)}
                  </p>
                  <p className="text-on-surface-variant text-[10px] font-bold uppercase">
                    {invoice.paymentType === "cash"
                      ? tr("Espèces", "نقدًا")
                      : tr("Crédit", "آجل")}
                  </p>
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function ReturnFormStep({
  tr,
  locale,
  selectedInvoice,
  returnLines,
  reason,
  onReasonChange,
  stockDisposition,
  onStockDispositionChange,
  note,
  onNoteChange,
  refundTotal,
  newBalanceMad,
  isCreditClient,
  invoiceTotal,
  anyQty,
  canSubmitReturn,
  submitting,
  returnError,
  onQtyChange,
  onConfirm,
}: {
  tr: (fr: string, ar: string) => string;
  locale: string;
  selectedInvoice: Invoice;
  returnLines: Array<{
    idx: number;
    line: Invoice["lines"][number];
    qtyReturned: number;
    refund: number;
    maxReturnableQty: number;
  }>;
  reason: ReturnReason;
  onReasonChange: (reason: ReturnReason) => void;
  stockDisposition: StockDisposition;
  onStockDispositionChange: (value: StockDisposition) => void;
  note: string;
  onNoteChange: (value: string) => void;
  refundTotal: number;
  newBalanceMad: number;
  isCreditClient: boolean;
  invoiceTotal: number;
  anyQty: boolean;
  canSubmitReturn: boolean;
  submitting: boolean;
  returnError: string | null;
  onQtyChange: (idx: number, next: number) => void;
  onConfirm: () => void;
}) {
  return (
    <div className="grid min-w-0 gap-6 lg:grid-cols-12 lg:items-start">
      <section className="min-w-0 space-y-6 lg:col-span-8">
        <header className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
          <div className="min-w-0">
            <h2 className="flex flex-wrap items-center gap-3 text-xl font-black tracking-tight">
              {tr("Facture", "الفاتورة")} {selectedInvoice.number}
              {isCreditClient ? (
                <span className="bg-tertiary-fixed text-on-tertiary-fixed rounded-full px-3 py-1 text-[10px] font-black tracking-wider uppercase">
                  {tr("Client à crédit", "عميل آجل")}
                </span>
              ) : null}
            </h2>
            <p className="text-on-surface-variant mt-1 text-sm">
              {selectedInvoice.clientName} ·{" "}
              <span className="font-semibold tabular-nums">
                {formatDateFr(selectedInvoice.date)} {selectedInvoice.time}
              </span>
            </p>
          </div>
          <div className="text-right">
            <span className="text-outline block text-[10px] font-black tracking-widest uppercase">
              {tr("Total facture", "إجمالي الفاتورة")}
            </span>
            <p className="text-on-surface mt-1 text-xl font-black tabular-nums">
              {formatMad(invoiceTotal, 2, locale)}
            </p>
          </div>
        </header>

        <div className="border-sidebar-border bg-surface-container-lowest overflow-hidden rounded-xl border shadow-sm">
          <div className="bg-surface-container-low border-sidebar-border grid grid-cols-12 border-b px-4 py-3 text-[10px] font-black tracking-widest uppercase text-slate-500 sm:px-6">
            <div className="col-span-5">{tr("Produit", "المنتج")}</div>
            <div className="col-span-2 text-center">{tr("Qté achetée", "الكمية المشتراة")}</div>
            <div className="col-span-2 text-right">{tr("Prix TTC", "السعر شامل الضريبة")}</div>
            <div className="col-span-1 text-center">{tr("Retour", "مرتجع")}</div>
            <div className="col-span-2 text-right">{tr("Sous-total", "المجموع الفرعي")}</div>
          </div>
          <div className="divide-sidebar-border divide-y">
            {returnLines.map((row, i) => {
              const striped = i % 2 === 1;
              return (
                <div
                  key={`${row.idx}-${row.line.nameAr}`}
                  className={cn(
                    "grid grid-cols-12 items-center px-4 py-4 sm:px-6",
                    striped && "bg-surface-container-low/30",
                  )}
                >
                  <div className="col-span-5 min-w-0">
                    <p className="text-on-surface truncate text-sm font-bold">
                      {row.line.nameAr}
                    </p>
                    <p className="text-outline mt-0.5 text-xs font-medium">
                      {tr("Ligne", "السطر")} #{row.idx + 1}
                    </p>
                  </div>
                  <div className="col-span-2 text-center text-sm font-semibold text-slate-600 tabular-nums">
                    {row.line.qty}
                  </div>
                  <div className="col-span-2 text-right text-sm font-semibold text-slate-600 tabular-nums">
                    {formatMad(row.line.unitPriceMad, 2, locale)}
                  </div>
                  <div className="col-span-1 flex justify-center">
                    <QtyKeypadField
                      value={row.qtyReturned}
                      onValueChange={(n) => onQtyChange(row.idx, n)}
                      min={0}
                      max={row.maxReturnableQty}
                      compact
                      keypadTitle={row.line.nameAr}
                      wrapperClassName="w-16"
                    />
                  </div>
                  <div
                    className={cn(
                      "col-span-2 text-right text-sm font-black tabular-nums",
                      row.refund > 0 ? "text-on-surface" : "text-outline",
                    )}
                  >
                    {row.refund > 0
                      ? `− ${formatMad(row.refund, 2, locale)}`
                      : formatMad(0, 2, locale)}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="grid min-w-0 gap-4 xl:grid-cols-2">
          <div className="border-sidebar-border bg-surface-container-lowest relative isolate min-w-0 overflow-hidden rounded-xl border p-5 shadow-sm">
            <div className="mb-4 flex items-center justify-between gap-2">
              <p className="text-on-surface text-[11px] font-black tracking-widest uppercase">
                {tr("Motif du retour", "سبب الإرجاع")}
              </p>
              <ClipboardList className="text-outline size-4" aria-hidden />
            </div>
            <div className="grid gap-2">
              {REASONS.map((r) => {
                const active = reason === r;
                return (
                  <label
                    key={r}
                    className={cn(
                      "border-sidebar-border hover:bg-surface-container-low flex min-w-0 cursor-pointer items-center gap-3 overflow-hidden rounded-xl border p-3 transition-colors",
                      active && "border-primary/25 bg-primary/5",
                    )}
                  >
                    <ReturnRadioControl
                      checked={active}
                      name="return-reason"
                      onChange={() => onReasonChange(r)}
                      activeClassName="border-primary bg-primary"
                    />
                    <span className="min-w-0 flex-1 text-sm font-semibold">
                      {reasonLabel(r, tr)}
                    </span>
                  </label>
                );
              })}
            </div>
            <div className="mt-4 space-y-2">
              <label
                htmlFor="return-note"
                className="text-on-surface text-[11px] font-black tracking-widest uppercase"
              >
                {tr("Note (optionnel)", "ملاحظة (اختياري)")}
              </label>
              <Input
                id="return-note"
                value={note}
                onChange={(e) => onNoteChange(e.target.value)}
                placeholder={tr(
                  "Ex. emballage ouvert, défaut constaté…",
                  "مثال: تغليف مفتوح، تم اكتشاف عيب…",
                )}
                className="bg-surface-container-low border-transparent h-11 rounded-xl"
              />
            </div>
          </div>

          <div className="border-sidebar-border bg-surface-container-lowest relative isolate min-w-0 overflow-hidden rounded-xl border p-5 shadow-sm">
            <div className="mb-4 flex items-center justify-between gap-2">
              <p className="text-on-surface text-[11px] font-black tracking-widest uppercase">
                {tr("Gestion du stock", "إدارة المخزون")}
              </p>
              <PackageCheck className="text-outline size-4" aria-hidden />
            </div>
            <div className="space-y-3">
              <label
                className={cn(
                  "block min-w-0 cursor-pointer overflow-hidden rounded-2xl border p-4 transition-colors",
                  stockDisposition === "Invendable"
                    ? "border-error-container bg-error-container/40"
                    : "border-sidebar-border bg-surface-container-low",
                )}
              >
                <div className="flex items-start gap-3">
                  <ReturnRadioControl
                    checked={stockDisposition === "Invendable"}
                    name="stock-disposition"
                    onChange={() => onStockDispositionChange("Invendable")}
                    activeClassName="border-error bg-error"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-on-surface text-sm font-black">
                      {tr("Réintégrer au stock invendable", "إرجاع إلى مخزون غير قابل للبيع")}
                    </p>
                    <p className="text-on-surface-variant mt-0.5 text-xs">
                      {tr("L'article sera marqué comme endommagé.", "سيتم وسم العنصر كتالف.")}
                    </p>
                  </div>
                </div>
              </label>
              <label
                className={cn(
                  "block min-w-0 cursor-pointer overflow-hidden rounded-2xl border p-4 transition-colors",
                  stockDisposition === "Disponible"
                    ? "border-secondary-container bg-secondary-container/40"
                    : "border-sidebar-border bg-surface-container-low",
                )}
              >
                <div className="flex items-start gap-3">
                  <ReturnRadioControl
                    checked={stockDisposition === "Disponible"}
                    name="stock-disposition"
                    onChange={() => onStockDispositionChange("Disponible")}
                    activeClassName="border-secondary bg-secondary"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-on-surface text-sm font-black">
                      {tr("Réintégrer au stock disponible", "إرجاع إلى المخزون المتاح")}
                    </p>
                    <p className="text-on-surface-variant mt-0.5 text-xs">
                      {tr("Remis en rayon immédiatement.", "إعادته للرف مباشرة.")}
                    </p>
                  </div>
                </div>
              </label>
            </div>
          </div>
        </div>
      </section>

      <aside className="min-w-0 lg:col-span-4">
        <div className="border-sidebar-border overflow-hidden rounded-3xl border bg-surface-container-lowest shadow-sm">
          <div className="bg-inverse-surface text-inverse-on-surface p-6">
            <p className="mb-6 text-[11px] font-black tracking-widest uppercase opacity-60">
              {tr("Récapitulatif de retour", "ملخص الإرجاع")}
            </p>
            <div className="space-y-4">
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm font-semibold opacity-80">
                  {tr("Facture initiale", "الفاتورة الأصلية")}
                </span>
                <span className="text-sm font-black tabular-nums">
                  {formatMad(invoiceTotal, 2, locale)}
                </span>
              </div>
              <div className="border-white/10 border-y py-4">
                <div className="flex items-end justify-between gap-3">
                  <div>
                    <p className="text-secondary-fixed text-[10px] font-black tracking-widest uppercase">
                      {tr("Valeur retour", "قيمة الإرجاع")}
                    </p>
                  </div>
                  <p className="text-secondary-fixed text-2xl font-black tabular-nums">
                    − {formatMad(refundTotal, 2, locale)}
                  </p>
                </div>
              </div>
              <div className="flex items-center justify-between gap-3 pt-1">
                <div>
                  <p className="text-sm font-black">{tr("Nouveau solde", "الرصيد الجديد")}</p>
                  <p className="text-[10px] opacity-60 italic">
                    {isCreditClient
                      ? tr("Crédit client mis à jour", "تم تحديث رصيد العميل الآجل")
                      : tr("Montant restant après remboursement", "المبلغ المتبقي بعد الاسترداد")}
                  </p>
                </div>
                <p className="text-xl font-black tabular-nums">
                  {formatMad(newBalanceMad, 2, locale)}
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-4 bg-surface-container-lowest p-6">
            <div className="bg-surface-container-low flex items-start gap-3 rounded-2xl p-4">
              <div className="bg-primary/10 text-primary flex size-10 shrink-0 items-center justify-center rounded-2xl">
                <ShieldAlert className="size-5 stroke-[1.75]" aria-hidden />
              </div>
              <div className="min-w-0">
                <p className="text-on-surface text-xs font-black">
                  {tr("Validation requise", "التأكيد مطلوب")}
                </p>
                <p className="text-on-surface-variant mt-0.5 text-[11px]">
                  {tr(
                    "L’ajustement stock est appliqué après confirmation.",
                    "يتم تطبيق تعديل المخزون بعد التأكيد.",
                  )}
                </p>
              </div>
            </div>

            <Button
              type="button"
              disabled={!anyQty || !canSubmitReturn || submitting}
              onClick={onConfirm}
              className="from-primary to-primary-container text-on-primary h-12 w-full rounded-2xl bg-linear-to-br font-black shadow-[0_12px_28px_rgba(122,21,24,0.2)] disabled:opacity-50"
            >
              {submitting
                ? tr("Enregistrement…", "جاري الحفظ…")
                : canSubmitReturn
                  ? tr(
                      "Confirmer le retour & ajuster le stock",
                      "تأكيد الإرجاع وتعديل المخزون",
                    )
                  : tr(
                      "Permission requise pour traiter les retours",
                      "صلاحية مطلوبة لمعالجة المرتجعات",
                    )}
            </Button>

            {returnError ? (
              <div className="border-error/30 bg-error-container/25 text-on-error-container rounded-2xl border p-4">
                <p className="text-xs font-black">
                  {tr("Retour non enregistré", "لم يتم حفظ الإرجاع")}
                </p>
                <p className="mt-1 text-[11px]">{returnError}</p>
              </div>
            ) : null}

            <Separator className="bg-outline-variant/60" />
          </div>
        </div>
      </aside>
    </div>
  );
}
