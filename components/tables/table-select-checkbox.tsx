"use client";

import { cn } from "@/lib/utils";

type TableSelectCheckboxProps = {
  checked: boolean;
  indeterminate?: boolean;
  onChange: () => void;
  disabled?: boolean;
  "aria-label": string;
  className?: string;
};

/** Compact checkbox for table row / header selection. */
export function TableSelectCheckbox({
  checked,
  indeterminate = false,
  onChange,
  disabled = false,
  "aria-label": ariaLabel,
  className,
}: TableSelectCheckboxProps) {
  return (
    <input
      type="checkbox"
      checked={checked}
      disabled={disabled}
      ref={(el) => {
        if (el) el.indeterminate = indeterminate && !checked;
      }}
      onChange={(e) => {
        e.stopPropagation();
        onChange();
      }}
      onClick={(e) => e.stopPropagation()}
      aria-label={ariaLabel}
      className={cn(
        "border-sidebar-border text-primary focus-visible:ring-primary/40 size-4 shrink-0 cursor-pointer rounded border accent-primary focus-visible:ring-2 focus-visible:outline-none disabled:cursor-wait disabled:opacity-50",
        className,
      )}
    />
  );
}
