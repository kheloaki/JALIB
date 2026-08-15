"use client";

import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { useQuery } from "convex/react";
import { ChevronDown, Plus, UserRound, UserSearch, X } from "lucide-react";

import { PosClientProfileDialog } from "@/components/pos/pos-client-profile-dialog";
import { PosQuickAddClientDialog } from "@/components/pos/pos-quick-add-client-dialog";
import { POS_SURFACE_Z_CLASS } from "@/components/pos/pos-dialog";
import type { PaymentMethod } from "@/components/pos/types";
import { Button } from "@/components/ui/button";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { filterAndRankClientsBySearch } from "@/lib/clients/client-search";
import type { Client } from "@/lib/clients/types";
import { clientFromConvex } from "@/lib/convex/mappers";
import {
  readRecentPosClients,
  rememberRecentPosClient,
} from "@/lib/pos/recent-clients";
import { cn } from "@/lib/utils";

const SEARCH_DEBOUNCE_MS = 250;
const MIN_SEARCH_CHARS = 2;

type PosClientComboboxProps = {
  selectedClientId: string | null;
  onClientChange: (clientId: string | null) => void;
  payment: PaymentMethod;
  tr: (fr: string, ar: string) => string;
  compact?: boolean;
};

function clientLabel(client: Client): string {
  return `${client.fullName} • ${client.phone}`;
}

function useDebouncedValue(value: string, delayMs: number) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), delayMs);
    return () => window.clearTimeout(timer);
  }, [delayMs, value]);
  return debounced;
}

