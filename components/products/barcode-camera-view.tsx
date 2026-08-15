"use client";

import type { RefObject } from "react";

import { BarcodeScannerOverlay } from "@/components/products/barcode-scanner-overlay";
import { POS_MOBILE_SCAN_SQUARE_SIZE } from "@/components/pos/constants";
import type { CameraDeviceOption } from "@/lib/barcode/camera-capabilities";
import type { TrackCapabilitiesSnapshot } from "@/lib/barcode/camera-capabilities";
import type { LastDetection } from "@/lib/barcode/scan-utils";
import { cn } from "@/lib/utils";

const EMPTY_CAPS: TrackCapabilitiesSnapshot = {
  torch: false,
  zoom: false,
  zoomMin: 1,
  zoomMax: 1,
  zoomStep: 0.1,
  focusMode: false,
  pointsOfInterest: false,
};

type BarcodeCameraViewProps = {
  videoRef: RefObject<HTMLVideoElement | null>;
  scanning: boolean;
  cameraError: string | null;
  scanFeedback: string | null;
  cameraSupported: boolean;
  tr: (fr: string, ar: string) => string;
  variant?: "dialog" | "inline";
  size?: "compact" | "fill" | "large";
  fillStretch?: boolean;
  className?: string;
  scanState?: "idle" | "requesting" | "scanning" | "success" | "error";
  lastDetection?: LastDetection | null;
  lastFormatLabel?: string;
  showControls?: boolean;
  capabilities?: TrackCapabilitiesSnapshot;
  torchOn?: boolean;
  onToggleTorch?: () => void;
  zoom?: number;
  onZoomChange?: (value: number) => void;
  devices?: CameraDeviceOption[];
  selectedDeviceId?: string | null;
  onSelectDevice?: (deviceId: string) => void;
  onFocusTap?: (clientX: number, clientY: number) => void;
};

export function BarcodeCameraView({
  videoRef,
  scanning,
  cameraError,
  scanFeedback,
  cameraSupported,
  tr,
  variant = "dialog",
  size = "compact",
  fillStretch = false,
  className,
  scanState = scanning ? "scanning" : "requesting",
  lastDetection = null,
  lastFormatLabel = "",
  showControls = variant === "dialog",
  capabilities = EMPTY_CAPS,
  torchOn = false,
  onToggleTorch,
  zoom = 1,
  onZoomChange,
  devices = [],
  selectedDeviceId = null,
  onSelectDevice,
  onFocusTap,
}: BarcodeCameraViewProps) {
  const isInline = variant === "inline";
  const isFillInline = isInline && size === "fill";
  const isLargeInline = isInline && size === "large";
  const isDynamicInline = isFillInline || isLargeInline;

  if (!cameraSupported) {
    return (
      <p className="text-on-surface-variant text-center text-xs">
        {tr(
          "Caméra non disponible sur ce navigateur.",
          "الكاميرا غير متاحة على هذا المتصفح.",
        )}
      </p>
    );
  }

  const overlay = (
    <BarcodeScannerOverlay
      videoRef={videoRef}
      scanning={scanning}
      cameraError={cameraError}
      scanFeedback={scanFeedback}
      scanState={scanState}
      lastDetection={lastDetection}
      lastFormatLabel={lastFormatLabel}
      tr={tr}
      showControls={showControls}
      capabilities={capabilities}
      torchOn={torchOn}
      onToggleTorch={onToggleTorch}
      zoom={zoom}
      onZoomChange={onZoomChange}
      devices={devices}
      selectedDeviceId={selectedDeviceId}
      onSelectDevice={onSelectDevice}
      onFocusTap={onFocusTap}
      className={cn(
        "size-full",
        !isDynamicInline && isInline && "rounded-xl",
        !isInline && "rounded-xl",
      )}
    />
  );

  return (
    <div
      className={cn(
        "flex min-h-0 w-full flex-col",
        isFillInline && fillStretch && "min-h-0 flex-1",
        isFillInline && !fillStretch && "w-full shrink-0",
        isLargeInline && "h-full flex-1 items-center justify-center gap-1",
        !isFillInline && !isLargeInline && "gap-1",
        className,
      )}
    >
      {isFillInline ? (
        fillStretch ? (
          <div className="flex h-full min-h-0 w-full flex-1 flex-col">
            <div className="relative min-h-0 w-full flex-1 overflow-hidden">
              {overlay}
            </div>
          </div>
        ) : (
          <div className="relative aspect-square w-full shrink-0 overflow-hidden">
            {overlay}
          </div>
        )
      ) : (
        <div
          className={cn(
            "relative overflow-hidden",
            isLargeInline &&
              "aspect-square mx-auto h-auto max-h-full w-full max-w-full",
            isInline &&
              !isDynamicInline &&
              "mx-auto aspect-square max-w-full",
            !isInline && "aspect-4/3 min-h-[10rem] w-full",
          )}
          style={
            isInline && !isDynamicInline
              ? {
                  width: POS_MOBILE_SCAN_SQUARE_SIZE,
                  height: POS_MOBILE_SCAN_SQUARE_SIZE,
                }
              : undefined
          }
        >
          {overlay}
        </div>
      )}
    </div>
  );
}
