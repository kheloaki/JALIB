"use client";

import { useEffect, useState } from "react";
import { useMutation } from "convex/react";
import { useLocale } from "next-intl";

import type { Product } from "@/components/pos/types";
import { MadPriceField } from "@/components/money/mad-price-field";
import { QtyKeypadField } from "@/components/money/qty-keypad-field";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/components/ui/toaster";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { clampMadPrice } from "@/lib/money/mad";
import { cn } from "@/lib/utils";

type StockMode = "add" | "set";

type ProductStockQuickDialogProps = {
  product: Product | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function ProductStockQuickDialog({
  product,
  open,
  onOpenChange,
}: ProductStockQuickDialogProps) {
  const locale = useLocale();
  const isAr = locale === "ar";
  const tr = (fr: string, ar: string) => (isAr ? ar : fr);
  const toast = useToast();
  const addStock = useMutation(api.products.addStock);
  const setStockQty = useMutation(api.products.setStockQty);

  const [mode, setMode] = useState<StockMode>("add");
  const [quantity, setQuantity] = useState(1);
  const [costMad, setCostMad] = useState(0);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open || !product) return;
    setMode("add");
    setQuantity(1);
    setCostMad(product.costMad && product.costMad > 0 ? product.costMad : 0);
  }, [open, product]);

  useEffect(() => {
    if (!product) return;
    if (mode === "add") {
      setQuantity(1);
    } else {
      setQuantity(Math.max(0, Math.floor(product.stockQty)));
    }
  }, [mode, product]);

  async function handleSave() {
    if (!product) return;
    const qty = Math.floor(quantity);

    if (mode === "add") {
      if (qty < 1) {
        toast.error(
          tr("Quantité invalide", "كمية غير صالحة"),
          tr("Indiquez au moins 1 unité à ajouter.", "أدخل وحدة واحدة على الأقل."),
        );
        return;
      }
      setSaving(true);
      try {
        await addStock({
          productId: product.id as Id<"products">,
          quantity: qty,
          ...(costMad > 0 ? { costMad: clampMadPrice(costMad) } : {}),
        });
        toast.success(
          tr("Stock mis à jour", "تم تحديث المخزون"),
          `${product.name} · +${qty}`,
        );
        onOpenChange(false);
      } catch (error) {
        toast.error(
          tr("Échec de l’ajout", "فشل الإضافة"),
          error instanceof Error
            ? error.message
            : tr("Réessayez dans un instant.", "حاول مرة أخرى."),
        );
      } finally {
        setSaving(false);
      }
      return;
    }

    if (qty < 0) {
      toast.error(
        tr("Quantité invalide", "كمية غير صالحة"),
        tr("Le stock ne peut pas être négatif.", "لا يمكن أن يكون المخزون سالبًا."),
      );
      return;
    }
    if (qty === Math.floor(product.stockQty)) {
      toast.error(
        tr("Aucun changement", "لا تغيير"),
        tr("Modifiez la quantité avant d’enregistrer.", "عدّل الكمية قبل الحفظ."),
      );
      return;
    }

    setSaving(true);
    try {
      await setStockQty({
        productId: product.id as Id<"products">,
        stockQty: qty,
      });
      toast.success(
        tr("Stock corrigé", "تم تصحيح المخزون"),
        `${product.name} · ${Math.floor(product.stockQty)} → ${qty}`,
      );
      onOpenChange(false);
    } catch (error) {
      toast.error(
        tr("Échec de la correction", "فشل التصحيح"),
        error instanceof Error
          ? error.message
          : tr("Réessayez dans un instant.", "حاول مرة أخرى."),
      );
    } finally {
      setSaving(false);
    }
  }

  const current = product ? Math.max(0, Math.floor(product.stockQty)) : 0;
  const preview =
    mode === "add"
      ? current + Math.max(0, Math.floor(quantity))
      : Math.max(0, Math.floor(quantity));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="border-sidebar-border bg-surface-container-lowest text-on-surface max-w-md">
        <DialogHeader>
          <DialogTitle className="text-on-surface text-xl font-black">
            {tr("Modifier le stock", "تعديل المخزون")}
          </DialogTitle>
          <DialogDescription>
            {tr(
              "Ajoutez des unités ou corrigez le stock actuel.",
              "أضف وحدات أو صحّح المخزون الحالي.",
            )}
          </DialogDescription>
          {product ? (
            <p className="text-on-surface pt-1 text-sm font-semibold">
              {product.name}
              <span className="text-on-surface-variant mt-1 block text-xs font-normal">
                {tr("Stock actuel", "المخزون الحالي")}:{" "}
                <span className="text-on-surface font-bold tabular-nums">
                  {current}
                </span>
                <span className="mx-1.5">·</span>
                {tr("Après", "بعد")}:{" "}
                <span className="text-primary font-bold tabular-nums">
                  {preview}
                </span>
              </span>
            </p>
          ) : null}
        </DialogHeader>

        <div
          className="bg-surface-container-low grid grid-cols-2 gap-1 rounded-xl p-1"
          role="tablist"
          aria-label={tr("Mode stock", "وضع المخزون")}
        >
          <button
            type="button"
            role="tab"
            aria-selected={mode === "add"}
            className={cn(
              "rounded-lg px-3 py-2 text-sm font-bold transition-colors",
              mode === "add"
                ? "bg-surface-container-lowest text-on-surface shadow-sm"
                : "text-on-surface-variant",
            )}
            onClick={() => setMode("add")}
          >
            {tr("Ajouter", "إضافة")}
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mode === "set"}
            className={cn(
              "rounded-lg px-3 py-2 text-sm font-bold transition-colors",
              mode === "set"
                ? "bg-surface-container-lowest text-on-surface shadow-sm"
                : "text-on-surface-variant",
            )}
            onClick={() => setMode("set")}
          >
            {tr("Définir", "تعيين")}
          </button>
        </div>

        <div className="space-y-4">
          <div className="space-y-2">
            <label
              htmlFor="quick-stock-qty"
              className="text-on-surface text-xs font-bold tracking-wide uppercase"
            >
              {mode === "add"
                ? tr("Quantité à ajouter", "الكمية للإضافة")
                : tr("Nouveau stock", "المخزون الجديد")}
            </label>
            <QtyKeypadField
              id="quick-stock-qty"
              value={quantity}
              onValueChange={setQuantity}
              min={mode === "add" ? 1 : 0}
              keypadTitle={product?.name ?? ""}
              wrapperClassName="max-w-full"
            />
          </div>

          {mode === "add" ? (
            <div className="space-y-2">
              <label
                htmlFor="quick-stock-cost"
                className="text-on-surface text-xs font-bold tracking-wide uppercase"
              >
                {tr("Prix d’achat unitaire (optionnel)", "سعر الشراء (اختياري)")}
              </label>
              <MadPriceField
                id="quick-stock-cost"
                value={costMad}
                onValueChange={setCostMad}
                min={0}
                wrapperClassName="max-w-full"
              />
              <p className="text-on-surface-variant text-xs">
                {tr(
                  "Si renseigné, enregistre un prix d’achat dans l’historique.",
                  "إن وُجد يُسجَّل سعر الشراء في السجل.",
                )}
              </p>
            </div>
          ) : (
            <p className="text-on-surface-variant text-xs">
              {tr(
                "Corrige le stock affiché sans créer d’entrée d’achat.",
                "يصحّح المخزون الظاهر دون إنشاء عملية شراء.",
              )}
            </p>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={saving}
          >
            {tr("Annuler", "إلغاء")}
          </Button>
          <Button
            type="button"
            onClick={() => void handleSave()}
            disabled={!product || saving}
            className="from-primary to-primary-container bg-linear-to-br font-bold"
          >
            {saving
              ? tr("Enregistrement…", "جارٍ الحفظ…")
              : mode === "add"
                ? tr("Ajouter au stock", "إضافة للمخزون")
                : tr("Enregistrer le stock", "حفظ المخزون")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
