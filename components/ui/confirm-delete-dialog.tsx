"use client";

import { useEffect, useState } from "react";
import { AlertTriangle } from "lucide-react";

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
import { cn } from "@/lib/utils";

export type ConfirmDeleteDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Entity display name shown in the warning. */
  entityName: string;
  /** Exact text the user must type to enable confirm (e.g. product/client name). */
  confirmText: string;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  typePrompt?: string;
  busy?: boolean;
  onConfirm: () => void | Promise<void>;
};

/**
 * Strict destructive confirm: primary action stays disabled until the user
 * types the confirmation phrase exactly (case-sensitive trim).
 */
export function ConfirmDeleteDialog({
  open,
  onOpenChange,
  entityName,
  confirmText,
  title,
  description,
  confirmLabel = "Supprimer définitivement",
  cancelLabel = "Annuler",
  typePrompt,
  busy = false,
  onConfirm,
}: ConfirmDeleteDialogProps) {
  const [typed, setTyped] = useState("");
  const expected = confirmText.trim();
  const matches = typed.trim() === expected && expected.length > 0;

  useEffect(() => {
    if (!open) setTyped("");
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md" showCloseButton={!busy}>
        <DialogHeader>
          <div className="bg-error-container text-on-error-container mb-3 flex size-11 items-center justify-center rounded-xl">
            <AlertTriangle className="size-5 stroke-[1.75]" aria-hidden />
          </div>
          <DialogTitle className="text-left text-lg font-black tracking-tight">
            {title}
          </DialogTitle>
          <DialogDescription className="text-left text-sm leading-relaxed">
            {description}
          </DialogDescription>
        </DialogHeader>

        <div className="bg-error-container/40 text-on-error-container rounded-xl px-3 py-2.5 text-sm font-semibold">
          {entityName}
        </div>

        <div className="space-y-2">
          <label
            htmlFor="confirm-delete-input"
            className="text-on-surface text-xs font-bold tracking-wide uppercase"
          >
            {typePrompt ??
              `Tapez « ${expected} » pour confirmer`}
          </label>
          <Input
            id="confirm-delete-input"
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            autoComplete="off"
            autoFocus
            disabled={busy}
            className={cn(
              "h-11 rounded-xl font-medium",
              typed.length > 0 && !matches && "border-error/50",
            )}
            placeholder={expected}
          />
        </div>

        <DialogFooter className="gap-2 pt-1">
          <Button
            type="button"
            variant="outline"
            className="rounded-xl font-bold"
            disabled={busy}
            onClick={() => onOpenChange(false)}
          >
            {cancelLabel}
          </Button>
          <Button
            type="button"
            variant="destructive"
            className="rounded-xl font-bold"
            disabled={!matches || busy}
            onClick={() => void onConfirm()}
          >
            {busy ? "…" : confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
