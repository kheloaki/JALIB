"use client";

import { useEffect, useRef, type ReactNode } from "react";
import {
  History,
  ImagePlus,
  PackagePlus,
  ScanBarcode,
  ShoppingCart,
  SquarePen,
  Tag,
  Trash2,
} from "lucide-react";

import type { Product } from "@/components/pos/types";
import { cn } from "@/lib/utils";

export type PosProductContextMenuState = {
  product: Product;
  x: number;
  y: number;
};

type PosProductContextMenuProps = {
  menu: PosProductContextMenuState | null;
  onClose: () => void;
  tr: (fr: string, ar: string) => string;
  onAddToCart?: (product: Product) => void;
  /** Default true — set false on inventory (no cart). */
  showAddToCart?: boolean;
  canEditProduct: boolean;
  canEditSellPrice: boolean;
  canAddStock: boolean;
  canDeleteProduct?: boolean;
  onEditProduct: (product: Product) => void;
  onOpenSellPrice: (product: Product) => void;
  onOpenHistory: (product: Product) => void;
  onEditBarcode?: (product: Product) => void;
  onEditImage?: (product: Product) => void;
  onAddStock: (product: Product) => void;
  onDeleteProduct?: (product: Product) => void;
};

export function PosProductContextMenu({
  menu,
  onClose,
  tr,
  onAddToCart,
  showAddToCart = true,
  canEditProduct,
  canEditSellPrice,
  canAddStock,
  canDeleteProduct = false,
  onEditProduct,
  onOpenSellPrice,
  onOpenHistory,
  onEditBarcode,
  onEditImage,
  onAddStock,
  onDeleteProduct,
}: PosProductContextMenuProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menu) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    function onPointerDown(e: MouseEvent | TouchEvent) {
      const el = ref.current;
      if (!el) return;
      const target = e.target as Node | null;
      if (target && !el.contains(target)) onClose();
    }
    window.addEventListener("keydown", onKey);
    window.addEventListener("mousedown", onPointerDown);
    window.addEventListener("touchstart", onPointerDown);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("mousedown", onPointerDown);
      window.removeEventListener("touchstart", onPointerDown);
    };
  }, [menu, onClose]);

  useEffect(() => {
    if (!menu || !ref.current) return;
    const el = ref.current;
    const rect = el.getBoundingClientRect();
    const pad = 8;
    let left = menu.x;
    let top = menu.y;
    if (left + rect.width > window.innerWidth - pad) {
      left = Math.max(pad, window.innerWidth - rect.width - pad);
    }
    if (top + rect.height > window.innerHeight - pad) {
      top = Math.max(pad, window.innerHeight - rect.height - pad);
    }
    el.style.left = `${left}px`;
    el.style.top = `${top}px`;
  }, [menu]);

  if (!menu) return null;

  const product = menu.product;
  const items: Array<{
    key: string;
    label: string;
    icon: ReactNode;
    onSelect: () => void;
    show: boolean;
  }> = [
    {
      key: "cart",
      label: tr("Ajouter au panier", "إضافة إلى السلة"),
      icon: <ShoppingCart className="size-4 stroke-[1.75]" aria-hidden />,
      onSelect: () => onAddToCart?.(product),
      show: showAddToCart && Boolean(onAddToCart),
    },
    {
      key: "edit",
      label: tr("Modifier le produit", "تعديل المنتج"),
      icon: <SquarePen className="size-4 stroke-[1.75]" aria-hidden />,
      onSelect: () => onEditProduct(product),
      show: canEditProduct,
    },
    {
      key: "sell",
      label: tr("Prix de vente", "سعر البيع"),
      icon: <Tag className="size-4 stroke-[1.75]" aria-hidden />,
      onSelect: () => onOpenSellPrice(product),
      show: canEditSellPrice || canEditProduct,
    },
    {
      key: "barcode",
      label: tr("Modifier le code-barres", "تعديل الباركود"),
      icon: <ScanBarcode className="size-4 stroke-[1.75]" aria-hidden />,
      onSelect: () => onEditBarcode?.(product),
      show: canEditProduct && Boolean(onEditBarcode),
    },
    {
      key: "image",
      label: tr("Photo produit", "صورة المنتج"),
      icon: <ImagePlus className="size-4 stroke-[1.75]" aria-hidden />,
      onSelect: () => onEditImage?.(product),
      show: canEditProduct && Boolean(onEditImage),
    },
    {
      key: "history",
      label: tr("Historique d’achat", "سجل الشراء"),
      icon: <History className="size-4 stroke-[1.75]" aria-hidden />,
      onSelect: () => onOpenHistory(product),
      show: canEditProduct || canAddStock,
    },
    {
      key: "stock",
      label: tr("Modifier le stock", "تعديل المخزون"),
      icon: <PackagePlus className="size-4 stroke-[1.75]" aria-hidden />,
      onSelect: () => onAddStock(product),
      show: canAddStock,
    },
    {
      key: "delete",
      label: tr("Supprimer", "حذف"),
      icon: <Trash2 className="size-4 stroke-[1.75]" aria-hidden />,
      onSelect: () => onDeleteProduct?.(product),
      show: canDeleteProduct && Boolean(onDeleteProduct),
    },
  ];

  const visible = items.filter((item) => item.show);

  return (
    <div
      ref={ref}
      role="menu"
      aria-label={tr("Actions produit", "إجراءات المنتج")}
      className={cn(
        "border-sidebar-border bg-surface-container-lowest fixed z-[200] min-w-[12.5rem] rounded-xl border py-1 shadow-lg",
      )}
      style={{ left: menu.x, top: menu.y }}
    >
      <p className="text-on-surface-variant line-clamp-2 border-b border-sidebar-border/60 px-3 py-2 text-[11px] font-semibold">
        {product.name}
      </p>
      {visible.map((item) => (
        <button
          key={item.key}
          type="button"
          role="menuitem"
          className="hover:bg-surface-container-low text-on-surface flex w-full items-center gap-2.5 px-3 py-2.5 text-left text-sm font-semibold"
          onClick={() => {
            item.onSelect();
            onClose();
          }}
        >
          {item.icon}
          {item.label}
        </button>
      ))}
    </div>
  );
}
