"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  createPosMiscLineId,
  POS_CUSTOM_PRODUCT_PLACEHOLDER_IMAGE,
} from "@/components/pos/constants";
import type { CartLine, Product } from "@/components/pos/types";
import { clampMadPrice } from "@/lib/money/mad";
import { MIN_WEIGHT_QTY, clampWeightQty } from "@/lib/pos/cart-qty";
import { playPosSound } from "@/lib/pos/pos-sounds";

type UsePosCartOptions = {
  /** Persist cart lines to localStorage. */
  storageKey?: string;
};

function safeParse(text: string): unknown {
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return null;
  }
}

function readCartFromStorage(storageKey: string): CartLine[] | null {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(storageKey);
  if (!raw) return null;
  const parsed = safeParse(raw);
  if (!Array.isArray(parsed)) return null;
  return parsed as CartLine[];
}

export function usePosCart(initialLines: CartLine[], opts: UsePosCartOptions = {}) {
  const storageKey = opts.storageKey;
  /** Avoid writing SSR defaults over a saved cart before the post-mount read runs. */
  const skipNextPersist = useRef(Boolean(storageKey));
  const [cart, setCart] = useState<CartLine[]>(initialLines);

  useEffect(() => {
    if (!storageKey) return;
    const stored = readCartFromStorage(storageKey);
    if (stored) setCart(stored);
  }, [storageKey]);

  useEffect(() => {
    if (!storageKey) return;
    if (skipNextPersist.current) {
      skipNextPersist.current = false;
      return;
    }
    window.localStorage.setItem(storageKey, JSON.stringify(cart));
  }, [cart, storageKey]);

  const totalTtc = useMemo(
    () =>
      cart.reduce(
        (sum, line) => sum + Math.round(line.unitPrice * line.qty * 100) / 100,
        0,
      ),
    [cart],
  );

  const addToCart = useCallback((product: Product) => {
    setCart((prev) => {
      const i = prev.findIndex((l) => l.productId === product.id);
      if (i >= 0) {
        const next = [...prev];
        const line = next[i]!;
        next[i] = {
          ...line,
          qty: product.soldByWeight ? clampWeightQty(line.qty + 1) : line.qty + 1,
          ...(line.costMad == null &&
          product.costMad != null &&
          product.costMad > 0
            ? { costMad: product.costMad }
            : {}),
        };
        return next;
      }
      return [
        ...prev,
        {
          productId: product.id,
          name: product.name,
          unitPrice: product.price,
          qty: 1,
          image: product.image,
          imageAlt: product.imageAlt,
          ...(product.costMad != null && product.costMad > 0
            ? { costMad: product.costMad }
            : {}),
          ...(product.soldByWeight ? { soldByWeight: true } : {}),
        },
      ];
    });
    playPosSound("add");
  }, []);

  /** Barcode scan: add once only; qty changes are manual in the cart. */
  const addFromBarcodeScan = useCallback((product: Product): boolean => {
    let added = false;
    setCart((prev) => {
      if (prev.some((line) => line.productId === product.id)) {
        return prev;
      }
      added = true;
      return [
        ...prev,
        {
          productId: product.id,
          name: product.name,
          unitPrice: product.price,
          qty: 1,
          image: product.image,
          imageAlt: product.imageAlt,
          ...(product.costMad != null && product.costMad > 0
            ? { costMad: product.costMad }
            : {}),
          ...(product.soldByWeight ? { soldByWeight: true } : {}),
        },
      ];
    });
    if (added) playPosSound("add");
    return added;
  }, []);

  const setQty = useCallback((productId: string, qty: number) => {
    setCart((prev) => {
      const line = prev.find((l) => l.productId === productId);
      if (!line) return prev;

      if (line.soldByWeight) {
        const nextQty = clampWeightQty(qty);
        if (nextQty < MIN_WEIGHT_QTY) {
          playPosSound("remove");
          return prev.filter((l) => l.productId !== productId);
        }
        if (nextQty > line.qty) playPosSound("add");
        else if (nextQty < line.qty) playPosSound("remove");
        return prev.map((l) =>
          l.productId === productId ? { ...l, qty: nextQty } : l,
        );
      }

      if (qty < 1) {
        playPosSound("remove");
        return prev.filter((l) => l.productId !== productId);
      }
      if (qty > line.qty) playPosSound("add");
      else if (qty < line.qty) playPosSound("remove");
      return prev.map((l) =>
        l.productId === productId ? { ...l, qty: Math.floor(qty) } : l,
      );
    });
  }, []);

  const clearCart = useCallback(() => {
    setCart([]);
  }, []);

  const loadCart = useCallback((lines: CartLine[]) => {
    setCart(lines);
  }, []);

  const setLineUnitPrice = useCallback((productId: string, unitPrice: number) => {
    const n = clampMadPrice(unitPrice);
    setCart((prev) =>
      prev.map((l) =>
        l.productId === productId ? { ...l, unitPrice: n } : l,
      ),
    );
  }, []);

  /** Unlisted amount — one Divers line with qty 1 and the entered total as unit price. */
  const addMiscTotalLine = useCallback(
    (amountMad: number, label = "Divers") => {
      const unitPrice = clampMadPrice(amountMad);
      if (unitPrice <= 0) return;
      setCart((prev) => [
        ...prev,
        {
          productId: createPosMiscLineId(),
          name: label,
          unitPrice,
          qty: 1,
          image: POS_CUSTOM_PRODUCT_PLACEHOLDER_IMAGE,
          imageAlt: label,
        },
      ]);
      playPosSound("add");
    },
    [],
  );

  return {
    cart,
    totalTtc,
    addToCart,
    addFromBarcodeScan,
    setQty,
    clearCart,
    loadCart,
    setLineUnitPrice,
    addMiscTotalLine,
  };
}
