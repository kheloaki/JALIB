"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useQuery } from "convex/react";
import {
  Keyboard,
  Maximize2,
  PackagePlus,
  PanelLeftOpen,
  Search,
} from "lucide-react";
import { useLocale, useTranslations } from "next-intl";

import { useAdminChrome } from "@/components/layout/admin-chrome-context";
import { AdminAlertsBell } from "@/components/layout/admin-alerts-bell";
import { CollapsibleHeaderSearch } from "@/components/layout/collapsible-header-search";
import { CreditsHeaderTabs } from "@/components/credits/credits-header-tabs";
import { StockHeaderTabs } from "@/components/stock/stock-header-tabs";
import { Button } from "@/components/ui/button";
import { PosHeaderBarcode } from "@/components/pos/pos-header-barcode";
import { PosHeaderClientHistory } from "@/components/pos/pos-header-client-history";
import { PosHeaderMiscTotal } from "@/components/pos/pos-header-misc-total";
import { PosHeaderMobileCatalogSearch } from "@/components/pos/pos-header-mobile-catalog-search";
import { PosHeaderPendingCarts } from "@/components/pos/pos-header-pending-carts";
import { PosSoundsToggle } from "@/components/pos/pos-sounds-toggle";
import { usePosBarcodeScanOptional } from "@/components/pos/pos-barcode-scan-context";
import { usePosKeyboardOptional } from "@/components/pos/pos-keyboard-context";
import { api } from "@/convex/_generated/api";
import {
  canLeavePos,
  firstAccessiblePathOutsidePos,
} from "@/lib/auth/permissions";
import { getAdminHeaderTitleKey } from "@/lib/admin/page-title";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";

function getSearchPlaceholderKey(
  pathname: string | null,
  tab: string | null,
): string {
  if (!pathname) return "default";
  if (pathname.includes("/dashboard")) return "dashboard";
  if (pathname.includes("/pos")) return "pos";
  if (pathname.includes("/credits")) return "credits";
  if (pathname.includes("/alertes")) return "alerts";
  if (pathname.includes("/clients")) return "clients";
  if (pathname.includes("/factures")) return "invoices";
  if (pathname.includes("/produits")) return "products";
  if (pathname.includes("/retours")) return "returns";
  if (pathname.includes("/parametres") && tab === "roles") return "roles";
  if (pathname.includes("/stock") && (tab === "returns" || tab === "retours")) {
    return "returns";
  }
  if (pathname.includes("/stock") && (tab === "procurement" || tab === "achats")) {
    return "procurement";
  }
  if (pathname.includes("/achats")) return "procurement";
  if (pathname.includes("/stock")) return "stock";
  return "default";
}

const searchPlaceholdersFR: Record<string, string> = {
  default: "Rechercher…",
  dashboard: "Rechercher un client (encours)…",
  pos: "Rechercher un produit…",
  credits: "Rechercher un client, une facture…",
  alerts: "Rechercher une alerte…",
  clients: "Rechercher un client…",
  invoices: "Rechercher une facture…",
  products: "Rechercher un produit…",
  returns: "Rechercher une facture ou un client (Nom/Tél)…",
  roles: "Rechercher un rôle, une permission…",
  stock: "Rechercher un produit (nom, code-barres)…",
  procurement: "Rechercher un produit ou une liste d'achats…",
};

const searchPlaceholdersAR: Record<string, string> = {
  default: "بحث…",
  dashboard: "البحث عن عميل (قيد التنفيذ)…",
  pos: "البحث عن منتج…",
  credits: "البحث عن عميل أو فاتورة…",
  alerts: "البحث عن تنبيه…",
  clients: "البحث عن عميل…",
  invoices: "البحث عن فاتورة…",
  products: "البحث عن منتج…",
  returns: "البحث عن فاتورة أو عميل (الاسم/الهاتف)…",
  roles: "البحث عن دور أو إذن…",
  stock: "البحث عن منتج (الاسم، الباركود)…",
  procurement: "البحث عن منتج أو قائمة مشتريات…",
};

