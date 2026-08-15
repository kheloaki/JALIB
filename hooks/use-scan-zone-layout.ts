"use client";

import { useEffect, useState, type RefObject } from "react";

const STATUS_LINE_PX = 18;

export type ScanZoneLayout = {
  /** Camera stretches to fill leftover space (few items). */
  useStretch: boolean;
  /** Full-width square height in px (width + status line). */
  defaultSquarePx: number;
};

/**
 * Stretch the camera when cart lines are short.
 * Once items exceed the space above a default full-width square, lock the camera
 * and let the list scroll.
 */
export function useScanZoneLayout(
  bodyRef: RefObject<HTMLElement | null>,
  itemsRef: RefObject<HTMLElement | null>,
  itemCount: number,
  options?: { enabled?: boolean; statusPx?: number },
): ScanZoneLayout {
  const enabled = options?.enabled ?? true;
  const statusPx = options?.statusPx ?? STATUS_LINE_PX;
  const [layout, setLayout] = useState<ScanZoneLayout>({
    useStretch: true,
    defaultSquarePx: 0,
  });

  useEffect(() => {
    if (!enabled) {
      setLayout({ useStretch: true, defaultSquarePx: 0 });
      return;
    }

    const body = bodyRef.current;
    if (!body) return;

    const update = () => {
      const bodyRect = body.getBoundingClientRect();
      const bodyHeight = bodyRect.height;
      const bodyWidth = bodyRect.width;
      if (bodyHeight <= 0 || bodyWidth <= 0) return;

      const itemsNaturalHeight = itemsRef.current?.scrollHeight ?? 0;
      const defaultSquarePx = bodyWidth + statusPx;
      const fitsWithStretch =
        itemsNaturalHeight + defaultSquarePx <= bodyHeight + 4;

      setLayout({
        useStretch: fitsWithStretch,
        defaultSquarePx,
      });
    };

    update();
    const frame = requestAnimationFrame(update);
    const observer = new ResizeObserver(update);
    observer.observe(body);
    if (itemsRef.current) observer.observe(itemsRef.current);

    window.addEventListener("resize", update);

    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener("resize", update);
    };
  }, [bodyRef, itemsRef, enabled, itemCount, statusPx]);

  return layout;
}
