"use client";

import { RotateCcw, Trash2 } from "lucide-react";

import { PosCartDraftHoverContent } from "@/components/pos/pos-cart-draft-hover-content";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { PosCartDraftView } from "@/lib/convex/pos-cart-draft";
import { formatPosDh } from "@/lib/pos/format-pos-dh";
import { cn } from "@/lib/utils";

type PosCartDraftsDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  drafts: PosCartDraftView[] | undefined;
  loading?: boolean;
  locale: string;
  tr: (fr: string, ar: string) => string;
  onRestoreDraft: (draftId: PosCartDraftView["id"]) => void;
  onDeleteDraft: (draftId: PosCartDraftView["id"]) => void;
  busy?: boolean;
};

export function PosCartDraftsDialog({
  open,
  onOpenChange,
  drafts,
  loading,
  locale,
  tr,
  onRestoreDraft,
  onDeleteDraft,
  busy,
}: PosCartDraftsDialogProps) {
  const draftCount = drafts?.length ?? 0;

  function handleRestore(draftId: PosCartDraftView["id"]) {
    onRestoreDraft(draftId);
    onOpenChange(false);
  }

  function handleDelete(draftId: PosCartDraftView["id"]) {
    onDeleteDraft(draftId);
    if (draftCount <= 1) onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[min(90vh,40rem)] gap-0 overflow-hidden p-0 sm:max-w-md">
        <DialogHeader className="border-border border-b px-4 py-3 text-left">
          <DialogTitle className="text-base">
            {tr("Paniers en attente", "سلات معلّقة")}
          </DialogTitle>
          <DialogDescription className="text-xs">
            {loading
              ? tr("Chargement…", "جاري التحميل…")
              : draftCount > 0
                ? tr(
                    "{count} brouillon(s)",
                    "{count} مسودة/مسودات",
                  ).replace("{count}", String(draftCount))
                : tr("Aucun brouillon", "لا توجد مسودات")}
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[min(70vh,28rem)] overflow-y-auto px-3 py-3">
          {loading ? (
            <p className="text-muted-foreground py-8 text-center text-sm">
              {tr("Chargement…", "جاري التحميل…")}
            </p>
          ) : draftCount === 0 ? (
            <p className="text-muted-foreground py-8 text-center text-sm">
              {tr("Aucun panier en attente.", "لا توجد سلات معلّقة.")}
            </p>
          ) : (
            <ul className="space-y-3">
              {drafts!.map((draft) => {
                const assistWithClient =
                  draft.parkedByAssist &&
                  !!draft.createdByUserName &&
                  !!(draft.clientId || draft.clientNameSnapshot);

                return (
                  <li
                    key={draft.id}
                    className={cn(
                      "overflow-hidden rounded-xl border",
                      draft.parkedByAssist
                        ? "border-amber-200 bg-amber-50/80"
                        : "border-emerald-200 bg-emerald-50/80",
                    )}
                  >
                    <div className="flex items-start gap-2 p-3 pb-0">
                      <div className="min-w-0 flex-1">
                        <p className="text-on-surface text-sm font-bold leading-snug">
                          {draft.label}
                        </p>
                        {assistWithClient ? (
                          <p className="truncate text-[11px] font-medium text-amber-900/75">
                            {draft.createdByUserName}
                          </p>
                        ) : null}
                        <p className="text-muted-foreground text-[11px] tabular-nums">
                          {draft.itemCount} {tr("art.", "صنف")} ·{" "}
                          {formatPosDh(draft.totalMad, 2, locale)}
                        </p>
                      </div>
                    </div>

                    <div className="px-1 pb-1">
                      <PosCartDraftHoverContent
                        draft={draft}
                        locale={locale}
                        tr={tr}
                        hideHeader
                      />
                    </div>

                    <div className="flex gap-2 border-t border-black/5 px-3 py-2.5">
                      <Button
                        type="button"
                        variant="outline"
                        className="text-error hover:text-error h-9 flex-1 gap-1.5 text-xs font-bold"
                        disabled={busy}
                        onClick={() => handleDelete(draft.id)}
                      >
                        <Trash2 className="size-3.5 stroke-[1.75]" aria-hidden />
                        {tr("Supprimer", "حذف")}
                      </Button>
                      <Button
                        type="button"
                        className="from-primary to-primary-container h-9 flex-1 gap-1.5 bg-linear-to-br text-xs font-bold text-white"
                        disabled={busy}
                        onClick={() => handleRestore(draft.id)}
                      >
                        <RotateCcw className="size-3.5 stroke-[1.75]" aria-hidden />
                        {tr("Reprendre", "استئناف")}
                      </Button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
