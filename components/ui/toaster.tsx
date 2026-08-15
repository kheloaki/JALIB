"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
} from "react";

import { cn } from "@/lib/utils";

type ToastTone = "success" | "error" | "info";

export type ToastInput = {
  title: string;
  description?: string;
  tone?: ToastTone;
  durationMs?: number;
};

type ToastItem = ToastInput & {
  id: string;
  createdAt: number;
};

type ToastApi = {
  push: (t: ToastInput) => void;
  success: (title: string, description?: string) => void;
  error: (title: string, description?: string) => void;
  info: (title: string, description?: string) => void;
};

const ToastContext = createContext<ToastApi | null>(null);

function toneClasses(tone: ToastTone) {
  switch (tone) {
    case "success":
      return "border-secondary-container bg-secondary-container/20 text-on-surface";
    case "error":
      return "border-error-container bg-error-container/30 text-on-surface";
    case "info":
    default:
      return "border-border bg-card text-foreground";
  }
}

export function ToasterProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const timers = useRef<Record<string, number>>({});

  const remove = useCallback((id: string) => {
    setItems((prev) => prev.filter((t) => t.id !== id));
    const t = timers.current[id];
    if (t) window.clearTimeout(t);
    delete timers.current[id];
  }, []);

  const push = useCallback(
    (t: ToastInput) => {
      const id = `toast:${crypto.randomUUID()}`;
      const item: ToastItem = {
        id,
        createdAt: Date.now(),
        tone: t.tone ?? "info",
        title: t.title,
        description: t.description,
        durationMs: t.durationMs ?? 2800,
      };
      setItems((prev) => [item, ...prev].slice(0, 5));
      timers.current[id] = window.setTimeout(() => remove(id), item.durationMs);
    },
    [remove],
  );

  const api = useMemo<ToastApi>(
    () => ({
      push,
      success: (title, description) =>
        push({ title, description, tone: "success" }),
      error: (title, description) => push({ title, description, tone: "error" }),
      info: (title, description) => push({ title, description, tone: "info" }),
    }),
    [push],
  );

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="pointer-events-none fixed right-4 bottom-4 z-200 flex w-[min(420px,calc(100vw-2rem))] flex-col gap-2">
        {items.map((t) => (
          <div
            key={t.id}
            className={cn(
              "pointer-events-auto overflow-hidden rounded-2xl border p-4 shadow-lg backdrop-blur-md",
              "animate-in fade-in slide-in-from-bottom-2 duration-200",
              toneClasses(t.tone ?? "info"),
            )}
            role="status"
            aria-live="polite"
          >
            <p className="text-sm font-black tracking-tight">{t.title}</p>
            {t.description ? (
              <p className="text-on-surface-variant mt-1 text-xs font-medium">
                {t.description}
              </p>
            ) : null}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastApi {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error("useToast must be used within ToasterProvider");
  }
  return ctx;
}

