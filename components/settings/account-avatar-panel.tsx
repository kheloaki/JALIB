"use client";

import { useCallback, useRef, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { Camera, Trash2, Upload, UserRound } from "lucide-react";

import { ProductPhotoCaptureDialog } from "@/components/products/product-photo-capture-dialog";
import { UserAvatarImage } from "@/components/users/user-avatar-image";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toaster";
import { api } from "@/convex/_generated/api";
import { compressProductPhotoFile, formatImageBytes } from "@/lib/images/compress-product-photo";
import { hasCustomUserAvatar } from "@/lib/users/user-avatar";

const ACCEPT = "image/jpeg,image/png,image/webp,image/heic,image/heif";

export function AccountAvatarPanel({
  tr,
}: {
  tr: (fr: string, ar: string) => string;
}) {
  const toast = useToast();
  const currentUser = useQuery(api.authz.currentUser);
  const updateOwnAvatar = useMutation(api.profile.updateOwnAvatar);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [captureOpen, setCaptureOpen] = useState(false);
  const [lastSizeLabel, setLastSizeLabel] = useState<string | null>(null);

  const saveAvatar = useCallback(
    async (image: string | null) => {
      setBusy(true);
      try {
        await updateOwnAvatar({ image });
        toast.success(
          tr("Photo de profil mise à jour", "تم تحديث صورة الملف الشخصي"),
          tr(
            "Votre avatar est visible dans le menu.",
            "تظهر صورتك في القائمة.",
          ),
        );
      } catch (error) {
        toast.error(
          tr("Mise à jour impossible", "تعذر التحديث"),
          error instanceof Error
            ? error.message
            : tr("Réessayez.", "حاول مجددًا."),
        );
      } finally {
        setBusy(false);
      }
    },
    [toast, tr, updateOwnAvatar],
  );

  const handleFile = useCallback(
    async (file: File | null) => {
      if (!file || busy) return;
      setBusy(true);
      try {
        const result = await compressProductPhotoFile(file, { maxEdge: 512 });
        setLastSizeLabel(
          `${formatImageBytes(result.originalBytes)} → ${formatImageBytes(result.compressedBytes)}${result.tinify ? " · WebP" : ""}`,
        );
        await saveAvatar(result.dataUrl);
      } catch (error) {
        toast.error(
          tr("Photo", "الصورة"),
          error instanceof Error
            ? error.message
            : tr("Import impossible.", "تعذر الاستيراد."),
        );
      } finally {
        setBusy(false);
        if (fileInputRef.current) fileInputRef.current.value = "";
      }
    },
    [busy, saveAvatar, toast, tr],
  );

  async function handleCapture(result: {
    dataUrl: string;
    originalBytes: number;
    compressedBytes: number;
    tinify: boolean;
  }) {
    setCaptureOpen(false);
    setLastSizeLabel(
      `${formatImageBytes(result.originalBytes)} → ${formatImageBytes(result.compressedBytes)}${result.tinify ? " · WebP" : ""}`,
    );
    await saveAvatar(result.dataUrl);
  }

  async function handleRemove() {
    await saveAvatar(null);
  }

  return (
    <section className="border-sidebar-border bg-surface-container-lowest flex flex-col gap-5 rounded-2xl border p-5 shadow-sm sm:p-6">
        <ProductPhotoCaptureDialog
          open={captureOpen}
          onOpenChange={setCaptureOpen}
          onCapture={(result) => void handleCapture(result)}
        />

        <div className="flex items-start gap-3">
          <div className="bg-primary/10 text-primary flex size-10 shrink-0 items-center justify-center rounded-xl">
            <UserRound className="size-5 stroke-[1.75]" aria-hidden />
          </div>
          <div>
            <h2 className="text-lg font-black tracking-tight">
              {tr("Photo de profil", "صورة الملف الشخصي")}
            </h2>
            <p className="text-on-surface-variant mt-1 text-sm">
              {tr(
                "Cette photo s'affiche dans le menu latéral.",
                "تظهر هذه الصورة في القائمة الجانبية.",
              )}
            </p>
            {lastSizeLabel ? (
              <p className="text-on-surface-variant mt-1 text-xs font-bold tabular-nums">
                {lastSizeLabel}
              </p>
            ) : null}
          </div>
        </div>

        <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-center">
          <div className="size-24 shrink-0 overflow-hidden rounded-full ring-2 ring-black/5">
            <UserAvatarImage
              image={currentUser?.image}
              alt={currentUser?.name ?? tr("Profil", "الملف الشخصي")}
              size={96}
              className="size-24"
              priority
            />
          </div>

          <div className="min-w-0 flex-1 text-center sm:text-start">
            <p className="text-on-surface truncate text-base font-bold">
              {currentUser?.name ?? tr("Utilisateur", "مستخدم")}
            </p>
            {currentUser?.email ? (
              <p className="text-muted-foreground truncate text-sm">
                {currentUser.email}
              </p>
            ) : null}
          </div>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept={ACCEPT}
          className="sr-only"
          tabIndex={-1}
          disabled={busy}
          onChange={(event) => void handleFile(event.target.files?.[0] ?? null)}
        />

        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            className="h-11 gap-2 rounded-xl font-bold"
            disabled={busy}
            onClick={() => setCaptureOpen(true)}
          >
            <Camera className="size-4 stroke-[1.75]" aria-hidden />
            {busy
              ? tr("Traitement…", "جاري المعالجة…")
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
            {tr("Choisir une photo", "اختر صورة")}
          </Button>
          {hasCustomUserAvatar(currentUser?.image) ? (
            <Button
              type="button"
              variant="outline"
              className="text-destructive hover:text-destructive h-11 gap-2 rounded-xl font-bold"
              disabled={busy}
              onClick={() => void handleRemove()}
            >
              <Trash2 className="size-4 stroke-[1.75]" aria-hidden />
              {tr("Supprimer", "حذف")}
            </Button>
          ) : null}
        </div>
    </section>
  );
}
