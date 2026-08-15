"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import {
  getVideoTrack,
  listVideoInputDevices,
  openCameraStream,
  pickPreferredDeviceId,
  readTrackCapabilities,
  focusAtNormalizedPoint,
  setTorch,
  setZoom,
  type CameraDeviceOption,
  type TrackCapabilitiesSnapshot,
} from "@/lib/barcode/camera-capabilities";
import {
  BARCODE_DETECT_VARIANTS,
  detectBarcodeWithVariants,
  paintBarcodeVideoVariant,
} from "@/lib/barcode/detect-with-variants";
import {
  createScanGate,
  noteScanAbsence,
  noteScanPresence,
  resetScanGate,
  type ScanGate,
} from "@/lib/barcode/scan-gate";
import { emitScanSuccessFeedback } from "@/lib/barcode/scan-feedback";
import {
  DEFAULT_SCAN_ENGINE_CONFIG,
  DETECT_FORMATS,
  cameraErrorMessage,
  formatBarcodeLabel,
  getBarcodeDetectorCtor,
  normalizeScannedValue,
  type CameraErrorMessages,
  type LastDetection,
  type ScanEngineConfig,
  validateScannedCandidate,
  zxingFormatToDetectorFormat,
} from "@/lib/barcode/scan-utils";

export type ScanUiState =
  | "idle"
  | "requesting"
  | "scanning"
  | "success"
  | "error";

type UseBarcodeCameraOptions = {
  active: boolean;
  onDetect: (value: string, meta?: { format?: string }) => void;
  tr: (fr: string, ar: string) => string;
  /** When false, keep camera running (POS continuous). Default true = single shot. */
  closeOnDetect?: boolean;
  config?: Partial<ScanEngineConfig>;
  sound?: boolean;
  vibrate?: boolean;
};

const EMPTY_CAPS: TrackCapabilitiesSnapshot = {
  torch: false,
  zoom: false,
  zoomMin: 1,
  zoomMax: 1,
  zoomStep: 0.1,
  focusMode: false,
  pointsOfInterest: false,
};

