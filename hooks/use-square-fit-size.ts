"use client";

import { useEffect, useState, type RefObject } from "react";

function remToPx(rem: string) {
  if (typeof document === "undefined") {
    return parseFloat(rem) * 16;
  }
  const probe = document.createElement("div");
  probe.style.width = rem;
  document.body.appendChild(probe);
  const px = probe.getBoundingClientRect().width;
  probe.remove();
  return px;
}

export function useSquareFitSize(
  containerRef: RefObject<HTMLElement | null>,
  options?: { minRem?: string; reservePx?: number; enabled?: boolean },
) {
  const minRem = options?.minRem ?? "8.75rem";
  const reservePx = options?.reservePx ?? 0;
  const enabled = options?.enabled ?? true;
  const [sizePx, setSizePx] = useState(0);

  useEffect(() => {
    if (!enabled) {
      setSizePx(0);
      return;
    }

    const el = containerRef.current;
    if (!el) return;

    const minPx = remToPx(minRem);

    const update = () => {
      const { width, height } = el.getBoundingClientRect();
      const availableHeight = Math.max(0, height - reservePx);
      // Full mobile-width square when space allows; shrink only if zone is too short.
      const side = availableHeight >= width ? width : Math.min(width, availableHeight);
      setSizePx(Math.max(side, 0) || minPx);
    };

    update();
    const frame = requestAnimationFrame(update);
    const observer = new ResizeObserver(update);
    observer.observe(el);
    window.addEventListener("resize", update);

    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener("resize", update);
    };
  }, [containerRef, enabled, minRem, reservePx]);

  return sizePx;
}
