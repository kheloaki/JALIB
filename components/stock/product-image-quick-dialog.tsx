"use client";

import { useState } from "react";
import { useMutation } from "convex/react";
import { useLocale } from "next-intl";

import type { Product } from "@/components/pos/types";
import { ProductPhotoField } from "@/components/products/product-photo-field";
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
import { isProductPlaceholderImage } from "@/lib/products/product-placeholder";

type ProductImageQuickDialogProps = {
  product: Product | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function ProductImageQuickDialog({
  product,
  open,
  onOpenChange,
}: ProductImageQuickDialogProps) {
  const locale = useLocale();
  const isAr = locale === "ar";
  const tr = (fr: string, ar: string) => (isAr ? ar : fr);
  const toast = useToast();
  const updateImage = useMutation(api.products.updateImage);
  const initial =
    product && !isProductPlaceholderImage(product.image)
      ? product.image
      : null;
  const [photoDataUrl, setPhotoDataUrl] = useState<string | null>(initial);
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    if (!product) return;
    const next = photoDataUrl?.trim() || null;
    const current = isProductPlaceholderImage(product.image)
      ? null
      : product.image.trim();
    if ((next ?? "") === (current ?? "")) {
      toast.error(
        tr("Aucun changement", "لا تغيير"),
        tr("Ajoutez ou changez la photo avant d’enregistrer.", "أضف أو غيّر الصورة قبل الحفظ."),
      );
      return;
    }

    setSaving(true);
    try {
      await updateImage({
        productId: product.id as Id<"products">,
        image: next,
        imageAlt: product.name,
      });
      toast.success(
        tr("Photo mise à jour", "تم تحديث الصورة"),
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
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="border-sidebar-border bg-surface-container-lowest text-on-surface max-w-md">
        <DialogHeader>
          <DialogTitle className="text-on-surface text-xl font-black">
            {tr("Photo produit", "صورة المنتج")}
          </DialogTitle>
          <DialogDescription>
            {tr(
              "Ajouter ou remplacer la photo affichée à la caisse.",
              "أضف أو استبدل الصورة المعروضة في الصندوق.",
            )}
          </DialogDescription>
          {product ? (
            <p className="text-on-surface pt-1 text-sm font-semibold">
              {product.name}
            </p>
          ) : null}
        </DialogHeader>

        <ProductPhotoField value={photoDataUrl} onChange={setPhotoDataUrl} />
        <p className="text-on-surface-variant text-xs">
          {photoDataUrl
            ? tr(
                "La photo est compressée automatiquement à l’upload.",
                "يتم ضغط الصورة تلقائيًا عند الرفع.",
              )
            : tr(
                "Sans photo, l’image par défaut du catalogue sera utilisée.",
                "بدون صورة ستُستخدم صورة الكتالوج الافتراضية.",
              )}
        </p>

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
  );
}
