"use client";

import { useEffect, useState } from "react";
import { useMutation } from "convex/react";
import { ArrowLeft, PackagePlus, ShoppingCart } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";

import { MadPriceField } from "@/components/money/mad-price-field";
import { QtyKeypadField } from "@/components/money/qty-keypad-field";
import { ProductCatalogImage } from "@/components/products/product-catalog-image";
import type { Product } from "@/components/pos/types";
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
import { procurementApi } from "@/lib/convex/procurement-api";
import { clampMadPrice } from "@/lib/money/mad";
import { cn } from "@/lib/utils";

type Step = "choose" | "replenishment" | "procurement";

type StockProductAddDestinationDialogProps = {
  product: Product | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  canReplenishment: boolean;
  canProcurement: boolean;
};

export function StockProductAddDestinationDialog({
  product,
  open,
  onOpenChange,
  canReplenishment,
  canProcurement,
}: StockProductAddDestinationDialogProps) {
  const t = useTranslations("stock");
  const tProc = useTranslations("procurement");
  const locale = useLocale();
  const toast = useToast();
  const addStock = useMutation(api.products.addStock);
  const addProcurementItem = useMutation(procurementApi.addItem);

  const [step, setStep] = useState<Step>("choose");
  const [quantity, setQuantity] = useState(1);
  const [costMad, setCostMad] = useState(0);
  const [sellPriceMad, setSellPriceMad] = useState(0);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open || !product) return;
    setStep("choose");
    setQuantity(1);
    setCostMad(product.costMad && product.costMad > 0 ? product.costMad : 0);
    setSellPriceMad(product.price);
  }, [open, product]);

  function handleOpenChange(next: boolean) {
    if (!next) setStep("choose");
    onOpenChange(next);
  }

  async function handleSaveReplenishment() {
    if (!product) return;
    const qty = Math.floor(quantity);
    if (qty < 1) {
      toast.error(t("invalidQtyTitle"), t("invalidQtyDescription"));
      return;
    }
    if (costMad <= 0) {
      toast.error(t("invalidPriceTitle"), t("invalidPriceDescription"));
      return;
    }
    if (sellPriceMad <= 0) {
      toast.error(t("invalidSellPriceTitle"), t("invalidSellPriceDescription"));
      return;
    }

    setSaving(true);
    try {
      await addStock({
        productId: product.id as Id<"products">,
        quantity: qty,
        costMad: clampMadPrice(costMad),
        sellPriceMad: clampMadPrice(sellPriceMad),
      });
      toast.success(t("replenishmentSuccessTitle"), product.name);
      handleOpenChange(false);
    } catch (error) {
      toast.error(
        t("replenishmentErrorTitle"),
        error instanceof Error ? error.message : t("errorGeneric"),
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveProcurement() {
    if (!product) return;
    const qty = Math.floor(quantity);
    if (qty < 1) {
      toast.error(t("invalidQtyTitle"), t("invalidQtyDescription"));
      return;
    }

    setSaving(true);
    try {
      await addProcurementItem({
        productId: product.id as Id<"products">,
        quantity: qty,
      });
      toast.success(
        tProc("itemAddedTitle"),
        tProc("itemAddedDescription"),
      );
      handleOpenChange(false);
    } catch (error) {
      toast.error(
        tProc("errorTitle"),
        error instanceof Error ? error.message : tProc("errorGeneric"),
      );
    } finally {
      setSaving(false);
    }
  }

  const stepTitle =
    step === "replenishment"
      ? t("tabReplenishment")
      : step === "procurement"
        ? t("tabProcurement")
        : t("addDestinationTitle");

  const stepDescription =
    step === "replenishment"
      ? t("addDestinationReplenishmentFormHint")
      : step === "procurement"
        ? t("addDestinationProcurementFormHint")
        : t("addDestinationDescription");

  const productName = product?.name ?? "";

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-lg rounded-2xl">
        <DialogHeader>
          <DialogTitle>{stepTitle}</DialogTitle>
          <DialogDescription>{stepDescription}</DialogDescription>
        </DialogHeader>

        {product ? (
          <div className="flex items-center gap-3 rounded-xl border px-3 py-2.5">
            <div className="relative size-14 shrink-0 overflow-hidden rounded-lg">
              <ProductCatalogImage
                src={product.image}
                alt={product.imageAlt}
                sizes="56px"
              />
            </div>
            <div className="min-w-0">
              <p className="text-primary text-xs font-semibold">{product.category}</p>
              <p className="text-on-background truncate font-bold">{product.name}</p>
            </div>
          </div>
        ) : null}

        {step === "choose" ? (
          <div className="grid gap-3 sm:grid-cols-2">
            {canReplenishment ? (
              <button
                type="button"
                disabled={!product}
                onClick={() => setStep("replenishment")}
                className={cn(
                  "border-secondary/35 bg-secondary-container/30 hover:border-secondary/60 hover:bg-secondary-container/50",
                  "flex min-h-[8.5rem] flex-col items-center justify-center gap-2 rounded-2xl border-2 px-4 py-5 text-center transition-all active:scale-[0.99]",
                )}
              >
                <span className="bg-secondary text-on-secondary flex size-12 items-center justify-center rounded-xl shadow-sm">
                  <PackagePlus className="size-6 stroke-[1.75]" aria-hidden />
                </span>
                <span className="text-on-background text-base font-black">
                  {t("tabReplenishment")}
                </span>
                <span className="text-on-surface-variant text-xs leading-snug">
                  {t("addDestinationReplenishmentHint")}
                </span>
              </button>
            ) : null}

            {canProcurement ? (
              <button
                type="button"
                disabled={!product}
                onClick={() => setStep("procurement")}
                className={cn(
                  "border-primary/35 bg-primary/5 hover:border-primary/55 hover:bg-primary/10",
                  "flex min-h-[8.5rem] flex-col items-center justify-center gap-2 rounded-2xl border-2 px-4 py-5 text-center transition-all active:scale-[0.99]",
                  !canReplenishment && "sm:col-span-2",
                )}
              >
                <span className="bg-primary text-on-primary flex size-12 items-center justify-center rounded-xl shadow-sm">
                  <ShoppingCart className="size-6 stroke-[1.75]" aria-hidden />
                </span>
                <span className="text-on-background text-base font-black">
                  {t("tabProcurement")}
                </span>
                <span className="text-on-surface-variant text-xs leading-snug">
                  {t("addDestinationProcurementHint")}
                </span>
              </button>
            ) : null}

            {!canReplenishment && !canProcurement ? (
              <p className="text-on-surface-variant col-span-full text-center text-sm">
                {t("addDestinationNoPermission")}
              </p>
            ) : null}
          </div>
        ) : (
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-on-surface text-xs font-bold tracking-wide uppercase">
                {t("replenishmentQtyCol")}
              </label>
              <QtyKeypadField
                value={quantity}
                onValueChange={setQuantity}
                min={1}
                keypadTitle={productName}
                wrapperClassName="max-w-full"
              />
            </div>

            {step === "replenishment" ? (
              <>
                <div className="space-y-2">
                  <label className="text-on-surface text-xs font-bold tracking-wide uppercase">
                    {t("replenishmentCostCol")}
                  </label>
                  <MadPriceField
                    value={costMad}
                    onValueChange={setCostMad}
                    min={0.01}
                    keypadTitle={productName}
                    labelFr="Prix achat"
                    labelAr="سعر الشراء"
                    wrapperClassName="max-w-full"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-on-surface text-xs font-bold tracking-wide uppercase">
                    {t("sellPrice")}
                  </label>
                  <MadPriceField
                    value={sellPriceMad}
                    onValueChange={setSellPriceMad}
                    min={0.01}
                    keypadTitle={productName}
                    labelFr="Prix vente"
                    labelAr="سعر البيع"
                    wrapperClassName="max-w-full"
                  />
                </div>
              </>
            ) : null}
          </div>
        )}

        {step !== "choose" ? (
          <DialogFooter className="gap-2 sm:justify-between">
            <Button
              type="button"
              variant="ghost"
              className="gap-1.5"
              onClick={() => setStep("choose")}
              disabled={saving}
            >
              <ArrowLeft className="size-4" aria-hidden />
              {t("addDestinationBack")}
            </Button>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => handleOpenChange(false)}
                disabled={saving}
              >
                {t("cancel")}
              </Button>
              <Button
                type="button"
                onClick={() =>
                  void (step === "replenishment"
                    ? handleSaveReplenishment()
                    : handleSaveProcurement())
                }
                disabled={!product || saving}
              >
                {saving ? t("saving") : t("save")}
              </Button>
            </div>
          </DialogFooter>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
