"use client";

import { useEffect, useRef } from "react";

import { normalizeBarcodeInput } from "@/lib/pos/catalog-lookup";

type UseHardwareBarcodeWedgeOptions = {
  enabled: boolean;
  onScan: (code: string) => void;
  /** Minimum barcode length after normalize (default 4). */
  minLength?: number;
  /** Max gap between keystrokes to stay in “scanner burst” mode (default 80ms). */
  maxInterKeyMs?: number;
};

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  const tag = target.tagName;
  if (tag === "TEXTAREA" || tag === "SELECT") return true;
  if (tag !== "INPUT") return false;
  const type = (target as HTMLInputElement).type;
  return ![
    "button",
    "checkbox",
    "radio",
    "submit",
    "reset",
    "file",
    "color",
    "range",
    "hidden",
  ].includes(type);
}

/** Header / catalog search — scanners often land here; we still intercept barcode bursts. */
function isSearchField(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLInputElement)) return false;
  if (target.type === "search") return true;
  return target.classList.contains("pf-search");
}

function looksLikeBarcode(raw: string): boolean {
  const normalized = normalizeBarcodeInput(raw);
  if (normalized.length < 4) return false;
  // Typical retail / EAN / CODE128 payloads are mostly digits; allow a few letters.
  const alnum = normalized.replace(/[^0-9A-Z]/gi, "");
  if (alnum.length < 4) return false;
  const digits = (alnum.match(/\d/g) ?? []).length;
  return digits / alnum.length >= 0.6;
}

function hasBlockingDialog(): boolean {
  if (typeof document === "undefined") return false;
  const dialogs = document.querySelectorAll(
    '[role="dialog"][data-state="open"], [data-radix-dialog-content]',
  );
  for (const node of dialogs) {
    if (!(node instanceof HTMLElement)) continue;
    const style = window.getComputedStyle(node);
    if (style.display !== "none" && style.visibility !== "hidden") {
      return true;
    }
  }
  return false;
}

/**
 * USB / keyboard-wedge barcode scanners: capture rapid key bursts + Enter
 * anywhere on the POS without requiring a focused barcode field.
 */
export function useHardwareBarcodeWedge({
  enabled,
  onScan,
  minLength = 4,
  maxInterKeyMs = 80,
}: UseHardwareBarcodeWedgeOptions) {
  const onScanRef = useRef(onScan);
  onScanRef.current = onScan;
  const bufferRef = useRef("");
  const lastKeyAtRef = useRef(0);
  const burstRef = useRef(false);

  useEffect(() => {
    if (!enabled) {
      bufferRef.current = "";
      burstRef.current = false;
      return;
    }

    function resetBuffer() {
      bufferRef.current = "";
      burstRef.current = false;
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.isComposing || event.defaultPrevented) return;
      if (event.ctrlKey || event.metaKey || event.altKey) return;
      if (hasBlockingDialog()) {
        resetBuffer();
        return;
      }

      const now = Date.now();
      const gap = now - lastKeyAtRef.current;
      lastKeyAtRef.current = now;

      if (gap > maxInterKeyMs) {
        bufferRef.current = "";
        burstRef.current = false;
      }

      const target = event.target;
      const inEditable = isEditableTarget(target);
      const inSearch = isSearchField(target);

      if (event.key === "Enter") {
        const code = normalizeBarcodeInput(bufferRef.current);
        const isBurst =
          burstRef.current || (!inEditable && code.length >= minLength);
        if (
          code.length >= minLength &&
          looksLikeBarcode(code) &&
          (isBurst || inSearch || !inEditable)
        ) {
          event.preventDefault();
          event.stopPropagation();
          if (inSearch && target instanceof HTMLInputElement) {
            target.blur();
            // Clear search so the barcode digits don’t stay as a filter.
            target.value = "";
            target.dispatchEvent(new Event("input", { bubbles: true }));
          }
          resetBuffer();
          onScanRef.current(code);
        } else {
          resetBuffer();
        }
        return;
      }

      if (event.key === "Escape") {
        resetBuffer();
        return;
      }

      if (event.key.length !== 1) return;

      // While typing in qty/price dialogs or other fields, ignore.
      if (inEditable && !inSearch) {
        resetBuffer();
        return;
      }

      const rapid = gap > 0 && gap <= maxInterKeyMs;
      if (rapid) burstRef.current = true;

      // Rapid burst into the search bar = scanner: keep digits out of the filter.
      if (inSearch && (rapid || burstRef.current)) {
        event.preventDefault();
        bufferRef.current += event.key;
        if (bufferRef.current.length > 64) {
          bufferRef.current = bufferRef.current.slice(-64);
        }
        return;
      }

      bufferRef.current += event.key;
      if (bufferRef.current.length > 64) {
        bufferRef.current = bufferRef.current.slice(-64);
      }
    }

    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [enabled, maxInterKeyMs, minLength]);
}
