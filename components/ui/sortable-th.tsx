"use client";

import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";

import { cn } from "@/lib/utils";

export type SortDirection = "asc" | "desc";

type SortableThProps<T extends string> = {
  column: T;
  activeColumn: T;
  direction: SortDirection;
  onSort: (column: T) => void;
  children: React.ReactNode;
  className?: string;
  align?: "start" | "end" | "center";
};

export function SortableTh<T extends string>({
  column,
  activeColumn,
  direction,
  onSort,
  children,
  className,
  align = "start",
}: SortableThProps<T>) {
  const active = activeColumn === column;
  const alignClass =
    align === "end"
      ? "justify-end text-end"
      : align === "center"
        ? "justify-center text-center"
        : "justify-start text-start";

  return (
    <th
      className={cn(
        "text-on-surface-variant px-4 py-3 text-[10px] font-bold tracking-wider uppercase sm:px-6",
        className,
      )}
      aria-sort={
        active ? (direction === "asc" ? "ascending" : "descending") : "none"
      }
    >
      <button
        type="button"
        onClick={() => onSort(column)}
        className={cn(
          "hover:text-on-surface inline-flex w-full items-center gap-1 transition-colors",
          alignClass,
          active && "text-primary",
        )}
      >
        <span>{children}</span>
        {active ? (
          direction === "asc" ? (
            <ArrowUp className="size-3.5 shrink-0" aria-hidden />
          ) : (
            <ArrowDown className="size-3.5 shrink-0" aria-hidden />
          )
        ) : (
          <ArrowUpDown
            className="text-on-surface-variant/50 size-3.5 shrink-0"
            aria-hidden
          />
        )}
      </button>
    </th>
  );
}

export function toggleSortState<T extends string>(
  currentColumn: T,
  currentDirection: SortDirection,
  nextColumn: T,
  defaultDirection: SortDirection = "asc",
): { column: T; direction: SortDirection } {
  if (currentColumn === nextColumn) {
    return {
      column: nextColumn,
      direction: currentDirection === "asc" ? "desc" : "asc",
    };
  }
  return { column: nextColumn, direction: defaultDirection };
}
