"use client";

import { cn } from "@/lib/utils";

export function PfTabList({
  children,
  className,
  "aria-label": ariaLabel,
}: {
  children: React.ReactNode;
  className?: string;
  "aria-label"?: string;
}) {
  return (
    <div
      className={cn("pf-tabs", className)}
      role="tablist"
      aria-label={ariaLabel}
    >
      {children}
    </div>
  );
}

export function PfTab({
  active,
  children,
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { active?: boolean }) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      className={cn("pf-tab", active && "pf-tab-active", className)}
      {...props}
    >
      {children}
    </button>
  );
}
