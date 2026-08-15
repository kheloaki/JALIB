/**
 * IndexedDB snapshot of the POS product catalog (summaries only).
 * Images are URL strings — never binary blobs.
 */

import type { Product } from "@/components/pos/types";

const DB_NAME = "matjar-pos-catalog";
const DB_VERSION = 1;
const PRODUCTS_STORE = "products";
const META_STORE = "meta";
const META_KEY = "sync";

/** Bump when POS catalog row shape changes (forces a full re-download). */
export const POS_CATALOG_SCHEMA_VERSION = 2;

export type PosCatalogMeta = {
  lastSyncAt: number;
  productCount: number;
  fullSyncAt: number;
  schemaVersion?: number;
};

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("IndexedDB unavailable"));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onerror = () => reject(req.error ?? new Error("IndexedDB open failed"));
    req.onsuccess = () => resolve(req.result);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(PRODUCTS_STORE)) {
        const store = db.createObjectStore(PRODUCTS_STORE, { keyPath: "id" });
        store.createIndex("barcode", "barcode", { unique: false });
        store.createIndex("updatedAt", "updatedAt", { unique: false });
      }
      if (!db.objectStoreNames.contains(META_STORE)) {
        db.createObjectStore(META_STORE, { keyPath: "key" });
      }
    };
  });
}

function idbReq<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error("IndexedDB request failed"));
  });
}

function toStored(product: Product): Product & { updatedAt: number } {
  return {
    ...product,
    updatedAt: product.updatedAt ?? product.createdAt ?? 0,
  };
}

export async function idbGetAllProducts(): Promise<Product[]> {
  try {
    const db = await openDb();
    try {
      const tx = db.transaction(PRODUCTS_STORE, "readonly");
      const store = tx.objectStore(PRODUCTS_STORE);
      const rows = await idbReq(store.getAll());
      return Array.isArray(rows) ? (rows as Product[]) : [];
    } finally {
      db.close();
    }
  } catch {
    return [];
  }
}

export async function idbUpsertProducts(products: Product[]): Promise<void> {
  if (products.length === 0) return;
  const db = await openDb();
  try {
    const tx = db.transaction(PRODUCTS_STORE, "readwrite");
    const store = tx.objectStore(PRODUCTS_STORE);
    for (const product of products) {
      store.put(toStored(product));
    }
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error ?? new Error("IndexedDB upsert failed"));
    });
  } finally {
    db.close();
  }
}

export async function idbReplaceAllProducts(products: Product[]): Promise<void> {
  const db = await openDb();
  try {
    const tx = db.transaction(PRODUCTS_STORE, "readwrite");
    const store = tx.objectStore(PRODUCTS_STORE);
    store.clear();
    for (const product of products) {
      store.put(toStored(product));
    }
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () =>
        reject(tx.error ?? new Error("IndexedDB replace failed"));
    });
  } finally {
    db.close();
  }
}

export async function idbGetMeta(): Promise<PosCatalogMeta | null> {
  try {
    const db = await openDb();
    try {
      const tx = db.transaction(META_STORE, "readonly");
      const row = await idbReq(
        tx.objectStore(META_STORE).get(META_KEY),
      );
      if (!row || typeof row !== "object") return null;
      const o = row as Record<string, unknown>;
      if (
        typeof o.lastSyncAt !== "number" ||
        typeof o.productCount !== "number" ||
        typeof o.fullSyncAt !== "number"
      ) {
        return null;
      }
      return {
        lastSyncAt: o.lastSyncAt,
        productCount: o.productCount,
        fullSyncAt: o.fullSyncAt,
        ...(typeof o.schemaVersion === "number"
          ? { schemaVersion: o.schemaVersion }
          : {}),
      };
    } finally {
      db.close();
    }
  } catch {
    return null;
  }
}

export async function idbSetMeta(meta: PosCatalogMeta): Promise<void> {
  const db = await openDb();
  try {
    const tx = db.transaction(META_STORE, "readwrite");
    tx.objectStore(META_STORE).put({ key: META_KEY, ...meta });
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error ?? new Error("IndexedDB meta failed"));
    });
  } finally {
    db.close();
  }
}