function PosToolbarControls({
  locale,
  onQuickAdd,
  showQuickAdd = true,
  showKeyboard = true,
}: {
  locale: string;
  onQuickAdd?: () => void;
  showQuickAdd?: boolean;
  showKeyboard?: boolean;
}) {
  const posKeyboard = usePosKeyboardOptional();
  const isAr = locale === "ar";

  return (
    <>
      {showKeyboard && posKeyboard ? (
        <Button
          type="button"
          variant="outline"
          size="icon"
          onClick={() => posKeyboard.toggleEnabled()}
          aria-pressed={posKeyboard.isEnabled}
          className={cn(
            "size-10 shrink-0 rounded-full transition-colors",
            posKeyboard.isEnabled
              ? "bg-primary text-primary-foreground shadow-[0_2px_8px_rgba(37,99,235,0.28)] hover:bg-primary/90"
              : "pf-icon-btn border-0 opacity-70",
          )}
          aria-label={
            posKeyboard.isEnabled
              ? isAr
                ? "إيقاف لوحة المفاتيح"
                : "Désactiver le clavier"
              : isAr
                ? "تفعيل لوحة المفاتيح"
                : "Activer le clavier"
          }
          title={
            posKeyboard.isEnabled
              ? isAr
                ? "لوحة المفاتيح: مفعّلة"
                : "Clavier : actif"
              : isAr
                ? "لوحة المفاتيح: معطّلة"
                : "Clavier : inactif"
          }
        >
          <Keyboard className="size-5 stroke-[1.75]" aria-hidden />
        </Button>
      ) : null}
      {showQuickAdd && onQuickAdd ? (
        <Button
          type="button"
          variant="outline"
          size="icon"
          onClick={onQuickAdd}
          className="pf-icon-btn size-10 shrink-0 border-0"
          aria-label={isAr ? "منتج جديد" : "Nouveau produit"}
          title={isAr ? "منتج جديد" : "Nouveau produit"}
        >
          <PackagePlus className="size-5 stroke-[1.75]" aria-hidden />
        </Button>
      ) : null}
    </>
  );
}

/**
 * Barre supérieure unique pour tout le back-office (même gabarit que la caisse).
 */
