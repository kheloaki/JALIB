/**
 * POS feedback sounds — typical supermarket / caisse cues.
 *
 * Assets (CC0 / public domain):
 * - scan.mp3, remove.mp3 — Joseph SARDIN / BigSoundBank (#1417, #3527)
 * - error.mp3 — BigSoundBank Operation game buzz (#1685)
 * - checkout.mp3 — ascending success chime (synthesized)
 * - duplicate.mp3 — descending reject cue for “already in cart” (synthesized)
 */

export type PosSound =
  | "add"
  | "remove"
  | "checkout"
  | "error"
  | "scan"
  | "duplicate";

const STORAGE_KEY = "matjar:pos:sounds-enabled";

const SOUND_SRC: Record<PosSound, string> = {
  add: "/sounds/pos/scan.mp3",
  scan: "/sounds/pos/scan.mp3",
  remove: "/sounds/pos/remove.mp3",
  error: "/sounds/pos/error.mp3",
  checkout: "/sounds/pos/checkout.mp3",
  duplicate: "/sounds/pos/duplicate.mp3",
};

const SOUND_VOLUME: Record<PosSound, number> = {
  add: 0.72,
  scan: 0.72,
  remove: 0.65,
  error: 0.78,
  checkout: 0.88,
  duplicate: 0.8,
};

const cache = new Map<string, HTMLAudioElement>();

export function isPosSoundsEnabled(): boolean {
  if (typeof window === "undefined") return true;
  return window.localStorage.getItem(STORAGE_KEY) !== "false";
}

export function setPosSoundsEnabled(enabled: boolean): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, enabled ? "true" : "false");
}

function baseAudio(src: string): HTMLAudioElement {
  let audio = cache.get(src);
  if (!audio) {
    audio = new Audio(src);
    audio.preload = "auto";
    cache.set(src, audio);
  }
  return audio;
}

/** Preload clips after a user gesture so the first scan plays instantly. */
export function warmupPosSounds(): void {
  if (!isPosSoundsEnabled() || typeof window === "undefined") return;
  const seen = new Set<string>();
  for (const src of Object.values(SOUND_SRC)) {
    if (seen.has(src)) continue;
    seen.add(src);
    baseAudio(src).load();
  }
}

/** Play a standard caisse sound (scanner beep, error buzz, cha-ching, etc.). */
export function playPosSound(sound: PosSound): void {
  if (!isPosSoundsEnabled() || typeof window === "undefined") return;
  const src = SOUND_SRC[sound];
  const clip = baseAudio(src).cloneNode(true) as HTMLAudioElement;
  clip.volume = SOUND_VOLUME[sound];
  void clip.play().catch(() => {
    // Autoplay blocked until user interacts — ignore silently.
  });
}
