"use client";

import { useState, type Dispatch, type SetStateAction } from "react";

import { MOBILE_BREAKPOINT } from "@/hooks/use-mobile";

export type TableGridViewMode = "table" | "grid";

export function useTableGridViewMode(
  defaultMode: TableGridViewMode = "table",
): [
  TableGridViewMode,
  Dispatch<SetStateAction<TableGridViewMode>>,
] {
  function initialViewMode(): TableGridViewMode {
    if (typeof window === "undefined") return defaultMode;
    if (window.innerWidth < MOBILE_BREAKPOINT) return "grid";
    return defaultMode;
  }

  return useState<TableGridViewMode>(initialViewMode);
}
