"use client";

import { useState } from "react";
import { useMutation } from "convex/react";
import { ScanBarcode } from "lucide-react";
import { useLocale } from "next-intl";

import type { Product } from "@/components/pos/types";
import { BarcodeScanDialog } from "@/components/products/barcode-scan-dialog";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toaster";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { normalizeBarcodeInput } from "@/lib/pos/catalog-lookup";

type ProductBarcodeQuickDialogProps = {
  product: Product | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function ProductBarcodeQuickDialog({
  product,
  open,
  onOpenChange,
}: ProductBarcodeQuickDialogProps) {
  const locale = useLocale();
  const isAr = locale === "ar";
  const tr = (fr: string, ar: string) => (isAr ? ar : fr);
  const toast = useToast();
  const updateBarcode = useMutation(api.products.updateBarcode);
  const [barcode, setBarcode] = useState(product?.barcode ?? "");
  const [saving, setSaving] = useState(false);
  const [scanOpen, setScanOpen] = useState(false);

  async function handleSave() {
    if (!product) return;
    const next = normalizeBarcodeInput(barcode);
    const current = normalizeBarcodeInput(product.barcode ?? "");
    if (next === current) {
      toast.error(
        tr("Aucun changement", "لا تغيير"),
        tr("Modifiez le code-barres avant d’enregistrer.", "عدّل الرمز قبل الحفظ."),
      );
      return;
    }

    setSaving(true);
    try {
      await updateBarcode({
        productId: product.id as Id<"products">,
        barcode: next || null,
      });
      toast.success(
        tr("Code-barres mis à jour", "تم تحديث الرمز"),
        product.name,
      );
      onOpenChange(false);
    } catch (error) {
      toast.error(
        tr("Sauvegarde impossible", "تعذر الحفظ"),
        error instanceof Error
          ? error.message
          : tr("Réessayez dans un instant.", "حاول مرة أخرى."),
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="border-sidebar-border bg-surface-container-lowest text-on-surface max-w-md">
          <DialogHeader>
            <DialogTitle className="text-on-surface text-xl font-black">
              {tr("Code-barres", "الباركود")}
            </DialogTitle>
            <DialogDescription>
              {tr(
                "Scanner ou saisir le code-barres de ce produit.",
                "امسح أو أدخل باركود هذا المنتج.",
              )}
            </DialogDescription>
            {product ? (
              <p className="text-on-surface pt-1 text-sm font-semibold">
                {product.name}
              </p>
            ) : null}
          </DialogHeader>

          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <label
                htmlFor="quick-product-barcode"
                className="text-on-surface text-xs font-bold tracking-wide uppercase"
              >
                {tr("Code-barres", "الباركود")}
              </label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 gap-1.5"
                onClick={() => setScanOpen(true)}
              >
                <ScanBarcode className="size-3.5" aria-hidden />
                {tr("Scanner", "مسح")}
              </Button>
            </div>
            <Input
              id="quick-product-barcode"
              value={barcode}
              onChange={(e) => setBarcode(e.target.value)}
              placeholder={tr("Ex. 6111252345678", "مثال 6111252345678")}
              autoComplete="off"
              inputMode="text"
            />
            <p className="text-on-surface-variant text-xs">
              {tr(
                "Laissez vide pour retirer le code-barres.",
                "اتركه فارغًا لإزالة الباركود.",
              )}
            </p>
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
                : tr("Enregistrer", "حفظ")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <BarcodeScanDialog
        open={scanOpen}
        onOpenChange={setScanOpen}
        onScan={setBarcode}
      />
    </>
  );
}
