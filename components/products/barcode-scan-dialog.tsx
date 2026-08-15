"use client";

import { useCallback, useState } from "react";
import { useLocale } from "next-intl";

import { BarcodeCameraView } from "@/components/products/barcode-camera-view";
import { BarcodeKeypadDialog } from "@/components/products/barcode-keypad-dialog";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useBarcodeCamera } from "@/hooks/use-barcode-camera";

type BarcodeScanDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Called with the raw scanned / entered value (may include spaces). */
  onScan: (value: string) => void;
  /**
   * Camera chirp on detect. Disable on POS so add / already-in-cart
   * sounds come only from the cart handlers.
   */
  cameraSound?: boolean;
};

export function BarcodeScanDialog({
  open,
  onOpenChange,
  onScan,
  cameraSound = true,
}: BarcodeScanDialogProps) {
  const locale = useLocale();
  const isAr = locale === "ar";
  const tr = useCallback(
    (fr: string, ar: string) => (isAr ? ar : fr),
    [isAr],
  );

  const [manual, setManual] = useState("");
  const [keypadOpen, setKeypadOpen] = useState(false);

  const finish = useCallback(
    (value: string) => {
      const t = value.trim();
      if (!t) return;
      onScan(t);
      setManual("");
      setKeypadOpen(false);
      onOpenChange(false);
    },
    [onOpenChange, onScan],
  );

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
    active: open && !keypadOpen,
    closeOnDetect: true,
    onDetect: (value) => finish(value),
    tr,
    sound: cameraSound,
  });

  return (
    <>
      <Dialog
        open={open}
        onOpenChange={(next) => {
          if (!next) {
            setManual("");
            setKeypadOpen(false);
          }
          onOpenChange(next);
        }}
      >
        <DialogContent
          showCloseButton
          className="border-sidebar-border bg-surface-container-lowest text-on-surface sm:max-w-md"
        >
          <DialogHeader>
            <DialogTitle className="text-on-surface text-xl font-black">
              {tr("Code-barres / QR", "الباركود / رمز QR")}
            </DialogTitle>
            <DialogDescription className="text-on-surface-variant">
              {cameraSupported
                ? tr(
                    "Cadrez le code avec la caméra, ou touchez le champ pour le clavier numérique.",
                    "صوّب الكاميرا على الرمز، أو المس الحقل لفتح لوحة الأرقام.",
                  )
                : tr(
                    "Touchez le champ pour saisir le code sur le clavier numérique.",
                    "المس الحقل لإدخال الرمز عبر لوحة الأرقام.",
                  )}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-1">
            {cameraSupported ? (
              <BarcodeCameraView
                videoRef={videoRef}
                scanning={scanning}
                cameraError={cameraError}
                scanFeedback={scanFeedback}
                cameraSupported={cameraSupported}
                tr={tr}
                variant="dialog"
                scanState={scanState}
                lastDetection={lastDetection}
                lastFormatLabel={lastFormatLabel}
                showControls
                capabilities={capabilities}
                torchOn={torchOn}
                onToggleTorch={() => void toggleTorch()}
                zoom={zoom}
                onZoomChange={(v) => void changeZoom(v)}
                devices={devices}
                selectedDeviceId={selectedDeviceId}
                onSelectDevice={setSelectedDeviceId}
                onFocusTap={(x, y) => void focusAtClientPoint(x, y)}
              />
            ) : null}

            <div className="space-y-2">
              <label
                htmlFor="barcode-manual"
                className="text-on-surface text-xs font-bold tracking-wide uppercase"
              >
                {tr("Saisie numérique", "إدخال رقمي")}
              </label>
              <Input
                id="barcode-manual"
                value={manual}
                readOnly
                inputMode="none"
                onClick={() => setKeypadOpen(true)}
                placeholder={tr(
                  "Appuyez pour saisir le code…",
                  "اضغط لإدخال الرمز…",
                )}
                autoComplete="off"
                className="bg-surface-container-low border-transparent focus-visible:ring-primary/25 h-11 cursor-pointer rounded-xl font-mono tabular-nums"
              />
              <p className="text-on-surface-variant text-xs">
                {tr(
                  "Clavier à l’écran — Entrée sur le pavé pour valider.",
                  "لوحة أرقام على الشاشة — Enter للتأكيد.",
                )}
              </p>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              {tr("Fermer", "إغلاق")}
            </Button>
            <Button
              type="button"
              className="font-bold"
              onClick={() => finish(manual)}
              disabled={!manual.trim()}
            >
              {tr("Valider", "تأكيد")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <BarcodeKeypadDialog
        open={keypadOpen}
        onOpenChange={setKeypadOpen}
        initialValue={manual}
        tr={tr}
        onConfirm={(code) => {
          setManual(code);
          finish(code);
        }}
      />
    </>
  );
}
