import { useEffect, useRef } from "react";

type KeypadKeyboardHandlers = {
  onDigit: (digit: string) => void;
  onDecimal?: () => void;
  onBackspace: () => void;
  onClear?: () => void;
  onConfirm: () => void;
};

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || target.isContentEditable;
}

export function useKeypadKeyboard(
  open: boolean,
  handlers: KeypadKeyboardHandlers,
) {
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;

  useEffect(() => {
    if (!open) return;

    function onKeyDown(e: KeyboardEvent) {
      if (isTypingTarget(e.target)) return;

      const h = handlersRef.current;
      const key = e.key;

      if (key >= "0" && key <= "9") {
        e.preventDefault();
        h.onDigit(key);
        return;
      }

      if (key === "Enter") {
        e.preventDefault();
        h.onConfirm();
        return;
      }

      if (key === "Backspace") {
        e.preventDefault();
        h.onBackspace();
        return;
      }

      if (key === "Delete" && h.onClear) {
        e.preventDefault();
        h.onClear();
        return;
      }

      if ((key === "," || key === ".") && h.onDecimal) {
        e.preventDefault();
        h.onDecimal();
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open]);
}
