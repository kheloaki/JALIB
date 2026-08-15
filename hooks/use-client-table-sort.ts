"use client";

import { useCallback, useMemo, useState } from "react";

import {
  toggleSortState,
  type SortDirection,
} from "@/components/ui/sortable-th";

type CompareFn<TRow, TCol extends string> = (
  a: TRow,
  b: TRow,
  column: TCol,
) => number;

/**
 * Client-side column sort for in-memory table rows.
 * Pair with `SortableTh` for the header UI.
 */
export function useClientTableSort<TRow, TCol extends string>({
  rows,
  initialColumn,
  initialDirection = "asc",
  /** Direction applied the first time a different column is clicked. */
  switchDirection = "asc",
  compare,
}: {
  rows: readonly TRow[];
  initialColumn: TCol;
  initialDirection?: SortDirection;
  switchDirection?: SortDirection;
  compare: CompareFn<TRow, TCol>;
}) {
  const [sortColumn, setSortColumn] = useState<TCol>(initialColumn);
  const [sortDirection, setSortDirection] =
    useState<SortDirection>(initialDirection);

  const handleSort = useCallback(
    (column: TCol) => {
      const next = toggleSortState(
        sortColumn,
        sortDirection,
        column,
        switchDirection,
      );
      setSortColumn(next.column);
      setSortDirection(next.direction);
    },
    [sortColumn, sortDirection, switchDirection],
  );

  const sortedRows = useMemo(() => {
    const dir = sortDirection === "asc" ? 1 : -1;
    return [...rows].sort((a, b) => compare(a, b, sortColumn) * dir);
  }, [rows, sortColumn, sortDirection, compare]);

  return {
    sortColumn,
    sortDirection,
    handleSort,
    sortedRows,
  };
}
