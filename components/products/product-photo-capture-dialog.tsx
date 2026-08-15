"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Camera, CameraOff } from "lucide-react";
import { useLocale } from "next-intl";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { compressProductPhotoFile, type CompressedPhotoResult } from "@/lib/images/compress-product-photo";

type CameraErrorMessages = {
  insecureContext: string;
  generic: string;
  notAllowed: string;
  notFound: string;
  notReadable: string;
};

function cameraErrorMessage(
  error: unknown,
  messages: CameraErrorMessages,
): string {
  if (typeof window !== "undefined" && !window.isSecureContext) {
    return messages.insecureContext;
  }
  if (!error || typeof error !== "object") {
    return messages.generic;
  }
  const name = (error as { name?: string }).name;
  if (name === "NotAllowedError" || name === "SecurityError") {
    return messages.notAllowed;
  }
  if (name === "NotFoundError" || name === "OverconstrainedError") {
    return messages.notFound;
  }
  if (name === "NotReadableError" || name === "AbortError") {
    return messages.notReadable;
  }
  return messages.generic;
}

async function requestCameraStream(): Promise<MediaStream> {
  if (!window.isSecureContext) {
    throw new Error("InsecureContext");
  }
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new Error("MediaDevicesUnavailable");
  }
  const attempts: MediaStreamConstraints[] = [
    {
      video: {
        facingMode: { ideal: "environment" },
        width: { ideal: 1280 },
        height: { ideal: 720 },
      },
      audio: false,
    },
    { video: { facingMode: "environment" }, audio: false },
    { video: { facingMode: "user" }, audio: false },
    { video: true, audio: false },
  ];
  let lastErr: unknown = null;
  for (const constraints of attempts) {
    try {
      return await navigator.mediaDevices.getUserMedia(constraints);
    } catch (err) {
      lastErr = err;
    }
  }
  throw lastErr ?? new Error("CameraUnavailable");
}

type ProductPhotoCaptureDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCapture: (result: CompressedPhotoResult) => void;
};

