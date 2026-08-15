"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, RotateCcw, Trash2 } from "lucide-react";

import { PosCartDraftHoverContent } from "@/components/pos/pos-cart-draft-hover-content";
import { Button } from "@/components/ui/button";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import type { PosCartDraftView } from "@/lib/convex/pos-cart-draft";
import { formatPosDh } from "@/lib/pos/format-pos-dh";
import { cn } from "@/lib/utils";

type PosCartDraftsBannerProps = {
  drafts: PosCartDraftView[] | undefined;
  loading?: boolean;
  locale: string;
  tr: (fr: string, ar: string) => string;
  onRestoreDraft: (draftId: PosCartDraftView["id"]) => void;
  onDeleteDraft: (draftId: PosCartDraftView["id"]) => void;
  busy?: boolean;
  className?: string;
};

export function PosCartDraftsBanner({
  drafts,
  loading,
  locale,
  tr,
  onRestoreDraft,
  onDeleteDraft,
  busy,
  className,
}: PosCartDraftsBannerProps) {
  const draftCount = drafts?.length ?? 0;
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const updateScrollState = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 1);
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 1);
  }, []);

  useEffect(() => {
    updateScrollState();
    const el = scrollRef.current;
    if (!el) return;
    el.addEventListener("scroll", updateScrollState, { passive: true });
    const observer = new ResizeObserver(updateScrollState);
    observer.observe(el);
    return () => {
      el.removeEventListener("scroll", updateScrollState);
      observer.disconnect();
    };
  }, [draftCount, loading, updateScrollState]);

  const scrollDrafts = useCallback((direction: -1 | 1) => {
    scrollRef.current?.scrollBy({
      left: direction * 200,
      behavior: "smooth",
    });
  }, []);

  if (!loading && draftCount === 0) {
    return null;
  }

  const showScrollArrows = !loading && draftCount > 0;

  const scrollArrowClass = (active: boolean) =>
    cn(
      "size-8 shrink-0 rounded-full border-0 transition-all",
      active
        ? "bg-primary text-primary-foreground shadow-[0_2px_8px_rgba(37,99,235,0.28)] hover:bg-primary/90"
        : "text-muted-foreground/35 hover:bg-transparent disabled:opacity-100",
    );

  return (
    <div
      className={cn(
        "border-[var(--border)] bg-white flex shrink-0 items-center gap-1.5 border-b px-2 py-2 shadow-[0_2px_12px_rgba(61,43,31,0.05)] sm:gap-2 sm:px-3",
        className,
      )}
    >
      {showScrollArrows ? (
        <Button
          type="button"
          size="icon"
          variant="ghost"
          className={scrollArrowClass(canScrollLeft)}
          disabled={!canScrollLeft}
          onClick={() => scrollDrafts(-1)}
          aria-label={tr("Défiler vers la gauche", "التمرير لليسار")}
          title={tr("Précédent", "السابق")}
        >
          <ChevronLeft
            className={cn(
              "size-4 stroke-[2]",
              canScrollLeft ? "text-primary-foreground" : "text-current",
            )}
            aria-hidden
          />
        </Button>
      ) : null}

      <div
        ref={scrollRef}
        className="flex min-w-0 flex-1 gap-2 overflow-x-auto overscroll-x-contain py-0.5 [scrollbar-gutter:stable] [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        aria-label={tr("Paniers en attente", "سلات معلّقة")}
      >
        {loading ? (
          <div className="text-muted-foreground flex h-12 min-w-[7.5rem] shrink-0 items-center justify-center rounded-md border border-dashed px-3 text-xs">
            {tr("Chargement…", "جاري التحميل…")}
          </div>
        ) : (
          drafts!.map((draft) => {
            const assistWithClient =
              draft.parkedByAssist &&
              !!draft.createdByUserName &&
              !!(draft.clientId || draft.clientNameSnapshot);

            return (
              <article
                key={draft.id}
                className={cn(
                  "flex h-12 max-w-[13.5rem] min-w-[10.5rem] shrink-0 items-center gap-1 rounded-2xl border py-0.5 pr-1 pl-2.5",
                  draft.parkedByAssist
                    ? "border-amber-200/80 bg-amber-50"
                    : "border-[var(--border)] bg-[var(--shell-main-muted)]",
                )}
              >
                <HoverCard>
                  <HoverCardTrigger
                    delay={250}
                    closeDelay={120}
                    render={
                      <button
                        type="button"
                        className="hover:bg-black/3 min-w-0 flex-1 rounded-sm px-0.5 py-1 text-left transition-colors"
                      />
                    }
                  >
                    <p className="text-on-surface truncate text-xs font-semibold leading-snug">
                      {draft.label}
                    </p>
                    <p className="text-muted-foreground truncate text-[10px] leading-snug tabular-nums">
                      {assistWithClient ? (
                        <span className="text-amber-900/75">
                          {draft.createdByUserName} ·{" "}
                        </span>
                      ) : null}
                      {draft.itemCount} {tr("art.", "ص")} ·{" "}
                      {formatPosDh(draft.totalMad, 2, locale)}
                    </p>
                  </HoverCardTrigger>
                  <HoverCardContent
                    side="bottom"
                    align="start"
                    className="w-[min(18rem,calc(100vw-2rem))]"
                  >
                    <PosCartDraftHoverContent
                      draft={draft}
                      locale={locale}
                      tr={tr}
                    />
                  </HoverCardContent>
                </HoverCard>
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  className="text-primary size-9 shrink-0 rounded-md"
                  disabled={busy}
                  onClick={() => onRestoreDraft(draft.id)}
                  aria-label={tr("Reprendre", "استئناف")}
                  title={tr("Reprendre", "استئناف")}
                >
                  <RotateCcw className="size-[1.125rem] stroke-[2]" aria-hidden />
                </Button>
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  className="text-muted-foreground hover:text-error size-7 shrink-0 rounded-md"
                  disabled={busy}
                  onClick={() => onDeleteDraft(draft.id)}
                  aria-label={tr("Supprimer", "حذف")}
                  title={tr("Supprimer", "حذف")}
                >
                  <Trash2 className="size-3.5 stroke-[1.75]" aria-hidden />
                </Button>
              </article>
            );
          })
        )}
      </div>

      {showScrollArrows ? (
        <Button
          type="button"
          size="icon"
          variant="ghost"
          className={scrollArrowClass(canScrollRight)}
          disabled={!canScrollRight}
          onClick={() => scrollDrafts(1)}
          aria-label={tr("Défiler vers la droite", "التمرير لليمين")}
          title={tr("Suivant", "التالي")}
        >
          <ChevronRight
            className={cn(
              "size-4 stroke-[2]",
              canScrollRight ? "text-primary-foreground" : "text-current",
            )}
            aria-hidden
          />
        </Button>
      ) : null}
    </div>
  );
}
