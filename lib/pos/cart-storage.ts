import type { CartLine, PaymentMethod } from "@/components/pos/types";

export type PosCartSnapshot = {
  cart: CartLine[];
  payment: PaymentMethod;
  selectedClientId: string | null;
};

const STORAGE_KEY = "matjar:pos:cart:v1";

function safeParse(text: string): unknown {
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return null;
  }
}

export function readPosCartSnapshot(): PosCartSnapshot | null {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  const parsed = safeParse(raw);
  if (!parsed || typeof parsed !== "object") return null;
  const snap = parsed as Partial<PosCartSnapshot>;
  if (!Array.isArray(snap.cart)) return null;
  if (snap.payment !== "cash" && snap.payment !== "credit") return null;
  const selectedClientId =
    snap.selectedClientId === null || typeof snap.selectedClientId === "string"
      ? snap.selectedClientId
      : null;
  return {
    cart: snap.cart as CartLine[],
    payment: snap.payment,
    selectedClientId,
  };
}

export function writePosCartSnapshot(next: PosCartSnapshot) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
}

export function clearPosCartSnapshot() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(STORAGE_KEY);
}

