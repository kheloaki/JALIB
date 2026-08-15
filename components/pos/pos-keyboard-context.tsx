"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useLocale } from "next-intl";

import {
  defaultLetterLayout,
  type PosKeyboardLayout,
} from "@/lib/pos/keyboard-layouts";

export type PosKeyboardInputMode = "text" | "numeric" | "tel";

export type PosKeyboardTarget = {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  inputMode?: PosKeyboardInputMode;
};

type PosKeyboardContextValue = {
  /** Virtual keyboard mode — only active after toggling the header icon. */
  isEnabled: boolean;
  isOpen: boolean;
  target: PosKeyboardTarget | null;
  layout: PosKeyboardLayout;
  toggleEnabled: () => void;
  open: (target: PosKeyboardTarget) => void;
  close: () => void;
  toggleNumeric: () => void;
  toggleLetterLanguage: () => void;
  setValue: (value: string) => void;
};

const PosKeyboardContext = createContext<PosKeyboardContextValue | null>(null);

export function PosKeyboardProvider({ children }: { children: ReactNode }) {
  const locale = useLocale();
  const initialLetterLayout = defaultLetterLayout(locale);
  const [isEnabled, setIsEnabled] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [target, setTarget] = useState<PosKeyboardTarget | null>(null);
  const [layout, setLayout] = useState<PosKeyboardLayout>(initialLetterLayout);
  const lastTargetRef = useRef<PosKeyboardTarget | null>(null);
  const letterLayoutRef = useRef<"alpha" | "arabic">(initialLetterLayout);
  const isEnabledRef = useRef(false);

  const open = useCallback((next: PosKeyboardTarget) => {
    if (!isEnabledRef.current) return;
    lastTargetRef.current = next;
    setTarget(next);
    setLayout(
      next.inputMode === "numeric" || next.inputMode === "tel"
        ? "numeric"
        : letterLayoutRef.current,
    );
    setIsOpen(true);
  }, []);

  const close = useCallback(() => {
    setIsOpen(false);
  }, []);

  const toggleEnabled = useCallback(() => {
    setIsEnabled((prev) => {
      const next = !prev;
      isEnabledRef.current = next;
      if (!next) {
        setIsOpen(false);
        return false;
      }
      if (lastTargetRef.current) {
        setTarget(lastTargetRef.current);
        setIsOpen(true);
      }
      return true;
    });
  }, []);

  const toggleNumeric = useCallback(() => {
    setLayout((prev) => {
      if (prev === "numeric") {
        return letterLayoutRef.current;
      }
      if (prev === "alpha" || prev === "arabic") {
        letterLayoutRef.current = prev;
      }
      return "numeric";
    });
  }, []);

  const toggleLetterLanguage = useCallback(() => {
    setLayout((prev) => {
      if (prev === "numeric") {
        const next =
          letterLayoutRef.current === "arabic" ? "alpha" : "arabic";
        letterLayoutRef.current = next;
        return next;
      }
      const next = prev === "arabic" ? "alpha" : "arabic";
      letterLayoutRef.current = next;
      return next;
    });
  }, []);

  const setValue = useCallback((value: string) => {
    setTarget((prev) => {
      if (!prev) return prev;
      const next = { ...prev, value };
      lastTargetRef.current = next;
      prev.onChange(value);
      return next;
    });
  }, []);

  const value = useMemo(
    () => ({
      isEnabled,
      isOpen,
      target,
      layout,
      toggleEnabled,
      open,
      close,
      toggleNumeric,
      toggleLetterLanguage,
      setValue,
    }),
    [
      isEnabled,
      isOpen,
      target,
      layout,
      toggleEnabled,
      open,
      close,
      toggleNumeric,
      toggleLetterLanguage,
      setValue,
    ],
  );

  return (
    <PosKeyboardContext.Provider value={value}>
      {children}
    </PosKeyboardContext.Provider>
  );
}

export function usePosKeyboard() {
  const ctx = useContext(PosKeyboardContext);
  if (!ctx) {
    throw new Error("usePosKeyboard must be used within PosKeyboardProvider");
  }
  return ctx;
}

export function usePosKeyboardOptional() {
  return useContext(PosKeyboardContext);
}

export function usePosKeyboardField(options: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  inputMode?: PosKeyboardInputMode;
}) {
  const keyboard = usePosKeyboardOptional();

  const bindFocus = useCallback(() => {
    if (!keyboard?.isEnabled) return;
    keyboard.open({
      id: options.id,
      label: options.label,
      value: options.value,
      onChange: options.onChange,
      inputMode: options.inputMode,
    });
  }, [
    keyboard,
    options.id,
    options.label,
    options.value,
    options.onChange,
    options.inputMode,
  ]);

  return {
    onFocus: bindFocus,
    onClick: bindFocus,
    readOnly: Boolean(keyboard?.isEnabled),
    inputMode: options.inputMode,
  };
}
