"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { usePathname } from "next/navigation";

import type { Product } from "@/components/pos/types";
import type { Client } from "@/lib/clients/types";
import type { PosCartDraftView } from "@/lib/convex/pos-cart-draft";
import type { PosInvoiceReopenPayload } from "@/lib/pos/invoice-to-cart";

export type PosBarcodeRegistration = {
  products: Product[];
  onBarcodeScan: (raw: string) => void;
};

export type PosClientHistoryRegistration = {
  clients: Client[];
  returnPurchaseToCaisse?: (payload: PosInvoiceReopenPayload) => boolean;
};

export type PosCartActionsRegistration = {
  onClearCart: () => void;
};

export type PosDraftsRegistration = {
  drafts?: PosCartDraftView[];
  draftsLoading?: boolean;
  draftsBusy?: boolean;
  onRestoreDraft: (draftId: PosCartDraftView["id"]) => void;
  onDeleteDraft: (draftId: PosCartDraftView["id"]) => void;
};

export type PosToolbarRegistration = {
  onQuickAdd?: () => void;
  onMiscTotal?: () => void;
  barcode?: PosBarcodeRegistration;
  clientHistory?: PosClientHistoryRegistration;
  cartActions?: PosCartActionsRegistration;
  drafts?: PosDraftsRegistration;
} | null;

type AdminChromeContextValue = {
  headerSearchQuery: string;
  setHeaderSearchQuery: (q: string) => void;
  posToolbar: PosToolbarRegistration;
  registerPosToolbar: (opts: PosToolbarRegistration) => void;
  isPosFocusMode: boolean;
  enterPosFocusMode: () => void;
  exitPosFocusMode: () => void;
};

const AdminChromeContext = createContext<AdminChromeContextValue | null>(null);

export function AdminChromeProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [headerSearchQuery, setHeaderSearchQuery] = useState("");
  const [posToolbar, setPosToolbar] = useState<PosToolbarRegistration>(null);
  const [isPosFocusMode, setIsPosFocusMode] = useState(false);

  const isPosRoute = Boolean(pathname?.includes("/pos"));

  useEffect(() => {
    setHeaderSearchQuery("");
  }, [pathname]);

  useEffect(() => {
    if (!pathname?.includes("/pos")) {
      setPosToolbar(null);
      setIsPosFocusMode(false);
    }
  }, [pathname]);

  useEffect(() => {
    if (isPosRoute) {
      setIsPosFocusMode(true);
    }
  }, [isPosRoute]);

  const registerPosToolbar = useCallback((opts: PosToolbarRegistration) => {
    setPosToolbar(opts);
  }, []);

  const enterPosFocusMode = useCallback(() => {
    setIsPosFocusMode(true);
  }, []);

  const exitPosFocusMode = useCallback(() => {
    setIsPosFocusMode(false);
  }, []);

  const value = useMemo(
    () => ({
      headerSearchQuery,
      setHeaderSearchQuery,
      posToolbar,
      registerPosToolbar,
      isPosFocusMode: isPosRoute && isPosFocusMode,
      enterPosFocusMode,
      exitPosFocusMode,
    }),
    [
      headerSearchQuery,
      posToolbar,
      registerPosToolbar,
      isPosRoute,
      isPosFocusMode,
      enterPosFocusMode,
      exitPosFocusMode,
    ],
  );

  return (
    <AdminChromeContext.Provider value={value}>
      {children}
    </AdminChromeContext.Provider>
  );
}

export function useAdminChrome() {
  const ctx = useContext(AdminChromeContext);
  if (!ctx) {
    throw new Error("useAdminChrome must be used within AdminChromeProvider");
  }
  return ctx;
}

export function useRegisterPosAdminHeader(
  onQuickAdd?: () => void,
  barcode?: PosBarcodeRegistration,
  clientHistory?: PosClientHistoryRegistration,
  cartActions?: PosCartActionsRegistration,
  drafts?: PosDraftsRegistration,
  onMiscTotal?: () => void,
) {
  const { registerPosToolbar } = useAdminChrome();
  useEffect(() => {
    registerPosToolbar({
      onQuickAdd,
      onMiscTotal,
      barcode,
      clientHistory,
      cartActions,
      drafts,
    });
    return () => registerPosToolbar(null);
  }, [
    barcode,
    cartActions,
    clientHistory,
    drafts,
    onMiscTotal,
    onQuickAdd,
    registerPosToolbar,
  ]);
}
