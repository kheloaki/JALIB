"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { ChevronDown, Plus, ScanBarcode, Trash2 } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";

import { MadPriceField } from "@/components/money/mad-price-field";
import { BarcodeScanDialog } from "@/components/products/barcode-scan-dialog";
import { ProductPhotoField } from "@/components/products/product-photo-field";
import { SoldByWeightField } from "@/components/products/sold-by-weight-field";
import type { PosCategory } from "@/components/pos/constants";
import { POS_CATEGORIES } from "@/components/pos/constants";
import { PosAddCategoryDialog } from "@/components/pos/pos-add-category-dialog";
import { Button } from "@/components/ui/button";
import { ConfirmDeleteDialog } from "@/components/ui/confirm-delete-dialog";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toaster";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import type { Product } from "@/components/pos/types";
import { useConvexCatalog } from "@/hooks/use-convex-catalog";
import { canDeleteProducts } from "@/lib/auth/permissions";
import {
  isBarcodeTaken,
  normalizeBarcodeInput,
} from "@/lib/pos/catalog-lookup";
import {
  mergeShelfCategoriesForSelect,
  normalizeCategoryLabel,
} from "@/lib/pos/pos-categories";
import { clampMadPrice } from "@/lib/money/mad";
import {
  isProductPlaceholderImage,
  resolveProductImage,
} from "@/lib/products/product-placeholder";

const PRODUCT_CATEGORIES = POS_CATEGORIES.filter(
  (c): c is Exclude<PosCategory, "Tout"> => c !== "Tout",
);

