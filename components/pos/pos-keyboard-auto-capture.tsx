"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";

import { usePosKeyboardOptional } from "@/components/pos/pos-keyboard-context";
import { setNativeInputValue } from "@/lib/pos/set-native-input-value";

const SKIP_INPUT_TYPES = new Set([
  "checkbox",
  "radio",
  "file",
  "hidden",
  "submit",
  "button",
  "reset",
  "image",
  "color",
  "range",
]);

function fieldLabel(el: HTMLInputElement | HTMLTextAreaElement): string {
  const aria = el.getAttribute("aria-label")?.trim();
  if (aria) return aria;
  const labelledBy = el.getAttribute("aria-labelledby");
  if (labelledBy) {
    const node = document.getElementById(labelledBy);
    if (node?.textContent?.trim()) return node.textContent.trim();
  }
  const label = el.labels?.[0]?.textContent?.trim();
  if (label) return label;
  return el.placeholder?.trim() || "Saisie";
}

function fieldInputMode(
  el: HTMLInputElement | HTMLTextAreaElement,
): "text" | "numeric" | "tel" {
  if (el instanceof HTMLTextAreaElement) return "text";
  if (el.type === "tel") return "tel";
  if (
    el.type === "number" ||
    el.inputMode === "numeric" ||
    el.inputMode === "decimal"
  ) {
    return "numeric";
  }
  return "text";
}

function PosKeyboardAutoCaptureInner() {
  const keyboard = usePosKeyboardOptional();
  const keyboardRef = useRef(keyboard);
  keyboardRef.current = keyboard;
  const activeElRef = useRef<HTMLInputElement | HTMLTextAreaElement | null>(
    null,
  );

  const isEnabled = keyboard?.isEnabled ?? false;
  const isOpen = keyboard?.isOpen ?? false;

  useEffect(() => {
    if (!isEnabled) {
      if (activeElRef.current) {
        activeElRef.current.readOnly = false;
        activeElRef.current = null;
      }
      return;
    }

    function releaseElement(el: HTMLInputElement | HTMLTextAreaElement | null) {
      if (el) el.readOnly = false;
    }

    function onFocusIn(e: FocusEvent) {
      const kb = keyboardRef.current;
      if (!kb?.isEnabled) return;
      const el = e.target;
      if (!(el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement)) {
        return;
      }
      if (el instanceof HTMLInputElement && SKIP_INPUT_TYPES.has(el.type)) {
        return;
      }
      if (el.dataset.noPosKeyboard !== undefined) return;

      if (activeElRef.current && activeElRef.current !== el) {
        releaseElement(activeElRef.current);
      }

      activeElRef.current = el;
      el.readOnly = true;

      kb.open({
        id: el.id || `pos-input-${crypto.randomUUID()}`,
        label: fieldLabel(el),
        value: el.value,
        onChange: (next) => setNativeInputValue(el, next),
        inputMode: fieldInputMode(el),
      });
    }

    document.addEventListener("focusin", onFocusIn, true);
    return () => {
      document.removeEventListener("focusin", onFocusIn, true);
      releaseElement(activeElRef.current);
      activeElRef.current = null;
    };
  }, [isEnabled]);

  useEffect(() => {
    if (!isOpen && activeElRef.current) {
      activeElRef.current.readOnly = false;
    }
  }, [isOpen]);

  return null;
}

/** On POS, binds the virtual keyboard to any text/number field when keyboard mode is on. */
export function PosKeyboardAutoCapture() {
  const pathname = usePathname();
  if (!pathname?.includes("/pos")) return null;
  return <PosKeyboardAutoCaptureInner />;
}
