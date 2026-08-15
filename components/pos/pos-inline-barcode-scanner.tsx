"use client";

import { useCallback } from "react";
import { useLocale } from "next-intl";

import { BarcodeCameraView } from "@/components/products/barcode-camera-view";
import { useBarcodeCamera } from "@/hooks/use-barcode-camera";
import { cn } from "@/lib/utils";

type PosInlineBarcodeScannerProps = {
  active: boolean;
  onScan: (value: string) => void;
  size?: "compact" | "fill" | "large";
  fillStretch?: boolean;
  className?: string;
};

export function PosInlineBarcodeScanner({
  active,
  onScan,
  size = "compact",
  fillStretch = false,
  className,
}: PosInlineBarcodeScannerProps) {
  const locale = useLocale();
  const isAr = locale === "ar";
  const tr = useCallback((fr: string, ar: string) => (isAr ? ar : fr), [isAr]);

  const {
    videoRef,
    scanning,
    cameraError,
    scanFeedback,
    scanState,
    cameraSupported,
    lastDetection,
    lastFormatLabel,
    devices,
    selectedDeviceId,
    setSelectedDeviceId,
    capabilities,
    torchOn,
    toggleTorch,
    zoom,
    changeZoom,
    focusAtClientPoint,
  } = useBarcodeCamera({
    active,
    onDetect: (value) => onScan(value),
    tr,
    closeOnDetect: false,
    // POS plays catalog “add” / “already in cart” itself — skip camera chirp.
    sound: false,
  });

  return (
    <BarcodeCameraView
      videoRef={videoRef}
      scanning={scanning}
      cameraError={cameraError}
      scanFeedback={scanFeedback}
      cameraSupported={cameraSupported}
      tr={tr}
      variant="inline"
      size={size}
      fillStretch={fillStretch}
      scanState={scanState}
      lastDetection={lastDetection}
      lastFormatLabel={lastFormatLabel}
      showControls={size !== "compact"}
      capabilities={capabilities}
      torchOn={torchOn}
      onToggleTorch={() => void toggleTorch()}
      zoom={zoom}
      onZoomChange={(v) => void changeZoom(v)}
      devices={devices}
      selectedDeviceId={selectedDeviceId}
      onSelectDevice={setSelectedDeviceId}
      onFocusTap={(x, y) => void focusAtClientPoint(x, y)}
      className={cn(
        size === "large" && "flex min-h-0 flex-1 items-center justify-center",
        size === "fill" && "w-full",
        className,
      )}
    />
  );
}
