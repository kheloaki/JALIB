"use client";

import type { RefObject } from "react";
import {
  CameraOff,
  Flashlight,
  FlashlightOff,
  Focus,
  ZoomIn,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import type { CameraDeviceOption } from "@/lib/barcode/camera-capabilities";
import type { TrackCapabilitiesSnapshot } from "@/lib/barcode/camera-capabilities";
import type { LastDetection } from "@/lib/barcode/scan-utils";
import { prefersReducedMotion } from "@/lib/barcode/scan-utils";
import { cn } from "@/lib/utils";

type BarcodeScannerOverlayProps = {
  videoRef: RefObject<HTMLVideoElement | null>;
  scanning: boolean;
  cameraError: string | null;
  scanFeedback: string | null;
  scanState: "idle" | "requesting" | "scanning" | "success" | "error";
  lastDetection: LastDetection | null;
  lastFormatLabel: string;
  tr: (fr: string, ar: string) => string;
  className?: string;
  showControls?: boolean;
  capabilities: TrackCapabilitiesSnapshot;
  torchOn: boolean;
  onToggleTorch?: () => void;
  zoom: number;
  onZoomChange?: (value: number) => void;
  devices: CameraDeviceOption[];
  selectedDeviceId: string | null;
  onSelectDevice?: (deviceId: string) => void;
  onFocusTap?: (clientX: number, clientY: number) => void;
};

export function BarcodeScannerOverlay({
  videoRef,
  scanning,
  cameraError,
  scanFeedback,
  scanState,
  lastDetection,
  lastFormatLabel,
  tr,
  className,
  showControls = true,
  capabilities,
  torchOn,
  onToggleTorch,
  zoom,
  onZoomChange,
  devices,
  selectedDeviceId,
  onSelectDevice,
  onFocusTap,
}: BarcodeScannerOverlayProps) {
  const reduceMotion = prefersReducedMotion();
  const canFocus = capabilities.pointsOfInterest || capabilities.focusMode;
  const showTorch = Boolean(capabilities.torch && onToggleTorch);
  const showZoom = Boolean(capabilities.zoom && onZoomChange);
  const showCameras = devices.length > 1 && Boolean(onSelectDevice);

  const statusText =
    scanFeedback ??
    (scanState === "success"
      ? tr("Code lu", "تم قراءة الرمز")
      : scanning
        ? tr("Recherche du code…", "جارٍ البحث عن الرمز…")
        : scanState === "requesting"
          ? tr("Autorisation caméra…", "طلب إذن الكاميرا…")
          : tr("Initialisation de la caméra…", "جاري تهيئة الكاميرا…"));

  return (
    <div
      className={cn(
        "bg-black relative isolate overflow-hidden rounded-2xl",
        className,
      )}
    >
      <video
        ref={videoRef}
        className="size-full object-cover"
        playsInline
        muted
        autoPlay
        aria-label={tr(
          "Aperçu caméra pour lecture du code",
          "معاينة الكاميرا لقراءة الرمز",
        )}
        onClick={(e) => {
          if (!canFocus || !onFocusTap) return;
          onFocusTap(e.clientX, e.clientY);
        }}
      />

      {scanning && !cameraError ? (
        <div className="pointer-events-none absolute inset-0" aria-hidden>
          <div className="absolute inset-[12%] rounded-2xl border border-white/50 shadow-[0_0_0_9999px_rgba(0,0,0,0.45)]" />
          <div className="absolute inset-[12%]">
            <span className="absolute top-0 left-0 h-7 w-7 border-t-[3px] border-l-[3px] border-emerald-400" />
            <span className="absolute top-0 right-0 h-7 w-7 border-t-[3px] border-r-[3px] border-emerald-400" />
            <span className="absolute bottom-0 left-0 h-7 w-7 border-b-[3px] border-l-[3px] border-emerald-400" />
            <span className="absolute right-0 bottom-0 h-7 w-7 border-r-[3px] border-b-[3px] border-emerald-400" />
          </div>
          {!reduceMotion ? (
            <div className="barcode-scan-line absolute inset-x-[14%] top-[12%] h-0.5 rounded-full bg-emerald-400/90 shadow-[0_0_12px_rgba(52,211,153,0.9)]" />
          ) : (
            <div className="absolute inset-x-[18%] top-1/2 h-0.5 -translate-y-1/2 rounded-full bg-emerald-400/70" />
          )}
        </div>
      ) : null}

      {scanning &&
      !cameraError &&
      lastDetection?.cornerPoints &&
      lastDetection.cornerPoints.length >= 4 ? (
        <DetectionBox
          sourceWidth={lastDetection.sourceWidth}
          sourceHeight={lastDetection.sourceHeight}
          points={lastDetection.cornerPoints}
          success={scanState === "success"}
        />
      ) : null}

      {scanning &&
      !cameraError &&
      !lastDetection?.cornerPoints?.length &&
      lastDetection?.boundingBox ? (
        <DetectionRect
          sourceWidth={lastDetection.sourceWidth}
          sourceHeight={lastDetection.sourceHeight}
          box={lastDetection.boundingBox}
          success={scanState === "success"}
        />
      ) : null}

      {!scanning && !cameraError ? (
        <div className="absolute inset-0 flex items-center justify-center bg-black/70 p-4 text-center text-sm font-medium text-white">
          {tr("Démarrage de la caméra…", "جاري تشغيل الكاميرا…")}
        </div>
      ) : null}

      {cameraError ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/85 p-4 text-center">
          <CameraOff className="size-10 text-white/70" aria-hidden />
          <p className="text-sm text-white">{cameraError}</p>
        </div>
      ) : null}

      {!cameraError ? (
        <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-3 pt-10">
          <p
            aria-live="polite"
            className={cn(
              "text-center text-xs font-semibold text-white",
              scanState === "success" && "text-emerald-300",
            )}
          >
            {statusText}
          </p>
          {lastDetection?.value ? (
            <p className="mt-1 text-center font-mono text-[11px] tracking-wide text-white/85 tabular-nums">
              {lastFormatLabel ? `${lastFormatLabel} · ` : null}
              {lastDetection.value}
            </p>
          ) : null}
          {canFocus ? (
            <p className="mt-1 flex items-center justify-center gap-1 text-[10px] text-white/55">
              <Focus className="size-3" aria-hidden />
              {tr("Appuyez pour focaliser", "اضغط للتركيز")}
            </p>
          ) : null}
        </div>
      ) : null}

      {showControls && !cameraError ? (
        <div className="absolute top-2 right-2 left-2 flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap gap-1.5">
            {showTorch ? (
              <Button
                type="button"
                size="sm"
                variant="secondary"
                className="h-8 bg-black/55 text-white hover:bg-black/70"
                onClick={onToggleTorch}
                aria-pressed={torchOn}
                aria-label={tr("Lampe torche", "الفلاش")}
              >
                {torchOn ? (
                  <Flashlight className="size-3.5" />
                ) : (
                  <FlashlightOff className="size-3.5" />
                )}
              </Button>
            ) : null}
            {showCameras ? (
              <>
                <label className="sr-only" htmlFor="barcode-camera-select">
                  {tr("Choisir la caméra", "اختر الكاميرا")}
                </label>
                <select
                  id="barcode-camera-select"
                  className="h-8 max-w-[10rem] rounded-md border-0 bg-black/55 px-2 text-[11px] text-white"
                  value={selectedDeviceId ?? ""}
                  onChange={(e) => onSelectDevice?.(e.target.value)}
                >
                  {devices.map((d) => (
                    <option key={d.deviceId} value={d.deviceId}>
                      {d.label}
                    </option>
                  ))}
                </select>
              </>
            ) : null}
          </div>
          {showZoom ? (
            <div className="flex items-center gap-1.5 rounded-md bg-black/55 px-2 py-1 text-white">
              <ZoomIn className="size-3.5 shrink-0" aria-hidden />
              <input
                type="range"
                min={capabilities.zoomMin}
                max={capabilities.zoomMax}
                step={capabilities.zoomStep || 0.1}
                value={zoom}
                onChange={(e) => onZoomChange?.(Number(e.target.value))}
                className="w-20 accent-emerald-400"
                aria-label={tr("Zoom", "تكبير")}
              />
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function DetectionBox({
  sourceWidth,
  sourceHeight,
  points,
  success,
}: {
  sourceWidth: number;
  sourceHeight: number;
  points: { x: number; y: number }[];
  success: boolean;
}) {
  const vw = sourceWidth || 1;
  const vh = sourceHeight || 1;
  const pts = points
    .map((p) => `${(p.x / vw) * 100}% ${(p.y / vh) * 100}%`)
    .join(", ");
  return (
    <div className="pointer-events-none absolute inset-0" aria-hidden>
      <div
        className={cn(
          "absolute inset-0 opacity-90",
          success ? "bg-emerald-400/15" : "bg-amber-300/15",
        )}
        style={{
          clipPath: `polygon(${pts})`,
          boxShadow: success
            ? "inset 0 0 0 2px rgb(52 211 153)"
            : "inset 0 0 0 2px rgb(252 211 77)",
        }}
      />
    </div>
  );
}

function DetectionRect({
  sourceWidth,
  sourceHeight,
  box,
  success,
}: {
  sourceWidth: number;
  sourceHeight: number;
  box: { x: number; y: number; width: number; height: number };
  success: boolean;
}) {
  const vw = sourceWidth || 1;
  const vh = sourceHeight || 1;
  return (
    <div
      className={cn(
        "pointer-events-none absolute rounded-md border-2",
        success ? "border-emerald-400" : "border-amber-300",
      )}
      style={{
        left: `${(box.x / vw) * 100}%`,
        top: `${(box.y / vh) * 100}%`,
        width: `${(box.width / vw) * 100}%`,
        height: `${(box.height / vh) * 100}%`,
      }}
      aria-hidden
    />
  );
}
