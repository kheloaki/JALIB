"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Search } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type CollapsibleHeaderSearchProps = {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  className?: string;
};

export function CollapsibleHeaderSearch({
  value,
  onChange,
  placeholder,
  className,
}: CollapsibleHeaderSearchProps) {
  const [expanded, setExpanded] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const expand = useCallback(() => {
    setExpanded(true);
    requestAnimationFrame(() => inputRef.current?.focus());
  }, []);

  const collapse = useCallback(() => {
    setExpanded(false);
  }, []);

  const hasValue = value.trim().length > 0;

  useEffect(() => {
    if (hasValue) {
      setExpanded(true);
    }
  }, [hasValue]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "f") {
        event.preventDefault();
        expand();
        return;
      }
      if (event.key === "Escape" && expanded) {
        event.preventDefault();
        if (hasValue) {
          onChange("");
        }
        collapse();
        inputRef.current?.blur();
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [collapse, expand, expanded, hasValue, onChange]);

  useEffect(() => {
    if (!expanded || hasValue) return;

    function onPointerDown(event: PointerEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        collapse();
      }
    }

    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [collapse, expanded, hasValue]);

  const showInput = expanded || hasValue;

  return (
    <div
      ref={containerRef}
      className={cn(
        "relative flex shrink-0 items-center justify-end transition-[width] duration-200 ease-out",
        showInput ? "w-56 sm:w-80" : "w-10",
        className,
      )}
    >
      {showInput ? (
        <div className="relative w-full">
          <Search
            className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 stroke-[1.75]"
            aria-hidden
          />
          <input
            ref={inputRef}
            type="search"
            value={value}
            onChange={(event) => onChange(event.target.value)}
            placeholder={placeholder}
            className="text-on-surface h-10 w-full rounded-full border-0 bg-white py-0 pr-10 pl-9 text-[13px] shadow-[0_2px_12px_rgba(61,43,31,0.06)] focus:ring-2 focus:ring-[#3d2b1f]/10 focus:outline-none"
            aria-label={placeholder}
          />
          <kbd className="text-muted-foreground pointer-events-none absolute top-1/2 right-2.5 hidden -translate-y-1/2 text-[10px] font-medium sm:inline">
            ⌘ F
          </kbd>
        </div>
      ) : (
        <Button
          type="button"
          variant="outline"
          size="icon"
          onClick={expand}
          className="pf-icon-btn size-10 shrink-0 border-0"
          aria-label={placeholder}
          title={placeholder}
        >
          <Search className="size-5 stroke-[1.75]" aria-hidden />
        </Button>
      )}
    </div>
  );
}
