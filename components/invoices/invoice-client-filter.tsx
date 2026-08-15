"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { useQuery } from "convex/react";
import { UserRound, X } from "lucide-react";

import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { filterAndRankClientsBySearch } from "@/lib/clients/client-search";
import { clientFromConvex } from "@/lib/convex/mappers";
import { cn } from "@/lib/utils";

const SEARCH_DEBOUNCE_MS = 250;
const MIN_SEARCH_CHARS = 2;

function useDebouncedValue(value: string, delayMs: number) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), delayMs);
    return () => window.clearTimeout(timer);
  }, [delayMs, value]);
  return debounced;
}

type InvoiceClientFilterProps = {
  selectedClientId: string | null;
  onClientChange: (clientId: string | null) => void;
  tr: (fr: string, ar: string) => string;
  className?: string;
};

/** Compact searchable client picker for Factures filters. */
export function InvoiceClientFilter({
  selectedClientId,
  onClientChange,
  tr,
  className,
}: InvoiceClientFilterProps) {
  const listboxId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const debouncedQuery = useDebouncedValue(query.trim(), SEARCH_DEBOUNCE_MS);
  const canSearch = debouncedQuery.length >= MIN_SEARCH_CHARS;

  const selectedRow = useQuery(
    api.clients.get,
    selectedClientId
      ? { clientId: selectedClientId as Id<"clients"> }
      : "skip",
  );
  const recentRows = useQuery(
    api.clients.listRecent,
    open && !canSearch ? { limit: 20 } : "skip",
  );
  const searchRows = useQuery(
    api.clients.searchSummaries,
    open && canSearch ? { query: debouncedQuery, limit: 30 } : "skip",
  );

  const selectedClient = useMemo(
    () => (selectedRow ? clientFromConvex(selectedRow) : null),
    [selectedRow],
  );

  const suggestions = useMemo(() => {
    if (canSearch) {
      const rows = (searchRows ?? []).map(clientFromConvex);
      return filterAndRankClientsBySearch(rows, query.trim() || debouncedQuery);
    }
    return (recentRows ?? []).map(clientFromConvex);
  }, [canSearch, debouncedQuery, query, recentRows, searchRows]);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [open]);

  useEffect(() => {
    if (selectedClient) {
      setQuery(selectedClient.fullName);
    } else if (!selectedClientId) {
      setQuery("");
    }
  }, [selectedClient, selectedClientId]);

  return (
    <div ref={rootRef} className={cn("relative min-w-0", className)}>
      <span className="text-on-surface-variant mb-1 block text-[10px] font-bold tracking-wide uppercase sm:text-xs">
        {tr("Client", "العميل")}
      </span>
      <div className="relative">
        <UserRound
          className="text-on-surface-variant pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 stroke-[1.75] sm:left-3 sm:size-4"
          aria-hidden
        />
        <input
          type="search"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
            if (selectedClientId) onClientChange(null);
          }}
          onFocus={() => setOpen(true)}
          placeholder={tr("Rechercher un client…", "ابحث عن عميل…")}
          aria-label={tr("Filtrer par client", "تصفية حسب العميل")}
          aria-expanded={open}
          aria-controls={listboxId}
          role="combobox"
          autoComplete="off"
          className="bg-surface-container-low border-sidebar-border text-on-surface focus:ring-primary/20 w-full rounded-xl border py-2 pr-9 pl-8 text-xs focus:ring-2 sm:py-2.5 sm:pl-10 sm:text-sm"
        />
        {selectedClientId || query ? (
          <button
            type="button"
            onClick={() => {
              onClientChange(null);
              setQuery("");
              setOpen(false);
            }}
            className="text-on-surface-variant hover:text-on-surface absolute top-1/2 right-2 -translate-y-1/2 rounded-md p-1"
            aria-label={tr("Effacer le client", "مسح العميل")}
          >
            <X className="size-3.5" aria-hidden />
          </button>
        ) : null}
      </div>

      {open ? (
        <ul
          id={listboxId}
          role="listbox"
          className="border-sidebar-border bg-surface-container-lowest absolute z-40 mt-1 max-h-56 w-full overflow-auto rounded-xl border py-1 shadow-lg"
        >
          {!canSearch ? (
            <li className="text-on-surface-variant px-3 py-2 text-xs">
              {tr(
                "Tapez au moins 2 caractères, ou choisissez un client récent.",
                "اكتب حرفين على الأقل، أو اختر عميلاً حديثاً.",
              )}
            </li>
          ) : null}
          {suggestions.length === 0 && canSearch ? (
            <li className="text-on-surface-variant px-3 py-2 text-xs">
              {tr("Aucun client trouvé.", "لا يوجد عميل.")}
            </li>
          ) : null}
          {suggestions.map((client) => {
            const active = client.id === selectedClientId;
            return (
              <li key={client.id} role="option" aria-selected={active}>
                <button
                  type="button"
                  className={cn(
                    "hover:bg-surface-container-low flex w-full flex-col items-start px-3 py-2 text-left text-sm",
                    active && "bg-primary/10 text-primary",
                  )}
                  onClick={() => {
                    onClientChange(client.id);
                    setQuery(client.fullName);
                    setOpen(false);
                  }}
                >
                  <span className="font-semibold">{client.fullName}</span>
                  <span className="text-on-surface-variant text-xs tabular-nums">
                    {client.phone}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}