type EditProductDialogProps = {
  product: Product | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function EditProductDialog({
  product,
  open,
  onOpenChange,
}: EditProductDialogProps) {
  const t = useTranslations("stock");
  const locale = useLocale();
  const isAr = locale === "ar";
  const tr = (fr: string, ar: string) => (isAr ? ar : fr);
  const toast = useToast();
  const currentUser = useQuery(api.authz.currentUser);
  const canDelete = canDeleteProducts(currentUser?.permissions ?? []);
  const updateProduct = useMutation(api.products.update);
  const removeProduct = useMutation(api.products.remove);
  const createCategory = useMutation(api.products.createCategory);
  const { products, categories, brands } = useConvexCatalog();

  const [name, setName] = useState("");
  const [category, setCategory] = useState("");
  const [brandId, setBrandId] = useState("");
  const [barcode, setBarcode] = useState("");
  const [priceMad, setPriceMad] = useState(0);
  const [costMad, setCostMad] = useState(0);
  const [soldByWeight, setSoldByWeight] = useState(false);
  const [photoDataUrl, setPhotoDataUrl] = useState<string | null>(null);
  const [scanOpen, setScanOpen] = useState(false);
  const [addCategoryOpen, setAddCategoryOpen] = useState(false);
  const [localCategories, setLocalCategories] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const productCategories = useMemo(
    () =>
      mergeShelfCategoriesForSelect(
        categories.length > 0 ? categories : [...PRODUCT_CATEGORIES],
        localCategories,
      ),
    [categories, localCategories],
  );

  const selectedCategory =
    category && productCategories.includes(category)
      ? category
      : (productCategories[0] ?? "Alimentation");

  useEffect(() => {
    if (!open || !product) return;
    setName(product.name);
    setCategory(product.category);
    setBrandId(product.brandId ?? "");
    setBarcode(product.barcode ?? "");
    setPriceMad(product.price);
    setCostMad(product.costMad && product.costMad > 0 ? product.costMad : 0);
    setSoldByWeight(product.soldByWeight === true);
    setPhotoDataUrl(
      isProductPlaceholderImage(product.image) ? null : product.image,
    );
    setLocalCategories([]);
  }, [open, product]);

  const barcodeConflict = useMemo(() => {
    const key = normalizeBarcodeInput(barcode);
    if (!key || !product) return false;
    return isBarcodeTaken(products, key, product.id);
  }, [barcode, product, products]);

  function handleCategoryCreated(label: string): boolean {
    const normalized = normalizeCategoryLabel(label);
    if (!normalized || normalized.toLowerCase() === "tout") return false;
    if (
      productCategories.some(
        (c) => c.toLowerCase() === normalized.toLowerCase(),
      )
    ) {
      return false;
    }
    setCategory(normalized);
    setLocalCategories((prev) => [...prev, normalized]);
    void createCategory({ label: normalized }).catch(() => {});
    return true;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!product) return;
    if (!name.trim()) {
      toast.error(tr("Nom requis", "الاسم مطلوب"), tr("Ajoutez un nom.", "أضف اسمًا."));
      return;
    }
    if (priceMad <= 0) {
      toast.error(tr("Prix invalide", "سعر غير صالح"), tr("Prix vente > 0.", "سعر البيع > 0."));
      return;
    }
    if (barcodeConflict) {
      toast.error(tr("Code-barres utilisé", "الباركود مستخدم"), tr("Choisissez un autre code.", "اختر باركودًا آخر."));
      return;
    }
    setSaving(true);
    try {
      await updateProduct({
        productId: product.id as Id<"products">,
        name: name.trim(),
        category: selectedCategory,
        priceMad: clampMadPrice(priceMad),
        image: resolveProductImage(photoDataUrl ?? product.image),
        imageAlt: name.trim(),
        ...(costMad > 0 ? { costMad: clampMadPrice(costMad) } : {}),
        ...(normalizeBarcodeInput(barcode)
          ? { barcode: normalizeBarcodeInput(barcode) }
          : {}),
        soldByWeight,
        brandId: brandId ? (brandId as Id<"brands">) : null,
      });
      toast.success(t("editProductSuccessTitle"), product.name);
      onOpenChange(false);
    } catch (error) {
      toast.error(
        t("editProductErrorTitle"),
        error instanceof Error ? error.message : t("errorGeneric"),
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteConfirm() {
    if (!product) return;
    setDeleting(true);
    try {
      await removeProduct({ productId: product.id as Id<"products"> });
      toast.success(
        tr("Produit supprimé", "تم حذف المنتج"),
        product.name,
      );
      setDeleteOpen(false);
      onOpenChange(false);
    } catch (error) {
      toast.error(
        tr("Suppression impossible", "تعذر الحذف"),
        error instanceof Error ? error.message : t("errorGeneric"),
      );
    } finally {
      setDeleting(false);
    }
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-h-[min(92vh,800px)] max-w-lg overflow-y-auto rounded-2xl">
          <DialogHeader>
            <DialogTitle>{t("editProduct")}</DialogTitle>
          </DialogHeader>

          <form className="space-y-4" onSubmit={(e) => void handleSubmit(e)}>
            <ProductPhotoField value={photoDataUrl} onChange={setPhotoDataUrl} />

            <div className="space-y-2">
              <label htmlFor="edit-product-name" className="text-on-surface text-xs font-bold uppercase">
                {tr("Nom", "الاسم")}
              </label>
              <Input
                id="edit-product-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="h-11 rounded-xl"
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="edit-product-category" className="text-on-surface text-xs font-bold uppercase">
                {tr("Catégorie", "الفئة")}
              </label>
              <div className="flex gap-2">
                <div className="relative min-w-0 flex-1">
                  <select
                    id="edit-product-category"
                    value={selectedCategory}
                    onChange={(e) => setCategory(e.target.value)}
                    className="bg-surface-container-low h-11 w-full appearance-none rounded-xl px-4 pr-10 text-sm font-medium"
                  >
                    {productCategories.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="pointer-events-none absolute top-1/2 right-3 size-5 -translate-y-1/2" />
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="size-11 shrink-0 rounded-xl"
                  onClick={() => setAddCategoryOpen(true)}
                >
                  <Plus className="size-5" />
                </Button>
              </div>
            </div>

            {brands.length > 0 ? (
              <div className="space-y-2">
                <label htmlFor="edit-product-brand" className="text-on-surface text-xs font-bold uppercase">
                  {tr("Marque", "العلامة")}
                </label>
                <div className="relative">
                  <select
                    id="edit-product-brand"
                    value={brandId}
                    onChange={(e) => setBrandId(e.target.value)}
                    className="bg-surface-container-low h-11 w-full appearance-none rounded-xl px-4 pr-10 text-sm font-medium"
                  >
                    <option value="">{tr("Aucune marque", "بدون علامة")}</option>
                    {brands.map((brand) => (
                      <option key={brand.id} value={brand.id}>
                        {brand.name}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="pointer-events-none absolute top-1/2 right-3 size-5 -translate-y-1/2" />
                </div>
              </div>
            ) : null}

            <div className="space-y-2">
              <div className="flex items-end justify-between gap-2">
                <label htmlFor="edit-product-barcode" className="text-on-surface text-xs font-bold uppercase">
                  {tr("Code-barres", "الباركود")}
                </label>
                <Button type="button" variant="outline" size="sm" onClick={() => setScanOpen(true)}>
                  <ScanBarcode className="size-3.5" />
                  {tr("Scanner", "مسح")}
                </Button>
              </div>
              <Input
                id="edit-product-barcode"
                value={barcode}
                onChange={(e) => setBarcode(e.target.value)}
                className="h-11 rounded-xl font-mono"
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <label className="text-on-surface text-xs font-bold uppercase">{t("sellPrice")}</label>
                <MadPriceField value={priceMad} onValueChange={setPriceMad} min={0.01} />
              </div>
              <div className="space-y-2">
                <label className="text-on-surface text-xs font-bold uppercase">{t("purchasePrice")}</label>
                <MadPriceField value={costMad} onValueChange={setCostMad} min={0} />
              </div>
            </div>

            <SoldByWeightField value={soldByWeight} onChange={setSoldByWeight} />

            <DialogFooter className="gap-2 pt-2 sm:justify-between">
              {canDelete ? (
                <Button
                  type="button"
                  variant="destructive"
                  className="rounded-xl font-bold sm:mr-auto"
                  disabled={saving || deleting || !product}
                  onClick={() => setDeleteOpen(true)}
                >
                  <Trash2 className="size-4 stroke-[1.75]" aria-hidden />
                  {tr("Supprimer", "حذف")}
                </Button>
              ) : (
                <span />
              )}
              <div className="flex flex-col-reverse gap-2 sm:flex-row">
                <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                  {t("cancel")}
                </Button>
                <Button type="submit" disabled={saving || !product}>
                  {saving ? t("saving") : t("save")}
                </Button>
              </div>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmDeleteDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        entityName={product?.name ?? ""}
        confirmText={product?.name ?? ""}
        title={tr("Supprimer ce produit ?", "حذف هذا المنتج؟")}
        description={tr(
          "Le produit disparaîtra du catalogue et de la caisse. Cette action est réservée à l'administrateur. Tapez le nom exact du produit pour confirmer.",
          "سيختفي المنتج من الكتالوج والصندوق. هذا الإجراء مخصص للمسؤول فقط. اكتب اسم المنتج تمامًا للتأكيد.",
        )}
        typePrompt={tr(
          `Tapez « ${product?.name ?? ""} » pour confirmer`,
          `اكتب « ${product?.name ?? ""} » للتأكيد`,
        )}
        confirmLabel={tr("Supprimer définitivement", "حذف نهائي")}
        cancelLabel={tr("Annuler", "إلغاء")}
        busy={deleting}
        onConfirm={handleDeleteConfirm}
      />

      <BarcodeScanDialog open={scanOpen} onOpenChange={setScanOpen} onScan={setBarcode} />
      <PosAddCategoryDialog
        open={addCategoryOpen}
        onOpenChange={setAddCategoryOpen}
        onCreate={handleCategoryCreated}
      />
    </>
  );
}