export function PosClientCombobox({
  selectedClientId,
  onClientChange,
  payment,
  tr,
  compact = false,
}: PosClientComboboxProps) {
  const listboxId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [addOpen, setAddOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [portalEl, setPortalEl] = useState<HTMLElement | null>(null);
  const [recentClients, setRecentClients] = useState<Client[]>([]);
  const [menuStyle, setMenuStyle] = useState<React.CSSProperties>({
    visibility: "hidden",
  });

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
    open && !canSearch ? { limit: 25 } : "skip",
  );
  const searchRows = useQuery(
    api.clients.searchSummaries,
    open && canSearch ? { query: debouncedQuery, limit: 40 } : "skip",
  );

  useEffect(() => {
    setPortalEl(document.body);
    setRecentClients(readRecentPosClients());
  }, []);

  const selectedClient = useMemo(() => {
    if (selectedRow) return clientFromConvex(selectedRow);
    if (!selectedClientId) return null;
    return recentClients.find((c) => c.id === selectedClientId) ?? null;
  }, [recentClients, selectedClientId, selectedRow]);

  const suggestionClients = useMemo(() => {
    if (canSearch) {
      const rows = (searchRows ?? []).map(clientFromConvex);
      // Re-rank with the live query so multi-word Arabic names match tightly.
      return filterAndRankClientsBySearch(rows, query.trim() || debouncedQuery);
    }
    const fromServer = (recentRows ?? []).map(clientFromConvex);
    const map = new Map<string, Client>();
    for (const client of [...recentClients, ...fromServer]) {
      map.set(client.id, client);
    }
    return [...map.values()].slice(0, 30);
  }, [
    canSearch,
    debouncedQuery,
    query,
    recentClients,
    recentRows,
    searchRows,
  ]);

  const trimmedQuery = query.trim();
  const showClearClientOption = trimmedQuery.length === 0;
  const searching =
    open &&
    trimmedQuery.length >= MIN_SEARCH_CHARS &&
    (debouncedQuery !== trimmedQuery || searchRows === undefined);

  const updateMenuPosition = useCallback(() => {
    if (!open || !inputRef.current) return;
    const rect = inputRef.current.getBoundingClientRect();
    const maxHeight = 208;
    const gap = 4;
    const spaceBelow = window.innerHeight - rect.bottom - gap;
    const spaceAbove = rect.top - gap;
    const openUp = spaceBelow < 180 && spaceAbove > spaceBelow;
    const available = openUp ? spaceAbove : spaceBelow;
    const height = Math.min(maxHeight, Math.max(120, available));

    if (openUp) {
      setMenuStyle({
        position: "fixed",
        left: rect.left,
        width: rect.width,
        bottom: window.innerHeight - rect.top + gap,
        maxHeight: height,
        visibility: "visible",
      });
      return;
    }

    setMenuStyle({
      position: "fixed",
      left: rect.left,
      width: rect.width,
      top: rect.bottom + gap,
      maxHeight: height,
      visibility: "visible",
    });
  }, [open]);

  useLayoutEffect(() => {
    if (!open) {
      setMenuStyle({ visibility: "hidden" });
      return;
    }
    updateMenuPosition();
  }, [open, suggestionClients.length, trimmedQuery, updateMenuPosition]);

  useEffect(() => {
    if (!open) return;
    window.addEventListener("resize", updateMenuPosition);
    window.addEventListener("scroll", updateMenuPosition, true);
    return () => {
      window.removeEventListener("resize", updateMenuPosition);
      window.removeEventListener("scroll", updateMenuPosition, true);
    };
  }, [open, updateMenuPosition]);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: MouseEvent) {
      const target = event.target as Node;
      if (rootRef.current?.contains(target)) return;
      if (listRef.current?.contains(target)) return;
      setOpen(false);
      setQuery("");
    }
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [open]);

  function openPicker() {
    const nextQuery = selectedClient?.fullName ?? "";
    setOpen(true);
    setQuery(nextQuery);
    requestAnimationFrame(() => inputRef.current?.select());
  }

  function selectClient(clientId: string | null, client?: Client | null) {
    onClientChange(clientId);
    if (client) {
      rememberRecentPosClient(client);
      setRecentClients(readRecentPosClients());
    }
    setQuery("");
    setOpen(false);
  }

  const inputValue = open
    ? query
    : selectedClient
      ? selectedClient.fullName
      : "";
  const showSelectedClient = Boolean(selectedClient && !open);
  const showCreditRequiredHint =
    payment === "credit" && !selectedClientId && !open;

  const listbox =
    open && portalEl ? (
      createPortal(
        <ul
          ref={listRef}
          id={listboxId}
          role="listbox"
          style={menuStyle}
          className={cn(
            "border-sidebar-border bg-surface-container-lowest overflow-y-auto overscroll-y-contain rounded-xl border py-1 shadow-lg",
            POS_SURFACE_Z_CLASS,
          )}
        >
          {showClearClientOption ? (
            <li role="option">
              <button
                type="button"
                className="text-on-surface-variant hover:bg-surface-container-low w-full px-3 py-3 text-left text-sm sm:py-2.5"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => selectClient(null)}
              >
                {tr("— Aucun client —", "— بدون عميل —")}
              </button>
            </li>
          ) : null}
          {trimmedQuery.length > 0 &&
          trimmedQuery.length < MIN_SEARCH_CHARS ? (
            <li className="text-on-surface-variant px-3 py-3 text-center text-xs">
              {tr(
                "Tapez au moins 2 caractères…",
                "اكتب حرفين على الأقل…",
              )}
            </li>
          ) : searching ? (
            <li className="text-on-surface-variant px-3 py-3 text-center text-xs">
              {tr("Recherche…", "جاري البحث…")}
            </li>
          ) : suggestionClients.length === 0 ? (
            <li className="text-on-surface-variant px-3 py-3 text-center text-xs">
              {canSearch
                ? tr("Aucun client trouvé.", "لم يُعثر على عميل.")
                : tr(
                    "Clients récents — recherchez par nom ou téléphone.",
                    "عملاء حديثون — ابحث بالاسم أو الهاتف.",
                  )}
            </li>
          ) : (
            suggestionClients.map((client) => (
              <li
                key={client.id}
                role="option"
                aria-selected={client.id === selectedClientId}
              >
                <button
                  type="button"
                  className={cn(
                    "hover:bg-surface-container-low w-full px-3 py-3 text-left text-sm sm:py-2.5",
                    client.id === selectedClientId &&
                      "bg-primary/8 text-primary font-semibold",
                  )}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => selectClient(client.id, client)}
                >
                  {clientLabel(client)}
                </button>
              </li>
            ))
          )}
        </ul>,
        portalEl,
      )
    ) : null;

  const profileClients = useMemo(() => {
    const map = new Map<string, Client>();
    for (const client of suggestionClients) map.set(client.id, client);
    for (const client of recentClients) map.set(client.id, client);
    if (selectedClient) map.set(selectedClient.id, selectedClient);
    return [...map.values()];
  }, [recentClients, selectedClient, suggestionClients]);

  return (
    <>
      <div ref={rootRef} className="flex items-stretch gap-2">
        <div className="relative min-w-0 flex-1">
          <UserSearch
            className="text-outline pointer-events-none absolute top-1/2 left-3 z-10 size-[18px] -translate-y-1/2 stroke-[1.75]"
            aria-hidden
          />
          <input
            ref={inputRef}
            type="text"
            name="pos-client-search"
            role="combobox"
            aria-expanded={open}
            aria-controls={listboxId}
            aria-autocomplete="list"
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck={false}
            enterKeyHint="search"
            value={inputValue}
            placeholder={tr("Rechercher un client…", "ابحث عن عميل…")}
            onFocus={openPicker}
            onChange={(e) => {
              setOpen(true);
              setQuery(e.target.value);
            }}
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                setOpen(false);
                setQuery("");
                inputRef.current?.blur();
              }
              if (e.key === "Enter" && open && suggestionClients.length > 0) {
                e.preventDefault();
                const first = suggestionClients[0]!;
                selectClient(first.id, first);
              }
            }}
            className={cn(
              "focus:ring-primary/20 w-full rounded-xl border-none bg-surface-container-low pl-10 text-sm focus:ring-2 focus:outline-none",
              compact ? "py-2" : "py-3",
              showSelectedClient ? "truncate pr-12" : "pr-10",
              showCreditRequiredHint && "ring-2 ring-error/25",
            )}
          />
          {showSelectedClient ? (
            <button
              type="button"
              onClick={() => selectClient(null)}
              className="bg-surface-container-lowest text-on-surface-variant ring-outline/25 hover:bg-surface-container-low hover:text-on-surface absolute top-1/2 right-2 z-10 -translate-y-1/2 rounded-lg p-1.5 shadow-sm ring-1"
              aria-label={tr("Retirer le client", "إزالة العميل")}
            >
              <X className="size-4 stroke-[2]" aria-hidden />
            </button>
          ) : (
            <ChevronDown
              className="text-outline pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 stroke-[1.75]"
              aria-hidden
            />
          )}

          {listbox}
        </div>

        <Button
          type="button"
          variant="outline"
          size="icon"
          className={cn(
            "border-primary/30 bg-primary/10 text-primary hover:bg-primary/15 shrink-0 rounded-xl",
            compact ? "size-9" : "size-[46px]",
          )}
          aria-label={tr("Fiche client", "بطاقة العميل")}
          title={tr("Fiche client", "بطاقة العميل")}
          disabled={!selectedClient}
          onClick={() => setProfileOpen(true)}
        >
          <UserRound className="size-5 stroke-[1.75]" aria-hidden />
        </Button>

        <Button
          type="button"
          variant="outline"
          size="icon"
          className={cn(
            "border-secondary/30 bg-secondary-container/35 text-on-secondary-container hover:bg-secondary-container/55 shrink-0 rounded-xl",
            compact ? "size-9" : "size-[46px]",
          )}
          aria-label={tr("Ajouter un client", "إضافة عميل")}
          title={tr("Ajouter un client", "إضافة عميل")}
          onClick={() => setAddOpen(true)}
        >
          <Plus className="size-5 stroke-[1.75]" aria-hidden />
        </Button>
      </div>

      <PosClientProfileDialog
        client={selectedClient}
        clients={profileClients}
        open={profileOpen}
        onOpenChange={setProfileOpen}
        tr={tr}
      />

      <PosQuickAddClientDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        onCreated={(clientId) => {
          onClientChange(clientId);
          setAddOpen(false);
        }}
        tr={tr}
      />
    </>
  );
}
