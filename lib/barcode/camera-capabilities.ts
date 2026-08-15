/**
 * MediaStreamTrack helpers — torch, zoom, focus, device enumeration.
 * Feature-detect everything; callers hide unsupported controls.
 */

export type CameraDeviceOption = {
  deviceId: string;
  label: string;
  facing: "environment" | "user" | "unknown";
};

export type TrackCapabilitiesSnapshot = {
  torch: boolean;
  zoom: boolean;
  zoomMin: number;
  zoomMax: number;
  zoomStep: number;
  focusMode: boolean;
  pointsOfInterest: boolean;
};

type CapRecord = Record<string, unknown>;

function asCaps(track: MediaStreamTrack | null): CapRecord | null {
  if (!track || typeof track.getCapabilities !== "function") return null;
  try {
    return track.getCapabilities() as CapRecord;
  } catch {
    return null;
  }
}

export function readTrackCapabilities(
  track: MediaStreamTrack | null,
): TrackCapabilitiesSnapshot {
  const caps = asCaps(track);
  const zoom = caps?.zoom as
    | { min?: number; max?: number; step?: number }
    | number
    | undefined;

  let zoomMin = 1;
  let zoomMax = 1;
  let zoomStep = 0.1;
  let zoomSupported = false;
  if (zoom && typeof zoom === "object") {
    zoomMin = typeof zoom.min === "number" ? zoom.min : 1;
    zoomMax = typeof zoom.max === "number" ? zoom.max : 1;
    zoomStep = typeof zoom.step === "number" ? zoom.step : 0.1;
    zoomSupported = zoomMax > zoomMin;
  }

  const focusMode = caps?.focusMode;
  const hasFocusMode = Array.isArray(focusMode)
    ? focusMode.includes("manual") || focusMode.includes("single-shot")
    : false;

  return {
    torch: caps?.torch === true,
    zoom: zoomSupported,
    zoomMin,
    zoomMax,
    zoomStep,
    focusMode: hasFocusMode,
    pointsOfInterest: Array.isArray(caps?.pointsOfInterest)
      ? true
      : caps?.pointsOfInterest === true,
  };
}

async function applyAdvanced(
  track: MediaStreamTrack,
  advanced: Record<string, unknown>,
): Promise<boolean> {
  try {
    await track.applyConstraints({
      advanced: [advanced],
    } as MediaTrackConstraints);
    return true;
  } catch {
    try {
      await track.applyConstraints(advanced as MediaTrackConstraints);
      return true;
    } catch {
      return false;
    }
  }
}

export async function setTorch(
  track: MediaStreamTrack | null,
  on: boolean,
): Promise<boolean> {
  if (!track) return false;
  const caps = readTrackCapabilities(track);
  if (!caps.torch) return false;
  return applyAdvanced(track, { torch: on });
}

export async function setZoom(
  track: MediaStreamTrack | null,
  value: number,
): Promise<boolean> {
  if (!track) return false;
  const caps = readTrackCapabilities(track);
  if (!caps.zoom) return false;
  const clamped = Math.min(caps.zoomMax, Math.max(caps.zoomMin, value));
  return applyAdvanced(track, { zoom: clamped });
}

/**
 * Tap-to-focus via pointsOfInterest when supported (mostly Chromium Android).
 * Coordinates are normalized 0–1 relative to the video element.
 */
export async function focusAtNormalizedPoint(
  track: MediaStreamTrack | null,
  x: number,
  y: number,
): Promise<boolean> {
  if (!track) return false;
  const caps = readTrackCapabilities(track);
  if (!caps.pointsOfInterest && !caps.focusMode) return false;
  const nx = Math.min(1, Math.max(0, x));
  const ny = Math.min(1, Math.max(0, y));
  return applyAdvanced(track, {
    focusMode: "single-shot",
    pointsOfInterest: [{ x: nx, y: ny }],
  });
}

function inferFacing(label: string): CameraDeviceOption["facing"] {
  const l = label.toLowerCase();
  if (/back|rear|environment|arrière|خلف/.test(l)) return "environment";
  if (/front|user|face|selfie|avant|أمام/.test(l)) return "user";
  return "unknown";
}

export async function listVideoInputDevices(): Promise<CameraDeviceOption[]> {
  if (
    typeof navigator === "undefined" ||
    !navigator.mediaDevices?.enumerateDevices
  ) {
    return [];
  }
  const devices = await navigator.mediaDevices.enumerateDevices();
  return devices
    .filter((d) => d.kind === "videoinput" && d.deviceId)
    .map((d, index) => ({
      deviceId: d.deviceId,
      label: d.label || `Camera ${index + 1}`,
      facing: inferFacing(d.label || ""),
    }));
}

export function pickPreferredDeviceId(
  devices: CameraDeviceOption[],
  preferredId?: string | null,
): string | undefined {
  if (preferredId && devices.some((d) => d.deviceId === preferredId)) {
    return preferredId;
  }
  const env = devices.find((d) => d.facing === "environment");
  if (env) return env.deviceId;
  return devices[0]?.deviceId;
}

export async function openCameraStream(options: {
  deviceId?: string | null;
}): Promise<MediaStream> {
  if (typeof window !== "undefined" && !window.isSecureContext) {
    throw Object.assign(new Error("InsecureContext"), {
      name: "SecurityError",
    });
  }
  if (!navigator.mediaDevices?.getUserMedia) {
    throw Object.assign(new Error("MediaDevicesUnavailable"), {
      name: "NotFoundError",
    });
  }

  const attempts: MediaStreamConstraints[] = [];
  if (options.deviceId) {
    attempts.push({
      video: {
        deviceId: { exact: options.deviceId },
        width: { ideal: 1280 },
        height: { ideal: 720 },
      },
      audio: false,
    });
    attempts.push({
      video: { deviceId: { exact: options.deviceId } },
      audio: false,
    });
  }
  attempts.push(
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
  );

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

export function getVideoTrack(
  stream: MediaStream | null,
): MediaStreamTrack | null {
  return stream?.getVideoTracks()?.[0] ?? null;
}
