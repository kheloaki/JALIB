"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useMutation, useQuery } from "convex/react";
import { useLocale } from "next-intl";
import {
  ArrowLeft,
  ArrowLeftRight,
  Banknote,
  RotateCcw,
  ShieldCheck,
  ShoppingBasket,
} from "lucide-react";

import { PosDialogProductPicker } from "@/components/pos/pos-dialog-product-picker";
import {
  PosInvoiceLinePicker,
  buildInvoiceLineRows,
} from "@/components/pos/pos-invoice-line-picker";
import {
  PosInvoiceLinePriceEditor,
  PosPriceChangeSummary,
} from "@/components/pos/pos-invoice-line-price-editor";
import {
  ReturnOptionsPicker,
  returnReasonLabel,
  stockDispositionLabel,
} from "@/components/returns/return-options-picker";
import type { Product } from "@/components/pos/types";
import {
  PosDialog,
  PosNestedDialogContent,
} from "@/components/pos/pos-dialog";
import { Button } from "@/components/ui/button";
import {
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/components/ui/toaster";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { invoiceFromConvex } from "@/lib/convex/mappers";
import { formatPosDh } from "@/lib/pos/format-pos-dh";
import {
  canEditSalePrice,
  canReopenSale,
} from "@/lib/auth/permissions";
import {
  formatLedgerDate,
  ledgerAmountClass,
  ledgerAmountSign,
  ledgerKindLabel,
} from "@/lib/credits/ledger-ui";
import type { LedgerEntry } from "@/lib/credits/types";
import type { ReturnReason, StockDisposition } from "@/lib/returns/types";
import {
  computeInvoicePriceTotals,
  invoiceLineKey,
  invoiceLinesToCartLines,
  remainingInvoiceLineQty,
  writePendingInvoiceReopen,
  type PosInvoiceReopenPayload,
} from "@/lib/pos/invoice-to-cart";
import { cn } from "@/lib/utils";

type UpdateType =
  | "return"
  | "replacement"
  | "price_change"
  | "reopen_in_caisse";
type Step = "choose" | "detail" | "confirm";
type ReplacementSubStep = "purchased" | "replacement";

type PosLedgerUpdateRequestDialogProps = {
  entry: LedgerEntry | null;
  clientName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tr: (fr: string, ar: string) => string;
  onReturnToCaisse?: (payload: PosInvoiceReopenPayload) => boolean;
  onReopenSuccess?: () => void;
};

function needsInvoice(type: UpdateType): boolean {
  return (
    type === "return" ||
    type === "replacement" ||
    type === "price_change" ||
    type === "reopen_in_caisse"
  );
}

function settlementLabel(
  differenceMad: number,
  tr: (fr: string, ar: string) => string,
): string {
  if (differenceMad > 0) {
    return tr(
      `Encaisser ${formatPosDh(differenceMad)} du client`,
      `استوفِ ${formatPosDh(differenceMad, 2, "ar")} من العميل`,
    );
  }
  if (differenceMad < 0) {
    return tr(
      `Rendre ${formatPosDh(Math.abs(differenceMad))} au client`,
      `أعد ${formatPosDh(Math.abs(differenceMad), 2, "ar")} للعميل`,
    );
  }
  return tr("Aucun écart", "لا فرق");
}

export function PosLedgerUpdateRequestDialog({
  entry,
  clientName,
  open,
  onOpenChange,
  tr,
  onReturnToCaisse,
  onReopenSuccess,
}: PosLedgerUpdateRequestDialogProps) {
  const locale = useLocale();
  const toast = useToast();
  const executeReturnFromHistory = useMutation(api.returns.executeFromPosHistory);
  const executeReplacementFromHistory = useMutation(
    api.posHistoryUpdates.executeReplacementFromPosHistory,
  );
  const executePriceChangeFromHistory = useMutation(
    api.posHistoryUpdates.executePriceChangeFromPosHistory,
  );
  const executeReopenInCaisse = useMutation(api.posReopen.executeReopenInCaisse);
  const pendingRequest = useQuery(
    api.creditLedgerUpdateRequests.pendingForLedgerEntry,
    entry && open ? { ledgerEntryId: entry.id as Id<"creditLedgerEntries"> } : "skip",
  );
  const currentUser = useQuery(api.authz.currentUser);
  const permissions = currentUser?.permissions ?? [];
  const canReopen = canReopenSale(permissions);
  const canChangePrice = canEditSalePrice(permissions);

  const [step, setStep] = useState<Step>("choose");
  const [updateType, setUpdateType] = useState<UpdateType | null>(null);
  const [replacementSubStep, setReplacementSubStep] =
    useState<ReplacementSubStep>("purchased");
  const [returnQtyByLine, setReturnQtyByLine] = useState<Record<number, number>>(
    {},
  );
  const [returnMotif, setReturnMotif] = useState<ReturnReason>("Endommagé");
  const [returnStockDisposition, setReturnStockDisposition] =
    useState<StockDisposition>("Invendable");
  const [selectedPurchasedLineIndex, setSelectedPurchasedLineIndex] = useState<
    number | null
  >(null);
  const [replacementProduct, setReplacementProduct] = useState<Product | null>(
    null,
  );
  const [unitPriceByLine, setUnitPriceByLine] = useState<Record<number, number>>(
    {},
  );
  const [responsibleChecked, setResponsibleChecked] = useState(false);
  const [saving, setSaving] = useState(false);

  const invoiceId = entry?.invoiceId ?? null;
  const invoicePreviewRow = useQuery(
    api.invoices.getWithLines,
    invoiceId && open ? { invoiceId } : "skip",
  );
  const invoicePreview = useMemo(
    () => (invoicePreviewRow ? invoiceFromConvex(invoicePreviewRow) : null),
    [invoicePreviewRow],
  );
  const isFullyCancelled = Boolean(
    invoicePreview &&
      invoicePreview.status === "returned" &&
      invoicePreview.totalMad <= 0,
  );

  const invoiceRow = useQuery(
    api.invoices.getWithLines,
    invoiceId && open && updateType && needsInvoice(updateType)
      ? { invoiceId }
      : "skip",
  );
  const invoice = useMemo(
    () => (invoiceRow ? invoiceFromConvex(invoiceRow) : null),
    [invoiceRow],
  );

  useEffect(() => {
    if (!open) {
      setStep("choose");
      setUpdateType(null);
      setReplacementSubStep("purchased");
      setReturnQtyByLine({});
      setReturnMotif("Endommagé");
      setReturnStockDisposition("Invendable");
      setSelectedPurchasedLineIndex(null);
      setReplacementProduct(null);
      setUnitPriceByLine({});
      setResponsibleChecked(false);
    }
  }, [open]);

  useEffect(() => {
    if (!invoice || updateType !== "price_change") return;
    const initial: Record<number, number> = {};
    for (const [idx, line] of invoice.lines.entries()) {
      initial[invoiceLineKey(line, idx)] = line.unitPriceMad;
    }
    setUnitPriceByLine(initial);
  }, [invoice, updateType]);

  const cashierName = currentUser?.name?.trim() || tr("Caissier", "أمين الصندوق");

  const invoiceLineRows = useMemo(
    () => (invoice ? buildInvoiceLineRows(invoice.lines) : []),
    [invoice],
  );

  const returnLines = useMemo(() => {
    return invoiceLineRows.map((row) => {
      const qtyReturned = Math.min(
        row.maxQty,
        Math.max(0, returnQtyByLine[row.idx] ?? 0),
      );
      return { ...row, qtyReturned };
    });
  }, [invoiceLineRows, returnQtyByLine]);

  const returnTotalMad = useMemo(
    () =>
      returnLines.reduce(
        (sum, row) => sum + row.qtyReturned * row.line.unitPriceMad,
        0,
      ),
    [returnLines],
  );

  const priceTotals = useMemo(
    () =>
      invoice
        ? computeInvoicePriceTotals(invoice.lines, unitPriceByLine)
        : { originalTotalMad: 0, newTotalMad: 0, differenceMad: 0 },
    [invoice, unitPriceByLine],
  );

  const changedPriceLines = useMemo(() => {
    if (!invoice) return [];
    return invoice.lines
      .map((line, idx) => {
        const lineIndex = invoiceLineKey(line, idx);
        const qty = remainingInvoiceLineQty(line);
        if (qty <= 0) return null;
        const newUnit = unitPriceByLine[lineIndex] ?? line.unitPriceMad;
        if (newUnit === line.unitPriceMad) return null;
        return { lineIndex, line, qty, newUnit };
      })
      .filter((row): row is NonNullable<typeof row> => row != null);
  }, [invoice, unitPriceByLine]);

  const selectedPurchasedLine = useMemo(
    () =>
      selectedPurchasedLineIndex == null
        ? null
        : (invoiceLineRows.find((r) => r.idx === selectedPurchasedLineIndex) ??
          null),
    [invoiceLineRows, selectedPurchasedLineIndex],
  );

  const showWideDialog =
    (step === "detail" &&
      updateType === "replacement" &&
      replacementSubStep === "replacement") ||
    (step === "detail" && updateType === "return");

  function handleOpenChange(next: boolean) {
    onOpenChange(next);
  }

  function selectType(type: UpdateType) {
    if (isFullyCancelled) {
      toast.error(
        tr("Achat déjà annulé", "الشراء مُلغى مسبقًا"),
        tr(
          "Cet achat a déjà été annulé et renvoyé à la caisse.",
          "تم إلغاء هذا الشراء وإرجاعه للصندوق مسبقًا.",
        ),
      );
      return;
    }
    if (needsInvoice(type) && !invoiceId) {
      toast.error(
        tr("Modification impossible", "تعذر التعديل"),
        tr(
          "Cette écriture n'est pas liée à une facture détaillée.",
          "هذا القيد غير مرتبط بفاتورة مفصلة.",
        ),
      );
      return;
    }
    setUpdateType(type);
    setReplacementSubStep("purchased");
    setStep("detail");
  }

  function validateDetail(): string | null {
    if (!updateType || !entry) return tr("Type requis", "النوع مطلوب");
    if (updateType === "return") {
      if (!returnLines.some((r) => r.qtyReturned > 0)) {
        return tr(
          "Sélectionnez au moins un article à retourner.",
          "اختر منتجًا واحدًا على الأقل للإرجاع.",
        );
      }
    }
    if (updateType === "replacement") {
      if (replacementSubStep === "purchased") {
        if (selectedPurchasedLineIndex == null) {
          return tr(
            "Sélectionnez l'article acheté à remplacer.",
            "اختر المنتج المُشترى للاستبدال.",
          );
        }
        return null;
      }
      if (!replacementProduct) {
        return tr(
          "Sélectionnez le produit de remplacement.",
          "اختر منتج الاستبدال.",
        );
      }
    }
    if (updateType === "price_change") {
      if (changedPriceLines.length === 0) {
        return tr(
          "Modifiez le prix d'au moins un article.",
          "عدّل سعر منتج واحد على الأقل.",
        );
      }
      if (changedPriceLines.some((row) => row.newUnit <= 0)) {
        return tr(
          "Chaque prix unitaire doit être supérieur à 0.",
          "يجب أن يكون كل سعر وحدة أكبر من 0.",
        );
      }
    }
    if (updateType === "reopen_in_caisse") {
      if (!invoice || invoiceLinesToCartLines(invoice).length === 0) {
        return tr(
          "Aucun article disponible pour recharger la caisse.",
          "لا يوجد منتج متاح لإعادة تحميل الصندوق.",
        );
      }
    }
    return null;
  }

  function buildReasonSummary(): string {
    if (!updateType || !entry) return "";
    if (updateType === "return") {
      const parts = returnLines
        .filter((r) => r.qtyReturned > 0)
        .map((r) => `${r.line.nameAr} ×${r.qtyReturned}`);
      return (
        tr("Retour", "إرجاع") +
        ` (${returnReasonLabel(returnMotif, tr)}) — ` +
        parts.join(", ")
      );
    }
    if (updateType === "replacement" && selectedPurchasedLine && replacementProduct) {
      return tr(
        `Remplacement : ${selectedPurchasedLine.line.nameAr} → ${replacementProduct.name}`,
        `استبدال: ${selectedPurchasedLine.line.nameAr} → ${replacementProduct.name}`,
      );
    }
    if (updateType === "price_change") {
      const parts = changedPriceLines.map(
        (row) =>
          `${row.line.nameAr}: ${formatPosDh(row.line.unitPriceMad, 2, locale)} → ${formatPosDh(row.newUnit, 2, locale)}`,
      );
      return (
        tr("Prix articles — ", "أسعار المنتجات — ") +
        parts.join(" · ") +
        ` · ${settlementLabel(priceTotals.differenceMad, tr)}`
      );
    }
    if (updateType === "reopen_in_caisse" && invoice) {
      const count = invoiceLinesToCartLines(invoice).reduce(
        (sum, line) => sum + line.qty,
        0,
      );
      return tr(
        `Renvoi à la caisse — facture ${invoice.number} (${count} art.)`,
        `إرجاع للصندوق — فاتورة ${invoice.number} (${count} ص.)`,
      );
    }
    return "";
  }

  function buildPayloadJson(): string {
    if (updateType === "return") {
      return JSON.stringify({
        returnLines: returnLines
          .filter((r) => r.qtyReturned > 0)
          .map((r) => ({
            lineIndex: r.idx,
            productId: r.line.productId ?? null,
            qtyReturned: r.qtyReturned,
          })),
        refundTotalMad: returnTotalMad,
        returnMotif,
        stockDisposition: returnStockDisposition,
      });
    }
    if (updateType === "replacement" && selectedPurchasedLine && replacementProduct) {
      return JSON.stringify({
        purchasedLineIndex: selectedPurchasedLine.idx,
        purchasedProductId: selectedPurchasedLine.line.productId ?? null,
        purchasedProductName: selectedPurchasedLine.line.nameAr,
        replacementProductId: replacementProduct.id,
        replacementProductName: replacementProduct.name,
        replacementPriceMad: replacementProduct.price,
      });
    }
    if (updateType === "price_change") {
      return JSON.stringify({
        linePrices: changedPriceLines.map((row) => ({
          lineIndex: row.lineIndex,
          productId: row.line.productId ?? null,
          productName: row.line.nameAr,
          qty: row.qty,
          previousUnitPriceMad: row.line.unitPriceMad,
          newUnitPriceMad: row.newUnit,
        })),
        originalTotalMad: priceTotals.originalTotalMad,
        newTotalMad: priceTotals.newTotalMad,
        differenceMad: priceTotals.differenceMad,
        settlement:
          priceTotals.differenceMad > 0
            ? "collect_client"
            : priceTotals.differenceMad < 0
              ? "refund_client"
              : "none",
      });
    }
    if (updateType === "reopen_in_caisse" && invoice && entry) {
      return JSON.stringify({
        invoiceId: invoice.id,
        invoiceNumber: invoice.number,
        clientId: entry.clientId,
        payment: invoice.paymentType,
        itemCount: invoiceLinesToCartLines(invoice).reduce(
          (sum, line) => sum + line.qty,
          0,
        ),
      });
    }
    return JSON.stringify({});
  }

  function buildReopenPayload(): PosInvoiceReopenPayload | null {
    if (!invoice || !entry) return null;
    return {
      invoiceId: invoice.id,
      invoiceNumber: invoice.number,
      clientId: entry.clientId,
      payment: invoice.paymentType,
      lines: invoiceLinesToCartLines(invoice),
      ledgerEntryId: entry.id,
    };
  }

  function handleDetailContinue() {
    const err = validateDetail();
    if (err) {
      toast.error(tr("Informations incomplètes", "معلومات ناقصة"), err);
      return;
    }
    if (updateType === "replacement" && replacementSubStep === "purchased") {
      setReplacementSubStep("replacement");
      return;
    }
    setStep("confirm");
  }

  function handleDetailBack() {
    if (step === "confirm") {
      setStep("detail");
      return;
    }
    if (updateType === "replacement" && replacementSubStep === "replacement") {
      setReplacementSubStep("purchased");
      return;
    }
    setStep("choose");
    setUpdateType(null);
    setReplacementSubStep("purchased");
  }

  async function handleSubmit() {
    if (!entry || !updateType) return;
    const detailError = validateDetail();
    if (detailError) {
      toast.error(tr("Informations incomplètes", "معلومات ناقصة"), detailError);
      return;
    }
    if (!responsibleChecked) {
      toast.error(
        tr("Confirmation requise", "التأكيد مطلوب"),
        tr("Cochez la case de responsabilité.", "حدد خانة المسؤولية."),
      );
      return;
    }

    if (updateType === "reopen_in_caisse") {
      const payload = buildReopenPayload();
      if (!payload) {
        toast.error(
          tr("Rechargement impossible", "تعذر إعادة التحميل"),
          tr("Facture introuvable.", "الفاتورة غير موجودة."),
        );
        return;
      }
      if (onReturnToCaisse && !onReturnToCaisse({ ...payload, dryRun: true })) {
        toast.error(
          tr("Panier non vide", "السلة غير فارغة"),
          tr(
            "Videz ou mettez en attente le panier actuel avant de recharger cet achat.",
            "أفرغ السلة الحالية أو علّقها قبل إعادة تحميل هذا الشراء.",
          ),
        );
        return;
      }
    }

    setSaving(true);
    try {
      if (updateType === "reopen_in_caisse") {
        const payload = buildReopenPayload();
        if (!payload) return;

        await executeReopenInCaisse({
          ledgerEntryId: entry.id as Id<"creditLedgerEntries">,
          reason: buildReasonSummary(),
          payloadJson: buildPayloadJson(),
          responsibleConfirmed: true,
          requestedByUserName: cashierName,
        });

        if (onReturnToCaisse) {
          onReturnToCaisse(payload);
        } else {
          writePendingInvoiceReopen(payload);
        }

        toast.success(
          tr("Achat annulé et renvoyé à la caisse", "تم إلغاء الشراء وإرجاعه للصندوق"),
          tr(
            "L'achat original est annulé. Modifiez le panier puis validez.",
            "أُلغي الشراء الأصلي. عدّل السلة ثم أكّد.",
          ),
        );
        onReopenSuccess?.();
        handleOpenChange(false);
        return;
      }

      if (updateType === "return") {
        const result = await executeReturnFromHistory({
          ledgerEntryId: entry.id as Id<"creditLedgerEntries">,
          lines: returnLines
            .filter((r) => r.qtyReturned > 0)
            .map((r) => ({
              lineIndex: r.idx,
              qtyReturned: r.qtyReturned,
            })),
          reason: buildReasonSummary(),
          returnMotif,
          stockDisposition: returnStockDisposition,
          payloadJson: buildPayloadJson(),
          responsibleConfirmed: true,
          requestedByUserName: cashierName,
        });

        toast.success(
          tr("Retour enregistré", "تم تسجيل الإرجاع"),
          tr(
            `Remboursement ${formatPosDh(result.refundTotalMad, 2, locale)} — stock mis à jour.`,
            `استرداد ${formatPosDh(result.refundTotalMad, 2, locale)} — تم تحديث المخزون.`,
          ),
        );
        onReopenSuccess?.();
        handleOpenChange(false);
        return;
      }

      if (updateType === "replacement" && selectedPurchasedLine && replacementProduct) {
        const result = await executeReplacementFromHistory({
          ledgerEntryId: entry.id as Id<"creditLedgerEntries">,
          purchasedLineIndex: selectedPurchasedLine.idx,
          replacementProductId: replacementProduct.id as Id<"products">,
          replacementUnitPriceMad: replacementProduct.price,
          reason: buildReasonSummary(),
          payloadJson: buildPayloadJson(),
          responsibleConfirmed: true,
          requestedByUserName: cashierName,
        });

        toast.success(
          tr("Remplacement enregistré", "تم تسجيل الاستبدال"),
          tr(
            `Facture ${result.invoiceNumber} : ${formatPosDh(result.previousTotalMad, 2, locale)} → ${formatPosDh(result.newTotalMad, 2, locale)}`,
            `فاتورة ${result.invoiceNumber}: ${formatPosDh(result.previousTotalMad, 2, locale)} → ${formatPosDh(result.newTotalMad, 2, locale)}`,
          ),
        );
        onReopenSuccess?.();
        handleOpenChange(false);
        return;
      }

      if (updateType === "price_change") {
        const result = await executePriceChangeFromHistory({
          ledgerEntryId: entry.id as Id<"creditLedgerEntries">,
          linePrices: changedPriceLines.map((row) => ({
            lineIndex: row.lineIndex,
            newUnitPriceMad: row.newUnit,
          })),
          reason: buildReasonSummary(),
          payloadJson: buildPayloadJson(),
          responsibleConfirmed: true,
          requestedByUserName: cashierName,
        });

        toast.success(
          tr("Prix mis à jour", "تم تحديث الأسعار"),
          tr(
            `Facture ${result.invoiceNumber} : ${formatPosDh(result.previousTotalMad, 2, locale)} → ${formatPosDh(result.newTotalMad, 2, locale)}`,
            `فاتورة ${result.invoiceNumber}: ${formatPosDh(result.previousTotalMad, 2, locale)} → ${formatPosDh(result.newTotalMad, 2, locale)}`,
          ),
        );
        onReopenSuccess?.();
        handleOpenChange(false);
        return;
      }

      toast.error(
        tr("Action non prise en charge", "إجراء غير مدعوم"),
        tr("Réessayez ou contactez un responsable.", "أعد المحاولة أو اتصل بالمسؤول."),
      );
    } catch (error) {
      toast.error(
        tr("Envoi impossible", "تعذر الإرسال"),
        error instanceof Error ? error.message : tr("Réessayez.", "حاول مجددًا."),
      );
    } finally {
      setSaving(false);
    }
  }

  if (!entry) return null;

  const typeLabel =
    updateType === "return"
      ? tr("Retour", "إرجاع")
      : updateType === "replacement"
        ? replacementSubStep === "purchased"
          ? tr("Article acheté", "المنتج المُشترى")
          : tr("Nouveau produit", "المنتج الجديد")
        : updateType === "price_change"
          ? tr("Prix par article", "السعر لكل منتج")
          : updateType === "reopen_in_caisse"
            ? tr("Renvoyer à la caisse", "إرجاع للصندوق")
            : "";

  const detailContinueLabel =
    updateType === "replacement" && replacementSubStep === "purchased"
      ? tr("Choisir le remplacement", "اختر البديل")
      : tr("Continuer", "متابعة");

  const confirmLabel =
    updateType === "reopen_in_caisse"
      ? tr("Renvoyer à la caisse", "إرجاع للصندوق")
      : updateType === "return"
        ? tr("Confirmer le retour", "تأكيد الإرجاع")
        : updateType === "replacement"
          ? tr("Confirmer le remplacement", "تأكيد الاستبدال")
          : updateType === "price_change"
            ? tr("Confirmer les prix", "تأكيد الأسعار")
            : tr("Confirmer", "تأكيد");

  const confirmHint =
    updateType === "reopen_in_caisse"
      ? tr(
          "L'achat original sera annulé (stock recrédité, crédit client ajusté) puis rechargé dans le panier caisse.",
          "سيُلغى الشراء الأصلي (إرجاع المخزون، تعديل رصيد العميل) ثم يُحمَّل في سلة الصندوق.",
        )
      : tr(
          "La modification sera appliquée immédiatement : facture, stock et crédit client mis à jour.",
          "يُطبَّق التعديل فورًا: تحديث الفاتورة والمخزون ورصيد العميل.",
        );

  return (
    <PosDialog open={open} onOpenChange={handleOpenChange}>
      <PosNestedDialogContent
        className={cn(
          "flex max-h-[min(92vh,720px)] flex-col gap-0 overflow-hidden rounded-2xl p-0",
          showWideDialog ? "max-w-2xl" : "max-w-md",
        )}
      >
        <DialogHeader className="border-sidebar-border shrink-0 border-b px-5 pt-5 pb-4 text-start">
          <DialogTitle className="text-lg font-black">
            {step === "choose"
              ? tr("Modifier cet achat", "تعديل هذا الشراء")
              : step === "detail"
                ? typeLabel
                : tr("Confirmation", "تأكيد")}
          </DialogTitle>
          <DialogDescription className="sr-only">
            {tr("Demande de modification d'achat client", "طلب تعديل شراء العميل")}
          </DialogDescription>
          <EntrySummary
            entry={entry}
            clientName={clientName}
            step={step}
            updateType={updateType}
            replacementSubStep={replacementSubStep}
            tr={tr}
          />
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          {step === "choose" ? (
            <div className="grid gap-2">
              {pendingRequest ? (
                <p className="border-warning/30 bg-warning/10 text-on-surface rounded-xl border px-3 py-2.5 text-sm leading-relaxed">
                  {tr(
                    `Une ancienne demande en attente (${pendingUpdateTypeLabel(pendingRequest.updateType, tr)}) sera annulée lors de la confirmation.`,
                    `سيُلغى طلب معلق سابق (${pendingUpdateTypeLabel(pendingRequest.updateType, tr)}) عند التأكيد.`,
                  )}
                </p>
              ) : null}
              {isFullyCancelled ? (
                <p className="border-error/25 bg-error/8 text-error rounded-xl border px-3 py-2.5 text-sm font-medium">
                  {tr(
                    "Cet achat est déjà annulé. Aucune modification n'est possible.",
                    "هذا الشراء مُلغى. لا يمكن إجراء أي تعديل.",
                  )}
                </p>
              ) : null}
              <TypeButton
                icon={RotateCcw}
                label={tr("Retour", "إرجاع")}
                hint={tr(
                  "Choisir les articles de cet achat",
                  "اختر منتجات هذا الشراء",
                )}
                disabled={!invoiceId || isFullyCancelled}
                onClick={() => selectType("return")}
              />
              <TypeButton
                icon={ArrowLeftRight}
                label={tr("Remplacement", "استبدال")}
                hint={tr(
                  "Choisir l'article erroné puis un nouveau produit",
                  "اختر المنتج الخاطئ ثم منتجًا جديدًا",
                )}
                disabled={!invoiceId || isFullyCancelled}
                onClick={() => selectType("replacement")}
              />
              <TypeButton
                icon={Banknote}
                label={tr("Changer le prix", "تغيير السعر")}
                hint={tr(
                  "Prix unitaire par article + écart client",
                  "سعر الوحدة لكل منتج + فرق للعميل",
                )}
                disabled={!invoiceId || isFullyCancelled || !canChangePrice}
                onClick={() => selectType("price_change")}
              />
              <TypeButton
                icon={ShoppingBasket}
                label={tr("Renvoyer à la caisse", "إرجاع للصندوق")}
                hint={tr(
                  "Annule l'achat et recharge tout au panier",
                  "يلغي الشراء ويعيد تحميل كل شيء في السلة",
                )}
                disabled={!invoiceId || isFullyCancelled || !canReopen}
                onClick={() => selectType("reopen_in_caisse")}
              />
            </div>
          ) : null}

          {step === "detail" && updateType === "return" ? (
            <InvoiceLinesSection invoiceRow={invoiceRow} invoice={invoice} tr={tr}>
              <PosInvoiceLinePicker
                rows={invoiceLineRows}
                mode="multiple"
                selectedLineIndex={null}
                returnQtyByLine={returnQtyByLine}
                onSelectLine={(lineIndex) => {
                  const row = invoiceLineRows.find((r) => r.idx === lineIndex);
                  if (!row || row.maxQty === 0) return;
                  setReturnQtyByLine((prev) => {
                    const current = prev[lineIndex] ?? 0;
                    if (current > 0) {
                      const next = { ...prev };
                      delete next[lineIndex];
                      return next;
                    }
                    return { ...prev, [lineIndex]: 1 };
                  });
                }}
                onQtyChange={(lineIndex, qty) => {
                  setReturnQtyByLine((prev) => ({ ...prev, [lineIndex]: qty }));
                }}
                tr={tr}
              />
              {returnTotalMad > 0 ? (
                <p className="text-primary pt-2 text-sm font-black tabular-nums">
                  {tr("Total retour", "مجموع الإرجاع")}: {formatPosDh(returnTotalMad, 2, locale)}
                </p>
              ) : null}
              <ReturnOptionsPicker
                reason={returnMotif}
                onReasonChange={setReturnMotif}
                stockDisposition={returnStockDisposition}
                onStockDispositionChange={setReturnStockDisposition}
                tr={tr}
              />
            </InvoiceLinesSection>
          ) : null}

          {step === "detail" &&
          updateType === "replacement" &&
          replacementSubStep === "purchased" ? (
            <InvoiceLinesSection invoiceRow={invoiceRow} invoice={invoice} tr={tr}>
              <p className="text-on-surface-variant mb-2 text-xs font-medium">
                {tr(
                  "Quel article de cet achat doit être remplacé ?",
                  "أي منتج من هذا الشراء يجب استبداله؟",
                )}
              </p>
              <PosInvoiceLinePicker
                rows={invoiceLineRows}
                mode="single"
                selectedLineIndex={selectedPurchasedLineIndex}
                returnQtyByLine={{}}
                onSelectLine={setSelectedPurchasedLineIndex}
                onQtyChange={() => {}}
                tr={tr}
              />
            </InvoiceLinesSection>
          ) : null}

          {step === "detail" &&
          updateType === "replacement" &&
          replacementSubStep === "replacement" ? (
            <div className="space-y-3">
              {selectedPurchasedLine ? (
                <div className="border-primary/20 bg-primary/5 rounded-xl border px-3 py-2 text-sm">
                  <p className="text-on-surface-variant text-[10px] font-bold tracking-wide uppercase">
                    {tr("Remplace", "يستبدل")}
                  </p>
                  <p className="text-on-surface font-bold">
                    {selectedPurchasedLine.line.nameAr}
                  </p>
                </div>
              ) : null}
              <PosDialogProductPicker
                selectedProductId={replacementProduct?.id ?? null}
                onSelectProduct={setReplacementProduct}
                tr={tr}
              />
            </div>
          ) : null}

          {step === "detail" && updateType === "price_change" ? (
            <InvoiceLinesSection invoiceRow={invoiceRow} invoice={invoice} tr={tr}>
              <PosInvoiceLinePriceEditor
                lines={invoice?.lines ?? []}
                unitPriceByLine={unitPriceByLine}
                onUnitPriceChange={(lineIndex, unitPriceMad) => {
                  setUnitPriceByLine((prev) => ({
                    ...prev,
                    [lineIndex]: unitPriceMad,
                  }));
                }}
                tr={tr}
              />
            </InvoiceLinesSection>
          ) : null}

          {step === "detail" && updateType === "reopen_in_caisse" ? (
            <InvoiceLinesSection invoiceRow={invoiceRow} invoice={invoice} tr={tr}>
              <p className="text-on-surface-variant text-sm leading-relaxed">
                {tr(
                  "L'achat original sera annulé, puis ces articles seront rechargés dans le panier caisse. Vous pourrez tout modifier avant de valider une nouvelle vente.",
                  "سيُلغى الشراء الأصلي، ثم تُحمَّل هذه المنتجات في سلة الصندوق. يمكنك تعديل كل شيء قبل تأكيد بيع جديد.",
                )}
              </p>
              <PosInvoiceLinePicker
                rows={invoiceLineRows.filter((row) => row.maxQty > 0)}
                mode="single"
                selectedLineIndex={null}
                returnQtyByLine={{}}
                onSelectLine={() => {}}
                onQtyChange={() => {}}
                readOnly
                tr={tr}
              />
            </InvoiceLinesSection>
          ) : null}

          {step === "confirm" ? (
            <div className="space-y-4">
              <div className="border-primary/20 bg-primary/5 rounded-xl border px-4 py-3">
                <p className="text-on-surface-variant text-[10px] font-bold tracking-wide uppercase">
                  {tr("Récapitulatif", "ملخص")}
                </p>
                <p className="text-on-surface mt-1 text-sm font-semibold">
                  {updateType === "return"
                    ? tr("Retour", "إرجاع")
                    : updateType === "replacement"
                      ? tr("Remplacement", "استبدال")
                      : updateType === "price_change"
                        ? tr("Changer le prix", "تغيير السعر")
                        : tr("Renvoyer à la caisse", "إرجاع للصندوق")}
                </p>
                <p className="text-on-surface mt-2 text-sm">{buildReasonSummary()}</p>
                {updateType === "return" ? (
                  <p className="text-on-surface-variant mt-2 text-xs font-medium">
                    {tr("Stock", "المخزون")}:{" "}
                    {stockDispositionLabel(returnStockDisposition, tr)}
                  </p>
                ) : null}
                {updateType === "replacement" && replacementProduct ? (
                  <p className="text-on-surface-variant mt-1 text-xs tabular-nums">
                    {tr("Prix du remplacement", "سعر البديل")}:{" "}
                    {formatPosDh(replacementProduct.price, 2, locale)}
                  </p>
                ) : null}
                {updateType === "price_change" ? (
                  <div className="mt-3">
                    <PosPriceChangeSummary
                      totals={priceTotals}
                      hasChange={changedPriceLines.length > 0}
                      tr={tr}
                    />
                  </div>
                ) : null}
              </div>

              <label className="border-sidebar-border/70 bg-surface-container-low/50 flex cursor-pointer gap-3 rounded-xl border p-4">
                <input
                  type="checkbox"
                  checked={responsibleChecked}
                  onChange={(e) => setResponsibleChecked(e.target.checked)}
                  className="border-primary text-primary mt-0.5 size-5 shrink-0 rounded"
                />
                <span className="text-on-surface text-sm leading-snug">
                  {tr(
                    `Je suis ${cashierName} et je confirme être responsable de cette demande de modification.`,
                    `أنا ${cashierName} وأؤكد أنني مسؤول عن طلب التعديل هذا.`,
                  )}
                </span>
              </label>

              <div className="text-on-surface-variant flex items-start gap-2 text-xs">
                <ShieldCheck className="text-primary mt-0.5 size-4 shrink-0" aria-hidden />
                <p>{confirmHint}</p>
              </div>
            </div>
          ) : null}
        </div>

        <DialogFooter className="border-sidebar-border shrink-0 gap-2 border-t px-5 py-4 sm:justify-between">
          {step !== "choose" ? (
            <Button
              type="button"
              variant="ghost"
              className="gap-1.5 font-bold"
              onClick={handleDetailBack}
              disabled={saving}
            >
              <ArrowLeft className="size-4 stroke-[1.75]" aria-hidden />
              {tr("Retour", "رجوع")}
            </Button>
          ) : (
            <span />
          )}

          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => handleOpenChange(false)}
              disabled={saving}
            >
              {tr("Annuler", "إلغاء")}
            </Button>
            {step === "detail" ? (
              <Button type="button" onClick={handleDetailContinue}>
                {detailContinueLabel}
              </Button>
            ) : null}
            {step === "confirm" ? (
              <Button
                type="button"
                onClick={() => void handleSubmit()}
                disabled={saving || !responsibleChecked}
              >
                {saving ? tr("Envoi…", "جاري الإرسال…") : confirmLabel}
              </Button>
            ) : null}
          </div>
        </DialogFooter>
      </PosNestedDialogContent>
    </PosDialog>
  );
}

