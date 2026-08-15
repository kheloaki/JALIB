"use client";

import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useConvex } from "convex/react";
import { useLocale } from "next-intl";

import { PosPageSkeleton } from "@/components/skeletons";
import { useRegisterPosAdminHeader, useAdminChrome } from "@/components/layout/admin-chrome-context";
import { useHardwareBarcodeWedge } from "@/hooks/use-hardware-barcode-wedge";
import {
  createPosMiscLineId,
  isPosMiscLineId,
  POS_SHELF_CATEGORIES,
} from "@/components/pos/constants";
import { usePosCart } from "@/components/pos/hooks/use-pos-cart";
import { usePosClientCreditStatus } from "@/components/pos/hooks/use-pos-client-credit-status";
import { usePosBarcodeScan } from "@/components/pos/pos-barcode-scan-context";
import { PosCartDraftsBanner } from "@/components/pos/pos-cart-drafts-banner";
import { PosCartPanel } from "@/components/pos/pos-cart-panel";
import { PosCartPriceKeypadDialog } from "@/components/pos/pos-cart-price-keypad-dialog";
import { PosCartSheet } from "@/components/pos/pos-cart-sheet";
import {
  PosCheckoutCaisseDialog,
  type PosCheckoutCaisseSession,
  type PosCheckoutClosedOptions,
} from "@/components/pos/pos-checkout-caisse-dialog";
import { PosCatalogSection } from "@/components/pos/pos-catalog-section";
import { restoreThermalPrinter } from "@/lib/print/thermal-printer";
import { PosMobileCaisseCart } from "@/components/pos/pos-mobile-caisse-cart";
import { AddProductDialog } from "@/components/products/add-product-dialog";
import type { CartLine, PaymentMethod, Product } from "@/components/pos/types";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { usePosLocalCatalog } from "@/hooks/use-pos-local-catalog";
import {
  canCheckoutSale,
  canEditSalePrice,
  canManageCartDrafts,
  canParkCartDraft,
  canSellOnCredit,
} from "@/lib/auth/permissions";
import {
  clearPosCartSnapshot,
  readPosCartSnapshot,
  writePosCartSnapshot,
} from "@/lib/pos/cart-storage";
import { playPosSound, warmupPosSounds } from "@/lib/pos/pos-sounds";
import type { Client } from "@/lib/clients/types";
import { clientFromConvex, productFromConvex } from "@/lib/convex/mappers";
import {
  buildAssistDraftLabel,
  buildDefaultDraftLabel,
  draftLinesToCartLines,
  type PosCartDraftView,
} from "@/lib/convex/pos-cart-draft";
import { useToast } from "@/components/ui/toaster";
import { buildPosCategoryTabs } from "@/lib/pos/pos-categories";
import { findProductByBarcode } from "@/lib/pos/catalog-lookup";
import { formatPosDh } from "@/lib/pos/format-pos-dh";
import { filterAndRankProductsBySearch } from "@/lib/products/product-search";
import {
  buildSoldQtyByProductId,
  compareProductsByBestSellers,
  sortProductsByBestSellers,
} from "@/lib/products/product-sort";
import {
  clearPendingInvoiceReopen,
  readPendingInvoiceReopen,
  writePendingInvoiceReopen,
  type PosInvoiceReopenPayload,
} from "@/lib/pos/invoice-to-cart";
import { cn } from "@/lib/utils";

function mergeProductLists(primary: Product[], extra: Product[]): Product[] {
  if (extra.length === 0) return primary;
  const map = new Map(primary.map((p) => [p.id, p]));
  for (const product of extra) {
    if (!map.has(product.id)) map.set(product.id, product);
  }
  return [...map.values()];
}

export function PosDashboard() {
  return <PosDashboardContent />;
}

