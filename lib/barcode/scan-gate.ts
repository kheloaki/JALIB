/**
 * Duplicate suppression + rearm gate for continuous / single-shot scanning.
 * Pure state machine — easy to unit test.
 */

export type ScanGateConfig = {
  rearmAbsentMs: number;
  cooldownMs: number;
};

export type ScanGate = {
  armed: boolean;
  lastAcceptedValue: string | null;
  lastAcceptedAt: number;
  lastSeenValue: string | null;
  lastSeenAt: number;
};

export type ScanGateDecision =
  | { action: "accept"; value: string }
  | { action: "ignore_duplicate" }
  | { action: "ignore_cooldown" }
  | { action: "ignore_disarmed" };

export function createScanGate(): ScanGate {
  return {
    armed: true,
    lastAcceptedValue: null,
    lastAcceptedAt: 0,
    lastSeenValue: null,
    lastSeenAt: 0,
  };
}

export function resetScanGate(gate: ScanGate): void {
  gate.armed = true;
  gate.lastAcceptedValue = null;
  gate.lastAcceptedAt = 0;
  gate.lastSeenValue = null;
  gate.lastSeenAt = 0;
}

/**
 * Call when a validated barcode is visible in the frame.
 * @param continuous when true, disarm until the code leaves the view.
 */
export function noteScanPresence(
  gate: ScanGate,
  value: string,
  now: number,
  config: ScanGateConfig,
  continuous: boolean,
): ScanGateDecision {
  gate.lastSeenValue = value;
  gate.lastSeenAt = now;

  if (!gate.armed) {
    return { action: "ignore_disarmed" };
  }

  if (
    gate.lastAcceptedValue === value &&
    now - gate.lastAcceptedAt < config.cooldownMs
  ) {
    return { action: "ignore_cooldown" };
  }

  gate.lastAcceptedValue = value;
  gate.lastAcceptedAt = now;
  if (continuous) {
    gate.armed = false;
  }
  return { action: "accept", value };
}

/**
 * Call when no barcode is present (or ZXing silence interval).
 * Rearms continuous mode after {@link ScanGateConfig.rearmAbsentMs}.
 */
export function noteScanAbsence(
  gate: ScanGate,
  now: number,
  config: ScanGateConfig,
  continuous: boolean,
): boolean {
  if (!continuous || gate.armed) return false;
  if (now - gate.lastSeenAt >= config.rearmAbsentMs) {
    gate.armed = true;
    return true;
  }
  return false;
}

/** True while the same accepted value is still "held" in view under cooldown. */
export function isSameCodeHeld(
  gate: ScanGate,
  value: string,
  now: number,
  config: ScanGateConfig,
): boolean {
  return (
    gate.lastAcceptedValue === value &&
    now - gate.lastAcceptedAt < config.cooldownMs
  );
}
