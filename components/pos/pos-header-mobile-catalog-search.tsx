"use client";

import { useEffect, useRef } from "react";
import { Search, X } from "lucide-react";
import { useLocale } from "next-intl";

import { useAdminChrome } from "@/components/layout/admin-chrome-context";
import { usePosBarcodeScan } from "@/components/pos/pos-barcode-scan-context";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type PosHeaderMobileCatalogSearchProps = {
  placeholder: string;
};

export function PosHeaderMobileCatalogSearch({
  placeholder,
}: PosHeaderMobileCatalogSearchProps) {
  const locale = useLocale();
  const isAr = locale === "ar";
  const inputRef = useRef<HTMLInputElement>(null);
  const { headerSearchQuery, setHeaderSearchQuery } = useAdminChrome();
  const { mobileCatalogOpen, openMobileCatalog, closeMobileCatalog } =
    usePosBarcodeScan();

  useEffect(() => {
    if (!mobileCatalogOpen) return;
    const id = window.requestAnimationFrame(() => inputRef.current?.focus());
    return () => window.cancelAnimationFrame(id);
  }, [mobileCatalogOpen]);

  function handleClose() {
    setHeaderSearchQuery("");
    closeMobileCatalog();
  }

  if (!mobileCatalogOpen) {
    return (
      <Button
        type="button"
        variant="outline"
        size="icon"
        onClick={openMobileCatalog}
        className="border-primary/20 text-primary bg-primary/5 hover:bg-primary/15 size-10 shrink-0 rounded-xl"
        aria-label={isAr ? "عرض المنتجات" : "Parcourir les produits"}
        title={isAr ? "عرض المنتجات" : "Parcourir les produits"}
      >
        <Search className="size-5 stroke-[1.75]" aria-hidden />
      </Button>
    );
  }

  return (
    <div className="flex min-w-0 flex-1 items-center gap-2">
      <div className="relative min-w-0 flex-1">
        <Search
          className="text-outline pointer-events-none absolute top-1/2 left-4 size-5 -translate-y-1/2 stroke-[1.75]"
          aria-hidden
        />
        <input
          ref={inputRef}
          type="search"
          value={headerSearchQuery}
          onChange={(e) => setHeaderSearchQuery(e.target.value)}
          placeholder={placeholder}
          className="text-on-surface focus:ring-primary/20 w-full rounded-xl border-none bg-surface-container-low py-2.5 pr-4 pl-12 text-sm focus:ring-2"
          aria-label={placeholder}
        />
      </div>
      <Button
        type="button"
        variant="outline"
        size="icon"
        onClick={handleClose}
        className={cn(
          "size-10 shrink-0 rounded-xl",
          "border-primary/20 text-primary bg-primary/5 hover:bg-primary/15",
        )}
        aria-label={isAr ? "العودة إلى الصندوق" : "Retour à la caisse"}
        title={isAr ? "العودة إلى الصندوق" : "Retour à la caisse"}
      >
        <X className="size-5 stroke-[1.75]" aria-hidden />
      </Button>
    </div>
  );
}
