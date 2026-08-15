"use client";

import { useState } from "react";
import { useMutation } from "convex/react";

import type { Product } from "@/components/pos/types";
import { MadPriceField } from "@/components/money/mad-price-field";
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
import { clampMadPrice, formatMadCompact } from "@/lib/money/mad";

type SellPriceDialogProps = {
  product: Product | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onPricingUpdated: () => void;
};

export function SellPriceDialog({
  product,
  open,
  onOpenChange,
  onPricingUpdated,
}: SellPriceDialogProps) {
  const toast = useToast();
  const updateSellPrice = useMutation(api.products.updateSellPrice);
  const [priceMad, setPriceMad] = useState(() =>
    product && product.price > 0 ? product.price : 0,
  );

  async function handleSave() {
    if (!product) return;
    const next = clampMadPrice(priceMad);
    if (next <= 0) {
      toast.error("Prix invalide", "Indiquez un prix de vente supérieur à 0.");
      return;
    }
    if (Math.abs(next - product.price) < 0.005) {
      toast.error("Aucun changement", "Modifiez le montant avant d’enregistrer.");
      return;
    }

    try {
      await updateSellPrice({
        productId: product.id as Id<"products">,
        priceMad: next,
      });
    } catch (error) {
      toast.error(
        "Sauvegarde impossible",
        error instanceof Error ? error.message : "Réessayez dans un instant.",
      );
      return;
    }

    toast.success("Prix de vente mis à jour", product.name);
    onPricingUpdated();
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="border-sidebar-border bg-surface-container-lowest text-on-surface max-w-md">
        <DialogHeader>
          <DialogTitle className="text-on-surface text-xl font-black">
            Prix de vente
          </DialogTitle>
          <DialogDescription>
            Mettre à jour le prix affiché à la caisse et sur cette page.
          </DialogDescription>
          {product ? (
            <p className="text-on-surface pt-1 text-sm font-semibold">
              {product.name}
              <span className="text-on-surface-variant mt-1 block text-xs font-normal">
                Prix actuel :{" "}
                <span className="text-primary font-bold">
                  {formatMadCompact(product.price)}
                </span>
              </span>
            </p>
          ) : null}
        </DialogHeader>

        <div className="space-y-2">
          <label
            htmlFor="stock-sell-price"
            className="text-on-surface text-xs font-bold tracking-wide uppercase"
          >
            Nouveau prix (MAD)
          </label>
          <MadPriceField
            id="stock-sell-price"
            value={priceMad}
            onValueChange={setPriceMad}
            min={0.01}
            wrapperClassName="max-w-full"
          />
          <p className="text-on-surface-variant text-xs">
            Le prix est enregistré dans le catalogue partagé.
          </p>
        </div>

        <DialogFooter className="gap-2 sm:gap-2">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Annuler
          </Button>
          <Button
            type="button"
            onClick={handleSave}
            disabled={!product}
            className="from-primary to-primary-container bg-linear-to-br font-bold"
          >
            Enregistrer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
