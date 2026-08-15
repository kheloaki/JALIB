"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";

import type { Product } from "@/components/pos/types";
import { MadPriceField } from "@/components/money/mad-price-field";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/components/ui/toaster";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { formatDateTimeMediumFr } from "@/lib/dates/format-date";
import { clampMadPrice, formatMadCompact } from "@/lib/money/mad";

type PurchasePriceHistoryDialogProps = {
  product: Product | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onPricingUpdated: () => void;
};

export function PurchasePriceHistoryDialog({
  product,
  open,
  onOpenChange,
  onPricingUpdated,
}: PurchasePriceHistoryDialogProps) {
  const toast = useToast();
  const updateCost = useMutation(api.products.updateCost);
  const historyRows = useQuery(
    api.products.listPurchaseHistory,
    open && product
      ? { productId: product.id as Id<"products"> }
      : "skip",
  );
  const entries = historyRows ?? [];
  const [newCostMad, setNewCostMad] = useState(() =>
    product?.costMad && product.costMad > 0 ? product.costMad : 0,
  );

  const currentLabel = useMemo(() => {
    if (!product) return "—";
    const c = product.costMad;
    if (c && c > 0) return formatMadCompact(c);
    return "—";
  }, [product]);

  async function handleSaveNewCost() {
    if (!product) return;
    const next = clampMadPrice(newCostMad);
    if (next <= 0) {
      toast.error("Prix invalide", "Indiquez un prix d’achat supérieur à 0.");
      return;
    }
    const prev =
      product.costMad && product.costMad > 0 ? product.costMad : 0;
    if (Math.abs(next - prev) < 0.005) {
      toast.error("Aucun changement", "Modifiez le montant avant d’enregistrer.");
      return;
    }

    try {
      await updateCost({
        productId: product.id as Id<"products">,
        costMad: next,
      });
    } catch (error) {
      toast.error(
        "Sauvegarde impossible",
        error instanceof Error ? error.message : "Réessayez dans un instant.",
      );
      return;
    }

    toast.success("Prix d’achat mis à jour", product.name);
    onPricingUpdated();
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="border-sidebar-border bg-surface-container-lowest text-on-surface max-h-[min(90vh,560px)] max-w-md overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-on-surface text-lg font-black">
            Prix d&apos;achat
          </DialogTitle>
          {product ? (
            <div className="text-on-surface flex items-center justify-between gap-3 text-sm">
              <p className="min-w-0 truncate font-semibold">{product.name}</p>
              <span className="bg-tertiary-fixed-dim/35 text-tertiary shrink-0 rounded-full px-2.5 py-1 text-xs font-black tabular-nums">
                PA {currentLabel}
              </span>
            </div>
          ) : null}
        </DialogHeader>

        <div className="space-y-3">
          <div>
            <p className="text-on-surface-variant mb-2 text-[11px] font-bold tracking-wide uppercase">
              Historique
            </p>
            {entries.length === 0 ? (
              <p className="text-on-surface-variant bg-surface-container-low rounded-lg px-3 py-2 text-sm">
                Aucun historique.
              </p>
            ) : (
              <ul className="border-outline-variant/40 max-h-40 divide-y overflow-y-auto rounded-lg border">
                {entries.map((e, i) => (
                  <li
                    key={`${e.at}-${e.costMad}-${i}`}
                    className="flex items-center justify-between gap-3 px-3 py-2.5 text-sm"
                  >
                    <span className="text-on-surface-variant shrink-0 tabular-nums">
                      {formatDateTimeMediumFr(e.at)}
                    </span>
                    <span className="text-on-surface font-bold tabular-nums">
                      {formatMadCompact(e.costMad)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="border-outline-variant/40 space-y-2 rounded-xl border p-3">
            <p className="text-on-surface text-[11px] font-bold tracking-wide uppercase">
              Nouveau PA
            </p>
            <MadPriceField
              id="stock-new-purchase-price"
              value={newCostMad}
              onValueChange={setNewCostMad}
              min={0.01}
              wrapperClassName="max-w-full"
            />
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-2">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Fermer
          </Button>
          <Button
            type="button"
            onClick={handleSaveNewCost}
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
