"use client";

import { useEffect, useState } from "react";
import { useMutation } from "convex/react";
import { useTranslations } from "next-intl";

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
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toaster";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { clampMadPrice } from "@/lib/money/mad";

type AddStockDialogProps = {
  product: Product | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function AddStockDialog({
  product,
  open,
  onOpenChange,
}: AddStockDialogProps) {
  const t = useTranslations("stock");
  const toast = useToast();
  const addStock = useMutation(api.products.addStock);
  const [quantity, setQuantity] = useState(1);
  const [costMad, setCostMad] = useState(0);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setQuantity(1);
    setCostMad(product?.costMad && product.costMad > 0 ? product.costMad : 0);
  }, [open, product]);

  async function handleSave() {
    if (!product) return;
    const qty = Math.floor(quantity);
    if (qty < 1) {
      toast.error(t("invalidQtyTitle"), t("invalidQtyDescription"));
      return;
    }

    setSaving(true);
    try {
      await addStock({
        productId: product.id as Id<"products">,
        quantity: qty,
        ...(costMad > 0 ? { costMad: clampMadPrice(costMad) } : {}),
      });
      toast.success(t("addStockSuccessTitle"), product.name);
      onOpenChange(false);
    } catch (error) {
      toast.error(
        t("addStockErrorTitle"),
        error instanceof Error ? error.message : t("errorGeneric"),
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md rounded-2xl">
        <DialogHeader>
          <DialogTitle>{t("addStock")}</DialogTitle>
          <DialogDescription>{t("addStockDescription")}</DialogDescription>
          {product ? (
            <p className="text-on-surface pt-1 text-sm font-semibold">
              {product.name}
              <span className="text-on-surface-variant mt-1 block text-xs font-normal">
                {t("currentStock")}:{" "}
                <span className="text-on-surface font-bold tabular-nums">
                  {Math.max(0, product.stockQty)}
                </span>
              </span>
            </p>
          ) : null}
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <label
              htmlFor="add-stock-qty"
              className="text-on-surface text-xs font-bold tracking-wide uppercase"
            >
              {t("addStockQtyLabel")}
            </label>
            <QtyKeypadField
              id="add-stock-qty"
              value={quantity}
              onValueChange={setQuantity}
              min={1}
              keypadTitle={product?.name ?? ""}
              wrapperClassName="max-w-full"
            />
          </div>
          <div className="space-y-2">
            <label
              htmlFor="add-stock-cost"
              className="text-on-surface text-xs font-bold tracking-wide uppercase"
            >
              {t("addStockCostLabel")}
            </label>
            <MadPriceField
              id="add-stock-cost"
              value={costMad}
              onValueChange={setCostMad}
              min={0}
              wrapperClassName="max-w-full"
            />
            <p className="text-on-surface-variant text-xs">{t("addStockCostHint")}</p>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            {t("cancel")}
          </Button>
          <Button type="button" onClick={() => void handleSave()} disabled={!product || saving}>
            {saving ? t("saving") : t("addStockConfirm")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