function InvoiceLinesSection({
  invoiceRow,
  invoice,
  tr,
  children,
}: {
  invoiceRow: unknown;
  invoice: ReturnType<typeof invoiceFromConvex> | null;
  tr: (fr: string, ar: string) => string;
  children: ReactNode;
}) {
  if (invoiceRow === undefined) {
    return (
      <p className="text-on-surface-variant text-sm">
        {tr("Chargement des articles…", "جاري تحميل المنتجات…")}
      </p>
    );
  }
  if (!invoice) {
    return (
      <p className="text-error text-sm">
        {tr("Facture introuvable.", "الفاتورة غير موجودة.")}
      </p>
    );
  }
  return (
    <div className="space-y-3">
      <p className="text-on-surface-variant text-xs font-medium">
        {tr("Articles de cet achat", "منتجات هذا الشراء")}{" "}
        <span className="font-bold">{invoice.number}</span>
      </p>
      {children}
    </div>
  );
}

function EntrySummary({
  entry,
  clientName,
  step,
  updateType,
  replacementSubStep,
  tr,
}: {
  entry: LedgerEntry;
  clientName: string;
  step: Step;
  updateType: UpdateType | null;
  replacementSubStep: ReplacementSubStep;
  tr: (fr: string, ar: string) => string;
}) {
  const locale = useLocale();
  const caption =
    step === "choose"
      ? tr("Choisissez le type de modification.", "اختر نوع التعديل.")
      : step === "detail" && updateType === "replacement"
        ? replacementSubStep === "purchased"
          ? tr(
              "Sélectionnez l'article erroné dans cet achat.",
              "اختر المنتج الخاطئ من هذا الشراء.",
            )
          : tr(
              "Choisissez le produit de remplacement dans le catalogue.",
              "اختر منتج الاستبدال من قائمة الصندوق.",
            )
        : step === "detail" && updateType === "return"
          ? tr(
              "Sélectionnez les articles à retourner.",
              "اختر المنتجات المراد إرجاعها.",
            )
          : step === "detail" && updateType === "price_change"
            ? tr(
                "Modifiez le prix unitaire — l'écart client s'affiche en bas.",
                "عدّل سعر الوحدة — يظهر فرق العميل في الأسفل.",
              )
            : step === "detail" && updateType === "reopen_in_caisse"
              ? tr(
                  "Vérifiez les articles avant rechargement au panier.",
                  "راجع المنتجات قبل إعادة التحميل إلى السلة.",
                )
              : step === "detail"
                ? tr("Complétez les détails.", "أكمل التفاصيل.")
                : tr(
                    "Vérifiez et confirmez votre responsabilité.",
                    "راجع وأكّد مسؤوليتك.",
                  );

  return (
    <div className="space-y-2 pt-1">
      <p className="text-on-surface text-sm font-bold">{clientName}</p>
      <div className="border-sidebar-border/70 bg-surface-container-low/60 rounded-xl border px-3 py-2 text-sm">
        <p className="font-semibold">{entry.ref}</p>
        <p className="text-on-surface-variant text-xs">{entry.note}</p>
        <div className="text-on-surface-variant flex flex-wrap items-center gap-2 pt-1 text-xs">
          <span>{formatLedgerDate(entry.date, "fr-FR")}</span>
          <span>·</span>
          <span>{ledgerKindLabel(entry)}</span>
          <span>·</span>
          <span className={cn("font-black tabular-nums", ledgerAmountClass(entry))}>
            {ledgerAmountSign(entry)} {formatPosDh(entry.amountMad, 2, locale)}
          </span>
        </div>
      </div>
      <p className="text-on-surface-variant text-xs leading-relaxed">{caption}</p>
    </div>
  );
}

