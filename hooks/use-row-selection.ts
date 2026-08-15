"use client";

import { useCallback, useMemo, useState } from "react";

/**
 * Multi-row selection for tables.
 * Selection can include ids beyond the currently rendered page.
 */
export function useRowSelection(visibleIds: readonly string[]) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());

  const selectedCount = selectedIds.size;
  const allVisibleSelected =
    visibleIds.length > 0 && visibleIds.every((id) => selectedIds.has(id));
  const someVisibleSelected =
    !allVisibleSelected && visibleIds.some((id) => selectedIds.has(id));

  const isSelected = useCallback(
    (id: string) => selectedIds.has(id),
    [selectedIds],
  );

  const toggle = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  /** Select / deselect only the currently visible rows. */
  const toggleAllVisible = useCallback(() => {
    setSelectedIds((prev) => {
      const allSelected =
        visibleIds.length > 0 && visibleIds.every((id) => prev.has(id));
      if (allSelected) {
        const next = new Set(prev);
        for (const id of visibleIds) next.delete(id);
        return next;
      }
      const next = new Set(prev);
      for (const id of visibleIds) next.add(id);
      return next;
    });
  }, [visibleIds]);

  const selectIds = useCallback((ids: readonly string[]) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      for (const id of ids) next.add(id);
      return next;
    });
  }, []);

  const replaceSelection = useCallback((ids: readonly string[]) => {
    setSelectedIds(new Set(ids));
  }, []);

  const clear = useCallback(() => setSelectedIds(new Set()), []);

  const selectedIdList = useMemo(() => [...selectedIds], [selectedIds]);

  return {
    selectedIds,
    selectedIdList,
    selectedCount,
    allVisibleSelected,
    someVisibleSelected,
    isSelected,
    toggle,
    toggleAllVisible,
    selectIds,
    replaceSelection,
    clear,
  };
}
