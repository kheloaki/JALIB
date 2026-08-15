"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";

type PosBarcodeScanContextValue = {
  mobileInlineScanOpen: boolean;
  setMobileInlineScanOpen: (open: boolean) => void;
  toggleMobileInlineScan: () => void;
  mobileCatalogOpen: boolean;
  setMobileCatalogOpen: (open: boolean) => void;
  openMobileCatalog: () => void;
  closeMobileCatalog: () => void;
};

const PosBarcodeScanContext = createContext<PosBarcodeScanContextValue | null>(
  null,
);

export function PosBarcodeScanProvider({ children }: { children: ReactNode }) {
  const [mobileInlineScanOpen, setMobileInlineScanOpen] = useState(false);
  const [mobileCatalogOpen, setMobileCatalogOpen] = useState(false);

  const openMobileCatalog = useCallback(() => {
    setMobileInlineScanOpen(false);
    setMobileCatalogOpen(true);
  }, []);

  const closeMobileCatalog = useCallback(() => {
    setMobileCatalogOpen(false);
  }, []);

  const toggleMobileInlineScan = useCallback(() => {
    setMobileCatalogOpen(false);
    setMobileInlineScanOpen((prev) => !prev);
  }, []);

  const value = useMemo(
    () => ({
      mobileInlineScanOpen,
      setMobileInlineScanOpen,
      toggleMobileInlineScan,
      mobileCatalogOpen,
      setMobileCatalogOpen,
      openMobileCatalog,
      closeMobileCatalog,
    }),
    [
      mobileInlineScanOpen,
      toggleMobileInlineScan,
      mobileCatalogOpen,
      openMobileCatalog,
      closeMobileCatalog,
    ],
  );

  return (
    <PosBarcodeScanContext.Provider value={value}>
      {children}
    </PosBarcodeScanContext.Provider>
  );
}

export function usePosBarcodeScan() {
  const ctx = useContext(PosBarcodeScanContext);
  if (!ctx) {
    throw new Error("usePosBarcodeScan must be used within PosBarcodeScanProvider");
  }
  return ctx;
}

export function usePosBarcodeScanOptional() {
  return useContext(PosBarcodeScanContext);
}