export function ProductPhotoCaptureDialog({
  open,
  onOpenChange,
  onCapture,
}: ProductPhotoCaptureDialogProps) {
  const locale = useLocale();
  const isAr = locale === "ar";
  const tr = useCallback(
    (fr: string, ar: string) => (isAr ? ar : fr),
    [isAr],
  );

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [capturing, setCapturing] = useState(false);

  const cameraSupported =
    typeof navigator !== "undefined" &&
    Boolean(navigator.mediaDevices?.getUserMedia);

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    const el = videoRef.current;
    if (el) el.srcObject = null;
    setReady(false);
  }, []);

  useEffect(() => {
    if (!open) {
      stopCamera();
      setCameraError(null);
      setCapturing(false);
      return;
    }

    if (!cameraSupported) return;

    let cancelled = false;
    const startTimer = window.setTimeout(() => {
      const video = videoRef.current;
      if (!video || cancelled) return;

      void (async () => {
        const cameraMessages: CameraErrorMessages = {
          insecureContext: tr(
            "La caméra nécessite HTTPS ou localhost.",
            "الكاميرا تتطلب HTTPS أو localhost.",
          ),
          generic: tr(
            "Impossible d’accéder à la caméra.",
            "تعذر الوصول إلى الكاميرا.",
          ),
          notAllowed: tr(
            "Autorisez l’accès à la caméra dans les réglages du navigateur.",
            "اسمح بالوصول إلى الكاميرا من إعدادات المتصفح.",
          ),
          notFound: tr(
            "Aucune caméra détectée sur cet appareil.",
            "لم يتم العثور على كاميرا على هذا الجهاز.",
          ),
          notReadable: tr(
            "Caméra utilisée par une autre application. Fermez-la et réessayez.",
            "الكاميرا قيد الاستخدام من تطبيق آخر. أغلقه ثم حاول مجددًا.",
          ),
        };

        setCameraError(null);
        setReady(false);
        try {
          const stream = await requestCameraStream();
          if (cancelled) {
            stream.getTracks().forEach((t) => t.stop());
            return;
          }
          streamRef.current = stream;
          video.srcObject = stream;
          video.setAttribute("playsinline", "true");
          try {
            await video.play();
          } catch {
            // autoplay rejection is fine
          }
          setReady(true);
        } catch (error) {
          setCameraError(cameraErrorMessage(error, cameraMessages));
        }
      })();
    }, 0);

    return () => {
      cancelled = true;
      window.clearTimeout(startTimer);
      stopCamera();
    };
  }, [cameraSupported, open, stopCamera, tr]);

  async function handleCapture() {
    const video = videoRef.current;
    if (!video || !ready || capturing) return;

    const w = video.videoWidth;
    const h = video.videoHeight;
    if (w <= 0 || h <= 0) return;

    setCapturing(true);
    try {
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error(tr("Capture impossible.", "تعذر الالتقاط."));
      ctx.drawImage(video, 0, 0, w, h);

      const blob = await new Promise<Blob | null>((resolve) => {
        canvas.toBlob(resolve, "image/jpeg", 0.92);
      });
      if (!blob) throw new Error(tr("Capture impossible.", "تعذر الالتقاط."));

      const file = new File([blob], "product-photo.jpg", { type: "image/jpeg" });
      const result = await compressProductPhotoFile(file);
      onCapture(result);
      onOpenChange(false);
    } catch (error) {
      setCameraError(
        error instanceof Error
          ? error.message
          : tr("Capture impossible.", "تعذر الالتقاط."),
      );
    } finally {
      setCapturing(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton
        className="border-sidebar-border bg-surface-container-lowest text-on-surface sm:max-w-md"
      >
        <DialogHeader>
          <DialogTitle className="text-on-surface text-xl font-black">
            {tr("Photo du produit", "صورة المنتج")}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-1">
          {cameraSupported ? (
            <div className="bg-surface-container-high relative aspect-4/3 w-full overflow-hidden rounded-xl">
              <video
                ref={videoRef}
                className="size-full object-cover"
                playsInline
                muted
                autoPlay
                aria-label={tr(
                  "Aperçu caméra pour photo produit",
                  "معاينة الكاميرا لصورة المنتج",
                )}
              />
              {ready && !cameraError ? (
                <div className="pointer-events-none absolute inset-0">
                  <div className="absolute inset-4 rounded-2xl border border-white/45 shadow-[0_0_0_9999px_rgba(0,0,0,0.18)]" />
                </div>
              ) : null}
              {!ready && !cameraError ? (
                <div className="bg-surface/80 text-on-surface-variant absolute inset-0 flex items-center justify-center text-sm font-medium">
                  {tr("Démarrage de la caméra…", "جاري تشغيل الكاميرا…")}
                </div>
              ) : null}
              {cameraError ? (
                <div className="bg-surface/90 absolute inset-0 flex flex-col items-center justify-center gap-2 p-4 text-center">
                  <CameraOff
                    className="text-on-surface-variant size-10 stroke-[1.5]"
                    aria-hidden
                  />
                  <p className="text-on-surface text-sm">{cameraError}</p>
                </div>
              ) : null}
            </div>
          ) : (
            <p className="text-on-surface-variant text-sm">
              {tr(
                "Ce navigateur ne permet pas la prise de photo. Utilisez la galerie.",
                "هذا المتصفح لا يدعم التقاط الصور. استخدم المعرض.",
              )}
            </p>
          )}

          {cameraSupported && ready && !cameraError ? (
            <p className="text-on-surface-variant text-center text-xs">
              {tr(
                "Cadrez le produit au centre, puis appuyez sur Capturer.",
                "ضع المنتج في الوسط ثم اضغط التقاط.",
              )}
            </p>
          ) : null}
        </div>

        <DialogFooter className="gap-2 sm:gap-2">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            {tr("Annuler", "إلغاء")}
          </Button>
          <Button
            type="button"
            className="gap-2 font-bold"
            disabled={!ready || Boolean(cameraError) || capturing}
            onClick={() => void handleCapture()}
          >
            <Camera className="size-4 stroke-[1.75]" aria-hidden />
            {capturing
              ? tr("Traitement…", "جاري المعالجة...")
              : tr("Capturer", "التقاط")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
