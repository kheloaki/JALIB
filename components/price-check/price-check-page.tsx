"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useQuery } from "convex/react";
import { useLocale } from "next-intl";
import { ScanBarcode } from "lucide-react";

import { StoreLogo } from "@/components/brand/store-logo";
import { ProductCatalogImage } from "@/components/products/product-catalog-image";
import { BarcodeKeypadDialog } from "@/components/products/barcode-keypad-dialog";
import { Input } from "@/components/ui/input";
import { api } from "@/convex/_generated/api";
import { STORE_NAME, STORE_NAME_AR } from "@/lib/brand/constants";
import { formatMad } from "@/lib/money/mad";
import { normalizeBarcodeInput } from "@/lib/pos/catalog-lookup";
import { cn } from "@/lib/utils";

const RESULT_HOLD_MS = 12_000;

export function PriceCheckPage() {
  const locale = useLocale();
  const isAr = locale === "ar";
  const tr = useCallback((fr: string, ar: string) => (isAr ? ar : fr), [isAr]);
  const storeName = isAr ? STORE_NAME_AR : STORE_NAME;

  const [lookupCode, setLookupCode] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [keypadOpen, setKeypadOpen] = useState(false);
  const clearTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const product = useQuery(
    api.products.publicPriceByBarcode,
    lookupCode ? { barcode: lookupCode } : "skip",
  );

  const focusScanner = useCallback(() => {
    const el = inputRef.current;
    if (!el) return;
    el.focus({ preventScroll: true });
    el.select();
  }, []);

  const scheduleClear = useCallback(() => {
    if (clearTimerRef.current) clearTimeout(clearTimerRef.current);
    clearTimerRef.current = setTimeout(() => {
      setLookupCode(null);
      setDraft("");
      focusScanner();
    }, RESULT_HOLD_MS);
  }, [focusScanner]);

  useEffect(() => {
    focusScanner();
    const onFocus = () => focusScanner();
    const onVisibility = () => {
      if (document.visibilityState === "visible") focusScanner();
    };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisibility);
      if (clearTimerRef.current) clearTimeout(clearTimerRef.current);
    };
  }, [focusScanner]);

  const submitCode = useCallback(
    (raw: string) => {
      const key = normalizeBarcodeInput(raw);
      if (!key) return;
      setLookupCode(key);
      setDraft("");
      scheduleClear();
      // Keep focus ready for the next hardware scan.
      requestAnimationFrame(() => focusScanner());
    },
    [focusScanner, scheduleClear],
  );

  const onSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      submitCode(draft);
    },
    [draft, submitCode],
  );

  const isLoading = lookupCode != null && product === undefined;
  const notFound = lookupCode != null && product === null;

  return (
    <div
      className="from-surface via-surface-container-low to-surface-container min-h-dvh bg-gradient-to-b px-4 py-6 sm:px-8"
      onPointerDown={() => focusScanner()}
    >
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-8">
        <header className="flex flex-col items-center gap-3 text-center">
          <StoreLogo
            variant="full"
            size="lg"
            priority
            className="mx-auto max-w-[220px]"
          />
          <div>
            <p className="text-on-surface text-2xl font-bold tracking-tight sm:text-3xl">
              {storeName}
            </p>
            <h1 className="text-on-surface-variant mt-1 text-base font-medium sm:text-lg">
              {tr("Vérifier le prix", "تحقق من السعر")}
            </h1>
          </div>
          <div className="flex gap-2 text-sm">
            <Link
              href="/fr/prix"
              className={cn(
                "rounded-full px-3 py-1",
                !isAr
                  ? "bg-primary text-primary-foreground"
                  : "text-on-surface-variant bg-white/70",
              )}
            >
              FR
            </Link>
            <Link
              href="/ar/prix"
              className={cn(
                "rounded-full px-3 py-1",
                isAr
                  ? "bg-primary text-primary-foreground"
                  : "text-on-surface-variant bg-white/70",
              )}
            >
              AR
            </Link>
          </div>
        </header>

        <section className="rounded-[28px] bg-white px-5 py-8 text-center shadow-[0_12px_40px_rgba(61,43,31,0.08)] sm:px-8">
          <div className="text-primary mx-auto mb-4 flex size-16 items-center justify-center rounded-full bg-[rgba(61,43,31,0.08)]">
            <ScanBarcode className="size-8" aria-hidden />
          </div>
          <p className="text-on-surface text-xl font-bold sm:text-2xl">
            {tr("Scannez le produit", "امسح المنتج")}
          </p>
          <p className="text-on-surface-variant mt-2 text-sm sm:text-base">
            {tr(
              "Utilisez le lecteur de code-barres.",
              "استخدم قارئ الرمز الشريطي.",
            )}
          </p>

          {/* Hardware USB scanner OR tap field for on-screen keypad */}
          <form onSubmit={onSubmit} className="mx-auto mt-6 max-w-md">
            <Input
              ref={inputRef}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onClick={() => setKeypadOpen(true)}
              onBlur={() => {
                if (keypadOpen) return;
                window.setTimeout(() => focusScanner(), 0);
              }}
              inputMode="none"
              autoComplete="off"
              autoCorrect="off"
              spellCheck={false}
              autoFocus
              className="h-14 cursor-pointer text-center text-lg tracking-wider tabular-nums"
              placeholder={tr(
                "Scan USB ou appuyez pour le clavier…",
                "مسح USB أو اضغط للوحة الأرقام…",
              )}
              aria-label={tr("Code-barres", "الرمز الشريطي")}
            />
          </form>
        </section>

        <section
          className={cn(
            "min-h-[14rem] rounded-[28px] bg-white p-6 shadow-[0_12px_40px_rgba(61,43,31,0.08)] sm:p-8",
            !lookupCode && "opacity-80",
          )}
          aria-live="polite"
        >
          {!lookupCode ? (
            <p className="text-on-surface-variant py-10 text-center text-base">
              {tr(
                "Le prix s’affichera ici après le scan.",
                "سيظهر السعر هنا بعد المسح.",
              )}
            </p>
          ) : isLoading ? (
            <p className="text-on-surface-variant py-10 text-center text-base">
              {tr("Recherche…", "جاري البحث…")}
            </p>
          ) : notFound ? (
            <div className="py-8 text-center">
              <p className="text-on-surface text-xl font-semibold">
                {tr("Produit introuvable", "المنتج غير موجود")}
              </p>
              <p className="text-on-surface-variant mt-2 text-sm tabular-nums">
                {lookupCode}
              </p>
            </div>
          ) : product ? (
            <div className="flex flex-col items-center gap-5 sm:flex-row sm:items-center sm:gap-8">
              <ProductCatalogImage
                src={product.image}
                alt={product.imageAlt || product.name}
                fit="contain"
                wrapperClassName="bg-surface-container-low size-36 shrink-0 rounded-2xl sm:size-44"
                sizes="176px"
                priority
              />
              <div className="min-w-0 flex-1 text-center sm:text-start">
                {product.brandName ? (
                  <p className="text-on-surface-variant text-sm font-medium">
                    {product.brandName}
                  </p>
                ) : null}
                <p className="text-on-surface mt-0.5 text-2xl font-bold leading-snug sm:text-3xl">
                  {product.name}
                </p>
                <p className="text-primary mt-4 text-5xl font-extrabold tracking-tight tabular-nums sm:text-6xl">
                  {formatMad(product.price, 2, locale)}
                  {product.soldByWeight ? tr(" / kg", " / كغ") : null}
                </p>
                {product.barcode ? (
                  <p className="text-on-surface-variant mt-3 text-sm tabular-nums">
                    {product.barcode}
                  </p>
                ) : null}
              </div>
            </div>
          ) : null}
        </section>

        <p className="text-on-surface-variant pb-4 text-center text-xs">
          {tr(
            "Prix indicatif — le prix en caisse fait foi.",
            "السعر إرشادي — السعر في الصندوق هو المعتمد.",
          )}
        </p>
      </div>

      <BarcodeKeypadDialog
        open={keypadOpen}
        onOpenChange={(open) => {
          setKeypadOpen(open);
          if (!open) requestAnimationFrame(() => focusScanner());
        }}
        initialValue={draft}
        tr={tr}
        onConfirm={(code) => {
          setDraft(code);
          submitCode(code);
        }}
      />
    </div>
  );
}
