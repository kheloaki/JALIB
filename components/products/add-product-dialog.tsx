"use client";

import { useEffect, useMemo, useState } from "react";
import { useConvex, useMutation, useQuery } from "convex/react";
import { ChevronDown, Plus, ScanBarcode } from "lucide-react";
import { useLocale } from "next-intl";

import { MadPriceField } from "@/components/money/mad-price-field";
import { QtyKeypadField } from "@/components/money/qty-keypad-field";
import { BarcodeScanDialog } from "@/components/products/barcode-scan-dialog";
import {
  ExistingProductAlert,
  type ExistingProductAlertData,
} from "@/components/products/existing-product-alert";
import { ProductPhotoField } from "@/components/products/product-photo-field";
import { SoldByWeightField } from "@/components/products/sold-by-weight-field";
import type { PosCategory } from "@/components/pos/constants";
import { POS_CATEGORIES } from "@/components/pos/constants";
import { PosAddCategoryDialog } from "@/components/pos/pos-add-category-dialog";
import { Button } from "@/components/ui/button";
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
import { useConvexCatalog } from "@/hooks/use-convex-catalog";
import {
  findProductByBarcode,
  isBarcodeTaken,
  normalizeBarcodeInput,
} from "@/lib/pos/catalog-lookup";
import {
  mergeShelfCategoriesForSelect,
  normalizeCategoryLabel,
} from "@/lib/pos/pos-categories";
import { clampMadPrice, formatMad } from "@/lib/money/mad";
import { resolveProductImage } from "@/lib/products/product-placeholder";

const PRODUCT_CATEGORIES = POS_CATEGORIES.filter(
  (c): c is Exclude<PosCategory, "Tout"> => c !== "Tout",
);

export type AddProductPrefill = {
  name?: string;
  barcode?: string;
};

type AddProductDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  prefill?: AddProductPrefill | null;
  onCreated?: (product: { id: string; name: string }) => void;
  /** Opens the camera when the dialog opens (quick add from achats). */
  openCameraOnOpen?: boolean;
};

