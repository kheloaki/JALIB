"use client";

import type { ReactNode } from "react";
import { X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type BulkAction = {
  key: string;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  variant?: "default" | "destructive" | "outline";
  icon?: ReactNode;
};

type BulkActionBarProps = {
  selectedCount: number;
  itemLabel: string;
  itemLabelPlural: string;
  clearLabel: string;
  onClear: () => void;
  actions: BulkAction[];
  className?: string;
};

export function BulkActionBar({
  selectedCount,
  itemLabel,
  itemLabelPlural,
  clearLabel,
  onClear,
  actions,
  className,
}: BulkActionBarProps) {
  if (selectedCount <= 0) return null;

  const label = selectedCount === 1 ? itemLabel : itemLabelPlural;

  return (
    <div
      className={cn(
        "border-primary/30 bg-primary/8 sticky bottom-3 z-20 flex flex-wrap items-center gap-2 rounded-2xl border px-3 py-2.5 shadow-md backdrop-blur-sm sm:gap-3 sm:px-4",
        className,
      )}
      role="region"
      aria-label="Bulk actions"
    >
      <p className="text-on-surface text-sm font-bold">
        <span className="text-primary tabular-nums">{selectedCount}</span>{" "}
        {label}
      </p>
      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
        {actions.map((action) => (
          <Button
            key={action.key}
            type="button"
            size="sm"
            variant={
              action.variant === "destructive"
                ? "destructive"
                : action.variant === "outline"
                  ? "outline"
                  : "default"
            }
            disabled={action.disabled}
            className="h-9 rounded-xl px-3 text-xs font-bold"
            onClick={action.onClick}
          >
            {action.icon}
            {action.label}
          </Button>
        ))}
      </div>
      <button
        type="button"
        onClick={onClear}
        className="text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high inline-flex size-8 items-center justify-center rounded-lg transition-colors"
        aria-label={clearLabel}
        title={clearLabel}
      >
        <X className="size-4 stroke-[1.75]" aria-hidden />
      </button>
    </div>
  );
}
