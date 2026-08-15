"use client";

import { PauseCircle, RotateCcw, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { PosCartDraftView } from "@/lib/convex/pos-cart-draft";
import { formatPosDh } from "@/lib/pos/format-pos-dh";
import { cn } from "@/lib/utils";

type PosCartDraftsSectionProps = {
  drafts: PosCartDraftView[] | undefined;
  loading?: boolean;
  locale: string;
  tr: (fr: string, ar: string) => string;
  onParkDraft: () => void;
  onRestoreDraft: (draftId: PosCartDraftView["id"]) => void;
  onDeleteDraft: (draftId: PosCartDraftView["id"]) => void;
  parkDisabled?: boolean;
  busy?: boolean;
  /** Hides restore/delete and draft list — assist-only users. */
  canManageDrafts?: boolean;
  /** Hides the header row — parent renders park control inline. */
  listOnly?: boolean;
  className?: string;
};

export function PosCartDraftsSection({
  drafts,
  loading,
  locale,
  tr,
  onParkDraft,
  onRestoreDraft,
  onDeleteDraft,
  parkDisabled,
  busy,
  canManageDrafts = true,
  listOnly = false,
  className,
}: PosCartDraftsSectionProps) {
  const draftCount = drafts?.length ?? 0;

  if (listOnly && (!canManageDrafts || draftCount === 0)) {
    return null;
  }

  if (!listOnly && !canManageDrafts && draftCount === 0) {
    return (
      <div className={cn("border-sidebar-border shrink-0 border-b", className)}>
        <div className="flex items-center justify-between gap-2 px-3 py-2 sm:px-4">
          <div className="min-w-0">
            <p className="text-on-surface text-xs font-bold">
              {tr("Panier client", "سلة العميل")}
            </p>
            <p className="text-muted-foreground text-[10px]">
              {tr(
                "Composez le panier puis envoyez-le au caissier.",
                "أكمل السلة ثم أرسلها لأمين الصندوق.",
              )}
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="border-tertiary/35 bg-tertiary-fixed/35 text-tertiary hover:bg-tertiary-fixed/55 h-8 shrink-0 gap-1.5 rounded-lg px-2.5 text-xs font-bold"
            onClick={onParkDraft}
            disabled={parkDisabled || busy}
          >
            <PauseCircle className="size-3.5 stroke-[1.75]" aria-hidden />
            {tr("En attente caissier", "بانتظار الصندوق")}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "border-sidebar-border shrink-0",
        !listOnly && "border-b",
        className,
      )}
    >
      {!listOnly ? (
        <div className="flex items-center justify-between gap-2 px-3 py-2 sm:px-4">
          <div className="min-w-0">
            <p className="text-on-surface text-xs font-bold">
              {tr("Paniers en attente", "سلات معلّقة")}
            </p>
            <p className="text-muted-foreground text-[10px]">
              {loading
                ? tr("Chargement…", "جاري التحميل…")
                : draftCount > 0
                  ? tr(
                      "{count} brouillon(s)",
                      "{count} مسودة/مسودات",
                    ).replace("{count}", String(draftCount))
                  : tr("Aucun brouillon", "لا توجد مسودات")}
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="border-tertiary/35 bg-tertiary-fixed/35 text-tertiary hover:bg-tertiary-fixed/55 h-8 shrink-0 gap-1.5 rounded-lg px-2.5 text-xs font-bold"
            onClick={onParkDraft}
            disabled={parkDisabled || busy}
          >
            <PauseCircle className="size-3.5 stroke-[1.75]" aria-hidden />
            {tr("Mettre en attente", "تعليق")}
          </Button>
        </div>
      ) : null}

      {canManageDrafts && draftCount > 0 ? (
        <ul
          className={cn(
            "space-y-1 overflow-y-auto px-2 pb-1.5",
            listOnly ? "max-h-24" : "max-h-40 px-3 pb-3 sm:px-4",
          )}
        >
          {drafts!.map((draft) => {
            const assistWithClient =
              draft.parkedByAssist &&
              !!draft.createdByUserName &&
              !!(draft.clientId || draft.clientNameSnapshot);

            return (
            <li
              key={draft.id}
              className={cn(
                "flex items-center gap-2 rounded-lg border p-2",
                draft.parkedByAssist
                  ? "border-amber-200 bg-amber-50"
                  : "border-emerald-200 bg-emerald-50",
              )}
            >
              <div className="min-w-0 flex-1">
                <p className="text-on-surface truncate text-sm font-semibold">
                  {draft.label}
                </p>
                {assistWithClient ? (
                  <p className="truncate text-[10px] font-medium text-amber-900/75">
                    {draft.createdByUserName}
                  </p>
                ) : null}
                <p className="text-muted-foreground text-[10px] tabular-nums">
                  {draft.itemCount} {tr("art.", "صنف")} ·{" "}
                  {formatPosDh(draft.totalMad, 2, locale)}
                </p>
              </div>
              <Button
                type="button"
                size="sm"
                className="from-primary to-primary-container h-8 shrink-0 gap-1 rounded-lg bg-linear-to-br px-2 text-xs font-bold text-white shadow-sm"
                disabled={busy}
                onClick={() => onRestoreDraft(draft.id)}
              >
                <RotateCcw className="size-3.5 stroke-[1.75]" aria-hidden />
                {tr("Reprendre", "استئناف")}
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="text-muted-foreground hover:text-error size-8 shrink-0 rounded-lg"
                disabled={busy}
                onClick={() => onDeleteDraft(draft.id)}
                aria-label={tr("Supprimer le brouillon", "حذف المسودة")}
                title={tr("Supprimer", "حذف")}
              >
                <Trash2 className="size-3.5 stroke-[1.75]" aria-hidden />
              </Button>
            </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}