export function AdminAppHeader() {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const locale = useLocale();
  const tNav = useTranslations("navigation");
  const currentUser = useQuery(api.authz.currentUser);
  const {
    headerSearchQuery,
    setHeaderSearchQuery,
    posToolbar,
    isPosFocusMode,
    enterPosFocusMode,
    exitPosFocusMode,
  } = useAdminChrome();
  const isAr = locale === "ar";

  const isPos = pathname?.includes("/pos") ?? false;
  const isStock = pathname?.includes("/stock") ?? false;
  const isCredits = pathname?.includes("/credits") ?? false;
  const pageTitleKey = getAdminHeaderTitleKey(pathname);
  const isMobile = useIsMobile();
  const posMobileView = usePosBarcodeScanOptional();
  const mobileCatalogOpen = posMobileView?.mobileCatalogOpen ?? false;
  const permissions = currentUser?.permissions ?? [];
  const showQuitCaisse = canLeavePos(permissions);
  const onQuickAdd = posToolbar?.onQuickAdd;
  const onMiscTotal = posToolbar?.onMiscTotal;
  const posBarcode = posToolbar?.barcode;
  const posClientHistory = posToolbar?.clientHistory;
  const posCartActions = posToolbar?.cartActions;
  const posDrafts = posToolbar?.drafts;

  function handleExitCaisse() {
    posMobileView?.closeMobileCatalog();
    if (isMobile) {
      const target = firstAccessiblePathOutsidePos(permissions);
      router.push(`/${locale}${target}`);
      return;
    }
    exitPosFocusMode();
  }

  const searchPlaceholder = isAr
    ? searchPlaceholdersAR[
        getSearchPlaceholderKey(pathname, searchParams.get("tab"))
      ]
    : searchPlaceholdersFR[
        getSearchPlaceholderKey(pathname, searchParams.get("tab"))
      ];

  if (isPos && isPosFocusMode) {
    if (isMobile && mobileCatalogOpen) {
      return (
        <header className="z-40 flex h-14 shrink-0 items-center gap-2 bg-[var(--shell-main)] px-4 sm:px-6">
          <PosHeaderMobileCatalogSearch placeholder={searchPlaceholder} />
          {onMiscTotal ? (
            <PosHeaderMiscTotal onMiscTotal={onMiscTotal} locale={locale} />
          ) : null}
          {posDrafts ? (
            <PosHeaderPendingCarts drafts={posDrafts} locale={locale} />
          ) : null}
          {onQuickAdd ? (
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={onQuickAdd}
              className="pf-icon-btn size-10 shrink-0 border-0"
              aria-label={isAr ? "منتج جديد" : "Nouveau produit"}
              title={isAr ? "منتج جديد" : "Nouveau produit"}
            >
              <PackagePlus className="size-5 stroke-[1.5]" aria-hidden />
            </Button>
          ) : null}
        </header>
      );
    }

    return (
      <header className="z-40 flex h-[4.5rem] shrink-0 items-center gap-3 bg-[var(--shell-main)] px-5 sm:px-8">
        <div className="flex min-w-0 flex-1 items-center gap-2 overflow-hidden">
          {showQuitCaisse ? (
            <Button
              type="button"
              onClick={handleExitCaisse}
              className="bg-error text-on-error hover:brightness-95 h-10 shrink-0 rounded-full border-0 px-3 text-xs font-bold shadow-sm"
              aria-label={isAr ? "الخروج من وضع الصندوق" : "Quitter le mode caisse"}
            >
              <span className="inline-flex items-center gap-2" dir="ltr">
                <PanelLeftOpen
                  className="size-4 shrink-0 stroke-[1.75] text-inherit"
                  aria-hidden
                />
                <span className="hidden text-xs sm:inline">
                  {isAr ? "خروج الصندوق" : "Quitter caisse"}
                </span>
              </span>
            </Button>
          ) : null}
          {isMobile ? (
            <PosHeaderMobileCatalogSearch placeholder={searchPlaceholder} />
          ) : (
            <div className="relative min-w-0 flex-1">
              <Search
                className="text-muted-foreground pointer-events-none absolute top-1/2 left-5 size-[18px] -translate-y-1/2 stroke-[1.5]"
                aria-hidden
              />
              <input
                type="search"
                value={headerSearchQuery}
                onChange={(e) => setHeaderSearchQuery(e.target.value)}
                placeholder={searchPlaceholder}
                className="pf-search text-on-surface w-full"
                aria-label={searchPlaceholder}
              />
            </div>
          )}
          {onMiscTotal ? (
            <PosHeaderMiscTotal onMiscTotal={onMiscTotal} locale={locale} />
          ) : null}
          {posBarcode ? (
            <PosHeaderBarcode
              products={posBarcode.products}
              onBarcodeScan={posBarcode.onBarcodeScan}
            />
          ) : null}
          {posClientHistory ? (
            <PosHeaderClientHistory
              clients={posClientHistory.clients}
              tr={(fr, ar) => (isAr ? ar : fr)}
            />
          ) : null}
        </div>
        <div className="flex min-w-0 shrink-0 items-center gap-2">
          {isMobile && posDrafts ? (
            <PosHeaderPendingCarts drafts={posDrafts} locale={locale} />
          ) : null}
          {posCartActions && !isMobile ? (
            <>
              <PosSoundsToggle />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={posCartActions.onClearCart}
                className="text-error hover:text-error hover:bg-error/10 h-10 shrink-0 rounded-xl px-2 text-xs font-bold"
              >
                {isAr ? "تفريغ" : "Vider"}
              </Button>
            </>
          ) : null}
          <PosToolbarControls
            locale={locale}
            onQuickAdd={onQuickAdd}
            showKeyboard={!isMobile}
          />
        </div>
      </header>
    );
  }

  if (isPos && !isPosFocusMode) {
    return (
      <header className="z-40 flex h-[4.5rem] shrink-0 items-center justify-between gap-4 bg-[var(--shell-main)] px-5 sm:px-8">
        <div className="relative min-w-0 flex-1">
          <Search
            className="text-muted-foreground pointer-events-none absolute top-1/2 left-5 size-[18px] -translate-y-1/2 stroke-[1.5]"
            aria-hidden
          />
          <input
            type="search"
            value={headerSearchQuery}
            onChange={(e) => setHeaderSearchQuery(e.target.value)}
            placeholder={searchPlaceholder}
            className="pf-search text-on-surface w-full"
            aria-label={searchPlaceholder}
          />
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {onMiscTotal ? (
            <PosHeaderMiscTotal onMiscTotal={onMiscTotal} locale={locale} />
          ) : null}
          {posBarcode ? (
            <PosHeaderBarcode
              products={posBarcode.products}
              onBarcodeScan={posBarcode.onBarcodeScan}
            />
          ) : null}
          <PosToolbarControls
            locale={locale}
            onQuickAdd={onQuickAdd}
            showKeyboard={!isMobile}
          />
              <Button
                type="button"
                variant="outline"
                onClick={enterPosFocusMode}
                className="hidden h-10 gap-2 rounded-full border-[var(--border)] bg-white px-3 text-xs font-bold shadow-sm sm:flex"
                aria-label={isAr ? "وضع الصندوق" : "Mode caisse"}
              >
            <Maximize2 className="size-4 shrink-0 stroke-[1.5]" aria-hidden />
            <span>{isAr ? "وضع الصندوق" : "Mode caisse"}</span>
          </Button>
          <AdminAlertsBell />
        </div>
      </header>
    );
  }

  return (
    <header className="z-40 flex h-12 shrink-0 items-center gap-2 bg-[var(--shell-main)] px-3 sm:h-14 sm:gap-3 sm:px-6 lg:px-8">
      {isStock ? (
        <StockHeaderTabs />
      ) : isCredits ? (
        <CreditsHeaderTabs />
      ) : pageTitleKey ? (
        <h1 className="min-w-0 flex-1 truncate text-base font-bold tracking-tight sm:text-lg">
          {tNav(pageTitleKey)}
        </h1>
      ) : (
        <div className="min-w-0 flex-1" />
      )}
      <div className="flex shrink-0 items-center gap-1.5 sm:gap-2.5">
        <CollapsibleHeaderSearch
          value={headerSearchQuery}
          onChange={setHeaderSearchQuery}
          placeholder={searchPlaceholder}
        />
        <AdminAlertsBell />
      </div>
    </header>
  );
}
