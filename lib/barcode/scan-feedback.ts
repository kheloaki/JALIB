/**
 * Local haptic + audio feedback for successful scans (no remote assets).
 */

import { prefersReducedMotion } from "@/lib/barcode/scan-utils";

let audioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const Ctx =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext })
      .webkitAudioContext;
  if (!Ctx) return null;
  if (!audioCtx) audioCtx = new Ctx();
  return audioCtx;
}

/** Short success chirp via Web Audio API. */
export function playScanSuccessSound(): void {
  if (prefersReducedMotion()) return;
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    if (ctx.state === "suspended") {
      void ctx.resume();
    }
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(880, now);
    osc.frequency.exponentialRampToValueAtTime(1320, now + 0.08);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.12, now + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.14);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.15);
  } catch {
    // ignore autoplay / AudioContext failures
  }
}

export function vibrateScanSuccess(): void {
  if (typeof navigator === "undefined" || !navigator.vibrate) return;
  if (prefersReducedMotion()) return;
  try {
    navigator.vibrate(40);
  } catch {
    // ignore
  }
}

export function emitScanSuccessFeedback(options?: {
  sound?: boolean;
  vibrate?: boolean;
}): void {
  if (options?.sound !== false) playScanSuccessSound();
  if (options?.vibrate !== false) vibrateScanSuccess();
}
