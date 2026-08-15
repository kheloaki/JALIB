"use client";

import { useEffect, useState } from "react";
import { ScanBarcode } from "lucide-react";
import { useLocale } from "next-intl";

import { usePosBarcodeScan } from "@/components/pos/pos-barcode-scan-context";
import type { Product } from "@/components/pos/types";
import { BarcodeKeypadDialog } from "@/components/products/barcode-keypad-dialog";
import { BarcodeScanDialog } from "@/components/products/barcode-scan-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useIsMobile } from "@/hooks/use-mobile";
import { findProductByBarcode } from "@/lib/pos/catalog-lookup";
import { cn } from "@/lib/utils";

type PosHeaderBarcodeProps = {
  products: Product[];
  onBarcodeScan: (raw: string) => void;
};

export function PosHeaderBarcode({
  products,
  onBarcodeScan,
}: PosHeaderBarcodeProps) {
  const locale = useLocale();
  const isAr = locale === "ar";
  const tr = (fr: string, ar: string) => (isAr ? ar : fr);
  const isMobile = useIsMobile();
  const { mobileInlineScanOpen, toggleMobileInlineScan, setMobileInlineScanOpen } =
    usePosBarcodeScan();
  const [expanded, setExpanded] = useState(false);
  const [value, setValue] = useState("");
  const [scanOpen, setScanOpen] = useState(false);
  const [keypadOpen, setKeypadOpen] = useState(false);

  const matched = value.trim()
    ? findProductByBarcode(products, value)
    : undefined;

  function openBarcodeEntry() {
    if (isMobile) {
      toggleMobileInlineScan();
      return;
    }
    setExpanded(true);
  }

  function closeBarcodeEntry() {
    setExpanded(false);
    setScanOpen(false);
    setKeypadOpen(false);
    setValue("");
    setMobileInlineScanOpen(false);
  }

  useEffect(() => {
    if (isMobile && expanded) {
      setExpanded(false);
      setScanOpen(false);
      setKeypadOpen(false);
    }
  }, [expanded, isMobile]);

  function submitBarcode(raw: string) {
    const trimmed = raw.trim();
    if (!trimmed) return;
    onBarcodeScan(trimmed);
    setValue("");
  }

  useEffect(() => {
    if (!matched || !value.trim()) return;
    const timer = setTimeout(() => {
      submitBarcode(value);
    }, 80);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- submit when match appears
  }, [matched, value]);

  if (isMobile) {
    return (
      <Button
        type="button"
        variant="outline"
        size="icon"
        onClick={toggleMobileInlineScan}
        className={cn(
          "border-primary/20 text-primary bg-primary/5 hover:bg-primary/15 size-10 shrink-0 rounded-xl",
          mobileInlineScanOpen &&
            "border-primary bg-primary/15 ring-primary/30 ring-2",
        )}
        aria-label={
          mobileInlineScanOpen
            ? tr("Désactiver le scan caméra", "إيقاف المسح بالكاميرا")
            : tr("Activer le scan caméra", "تفعيل المسح بالكاميرا")
        }
        title={
          mobileInlineScanOpen
            ? tr("Scan actif — appuyez pour arrêter", "المسح مفعّل — اضغط للإيقاف")
            : tr("Scan caméra", "المسح بالكاميرا")
        }
        aria-pressed={mobileInlineScanOpen}
      >
        <ScanBarcode className="size-5 stroke-[1.75]" aria-hidden />
      </Button>
    );
  }

  return (
    <>
      {!expanded ? (
        <Button
          type="button"
          variant="outline"
          size="icon"
          onClick={openBarcodeEntry}
          className="border-primary/20 text-primary bg-primary/5 hover:bg-primary/15 size-10 shrink-0 rounded-xl"
          aria-label={tr(
            "Code-barres (douchette active sans clic — caméra / saisie manuelle)",
            "الباركود (الماسح نشط بدون نقر — كاميرا / إدخال يدوي)",
          )}
          title={tr(
            "Douchette: scannez directement. Clic = caméra / clavier.",
            "الماسح: امسح مباشرة. النقر = كاميرا / لوحة مفاتيح.",
          )}
        >
          <ScanBarcode className="size-5 stroke-[1.75]" aria-hidden />
        </Button>
      ) : (
        <div className="flex min-w-0 shrink-0 items-center gap-1.5 sm:gap-2">
          <Input
            value={value}
            readOnly
            inputMode="none"
            onClick={() => setKeypadOpen(true)}
            placeholder={tr("Appuyez…", "اضغط…")}
            autoComplete="off"
            className={cn(
              "bg-surface-container-low border-transparent focus-visible:ring-primary/25 h-10 cursor-pointer rounded-xl font-mono text-sm tabular-nums",
              "w-[7.5rem] sm:w-36 md:w-44",
            )}
            aria-label={tr("Code-barres", "الباركود")}
          />
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="border-primary/20 text-primary bg-primary/5 hover:bg-primary/15 h-10 w-10 shrink-0 rounded-xl"
            aria-label={tr("Scanner avec la caméra", "المسح بالكاميرا")}
            title={tr("Scanner avec la caméra", "المسح بالكاميرا")}
            onClick={() => setScanOpen(true)}
          >
            <ScanBarcode className="size-5 stroke-[1.75]" aria-hidden />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="text-on-surface-variant hover:text-on-surface h-10 w-10 shrink-0 rounded-xl"
            aria-label={tr("Fermer le code-barres", "إغلاق الباركود")}
            onClick={closeBarcodeEntry}
          >
            <span className="text-lg leading-none" aria-hidden>
              ×
            </span>
          </Button>
        </div>
      )}
      <BarcodeKeypadDialog
        open={keypadOpen}
        onOpenChange={setKeypadOpen}
        initialValue={value}
        tr={tr}
        onConfirm={(code) => {
          setValue(code);
          submitBarcode(code);
        }}
      />
      <BarcodeScanDialog
        open={scanOpen}
        onOpenChange={setScanOpen}
        cameraSound={false}
        onScan={(raw) => {
          setScanOpen(false);
          submitBarcode(raw);
          if (!expanded) setExpanded(true);
        }}
      />
    </>
  );
}
