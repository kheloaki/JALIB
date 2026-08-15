"use client";

import { useState } from "react";
import { ChevronDown, Plus } from "lucide-react";

import { MadPriceField } from "@/components/money/mad-price-field";
import { PosAddCategoryDialog } from "@/components/pos/pos-add-category-dialog";
import { POS_CUSTOM_PRODUCT_PLACEHOLDER_IMAGE } from "@/components/pos/constants";
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
import { Input } from "@/components/ui/input";
import { clampMadPrice } from "@/lib/money/mad";
import { isBarcodeTaken, normalizeBarcodeInput } from "@/lib/pos/catalog-lookup";

type PosQuickAddProductDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Built-in + catégories personnalisées (même ordre que les onglets hors « Tout »). */
  shelfCategories: string[];
  /** Catalogue actuel (doublons code-barres). */
  catalogProducts: Product[];
  /** Ajoute une catégorie persistante ; retourne false si doublon. */
  onTryAddCategory: (name: string) => boolean;
  /** Ajoute l’article au catalogue (grille) — pas au panier. */
  onAddProduct: (product: Product) => boolean | Promise<boolean>;
};

export function PosQuickAddProductDialog({
  open,
  onOpenChange,
  shelfCategories,
  catalogProducts,
  onTryAddCategory,
  onAddProduct,
}: PosQuickAddProductDialogProps) {
  const [name, setName] = useState("");
  const [category, setCategory] = useState(() => shelfCategories[0] ?? "");
  const [priceMad, setPriceMad] = useState(0);
  const [costMad, setCostMad] = useState(0);
  const [barcode, setBarcode] = useState("");
  const [barcodeError, setBarcodeError] = useState<string | null>(null);
  const [addCategoryOpen, setAddCategoryOpen] = useState(false);
  const selectedCategory =
    category && shelfCategories.includes(category)
      ? category
      : shelfCategories[0] ?? "";

  const canSubmit =
    name.trim().length > 0 &&
    priceMad > 0 &&
    selectedCategory.length > 0 &&
    !barcodeError;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    const price = clampMadPrice(priceMad);
    const cost = clampMadPrice(costMad);
    if (price <= 0) return;

    const normalized = normalizeBarcodeInput(barcode);
    if (normalized && isBarcodeTaken(catalogProducts, normalized)) {
      setBarcodeError("Ce code-barres est déjà utilisé.");
      return;
    }
    setBarcodeError(null);

    const product: Product = {
      id: `pos-extra:${crypto.randomUUID()}`,
      category: selectedCategory,
      name: name.trim(),
      price,
      stockQty: 0,
      stockLabel: "STOCK: —",
      stockLow: false,
      image: POS_CUSTOM_PRODUCT_PLACEHOLDER_IMAGE,
      imageAlt: name.trim(),
      ...(cost > 0 ? { costMad: cost } : {}),
      ...(normalized ? { barcode: normalized } : {}),
    };
    const saved = await onAddProduct(product);
    if (saved) onOpenChange(false);
  }

  function handleCategoryCreated(label: string): boolean {
    const ok = onTryAddCategory(label);
    if (ok) setCategory(label);
    return ok;
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent
          showCloseButton
          className="border-sidebar-border bg-surface-container-lowest text-on-surface sm:max-w-md"
        >
          <form onSubmit={handleSubmit}>
            <DialogHeader>
              <DialogTitle className="text-on-surface text-xl font-black">
                Nouvel article
              </DialogTitle>
              <DialogDescription className="text-on-surface-variant">
                L&apos;article apparaît dans la grille des produits ; ajoutez-le
                au panier depuis la carte comme les autres références.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <label
                  htmlFor="pos-quick-add-name"
                  className="text-on-surface text-xs font-bold tracking-wide uppercase"
                >
                  Nom de l&apos;article
                </label>
                <Input
                  id="pos-quick-add-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ex. Sac en papier kraft"
                  autoComplete="off"
                  className="bg-surface-container-low border-transparent focus-visible:ring-primary/25 h-11 rounded-xl"
                />
              </div>

              <div className="space-y-2">
                <label
                  htmlFor="pos-quick-add-barcode"
                  className="text-on-surface text-xs font-bold tracking-wide uppercase"
                >
                  Code-barres{" "}
                  <span className="text-on-surface-variant font-normal normal-case">
                    (optionnel)
                  </span>
                </label>
                <Input
                  id="pos-quick-add-barcode"
                  value={barcode}
                  onChange={(e) => {
                    setBarcode(e.target.value);
                    setBarcodeError(null);
                  }}
                  placeholder="Scan USB ou EAN…"
                  autoComplete="off"
                  inputMode="numeric"
                  className="bg-surface-container-low border-transparent focus-visible:ring-primary/25 h-11 rounded-xl font-mono tabular-nums"
                />
                {barcodeError ? (
                  <p className="text-error text-xs font-medium">{barcodeError}</p>
                ) : null}
              </div>

              <div className="space-y-2">
                <label
                  htmlFor="pos-quick-add-category"
                  className="text-on-surface text-xs font-bold tracking-wide uppercase"
                >
                  Catégorie
                </label>
                <div className="flex items-stretch gap-2">
                  <div className="relative min-w-0 flex-1">
                    <select
                      id="pos-quick-add-category"
                      value={selectedCategory}
                      onChange={(e) => setCategory(e.target.value)}
                      className="bg-surface-container-low text-on-surface focus-visible:ring-primary/30 h-11 w-full min-w-0 appearance-none rounded-xl border-none px-4 pr-10 text-sm font-medium outline-none focus-visible:ring-2"
                    >
                      {shelfCategories.map((c) => (
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
                    className="border-primary/20 text-primary bg-primary/5 hover:bg-primary/15 h-11 w-11 shrink-0 rounded-xl"
                    aria-label="Nouvelle catégorie"
                    onClick={() => setAddCategoryOpen(true)}
                  >
                    <Plus className="size-5 stroke-[1.75]" aria-hidden />
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                <label
                  htmlFor="pos-quick-add-price"
                  className="text-on-surface text-xs font-bold tracking-wide uppercase"
                >
                  Prix de vente
                </label>
                <MadPriceField
                  id="pos-quick-add-price"
                  value={priceMad}
                  onValueChange={setPriceMad}
                  min={0.01}
                  wrapperClassName="max-w-full"
                />
              </div>

              <div className="space-y-2">
                <label
                  htmlFor="pos-quick-add-cost"
                  className="text-on-surface text-xs font-bold tracking-wide uppercase"
                >
                  Prix d&apos;achat{" "}
                  <span className="text-on-surface-variant font-normal normal-case">
                    (optionnel)
                  </span>
                </label>
                <MadPriceField
                  id="pos-quick-add-cost"
                  value={costMad}
                  onValueChange={setCostMad}
                  min={0}
                  wrapperClassName="max-w-full"
                />
              </div>
            </div>

            <DialogFooter className="gap-2 sm:gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                Annuler
              </Button>
              <Button
                type="submit"
                disabled={!canSubmit}
                className="from-primary to-primary-container bg-linear-to-br font-bold"
              >
                Ajouter au catalogue
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <PosAddCategoryDialog
        open={addCategoryOpen}
        onOpenChange={setAddCategoryOpen}
        onCreate={handleCategoryCreated}
      />
    </>
  );
}
