"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Camera, ImagePlus, Upload } from "lucide-react";
import { useLocale } from "next-intl";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ProductCatalogImage } from "@/components/products/product-catalog-image";
import { ProductPhotoCaptureDialog } from "@/components/products/product-photo-capture-dialog";
import { useToast } from "@/components/ui/toaster";
import {
  compressProductPhotoFile,
  formatImageBytes,
  resolveImageByteSize,
  type CompressedPhotoResult,
} from "@/lib/images/compress-product-photo";
import { PRODUCT_PLACEHOLDER_IMAGE } from "@/lib/products/product-placeholder";

const ACCEPT = "image/jpeg,image/png,image/webp,image/heic,image/heif";

type ProductPhotoFieldProps = {
  value: string | null;
  onChange: (dataUrl: string | null) => void;
  disabled?: boolean;
  /** Opens the camera capture dialog when the field appears (e.g. quick add from achats). */
  autoOpenCamera?: boolean;
};

export function ProductPhotoField({
  value,
  onChange,
  disabled,
  autoOpenCamera = false,
}: ProductPhotoFieldProps) {
  const locale = useLocale();
  const isAr = locale === "ar";
  const tr = useCallback(
    (fr: string, ar: string) => (isAr ? ar : fr),
    [isAr],
  );
  const toast = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const autoOpenedRef = useRef(false);
  const [busy, setBusy] = useState(false);
  const [captureOpen, setCaptureOpen] = useState(false);
  const [compressMeta, setCompressMeta] = useState<CompressedPhotoResult | null>(
    null,
  );
  const [storedSize, setStoredSize] = useState<{
    bytes: number;
    format: "webp" | "jpeg" | "png" | "other";
  } | null>(null);
  const [sizeLoading, setSizeLoading] = useState(false);

  useEffect(() => {
    if (!value) {
      setCompressMeta(null);
      setStoredSize(null);
      setSizeLoading(false);
      return;
    }
    // Drop stale compress meta when editing another / existing product image.
    if (compressMeta && compressMeta.dataUrl !== value) {
      setCompressMeta(null);
    }
    if (compressMeta && compressMeta.dataUrl === value) {
      setStoredSize(null);
      setSizeLoading(false);
      return;
    }
    let cancelled = false;
    setSizeLoading(true);
    void resolveImageByteSize(value).then((resolved) => {
      if (cancelled) return;
      setStoredSize(resolved);
      setSizeLoading(false);
    });
    return () => {
      cancelled = true;
    };
    // Intentionally depend on value only — compressMeta is synced above.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  const applyResult = useCallback(
    (result: CompressedPhotoResult) => {
      setCompressMeta(result);
      setStoredSize(null);
      onChange(result.dataUrl);
    },
    [onChange],
  );

  const handleFile = useCallback(
    async (file: File | null) => {
      if (!file || disabled) return;
      setBusy(true);
      try {
        const result = await compressProductPhotoFile(file);
        applyResult(result);
      } catch (e) {
        const msg =
          e instanceof Error
            ? e.message
            : tr("Import impossible.", "تعذر الاستيراد.");
        toast.error(tr("Photo", "الصورة"), msg);
      } finally {
        setBusy(false);
        if (fileInputRef.current) fileInputRef.current.value = "";
      }
    },
    [applyResult, disabled, toast, tr],
  );

  useEffect(() => {
    if (!autoOpenCamera) {
      autoOpenedRef.current = false;
      return;
    }
    if (value || disabled || autoOpenedRef.current) return;
    autoOpenedRef.current = true;
    setCaptureOpen(true);
  }, [autoOpenCamera, disabled, value]);

  const sizeBadge = useMemo(() => {
    if (compressMeta) {
      return {
        label: `${formatImageBytes(compressMeta.originalBytes)} → ${formatImageBytes(compressMeta.compressedBytes)}`,
        format: compressMeta.format,
        tinify: compressMeta.tinify,
      };
    }
    if (storedSize) {
      return {
        label: formatImageBytes(storedSize.bytes),
        format: storedSize.format,
        tinify: false,
      };
    }
    return null;
  }, [compressMeta, storedSize]);

  const formatSuffix =
    sizeBadge?.format === "webp"
      ? " · WebP"
      : sizeBadge?.format === "jpeg"
        ? " · JPEG"
        : sizeBadge?.format === "png"
          ? " · PNG"
          : "";

  return (
    <div className="space-y-3">
      <ProductPhotoCaptureDialog
        open={captureOpen}
        onOpenChange={setCaptureOpen}
        onCapture={applyResult}
      />

      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-on-surface text-xs font-bold tracking-wide uppercase">
          {tr("Photo du produit", "صورة المنتج")}
          <span className="text-on-surface-variant ml-1.5 font-semibold normal-case">
            ({tr("optionnel", "اختياري")})
          </span>
        </span>
        {sizeBadge ? (
          <span className="bg-surface-container-high text-on-surface rounded-full px-2.5 py-1 text-[10px] font-bold tabular-nums">
            {tr("Taille", "الحجم")}: {sizeBadge.label}
            {formatSuffix}
            {sizeBadge.tinify ? ` · ${tr("Tinify", "Tinify")}` : ""}
          </span>
        ) : sizeLoading && value ? (
          <span className="text-on-surface-variant text-[10px] font-bold">
            {tr("Taille…", "الحجم…")}
          </span>
        ) : null}
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept={ACCEPT}
        className="sr-only"
        tabIndex={-1}
        disabled={disabled || busy}
        onChange={(e) => void handleFile(e.target.files?.[0] ?? null)}
      />

      <div
        className={cn(
          "border-sidebar-border relative overflow-hidden rounded-2xl border-2 border-dashed transition-colors",
          value
            ? "border-primary/25 bg-surface-container-low"
            : "bg-surface-container-high/40 border-on-surface-variant/25",
          disabled && "opacity-60",
        )}
      >
        <div className="relative aspect-[4/3] w-full max-h-[min(52vh,22rem)] min-h-[11rem] sm:aspect-[3/2] sm:max-h-[18rem]">
          {value ? (
            <>
              <ProductCatalogImage
                src={value}
                alt={tr("Aperçu produit", "معاينة المنتج")}
                sizes="(max-width: 640px) 100vw, 28rem"
                className="transition-transform duration-500"
              />
              <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-linear-to-t from-black/55 to-transparent px-4 py-3 pt-12">
                <p className="text-[11px] font-medium text-white/95">
                  {busy
                    ? tr("Compression…", "جاري الضغط…")
                    : sizeBadge
                      ? `${tr("Taille", "الحجم")}: ${sizeBadge.label}${formatSuffix}`
                      : tr(
                          "Aperçu catalogue — compression auto WebP à l’import",
                          "معاينة الكتالوج — ضغط WebP تلقائي عند الرفع",
                        )}
                </p>
              </div>
            </>
          ) : (
            <div className="absolute inset-0">
              <ProductCatalogImage
                src={PRODUCT_PLACEHOLDER_IMAGE}
                alt={tr("Image produit par défaut", "صورة المنتج الافتراضية")}
                sizes="(max-width: 640px) 100vw, 28rem"
                className="opacity-55"
              />
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-[#faf6f1]/55 p-6 text-center backdrop-blur-[1px]">
                <div className="bg-primary/12 text-primary flex size-14 items-center justify-center rounded-2xl">
                  <ImagePlus className="size-7 stroke-[1.5]" aria-hidden />
                </div>
                <div>
                  <p className="text-on-surface text-sm font-bold">
                    {tr("Ajoutez une photo", "أضف صورة")}
                  </p>
                  <p className="text-on-surface-variant mx-auto mt-1 max-w-[18rem] text-xs leading-relaxed">
                    {tr(
                      "Compression Tinify → WebP automatique à l’upload (si clé configurée).",
                      "ضغط Tinify → WebP تلقائي عند الرفع (إذا وُجد المفتاح).",
                    )}
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {!disabled ? (
          <div className="border-sidebar-border bg-surface-container-low/90 grid gap-2 border-t p-3 sm:grid-cols-2">
            <Button
              type="button"
              variant="default"
              className="h-11 gap-2 rounded-xl font-bold shadow-sm"
              disabled={busy}
              onClick={() => setCaptureOpen(true)}
            >
              <Camera className="size-4 stroke-[1.75]" aria-hidden />
              {busy
                ? tr("Compression…", "جاري الضغط…")
                : value
                  ? tr("Reprendre", "إعادة التقاط")
                  : tr("Prendre une photo", "التقاط صورة")}
            </Button>
            <Button
              type="button"
              variant="outline"
              className="h-11 gap-2 rounded-xl font-bold"
              disabled={busy}
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className="size-4 stroke-[1.75]" aria-hidden />
              {value
                ? tr("Galerie", "المعرض")
                : tr("Choisir galerie", "اختر من المعرض")}
            </Button>
          </div>
        ) : null}
      </div>

      <p className="text-outline text-[11px] leading-relaxed">
        {tr(
          "À l’import, l’image est compressée (Tinify → WebP). La taille s’affiche à côté de la photo, y compris pour une image déjà enregistrée.",
          "عند الرفع تُضغط الصورة (Tinify → WebP). يظهر الحجم بجانب الصورة، حتى للصورة المحفوظة مسبقاً.",
        )}
      </p>
    </div>
  );
}