function pendingUpdateTypeLabel(
  type: UpdateType,
  tr: (fr: string, ar: string) => string,
): string {
  switch (type) {
    case "return":
      return tr("Retour", "إرجاع");
    case "replacement":
      return tr("Remplacement", "استبدال");
    case "price_change":
      return tr("Changer le prix", "تغيير السعر");
    case "reopen_in_caisse":
      return tr("Renvoyer à la caisse", "إرجاع للصندوق");
  }
}

function TypeButton({
  icon: Icon,
  label,
  hint,
  disabled,
  onClick,
}: {
  icon: typeof RotateCcw;
  label: string;
  hint: string;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "border-sidebar-border/70 bg-surface-container-lowest hover:border-primary/25 hover:bg-primary/5 flex items-center gap-3 rounded-xl border p-3 text-start transition-colors active:scale-[0.99]",
        disabled && "cursor-not-allowed opacity-40",
      )}
    >
      <div className="bg-primary/10 text-primary flex size-10 shrink-0 items-center justify-center rounded-lg">
        <Icon className="size-5 stroke-[1.75]" aria-hidden />
      </div>
      <div className="min-w-0">
        <p className="text-on-surface text-sm font-black">{label}</p>
        <p className="text-on-surface-variant text-xs">{hint}</p>
      </div>
    </button>
  );
}
