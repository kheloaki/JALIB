"use client";

import { useEffect, useState } from "react";

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
import { normalizeCategoryLabel } from "@/lib/pos/pos-categories";

type PosAddCategoryDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Return false if duplicate / invalid — dialog stays open. */
  onCreate: (name: string) => boolean;
};

export function PosAddCategoryDialog({
  open,
  onOpenChange,
  onCreate,
}: PosAddCategoryDialogProps) {
  const [label, setLabel] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setLabel("");
      setError(null);
    }
  }, [open]);

  const trimmed = normalizeCategoryLabel(label);
  const canSubmit = trimmed.length > 0;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setError(null);
    const ok = onCreate(trimmed);
    if (ok) {
      onOpenChange(false);
    } else {
      setError("Cette catégorie existe déjà ou est réservée.");
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton
        className="border-sidebar-border bg-surface-container-lowest text-on-surface z-[60] sm:max-w-sm"
      >
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle className="text-on-surface text-lg font-black">
              Nouvelle catégorie
            </DialogTitle>
            <DialogDescription className="text-on-surface-variant">
              Elle apparaîtra dans les onglets du point de vente et dans la liste
              des catégories des articles.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2 py-2">
            <label
              htmlFor="pos-new-category-name"
              className="text-on-surface text-xs font-bold tracking-wide uppercase"
            >
              Nom de la catégorie
            </label>
            <Input
              id="pos-new-category-name"
              value={label}
              onChange={(e) => {
                setLabel(e.target.value);
                setError(null);
              }}
              placeholder="Ex. Boulangerie"
              autoComplete="off"
              className="bg-surface-container-low border-transparent focus-visible:ring-primary/25 h-11 rounded-xl"
            />
            {error ? (
              <p className="text-error text-xs font-medium">{error}</p>
            ) : null}
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
              Créer la catégorie
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