function PosDashboardContent() {
  const locale = useLocale();
  const isAr = locale === "ar";
  const tr = useCallback((fr: string, ar: string) => (isAr ? ar : fr), [isAr]);
  const toast = useToast();
  const convex = useConvex();
  const [category, setCategory] = useState("Tout");
  const [brandId, setBrandId] = useState<string | null>(null);
  const [payment, setPayment] = useState<PaymentMethod>("cash");
  const [addProductOpen, setAddProductOpen] = useState(false);
  const [miscTotalOpen, setMiscTotalOpen] = useState(false);
  const [cartOpen, setCartOpen] = useState(false);
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [isCheckingOut, setIsCheckingOut] = useState(false);
  const [checkoutSession, setCheckoutSession] =
    useState<PosCheckoutCaisseSession | null>(null);
  const [draftsBusy, setDraftsBusy] = useState(false);
  const [posStorageReady, setPosStorageReady] = useState(false);
  const skipFirstSnapshotWrite = useRef(true);
  const lastDuplicateBarcodeToastAtRef = useRef(0);
  const checkoutSale = useMutation(api.pos.checkout);
  const parkCartDraft = useMutation(api.posCartDrafts.park);
  const restoreCartDraft = useMutation(api.posCartDrafts.restore);
  const removeCartDraft = useMutation(api.posCartDrafts.remove);
  const currentUser = useQuery(api.authz.currentUser);
  const permissions = currentUser?.permissions ?? [];
  const allowCheckout = canCheckoutSale(permissions);
  const allowParkCart = canParkCartDraft(permissions);
  const canManageDrafts = canManageCartDrafts(permissions);
  const allowCreditPayment = canSellOnCredit(permissions);
  const allowPriceEdit = canEditSalePrice(permissions);
  const canAddProducts = permissions.includes("stock.edit_products");
  const cartDrafts = useQuery(
    api.posCartDrafts.list,
    canManageDrafts ? {} : "skip",
  );
  const {
    products: shelfProducts,
    categories,
    brands,
    isLoading: catalogLoading,
    syncing: catalogSyncing,
  } = usePosLocalCatalog();
  // Defer sold-qty until catalog arrives so POS isn't blocked.
  const selectedClientRow = useQuery(
    api.clients.get,
    selectedClientId
      ? { clientId: selectedClientId as Id<"clients"> }
      : "skip",
  );
  const soldQtyRows = useQuery(
    api.products.soldQuantities,
    catalogLoading ? "skip" : {},
  );
  const soldQtyByProductId = useMemo(
    () => buildSoldQtyByProductId(soldQtyRows),
    [soldQtyRows],
  );
  const selectedClient = useMemo(
    () => (selectedClientRow ? clientFromConvex(selectedClientRow) : null),
    [selectedClientRow],
  );
  const clients = useMemo<Client[]>(
    () => (selectedClient ? [selectedClient] : []),
    [selectedClient],
  );

  useEffect(() => {
    const snap = readPosCartSnapshot();
    if (snap) {
      setPayment(snap.payment);
      setSelectedClientId(snap.selectedClientId);
    }
    setPosStorageReady(true);
    const onFirstGesture = () => {
      warmupPosSounds();
      window.removeEventListener("pointerdown", onFirstGesture);
      window.removeEventListener("keydown", onFirstGesture);
    };
    window.addEventListener("pointerdown", onFirstGesture, { once: true });
    window.addEventListener("keydown", onFirstGesture, { once: true });
    return () => {
      window.removeEventListener("pointerdown", onFirstGesture);
      window.removeEventListener("keydown", onFirstGesture);
    };
  }, []);

  // Reuse printer linked in Paramètres (no UI on caisse).
  useEffect(() => {
    void restoreThermalPrinter();
  }, []);

  useEffect(() => {
    if (currentUser === undefined) return;
    if (payment === "credit" && !allowCreditPayment) {
      setPayment("cash");
      setSelectedClientId(null);
    }
  }, [allowCreditPayment, currentUser, payment]);

  const tabCategories = useMemo(
    () => buildPosCategoryTabs(POS_SHELF_CATEGORIES, categories),
    [categories],
  );

  const activeCategory = tabCategories.includes(category) ? category : "Tout";

  const {
    cart,
    totalTtc,
    addToCart,
    addFromBarcodeScan,
    setQty,
    clearCart,
    loadCart,
    setLineUnitPrice,
    addMiscTotalLine,
  } = usePosCart([], { storageKey: "matjar:pos:cart-lines:v1" });

  const displayCart = useMemo(
    () =>
      cart.map((line) => {
        const product = shelfProducts.find((p) => p.id === line.productId);
        if (!product) return line;
        const needsImage = !line.image;
        const needsCost =
          !(line.costMad != null && line.costMad > 0) &&
          product.costMad != null &&
          product.costMad > 0;
        if (!needsImage && !needsCost) return line;
        return {
          ...line,
          ...(needsImage
            ? { image: product.image, imageAlt: product.imageAlt }
            : {}),
          ...(needsCost ? { costMad: product.costMad } : {}),
        };
      }),
    [cart, shelfProducts],
  );

  const effectiveSelectedClientId =
    selectedClient?.id ??
    (selectedClientId && selectedClientRow === undefined
      ? selectedClientId
      : null);

  useEffect(() => {
    if (selectedClientId && selectedClientRow === null) {
      setSelectedClientId(null);
    }
  }, [selectedClientId, selectedClientRow]);

  const clientCreditStatus = usePosClientCreditStatus({
    client: selectedClient,
    payment,
    cartTotalMad: totalTtc,
  });

  useEffect(() => {
    if (!posStorageReady) return;
    if (skipFirstSnapshotWrite.current) {
      skipFirstSnapshotWrite.current = false;
      return;
    }
    writePosCartSnapshot({
      cart,
      payment,
      selectedClientId: effectiveSelectedClientId,
    });
  }, [cart, effectiveSelectedClientId, payment, posStorageReady]);

  const canCheckout =
    cart.length > 0 &&
    !isCheckingOut &&
    !catalogLoading &&
    (payment === "cash" ||
      (allowCreditPayment &&
        !!effectiveSelectedClientId &&
        !clientCreditStatus.loading &&
        !clientCreditStatus.isCashOnly));
  const validProductIds = useMemo(
    () => new Set(shelfProducts.map((product) => product.id)),
    [shelfProducts],
  );

  const { headerSearchQuery, setHeaderSearchQuery } = useAdminChrome();
  const { mobileCatalogOpen } = usePosBarcodeScan();
  const trimmedSearch = headerSearchQuery.trim();
  /** Keep typing snappy: rank/filter the catalog off the urgent path. */
  const deferredSearch = useDeferredValue(trimmedSearch);
  const hasSearch = deferredSearch.length > 0;

  // While IndexedDB sync is incomplete, fall back to server name search.
  const serverSearchRows = useQuery(
    api.products.searchSummaries,
    hasSearch && (catalogSyncing || shelfProducts.length < 200)
      ? { query: deferredSearch, limit: 60 }
      : "skip",
  );

  const filteredProducts = useMemo(() => {
    const searchPool =
      hasSearch && serverSearchRows && serverSearchRows.length > 0
        ? mergeProductLists(
            shelfProducts,
            serverSearchRows.map(productFromConvex),
          )
        : shelfProducts;
    const base = hasSearch
      ? searchPool
      : activeCategory === "Tout"
        ? shelfProducts
        : shelfProducts.filter((p) => p.category === activeCategory);
    const byBrand = brandId
      ? base.filter((p) => p.brandId === brandId)
      : base;
    if (!hasSearch) {
      return sortProductsByBestSellers(byBrand, soldQtyByProductId);
    }
    // Closest to typed text first (exact → prefix → contains), then bestsellers.
    return filterAndRankProductsBySearch(byBrand, deferredSearch, (a, b) =>
      compareProductsByBestSellers(a, b, soldQtyByProductId),
    );
  }, [
    activeCategory,
    brandId,
    deferredSearch,
    hasSearch,
    serverSearchRows,
    shelfProducts,
    soldQtyByProductId,
  ]);

  const openAddProduct = useCallback(() => setAddProductOpen(true), []);

  const applyInvoiceReopen = useCallback(
    (payload: PosInvoiceReopenPayload) => {
      loadCart(payload.lines);
      setPayment(payload.payment);
      setSelectedClientId(payload.clientId);
      setCartOpen(true);
      playPosSound("add");
      toast.success(
        tr("Achat rechargé", "تم إعادة تحميل الشراء"),
        payload.invoiceNumber,
      );
    },
    [loadCart, toast, tr],
  );

  const handleReturnPurchaseToCaisse = useCallback(
    (payload: PosInvoiceReopenPayload) => {
      if (checkoutSession) {
        if (!payload.dryRun) {
          toast.error(
            tr("Caisse occupée", "الصندوق مشغول"),
            tr(
              "Terminez ou annulez la vente en cours avant de recharger un achat.",
              "أنهِ أو ألغِ البيع الجاري قبل إعادة تحميل شراء.",
            ),
          );
        }
        return false;
      }
      if (cart.length > 0) {
        if (!payload.dryRun) {
          toast.error(
            tr("Panier non vide", "السلة غير فارغة"),
            tr(
              "Videz ou mettez en attente le panier actuel avant de recharger cet achat.",
              "أفرغ السلة الحالية أو علّقها قبل إعادة تحميل هذا الشراء.",
            ),
          );
        }
        return false;
      }
      if (payload.dryRun) return true;
      applyInvoiceReopen(payload);
      return true;
    },
    [applyInvoiceReopen, cart.length, checkoutSession, toast, tr],
  );

  useEffect(() => {
    if (!posStorageReady) return;
    const pending = readPendingInvoiceReopen();
    if (!pending) return;
    clearPendingInvoiceReopen();
    if (!handleReturnPurchaseToCaisse(pending)) {
      writePendingInvoiceReopen(pending);
    }
  }, [handleReturnPurchaseToCaisse, posStorageReady]);

  const posClientHistory = useMemo(
    () => ({ clients, returnPurchaseToCaisse: handleReturnPurchaseToCaisse }),
    [clients, handleReturnPurchaseToCaisse],
  );

  const openCaisse = useCallback(
    (closeSheet: boolean) => {
      if (!allowCheckout || !canCheckout || checkoutSession) return;
      const staleLine = cart.find(
        (line) =>
          !isPosMiscLineId(line.productId) &&
          !validProductIds.has(line.productId),
      );
      if (staleLine) {
        playPosSound("error");
        toast.error(
          tr("Panier obsolète", "السلة قديمة"),
          tr(
            "Un article du panier n’existe plus dans le catalogue serveur. Le panier a été vidé.",
            "أحد عناصر السلة لم يعد موجودًا في كتالوج الخادم. تم تفريغ السلة.",
          ),
        );
        clearCart();
        clearPosCartSnapshot();
        return;
      }

      const missingPriceLine = cart.find(
        (line) => !Number.isFinite(line.unitPrice) || line.unitPrice <= 0,
      );
      if (missingPriceLine) {
        playPosSound("error");
        toast.error(
          tr("Prix manquant", "السعر ناقص"),
          tr(
            `« ${missingPriceLine.name} » n’a pas de prix. Touchez le prix dans le panier pour le saisir.`,
            `« ${missingPriceLine.name} » بلا سعر. المس السعر في السلة لإدخاله.`,
          ),
        );
        return;
      }

      const checkoutClient = selectedClient;

      setCheckoutSession({
        clientName:
          payment === "credit"
            ? checkoutClient?.fullName ?? "Client"
            : checkoutClient?.fullName ??
              tr("Client de passage", "عميل عابر"),
        paymentType: payment,
        totalMad: totalTtc,
        lines: cart.map((line) => ({
          ...(isPosMiscLineId(line.productId)
            ? {}
            : { productId: line.productId as Id<"products"> }),
          name: line.name,
          unitPriceMad: line.unitPrice,
          qty: line.qty,
        })),
        ...(effectiveSelectedClientId
          ? { clientId: effectiveSelectedClientId as Id<"clients"> }
          : {}),
      });

      clearCart();
      clearPosCartSnapshot();
      if (closeSheet) setCartOpen(false);
    },
    [
      allowCheckout,
      canCheckout,
      cart,
      checkoutSession,
      clearCart,
      effectiveSelectedClientId,
      payment,
      selectedClient,
      toast,
      totalTtc,
      tr,
      validProductIds,
    ],
  );

  const confirmCaisseCheckout = useCallback(
    async (session: PosCheckoutCaisseSession) => {
      setIsCheckingOut(true);
      try {
        const invoice = await checkoutSale({
          clientName: session.clientName,
          paymentType: session.paymentType,
          totalMad: session.totalMad,
          cashierName: "Caisse POS",
          lines: session.lines,
          ...(session.clientId ? { clientId: session.clientId } : {}),
        });
        playPosSound("checkout");
        return invoice;
      } catch (error) {
        playPosSound("error");
        toast.error(
          tr("Vente non enregistrée", "تعذر تسجيل البيع"),
          error instanceof Error ? error.message : tr("Réessayez.", "حاول مجددًا."),
        );
        return null;
      } finally {
        setIsCheckingOut(false);
      }
    },
    [checkoutSale, toast, tr],
  );

  const handleCaisseClosed = useCallback(
    (opts?: PosCheckoutClosedOptions) => {
      setCheckoutSession(null);
      clearPosCartSnapshot();
      if (opts?.nextClient) {
        setSelectedClientId(null);
        setPayment(allowCreditPayment ? "credit" : "cash");
      }
    },
    [allowCreditPayment],
  );

  const handleReturnToCart = useCallback(() => {
    if (!checkoutSession || isCheckingOut) return;

    const lines: CartLine[] = checkoutSession.lines.map((line) => {
      const product = line.productId
        ? shelfProducts.find((p) => p.id === line.productId)
        : undefined;
      return {
        productId: line.productId ?? createPosMiscLineId(),
        name: line.name,
        unitPrice: line.unitPriceMad,
        qty: line.qty,
        ...(product
          ? { image: product.image, imageAlt: product.imageAlt }
          : {}),
      };
    });

    loadCart(lines);
    setPayment(checkoutSession.paymentType);
    setSelectedClientId(checkoutSession.clientId ?? null);
    setCheckoutSession(null);
    setCartOpen(true);
  }, [checkoutSession, isCheckingOut, loadCart, shelfProducts]);

  const checkoutDisabledReason =
    cart.length === 0
      ? tr("Ajoutez des produits au panier.", "أضف منتجات إلى السلة.")
      : catalogLoading
        ? tr("Chargement du catalogue serveur.", "يتم تحميل كتالوج الخادم.")
        : payment === "credit" && !allowCreditPayment
          ? tr(
              "Vente à crédit non autorisée pour votre rôle.",
              "البيع الآجل غير مسموح لدورك.",
            )
          : payment === "credit" && !effectiveSelectedClientId
            ? tr(
                "Sélectionnez un client pour vendre à crédit.",
                "اختر عميلًا للبيع الآجل.",
              )
            : payment === "credit" && clientCreditStatus.loading
              ? tr(
                  "Chargement du crédit client…",
                  "جاري تحميل رصيد العميل…",
                )
              : payment === "credit" && clientCreditStatus.isCashOnly
                ? tr(
                    "Ce client est marqué comptant uniquement.",
                    "هذا العميل مخصص للدفع النقدي فقط.",
                  )
                : null;

  const resetActiveCart = useCallback(() => {
    clearCart();
    setPayment(allowCreditPayment ? "credit" : "cash");
    setSelectedClientId(null);
    clearPosCartSnapshot();
  }, [allowCreditPayment, clearCart]);

  const handleParkDraft = useCallback(async () => {
    if (cart.length === 0 || draftsBusy || !allowParkCart) return;
    const parkClient = selectedClient;
    setDraftsBusy(true);
    try {
      await parkCartDraft({
        label: allowCheckout
          ? buildDefaultDraftLabel({
              clientName: parkClient?.fullName ?? null,
              lines: cart,
              tr,
            })
          : buildAssistDraftLabel({
              clientName: parkClient?.fullName ?? null,
              aideName: currentUser?.name ?? currentUser?.email ?? "",
              tr,
            }),
        payment,
        lines: cart.map((line) => ({
          ...(isPosMiscLineId(line.productId)
            ? {}
            : { productId: line.productId as Id<"products"> }),
          name: line.name,
          unitPriceMad: line.unitPrice,
          qty: line.qty,
          ...(line.image ? { image: line.image } : {}),
          ...(line.imageAlt ? { imageAlt: line.imageAlt } : {}),
          ...(line.soldByWeight ? { soldByWeight: true } : {}),
        })),
        ...(effectiveSelectedClientId
          ? { clientId: effectiveSelectedClientId as Id<"clients"> }
          : {}),
        ...(selectedClient?.fullName
          ? { clientNameSnapshot: selectedClient.fullName }
          : {}),
      });
      resetActiveCart();
      toast.success(
        allowCheckout
          ? tr("Panier en attente", "سلة معلّقة")
          : tr("En attente caissier", "بانتظار الصندوق"),
        allowCheckout
          ? tr(
              "Vous pouvez servir un autre client. Reprenez le brouillon quand il revient.",
              "يمكنك خدمة عميل آخر. استأنف المسودة عند عودته.",
            )
          : tr(
              "Le caissier reprendra ce panier pour encaisser.",
              "سيتولى أمين الصندوق استئناف هذه السلة للتحصيل.",
            ),
      );
    } catch (error) {
      toast.error(
        tr("Enregistrement impossible", "تعذر الحفظ"),
        error instanceof Error ? error.message : tr("Réessayez.", "حاول مجددًا."),
      );
    } finally {
      setDraftsBusy(false);
    }
  }, [
    allowCheckout,
    allowParkCart,
    cart,
    currentUser,
    draftsBusy,
    effectiveSelectedClientId,
    parkCartDraft,
    payment,
    resetActiveCart,
    selectedClient,
    toast,
    tr,
  ]);

  const handleRestoreDraft = useCallback(
    async (draftId: PosCartDraftView["id"]) => {
      if (draftsBusy) return;
      if (cart.length > 0) {
        toast.error(
          tr("Panier non vide", "السلة غير فارغة"),
          tr(
            "Mettez le panier actuel en attente ou videz-le avant de reprendre un brouillon.",
            "علّق السلة الحالية أو أفرغها قبل استئناف مسودة.",
          ),
        );
        return;
      }
      setDraftsBusy(true);
      try {
        const restored = await restoreCartDraft({ draftId });
        loadCart(draftLinesToCartLines(restored.lines));
        setPayment(restored.payment);
        setSelectedClientId(restored.clientId);
        toast.success(
          tr("Brouillon repris", "تم استئناف المسودة"),
          restored.label,
        );
      } catch (error) {
        toast.error(
          tr("Impossible de reprendre", "تعذر الاستئناف"),
          error instanceof Error ? error.message : tr("Réessayez.", "حاول مجددًا."),
        );
      } finally {
        setDraftsBusy(false);
      }
    },
    [cart.length, draftsBusy, loadCart, restoreCartDraft, toast, tr],
  );

  const handleDeleteDraft = useCallback(
    async (draftId: PosCartDraftView["id"]) => {
      if (draftsBusy) return;
      setDraftsBusy(true);
      try {
        await removeCartDraft({ draftId });
        toast.success(tr("Brouillon supprimé", "تم حذف المسودة"), "");
      } catch (error) {
        toast.error(
          tr("Suppression impossible", "تعذر الحذف"),
          error instanceof Error ? error.message : tr("Réessayez.", "حاول مجددًا."),
        );
      } finally {
        setDraftsBusy(false);
      }
    },
    [draftsBusy, removeCartDraft, toast, tr],
  );

  const draftHandlers = {
    drafts: cartDrafts,
    draftsLoading: cartDrafts === undefined,
    draftsBusy,
    onParkDraft: () => void handleParkDraft(),
    onRestoreDraft: (draftId: PosCartDraftView["id"]) =>
      void handleRestoreDraft(draftId),
    onDeleteDraft: (draftId: PosCartDraftView["id"]) =>
      void handleDeleteDraft(draftId),
  };

  const handlePosBarcodeScan = useCallback(
    async (raw: string) => {
      let hit = findProductByBarcode(shelfProducts, raw);
      if (!hit) {
        const row = await convex.query(api.products.findByBarcode, {
          barcode: raw,
          includeInactive: true,
        });
        if (row?.active) hit = productFromConvex(row);
        else if (row && !row.active) {
          playPosSound("error");
          toast.error(
            tr("Article inactif", "منتج غير نشط"),
            tr(
              `« ${row.name} » existe mais est désactivé. Réactivez-le depuis le stock.`,
              `« ${row.name} » موجود لكنه معطّل. أعد تفعيله من المخزون.`,
            ),
          );
          return;
        }
      }
      if (!hit) {
        playPosSound("error");
        toast.error(
          tr("Code inconnu", "رمز غير معروف"),
          tr(
            "Aucun article avec ce code-barres. Ajoutez-le depuis Nouveau produit.",
            "لا يوجد منتج بهذا الباركود. أضفه من منتج جديد.",
          ),
        );
        return;
      }

      if (cart.some((line) => line.productId === hit.id)) {
        playPosSound("duplicate");
        const now = Date.now();
        if (now - lastDuplicateBarcodeToastAtRef.current > 2000) {
          lastDuplicateBarcodeToastAtRef.current = now;
          toast.error(
            tr("Déjà dans le panier", "موجود في السلة"),
            tr(
              "Modifiez la quantité sur la ligne du panier.",
              "عدّل الكمية من سطر السلة.",
            ),
          );
        }
        return;
      }

      addFromBarcodeScan(hit);
      toast.success(hit.name, tr("Ajouté au panier (×1)", "أُضيف إلى السلة (×1)"));
    },
    [addFromBarcodeScan, cart, convex, shelfProducts, toast, tr],
  );

  // USB / keyboard-wedge scanner: scan anywhere on POS — no barcode button click.
  useHardwareBarcodeWedge({
    enabled:
      allowCheckout &&
      !checkoutSession &&
      !miscTotalOpen &&
      !addProductOpen &&
      !isCheckingOut,
    onScan: (code) => {
      setHeaderSearchQuery("");
      void handlePosBarcodeScan(code);
    },
  });

  const posBarcode = useMemo(
    () => ({ products: shelfProducts, onBarcodeScan: handlePosBarcodeScan }),
    [handlePosBarcodeScan, shelfProducts],
  );

  const posCartActions = useMemo(
    () => ({ onClearCart: resetActiveCart }),
    [resetActiveCart],
  );

  const posDrafts = useMemo(
    () =>
      canManageDrafts
        ? {
            drafts: cartDrafts,
            draftsLoading: cartDrafts === undefined,
            draftsBusy,
            onRestoreDraft: (draftId: PosCartDraftView["id"]) =>
              void handleRestoreDraft(draftId),
            onDeleteDraft: (draftId: PosCartDraftView["id"]) =>
              void handleDeleteDraft(draftId),
          }
        : undefined,
    [
      canManageDrafts,
      cartDrafts,
      draftsBusy,
      handleDeleteDraft,
      handleRestoreDraft,
    ],
  );

  const openMiscTotal = useCallback(() => {
    setMiscTotalOpen(true);
  }, []);

  useRegisterPosAdminHeader(
    canAddProducts ? openAddProduct : undefined,
    posBarcode,
    posClientHistory,
    posCartActions,
    posDrafts,
    allowCheckout ? openMiscTotal : undefined,
  );

  const sharedCartProps = {
    cart: displayCart,
    totalTtc,
    payment,
    onPaymentChange: setPayment,
    selectedClientId: effectiveSelectedClientId,
    onClientChange: setSelectedClientId,
    checkoutDisabledReason,
    onLineQtyChange: setQty,
    onLineUnitPriceChange: setLineUnitPrice,
    allowCreditPayment,
    allowPriceEdit,
    allowCheckout,
    allowParkDraft: allowCheckout && allowParkCart,
    parkDisabled: cart.length === 0 || !allowParkCart,
    parkBusy: draftsBusy,
    canManageDrafts,
    ...draftHandlers,
  };

  // Show POS as soon as the catalog is ready — don't wait on 1400+ clients.
  if (catalogLoading) {
    return <PosPageSkeleton />;
  }

  return (
      <div className="pos-surface relative flex h-full min-h-0 flex-1 flex-col overflow-hidden">
      <PosCartPriceKeypadDialog
        open={miscTotalOpen}
        onOpenChange={setMiscTotalOpen}
        productName={tr("Montant libre", "مبلغ حر")}
        unitPriceMad={0}
        locale={locale}
        tr={tr}
        labelFr="Montant (DH)"
        labelAr="المبلغ (درهم)"
        enableNote
        onConfirm={(amountMad, note) => {
          addMiscTotalLine(
            amountMad,
            note?.trim() || tr("Divers", "متنوع"),
          );
          setMiscTotalOpen(false);
        }}
      />
      <PosCheckoutCaisseDialog
        session={checkoutSession}
        onConfirmCheckout={confirmCaisseCheckout}
        onClosed={handleCaisseClosed}
        onReturnToCart={handleReturnToCart}
        isConfirming={isCheckingOut}
        locale={locale}
        tr={tr}
      />
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden md:flex-row md:items-stretch">
        <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
          {canManageDrafts ? (
            <PosCartDraftsBanner
              className="hidden md:flex"
              drafts={cartDrafts}
              loading={cartDrafts === undefined}
              locale={locale}
              tr={tr}
              onRestoreDraft={(draftId) => void handleRestoreDraft(draftId)}
              onDeleteDraft={(draftId) => void handleDeleteDraft(draftId)}
              busy={draftsBusy}
            />
          ) : null}
          <PosCatalogSection
            className={cn("hidden md:flex", mobileCatalogOpen && "max-md:flex")}
            compact={mobileCatalogOpen}
            category={activeCategory}
            onCategoryChange={setCategory}
            tabCategories={tabCategories}
            brands={brands}
            activeBrandId={brandId}
            onBrandChange={setBrandId}
            brandAllLabel={tr("Tout", "الكل")}
            products={filteredProducts}
            onAddToCart={addToCart}
            listResetKey={`${activeCategory}\0${brandId ?? ""}\0${deferredSearch}`}
          />
          <AddProductDialog
            open={addProductOpen && canAddProducts}
            onOpenChange={setAddProductOpen}
          />
          <PosMobileCaisseCart
            {...sharedCartProps}
            onCheckout={() => openCaisse(true)}
            onBarcodeScan={handlePosBarcodeScan}
            className={mobileCatalogOpen ? "max-md:hidden" : undefined}
          />
          <div className="hidden md:contents">
            <PosCartSheet
              open={cartOpen}
              onOpenChange={setCartOpen}
              onClearCart={() => {
                resetActiveCart();
                setCartOpen(false);
              }}
              onCheckout={() => openCaisse(true)}
              {...sharedCartProps}
            />
          </div>
        </div>
        <PosCartPanel
          className="hidden min-h-0 md:flex"
          onClearCart={resetActiveCart}
          onCheckout={() => openCaisse(false)}
          {...sharedCartProps}
        />
      </div>
    </div>
  );
}
