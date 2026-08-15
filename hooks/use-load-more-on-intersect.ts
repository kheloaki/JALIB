"use client";

import { useEffect, useRef, type RefObject } from "react";

/**
 * Calls `onLoadMore` when `sentinelRef` scrolls into view.
 * Skips while `enabled` is false or `busy` is true.
 * Pass `rootRef` when the list scrolls inside a nested overflow container
 * (not the window) so intersection is measured against that scroller.
 */
export function useLoadMoreOnIntersect(
  enabled: boolean,
  busy: boolean,
  onLoadMore: () => void,
  rootRef?: RefObject<Element | null>,
) {
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const onLoadMoreRef = useRef(onLoadMore);
  onLoadMoreRef.current = onLoadMore;

  useEffect(() => {
    const node = sentinelRef.current;
    if (!node || !enabled) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (!entry?.isIntersecting || busy) return;
        onLoadMoreRef.current();
      },
      {
        root: rootRef?.current ?? null,
        rootMargin: "240px 0px",
        threshold: 0,
      },
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [busy, enabled, rootRef]);

  return sentinelRef;
}