export function AddProductDialog({
  open,
  onOpenChange,
  prefill = null,
  onCreated,
  openCameraOnOpen = false,
}: AddProductDialogProps) {
  const locale = useLocale();
  const isAr = locale === "ar";
  const tr = (fr: string, ar: string) => (isAr ? ar : fr);
  const toast = useToast();
  const convex = useConvex();
  const createProduct = useMutation(api.products.create);
  const createCategory = useMutation(api.products.createCategory);
  const { products, categories, brands, isLoading } = useConvexCatalog();
  const hydrated = !isLoading;

  const [barcode, setBarcode] = useState("");
  const [scanOpen, setScanOpen] = useState(false);
  const [addCategoryOpen, setAddCategoryOpen] = useState(false);
  const [localCategories, setLocalCategories] = useState<string[]>([]);
  const [name, setName] = useState("");
  const [category, setCategory] = useState("Alimentation");
  const [brandId, setBrandId] = useState<string>("");
  const [priceMad, setPriceMad] = useState(0);
  const [costMad, setCostMad] = useState(0);
  const [stock, setStock] = useState(0);
  const [soldByWeight, setSoldByWeight] = useState(false);
  const [photoDataUrl, setPhotoDataUrl] = useState<string | null>(null);
  const [submitDuplicate, setSubmitDuplicate] =
    useState<ExistingProductAlertData | null>(null);

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

  const normalizedBarcode = useMemo(
    () => normalizeBarcodeInput(barcode),
    [barcode],
  );

  const serverDuplicate = useQuery(
    api.products.findByBarcode,
    open && normalizedBarcode
      ? { barcode: normalizedBarcode, includeInactive: true }
      : "skip",
  );

  const matchedByBarcode = useMemo(() => {
    if (!normalizedBarcode) return undefined;
    return findProductByBarcode(products, normalizedBarcode);
  }, [normalizedBarcode, products]);

  const existingProduct = useMemo<ExistingProductAlertData | null>(() => {
    if (matchedByBarcode) {
      return {
        name: matchedByBarcode.name,
        category: matchedByBarcode.category,
        price: matchedByBarcode.price,
        image: matchedByBarcode.image,
        imageAlt: matchedByBarcode.imageAlt,
        active: true,
      };
    }
    if (serverDuplicate) {
      return {
        name: serverDuplicate.name,
        category: serverDuplicate.category,
        price: serverDuplicate.price,
        image: serverDuplicate.image,
        imageAlt: serverDuplicate.imageAlt,
        active: serverDuplicate.active,
      };
    }
    if (submitDuplicate) return submitDuplicate;
    return null;
  }, [matchedByBarcode, serverDuplicate, submitDuplicate]);

  const previewLine = useMemo(() => {
    const stockNum = stock;
    return `${name.trim() || "…"} · ${formatMad(priceMad, 2, locale)} · stock ${stockNum}`;
  }, [name, priceMad, stock, locale]);

  function resetForm() {
    setName("");
    setBarcode("");
    setPriceMad(0);
    setCostMad(0);
    setStock(0);
    setSoldByWeight(false);
    setPhotoDataUrl(null);
    setCategory("Alimentation");
    setBrandId("");
    setLocalCategories([]);
    setSubmitDuplicate(null);
  }

  useEffect(() => {
    if (!open) return;
    resetForm();
    if (prefill?.name) setName(prefill.name);
    if (prefill?.barcode) setBarcode(prefill.barcode);
  }, [open, prefill?.barcode, prefill?.name]);

  function handleOpenChange(next: boolean) {
    if (!next) resetForm();
    onOpenChange(next);
  }

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
    void createCategory({ label: normalized }).catch((error) => {
      toast.error(
        tr("Catégorie impossible", "تعذر إنشاء الفئة"),
        error instanceof Error ? error.message : tr("Réessayez.", "حاول مجددًا."),
      );
    });
    return true;
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!name.trim()) {
      toast.error(tr("Nom requis", "الاسم مطلوب"), tr("Ajoutez un nom de produit.", "أضف اسم المنتج."));
      return;
    }
    if (priceMad <= 0) {
      toast.error(
        tr("Prix requis", "السعر مطلوب"),
        tr("Le prix de vente doit être supérieur à 0.", "يجب أن يكون سعر البيع أكبر من 0."),
      );
      return;
    }
    if (existingProduct) {
      return;
    }

    const normalized = normalizedBarcode;
    if (normalized && isBarcodeTaken(products, normalized)) {
      return;
    }

    const stockQty = stock;
    const cost = clampMadPrice(costMad);
    try {
      const product = await createProduct({
        name: name.trim(),
        category: selectedCategory,
        priceMad,
        stockQty,
        image: resolveProductImage(photoDataUrl),
        imageAlt: name.trim(),
        ...(cost > 0 ? { costMad: cost } : {}),
        ...(normalized ? { barcode: normalized } : {}),
        ...(soldByWeight ? { soldByWeight: true } : {}),
        ...(brandId ? { brandId: brandId as Id<"brands"> } : {}),
      });
      toast.success(
        tr("Produit enregistré", "تم حفظ المنتج"),
        tr(`${product.name} est dans le catalogue.`, `${product.name} تمت إضافته إلى الكتالوج.`),
      );
      onCreated?.({ id: product.id, name: product.name });
      handleOpenChange(false);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : tr("Réessayez.", "حاول مجددًا.");
      if (
        normalized &&
        message.toLowerCase().includes("barcode already exists")
      ) {
        const duplicate = await convex.query(api.products.findByBarcode, {
          barcode: normalized,
          includeInactive: true,
        });
        if (duplicate) {
          setSubmitDuplicate({
            name: duplicate.name,
            category: duplicate.category,
            price: duplicate.price,
            image: duplicate.image,
            imageAlt: duplicate.imageAlt,
            active: duplicate.active,
          });
          return;
        }
      }
      toast.error(tr("Enregistrement impossible", "تعذر الحفظ"), message);
    }
  }

  const canSubmit =
    hydrated &&
    name.trim().length > 0 &&
    priceMad > 0 &&
    !existingProduct;

  return (
    <>
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="max-h-[min(92vh,800px)] max-w-lg overflow-y-auto rounded-2xl">
          <DialogHeader>
            <DialogTitle>{tr("Nouveau produit", "منتج جديد")}</DialogTitle>
          </DialogHeader>

          <form className="space-y-5" onSubmit={handleSubmit}>
            <div className="border-sidebar-border bg-surface-container-lowest/80 space-y-4 rounded-2xl border p-4">
              <div className="space-y-2">
                <div className="flex flex-wrap items-end justify-between gap-2">
                  <label
                    htmlFor="product-barcode"
                    className="text-on-surface text-xs font-bold tracking-wide uppercase"
                  >
                    {tr("Code-barres", "الباركود")}
                  </label>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="border-primary/20 text-primary h-8 gap-1.5 rounded-lg px-2.5 text-xs font-bold"
                    onClick={() => setScanOpen(true)}
                  >
                    <ScanBarcode className="size-3.5 stroke-[1.75]" aria-hidden />
                    {tr("Scanner", "مسح")}
                  </Button>
                </div>
                <Input
                  id="product-barcode"
                  name="barcode"
                  value={barcode}
                  onChange={(e) => {
                    setBarcode(e.target.value);
                    setSubmitDuplicate(null);
                  }}
                  placeholder={tr("EAN, UPC…", "EAN, UPC…")}
                  autoComplete="off"
                  inputMode="numeric"
                  className="bg-surface-container-low border-transparent focus-visible:ring-primary/25 h-11 rounded-xl font-mono tabular-nums"
                />
              </div>

              {existingProduct ? (
                <ExistingProductAlert
                  product={existingProduct}
                  locale={locale}
                  tr={tr}
                />
              ) : null}

              {!existingProduct ? (
                <ProductPhotoField
                  value={photoDataUrl}
                  onChange={setPhotoDataUrl}
                  autoOpenCamera={open && openCameraOnOpen}
                />
              ) : null}

              <div className="space-y-2">
                <label
                  htmlFor="product-name"
                  className="text-on-surface text-xs font-bold tracking-wide uppercase"
                >
                  {tr("Nom du produit", "اسم المنتج")}
                </label>
                <Input
                  id="product-name"
                  name="name"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={tr("Ex. Huile d'olive 1L", "مثال: زيت زيتون 1 لتر")}
                  disabled={Boolean(existingProduct)}
                  className="bg-surface-container-low border-transparent focus-visible:ring-primary/25 h-11 rounded-xl disabled:opacity-60"
                  dir="auto"
                  lang={locale}
                />
              </div>

              <div className="space-y-2">
                <label
                  htmlFor="product-category"
                  className="text-on-surface text-xs font-bold tracking-wide uppercase"
                >
                  {tr("Catégorie", "الفئة")}
                </label>
                <div className="flex items-stretch gap-2">
                  <div className="relative min-w-0 flex-1">
                    <select
                      id="product-category"
                      name="category"
                      value={selectedCategory}
                      disabled={Boolean(existingProduct)}
                      onChange={(e) => setCategory(e.target.value)}
                      className="bg-surface-container-low text-on-surface focus-visible:ring-primary/30 h-11 w-full min-w-0 appearance-none rounded-xl border-none px-4 pr-10 text-sm font-medium outline-none focus-visible:ring-2 disabled:opacity-60"
                    >
                      {productCategories.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                    <ChevronDown
                      className="text-on-surface-variant pointer-events-none absolute top-1/2 right-3 size-5 -translate-y-1/2 stroke-[1.75]"
                      aria-hidden
                    />
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    disabled={Boolean(existingProduct)}
                    className="border-primary/20 text-primary bg-primary/5 hover:bg-primary/15 h-11 w-11 shrink-0 rounded-xl disabled:opacity-60"
                    aria-label={tr("Nouvelle catégorie", "فئة جديدة")}
                    onClick={() => setAddCategoryOpen(true)}
                  >
                    <Plus className="size-5 stroke-[1.75]" aria-hidden />
                  </Button>
                </div>
              </div>

              {brands.length > 0 ? (
                <div className="space-y-2">
                  <label
                    htmlFor="product-brand"
                    className="text-on-surface text-xs font-bold tracking-wide uppercase"
                  >
                    {tr("Marque", "العلامة")}
                  </label>
                  <div className="relative">
                    <select
                      id="product-brand"
                      name="brandId"
                      value={brandId}
                      disabled={Boolean(existingProduct)}
                      onChange={(e) => setBrandId(e.target.value)}
                      className="bg-surface-container-low text-on-surface focus-visible:ring-primary/30 h-11 w-full appearance-none rounded-xl border-none px-4 pr-10 text-sm font-medium outline-none focus-visible:ring-2 disabled:opacity-60"
                    >
                      <option value="">{tr("Aucune marque", "بدون علامة")}</option>
                      {brands.map((brand) => (
                        <option key={brand.id} value={brand.id}>
                          {brand.name}
                        </option>
                      ))}
                    </select>
                    <ChevronDown
                      className="text-on-surface-variant pointer-events-none absolute top-1/2 right-3 size-5 -translate-y-1/2 stroke-[1.75]"
                      aria-hidden
                    />
                  </div>
                </div>
              ) : null}

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <label
                    htmlFor="product-price"
                    className="text-on-surface text-xs font-bold tracking-wide uppercase"
                  >
                    {tr("Prix de vente", "سعر البيع")}
                  </label>
                  <MadPriceField
                    id="product-price"
                    name="priceMad"
                    value={priceMad}
                    onValueChange={setPriceMad}
                    required
                    disabled={Boolean(existingProduct)}
                  />
                </div>
                <div className="space-y-2">
                  <label
                    htmlFor="product-cost"
                    className="text-on-surface text-xs font-bold tracking-wide uppercase"
                  >
                    {tr("Prix d'achat", "سعر الشراء")}
                  </label>
                  <MadPriceField
                    id="product-cost"
                    name="costMad"
                    value={costMad}
                    onValueChange={setCostMad}
                    min={0}
                    disabled={Boolean(existingProduct)}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label
                  htmlFor="product-stock"
                  className="text-on-surface text-xs font-bold tracking-wide uppercase"
                >
                  {soldByWeight
                    ? tr("Stock initial (kg)", "المخزون الأولي (كغ)")
                    : tr("Stock initial", "المخزون الأولي")}
                </label>
                <QtyKeypadField
                  id="product-stock"
                  value={stock}
                  onValueChange={setStock}
                  min={0}
                  disabled={Boolean(existingProduct)}
                  keypadTitle={name.trim() || tr("Stock initial", "المخزون الأولي")}
                  wrapperClassName="max-w-xs"
                />
              </div>

              <SoldByWeightField
                value={soldByWeight}
                onChange={setSoldByWeight}
                disabled={Boolean(existingProduct)}
              />
            </div>

            <div className="border-sidebar-border bg-surface-container-low/60 rounded-xl border px-4 py-3">
              <p className="text-on-surface-variant text-xs font-medium uppercase">
                {tr("Aperçu ligne POS", "معاينة سطر نقطة البيع")}
              </p>
              <p className="text-on-surface mt-1 text-sm">{previewLine}</p>
            </div>

            <DialogFooter className="gap-2 sm:gap-0">
              <Button
                type="button"
                variant="outline"
                onClick={() => handleOpenChange(false)}
              >
                {tr("Annuler", "إلغاء")}
              </Button>
              <Button type="submit" disabled={!canSubmit} className="font-bold">
                {tr("Enregistrer le produit", "حفظ المنتج")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <BarcodeScanDialog
        open={scanOpen}
        onOpenChange={setScanOpen}
        onScan={(raw) => setBarcode(raw)}
      />

      <PosAddCategoryDialog
        open={addCategoryOpen}
        onOpenChange={setAddCategoryOpen}
        onCreate={handleCategoryCreated}
      />
    </>
  );
}
