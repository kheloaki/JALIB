"use client";

import { useState } from "react";
import { PauseCircle } from "lucide-react";

import type { PosDraftsRegistration } from "@/components/layout/admin-chrome-context";
import { PosCartDraftsDialog } from "@/components/pos/pos-cart-drafts-dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type PosHeaderPendingCartsProps = {
  drafts: PosDraftsRegistration;
  locale: string;
  className?: string;
};

export function PosHeaderPendingCarts({
  drafts,
  locale,
  className,
}: PosHeaderPendingCartsProps) {
  const isAr = locale === "ar";
  const tr = (fr: string, ar: string) => (isAr ? ar : fr);
  const [open, setOpen] = useState(false);
  const draftCount = drafts.drafts?.length ?? 0;

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="icon"
        onClick={() => setOpen(true)}
        className={cn(
          "border-primary/20 text-primary bg-primary/5 hover:bg-primary/15 relative size-10 shrink-0 rounded-xl",
          className,
        )}
        aria-label={tr("Paniers en attente", "سلات معلّقة")}
        title={tr("Paniers en attente", "سلات معلّقة")}
      >
        <PauseCircle className="size-5 stroke-[1.75]" aria-hidden />
        {draftCount > 0 ? (
          <span className="bg-primary text-primary-foreground absolute -top-1 -right-1 flex size-4 min-w-4 items-center justify-center rounded-full px-0.5 text-[9px] font-bold tabular-nums">
            {draftCount > 9 ? "9+" : draftCount}
          </span>
        ) : null}
      </Button>

      <PosCartDraftsDialog
        open={open}
        onOpenChange={setOpen}
        drafts={drafts.drafts}
        loading={drafts.draftsLoading}
        locale={locale}
        tr={tr}
        busy={drafts.draftsBusy}
        onRestoreDraft={drafts.onRestoreDraft}
        onDeleteDraft={drafts.onDeleteDraft}
      />
    </>
  );
}