export function useBarcodeCamera({
  active,
  onDetect,
  tr,
  closeOnDetect = true,
  config: configOverride,
  sound = true,
  vibrate = true,
}: UseBarcodeCameraOptions) {
  const config: ScanEngineConfig = {
    ...DEFAULT_SCAN_ENGINE_CONFIG,
    ...configOverride,
  };

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const zxingControlsRef = useRef<{ stop: () => void } | null>(null);
  const rafRef = useRef<number>(0);
  const detectCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const variantCursorRef = useRef(0);
  const lastDetectAttemptAtRef = useRef(0);
  const gateRef = useRef<ScanGate>(createScanGate());
  const rearmTimerRef = useRef<number | null>(null);
  const deviceIdRef = useRef<string | null>(null);
  const detectBusyRef = useRef(false);
  const onDetectRef = useRef(onDetect);
  onDetectRef.current = onDetect;
  const trRef = useRef(tr);
  trRef.current = tr;

  const [cameraError, setCameraError] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const [scanFeedback, setScanFeedback] = useState<string | null>(null);
  const [scanState, setScanState] = useState<ScanUiState>("idle");
  const [lastDetection, setLastDetection] = useState<LastDetection | null>(
    null,
  );
  const [devices, setDevices] = useState<CameraDeviceOption[]>([]);
  const [selectedDeviceId, setSelectedDeviceIdState] = useState<string | null>(
    null,
  );
  const [capabilities, setCapabilities] =
    useState<TrackCapabilitiesSnapshot>(EMPTY_CAPS);
  const [torchOn, setTorchOnState] = useState(false);
  const [zoom, setZoomState] = useState(1);
  const [restartToken, setRestartToken] = useState(0);

  const cameraSupported =
    typeof window !== "undefined" &&
    Boolean(navigator.mediaDevices?.getUserMedia);

  const refreshCapabilities = useCallback(() => {
    const track = getVideoTrack(streamRef.current);
    const caps = readTrackCapabilities(track);
    setCapabilities(caps);
    if (!caps.torch) setTorchOnState(false);
    if (caps.zoom) setZoomState(caps.zoomMin);
    else setZoomState(1);
  }, []);

  const stopCamera = useCallback(() => {
    zxingControlsRef.current?.stop();
    zxingControlsRef.current = null;
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = 0;
    }
    if (rearmTimerRef.current) {
      window.clearInterval(rearmTimerRef.current);
      rearmTimerRef.current = null;
    }
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    const v = videoRef.current;
    if (v) v.srcObject = null;
    lastDetectAttemptAtRef.current = 0;
    detectBusyRef.current = false;
    resetScanGate(gateRef.current);
    setScanFeedback(null);
    setScanning(false);
    setLastDetection(null);
    setCapabilities(EMPTY_CAPS);
    setTorchOnState(false);
    setZoomState(1);
  }, []);

  const setSelectedDeviceId = useCallback((id: string) => {
    deviceIdRef.current = id;
    setSelectedDeviceIdState(id);
    setRestartToken((n) => n + 1);
  }, []);

  const toggleTorch = useCallback(async () => {
    const track = getVideoTrack(streamRef.current);
    const next = !torchOn;
    const ok = await setTorch(track, next);
    if (ok) setTorchOnState(next);
  }, [torchOn]);

  const changeZoom = useCallback(async (value: number) => {
    const track = getVideoTrack(streamRef.current);
    const ok = await setZoom(track, value);
    if (ok) setZoomState(value);
  }, []);

  const focusAtClientPoint = useCallback(
    async (clientX: number, clientY: number) => {
      const video = videoRef.current;
      const track = getVideoTrack(streamRef.current);
      if (!video || !track) return false;
      if (!capabilities.pointsOfInterest && !capabilities.focusMode) {
        return false;
      }
      const rect = video.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return false;
      const x = (clientX - rect.left) / rect.width;
      const y = (clientY - rect.top) / rect.height;
      return focusAtNormalizedPoint(track, x, y);
    },
    [capabilities.focusMode, capabilities.pointsOfInterest],
  );

  const handleCandidate = useCallback(
    (
      raw: string,
      format: string | undefined,
      geometry?: Pick<
        LastDetection,
        "cornerPoints" | "boundingBox" | "sourceWidth" | "sourceHeight"
      >,
    ) => {
      const value = normalizeScannedValue(raw);
      if (!value) return;

      if (!validateScannedCandidate(raw, format)) {
        setScanFeedback(
          trRef.current(
            "Lecture instable. Rapprochez-vous du code.",
            "قراءة غير مستقرة. اقترب من الرمز.",
          ),
        );
        return;
      }

      const now = performance.now();
      const continuous = !closeOnDetect;
      const decision = noteScanPresence(
        gateRef.current,
        value,
        now,
        {
          rearmAbsentMs: config.rearmAbsentMs,
          cooldownMs: config.cooldownMs,
        },
        continuous,
      );

      const sourceWidth = geometry?.sourceWidth ?? 1;
      const sourceHeight = geometry?.sourceHeight ?? 1;

      if (decision.action !== "accept") {
        if (geometry?.cornerPoints?.length || geometry?.boundingBox) {
          setLastDetection({
            value,
            format,
            cornerPoints: geometry.cornerPoints,
            boundingBox: geometry.boundingBox,
            sourceWidth,
            sourceHeight,
            at: now,
          });
        }
        return;
      }

      const detection: LastDetection = {
        value,
        format,
        cornerPoints: geometry?.cornerPoints,
        boundingBox: geometry?.boundingBox,
        sourceWidth,
        sourceHeight,
        at: now,
      };
      setLastDetection(detection);
      setScanState("success");
      setScanFeedback(
        continuous
          ? trRef.current(
              "Article ajouté — retirez le code pour le suivant.",
              "تمت الإضافة — أبعد الرمز للمنتج التالي.",
            )
          : trRef.current("Code lu", "تم قراءة الرمز"),
      );

      emitScanSuccessFeedback({ sound, vibrate });
      onDetectRef.current(value, { format });

      if (closeOnDetect) {
        stopCamera();
      }
    },
    [
      closeOnDetect,
      config.cooldownMs,
      config.rearmAbsentMs,
      sound,
      stopCamera,
      vibrate,
    ],
  );

  useEffect(() => {
    if (!active) {
      stopCamera();
      setCameraError(null);
      setScanState("idle");
      return;
    }

    let cancelled = false;
    const cameraMessages: CameraErrorMessages = {
      insecureContext: tr(
        "Caméra bloquée : ouvrez l’application en HTTPS (ou localhost).",
        "تم حظر الكاميرا: افتح التطبيق عبر HTTPS أو localhost.",
      ),
      generic: tr(
        "Caméra indisponible. Saisissez le code à la main ou utilisez un lecteur USB.",
        "الكاميرا غير متاحة. أدخل الرمز يدويًا أو استخدم قارئًا عبر USB.",
      ),
      notAllowed: tr(
        "Accès caméra refusé. Autorisez la caméra للـ site puis réessayez.",
        "تم رفض الوصول إلى الكاميرا. امنح الإذن ثم حاول مجددًا.",
      ),
      notFound: tr(
        "Aucune caméra compatible. Utilisez la saisie manuelle.",
        "لا توجد كاميرا متوافقة. استخدم الإدخال اليدوي.",
      ),
      notReadable: tr(
        "Caméra utilisée par une autre application. Fermez-la et réessayez.",
        "الكاميرا قيد الاستخدام من تطبيق آخر. أغلقه ثم حاول مجددًا.",
      ),
    };
    // Fix accidental mix of FR/AR in notAllowed - use proper French
    cameraMessages.notAllowed = tr(
      "Accès caméra refusé. Autorisez la caméra pour ce site puis réessayez.",
      "تم رفض الوصول إلى الكاميرا. امنح الإذن ثم حاول مجددًا.",
    );

    setScanState("requesting");
    resetScanGate(gateRef.current);

    const startTimer = window.setTimeout(() => {
      async function start() {
        const el = videoRef.current;
        if (!el || cancelled) return;

        setCameraError(null);
        setScanFeedback(null);
        setLastDetection(null);

        try {
          const listed = await listVideoInputDevices();
          if (cancelled) return;
          setDevices(listed);
          const preferred =
            pickPreferredDeviceId(listed, deviceIdRef.current) ?? null;
          if (preferred) {
            deviceIdRef.current = preferred;
            setSelectedDeviceIdState(preferred);
          }

          const stream = await openCameraStream({
            deviceId: deviceIdRef.current,
          });
          if (cancelled) {
            stream.getTracks().forEach((t) => t.stop());
            return;
          }

          streamRef.current = stream;
          el.srcObject = stream;
          el.setAttribute("playsinline", "true");
          setScanning(true);
          setScanState("scanning");
          refreshCapabilities();

          // Re-enumerate after permission so labels appear
          void listVideoInputDevices().then((withLabels) => {
            if (!cancelled) setDevices(withLabels);
          });

          const Ctor = getBarcodeDetectorCtor();
          const detector = Ctor
            ? new Ctor({ formats: [...DETECT_FORMATS] })
            : null;

          if (!detectCanvasRef.current) {
            detectCanvasRef.current = document.createElement("canvas");
          }
          const detectCanvas = detectCanvasRef.current;
          variantCursorRef.current = 0;

          if (detector) {
            try {
              await el.play();
            } catch {
              // ignore autoplay rejection
            }

            const tick = async () => {
              if (cancelled || !videoRef.current) return;
              const now = performance.now();
              if (now - lastDetectAttemptAtRef.current < config.detectIntervalMs) {
                rafRef.current = requestAnimationFrame(tick);
                return;
              }
              lastDetectAttemptAtRef.current = now;

              if (!detectBusyRef.current) {
                detectBusyRef.current = true;
                try {
                  const { results, variant, nextCursor } =
                    await detectBarcodeWithVariants(
                      detector,
                      el,
                      detectCanvas,
                      variantCursorRef.current,
                    );
                  variantCursorRef.current = nextCursor;
                  const first = results[0];
                  if (first?.rawValue) {
                    const useGeometry = variant === "normal";
                    const box =
                      useGeometry && first.boundingBox
                        ? {
                            x: first.boundingBox.x,
                            y: first.boundingBox.y,
                            width: first.boundingBox.width,
                            height: first.boundingBox.height,
                          }
                        : undefined;
                    handleCandidate(first.rawValue, first.format, {
                      cornerPoints: useGeometry
                        ? first.cornerPoints
                        : undefined,
                      boundingBox: box,
                      sourceWidth: el.videoWidth || 1,
                      sourceHeight: el.videoHeight || 1,
                    });
                  } else if (!closeOnDetect) {
                    const rearmed = noteScanAbsence(
                      gateRef.current,
                      performance.now(),
                      {
                        rearmAbsentMs: config.rearmAbsentMs,
                        cooldownMs: config.cooldownMs,
                      },
                      true,
                    );
                    if (rearmed) {
                      setScanFeedback(null);
                      setLastDetection(null);
                      setScanState("scanning");
                    }
                  }
                } catch {
                  // ignore frame errors
                } finally {
                  detectBusyRef.current = false;
                }
              }
              rafRef.current = requestAnimationFrame(tick);
            };
            rafRef.current = requestAnimationFrame(tick);
            return;
          }

          const { BrowserMultiFormatReader } = await import("@zxing/browser");
          const { DecodeHintType } = await import("@zxing/library");
          const hints = new Map();
          hints.set(DecodeHintType.TRY_HARDER, true);
          const reader = new BrowserMultiFormatReader(hints);

          try {
            await el.play();
          } catch {
            // ignore autoplay rejection
          }

          const zxingTick = () => {
            if (cancelled || !videoRef.current) return;
            const now = performance.now();
            if (now - lastDetectAttemptAtRef.current < config.detectIntervalMs) {
              rafRef.current = requestAnimationFrame(zxingTick);
              return;
            }
            lastDetectAttemptAtRef.current = now;

            if (!detectBusyRef.current) {
              detectBusyRef.current = true;
              try {
                let text: string | undefined;
                let format: string | undefined;
                try {
                  const result = reader.decode(el);
                  text = result.getText();
                  format = zxingFormatToDetectorFormat(
                    result.getBarcodeFormat() as unknown as number,
                  );
                } catch {
                  const variant =
                    BARCODE_DETECT_VARIANTS[
                      variantCursorRef.current % BARCODE_DETECT_VARIANTS.length
                    ]!;
                  variantCursorRef.current += 1;
                  if (paintBarcodeVideoVariant(el, detectCanvas, variant)) {
                    try {
                      const result = reader.decodeFromCanvas(detectCanvas);
                      text = result.getText();
                      format = zxingFormatToDetectorFormat(
                        result.getBarcodeFormat() as unknown as number,
                      );
                    } catch {
                      // no decode on this variant
                    }
                  }
                }

                if (text) {
                  handleCandidate(text, format);
                } else if (!closeOnDetect) {
                  const rearmed = noteScanAbsence(
                    gateRef.current,
                    performance.now(),
                    {
                      rearmAbsentMs: config.rearmAbsentMs,
                      cooldownMs: config.cooldownMs,
                    },
                    true,
                  );
                  if (rearmed) {
                    setScanFeedback(null);
                    setLastDetection(null);
                    setScanState("scanning");
                  }
                }
              } finally {
                detectBusyRef.current = false;
              }
            }
            rafRef.current = requestAnimationFrame(zxingTick);
          };
          rafRef.current = requestAnimationFrame(zxingTick);
          zxingControlsRef.current = {
            stop: () => {
              if (rafRef.current) {
                cancelAnimationFrame(rafRef.current);
                rafRef.current = 0;
              }
            },
          };

          if (!closeOnDetect) {
            rearmTimerRef.current = window.setInterval(() => {
              const rearmed = noteScanAbsence(
                gateRef.current,
                performance.now(),
                {
                  rearmAbsentMs: config.rearmAbsentMs,
                  cooldownMs: config.cooldownMs,
                },
                true,
              );
              if (rearmed) {
                setScanFeedback(null);
                setLastDetection(null);
                setScanState("scanning");
              }
            }, Math.max(80, config.rearmAbsentMs / 2));
          }
        } catch (error) {
          setCameraError(cameraErrorMessage(error, cameraMessages));
          setScanning(false);
          setScanState("error");
        }
      }

      void start();
    }, 0);

    return () => {
      cancelled = true;
      window.clearTimeout(startTimer);
      stopCamera();
    };
  }, [
    active,
    closeOnDetect,
    config.cooldownMs,
    config.detectIntervalMs,
    config.rearmAbsentMs,
    handleCandidate,
    refreshCapabilities,
    restartToken,
    stopCamera,
    tr,
  ]);

  return {
    videoRef,
    scanning,
    cameraError,
    scanFeedback,
    scanState,
    cameraSupported,
    lastDetection,
    lastFormatLabel: formatBarcodeLabel(lastDetection?.format),
    devices,
    selectedDeviceId,
    setSelectedDeviceId,
    capabilities,
    torchOn,
    toggleTorch,
    zoom,
    changeZoom,
    focusAtClientPoint,
    stopCamera,
  };
}
