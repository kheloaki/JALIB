"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  Check,
  CreditCard,
  Loader2,
  Printer,
  ReceiptText,
  UserRound,
} from "lucide-react";
import { useQuery } from "convex/react";

import {
  InvoiceReceiptPreview,
  type InvoiceReceiptMode,
} from "@/components/invoices/invoice-receipt-preview";
import { Button } from "@/components/ui/button";
import {
  PosDialog,
  PosDialogContent,
  PosDialogDescription,
  PosDialogHeader,
  PosDialogTitle,
} from "@/components/pos/pos-dialog";
import type { Id } from "@/convex/_generated/dataModel";
import type { PaymentMethod } from "@/components/pos/types";
import { useKeypadKeyboard } from "@/hooks/use-keypad-keyboard";
import type { Invoice } from "@/lib/invoices/types";
import { clampMadPrice, parseMadToNumber } from "@/lib/money/mad";
import { printElementById, prefetchPrintLogo } from "@/lib/print/wait-for-print-images";
import { STORE_LOGO_PRINT_PATH } from "@/lib/brand/constants";
import { formatPosDh } from "@/lib/pos/format-pos-dh";
import { cn } from "@/lib/utils";
import { api } from "@/convex/_generated/api";
import { toReceiptSettings } from "@/lib/i18n/app-document-settings";
import {
  isThermalPrinterActive,
  printRawEscPos,
} from "@/lib/print/thermal-printer";
import { buildClientReceiptEscPos } from "@/lib/print/build-client-receipt-escpos";
import { computeEan13CheckDigit } from "@/lib/invoices/barcode";

export type PosCheckoutCaisseLine = {
  productId?: Id<"products">;
  name: string;
  unitPriceMad: number;
  qty: number;
};

export type PosCheckoutCaisseSession = {
  clientName: string;
  paymentType: PaymentMethod;
  totalMad: number;
  lines: PosCheckoutCaisseLine[];
  clientId?: Id<"clients">;
};

export type PosCheckoutResult = {
  id: Id<"invoices">;
  number: string;
  barcode: string;
  date: string;
  time: string;
  clientName: string;
  paymentType: PaymentMethod;
  totalMad: number;
  status: "paid" | "pending";
};

export type PosCheckoutClosedOptions = {
  nextClient?: boolean;
};

type PrintChoice = "client" | "owner" | "both";

type PosCheckoutCaisseDialogProps = {
  session: PosCheckoutCaisseSession | null;
  onConfirmCheckout: (
    session: PosCheckoutCaisseSession,
  ) => Promise<PosCheckoutResult | null>;
  onClosed: (opts?: PosCheckoutClosedOptions) => void;
  onReturnToCart: () => void;
  isConfirming: boolean;
  locale: string;
  tr: (fr: string, ar: string) => string;
};

function CaisseKey({
  label,
  onPress,
  className,
  ariaLabel,
}: {
  label: string;
  onPress: () => void;
  className?: string;
  ariaLabel?: string;
}) {
  return (
    <button
      type="button"
      onMouseDown={(e) => e.preventDefault()}
      onClick={onPress}
      aria-label={ariaLabel ?? label}
      className={cn(
        "bg-surface-container-lowest text-on-surface hover:bg-primary/8 flex h-10 items-center justify-center rounded-xl border border-primary/10 text-lg font-black tabular-nums shadow-sm transition-colors active:scale-[0.98] sm:h-11 sm:text-xl",
        className,
      )}
    >
      {label}
    </button>
  );
}

function parseTenderDraft(draft: string): number {
  const parsed = parseMadToNumber(draft);
  if (parsed === null) return 0;
  return clampMadPrice(parsed);
}

function tenderToDraft(amount: number, locale: string): string {
  if (amount <= 0) return "";
  const fixed = (Math.round(amount * 100) / 100).toFixed(2);
  return locale === "ar" ? fixed : fixed.replace(".", ",");
}

function draftBarcode(): string {
  const payload = "209000000000";
  return `${payload}${computeEan13CheckDigit(payload)}`;
}

function buildDraftInvoiceFromSession(
  session: PosCheckoutCaisseSession,
): Invoice {
  const now = new Date();
  const date = now.toISOString().slice(0, 10);
  const time = now.toLocaleTimeString("fr-FR", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const lines = session.lines.map((line, lineIndex) => ({
    lineIndex,
    nameAr: line.name,
    qty: line.qty,
    unitPriceMad: line.unitPriceMad,
    ...(line.productId ? { productId: line.productId } : {}),
  }));

  const base = {
    id: "draft-print",
    number: "—",
    barcode: draftBarcode(),
    date,
    time,
    clientName: session.clientName,
    cashierId: "",
    lines,
    totalMad: session.totalMad,
    paymentHistory: [],
  };

  if (session.paymentType === "cash") {
    return {
      ...base,
      status: "paid" as const,
      paymentType: "cash" as const,
      paidMad: session.totalMad,
    };
  }

  return {
    ...base,
    status: "pending" as const,
    paymentType: "credit" as const,
  };
}

function printChoiceToModes(choice: PrintChoice): InvoiceReceiptMode[] {
  if (choice === "both") return ["client", "owner"];
  return [choice];
}

function articleSummary(lines: PosCheckoutCaisseLine[]): string {
  if (lines.length === 0) return "";
  const preview = lines
    .slice(0, 2)
    .map((line) => `${line.name} ×${line.qty}`)
    .join(", ");
  if (lines.length <= 2) return preview;
  return `${preview} +${lines.length - 2}`;
}

export function PosCheckoutCaisseDialog({
  session,
  onConfirmCheckout,
  onClosed,
  onReturnToCart,
  isConfirming,
  locale,
  tr,
}: PosCheckoutCaisseDialogProps) {
  const open = session !== null;
  const totalMad = session?.totalMad ?? 0;
  const isCash = session?.paymentType === "cash";
  const hasClient = Boolean(session?.clientId);

  const [tenderDraft, setTenderDraft] = useState("");
  const replaceNextRef = useRef(true);
  const [keepClient, setKeepClient] = useState(true);
  const [printPickerOpen, setPrintPickerOpen] = useState(false);
  const [receiptMode, setReceiptMode] = useState<InvoiceReceiptMode>("client");
  const [printInvoice, setPrintInvoice] = useState<Invoice | null>(null);
  const [printQueue, setPrintQueue] = useState<InvoiceReceiptMode[]>([]);
  const printingRef = useRef(false);
  const settingsRow = useQuery(api.settings.getAppSettings);
  const receiptSettings = toReceiptSettings(settingsRow);

  useEffect(() => {
    if (!open) return;
    setTenderDraft("");
    replaceNextRef.current = true;
    setKeepClient(true);
    setPrintPickerOpen(false);
    setReceiptMode("client");
    setPrintInvoice(null);
    setPrintQueue([]);
    printingRef.current = false;
    prefetchPrintLogo(STORE_LOGO_PRINT_PATH);
  }, [open, session?.totalMad, session?.clientName]);

  const tenderMad = parseTenderDraft(tenderDraft);
  const changeMad =
    isCash && tenderMad >= totalMad
      ? Math.round((tenderMad - totalMad) * 100) / 100
      : 0;
  const tenderShort = isCash && tenderMad > 0 && tenderMad < totalMad;

  const enterDigit = useCallback((digit: string) => {
    setTenderDraft((prev) => {
      if (replaceNextRef.current) {
        replaceNextRef.current = false;
        return digit;
      }
      if (prev.replace(/\D/g, "").length >= 9) return prev;
      return prev + digit;
    });
  }, []);

  const enterDecimal = useCallback(() => {
    setTenderDraft((prev) => {
      const sep = locale === "ar" ? "." : ",";
      if (prev.includes(sep) || prev.includes(".") || prev.includes(",")) {
        return prev;
      }
      if (replaceNextRef.current) {
        replaceNextRef.current = false;
        return `0${sep}`;
      }
      return prev === "" ? `0${sep}` : `${prev}${sep}`;
    });
  }, [locale]);

  const backspace = useCallback(() => {
    replaceNextRef.current = false;
    setTenderDraft((prev) => prev.slice(0, -1));
  }, []);

  const clearTender = useCallback(() => {
    replaceNextRef.current = true;
    setTenderDraft("");
  }, []);

  const setExactTender = useCallback(() => {
    replaceNextRef.current = true;
    setTenderDraft(tenderToDraft(totalMad, locale));
  }, [locale, totalMad]);

  const queueDraftPrint = useCallback(
    (choice: PrintChoice) => {
      if (!session) return;
      setPrintInvoice(buildDraftInvoiceFromSession(session));
      setPrintQueue(printChoiceToModes(choice));
      setPrintPickerOpen(false);
    },
    [session],
  );

  const handleValidateSale = useCallback(async () => {
    if (!session || isConfirming) return;
    const result = await onConfirmCheckout(session);
    if (!result) return;
    onClosed({ nextClient: hasClient && !keepClient });
  }, [
    hasClient,
    isConfirming,
    keepClient,
    onClosed,
    onConfirmCheckout,
    session,
  ]);

  useEffect(() => {
    if (printQueue.length === 0 || !printInvoice) {
      printingRef.current = false;
      return;
    }
    if (printingRef.current) return;
    const mode = printQueue[0]!;
    if (receiptMode !== mode) {
      setReceiptMode(mode);
      return;
    }

    let cancelled = false;
    printingRef.current = true;
    void (async () => {
      if (mode === "client" && isThermalPrinterActive()) {
        try {
          const payload = buildClientReceiptEscPos(printInvoice, {
            businessName: receiptSettings.businessName,
            storePhone: receiptSettings.storePhone,
            storeAddress: receiptSettings.storeAddress,
            receiptFooter: receiptSettings.receiptFooter,
            documentLocale: receiptSettings.documentLocale,
          });
          await printRawEscPos(payload);
          if (cancelled) return;
          printingRef.current = false;
          setPrintQueue((prev) => prev.slice(1));
          return;
        } catch {
          // Fall through to browser print if direct print fails.
        }
      }

      await new Promise<void>((resolve) => {
        window.requestAnimationFrame(() => {
          window.requestAnimationFrame(() => resolve());
        });
      });
      if (cancelled) return;
      await printElementById("invoice-print-area", 600);
    })();

    return () => {
      cancelled = true;
    };
  }, [
    printInvoice,
    printQueue,
    receiptMode,
    receiptSettings.businessName,
    receiptSettings.documentLocale,
    receiptSettings.receiptFooter,
    receiptSettings.storeAddress,
    receiptSettings.storePhone,
  ]);

  useEffect(() => {
    if (!open) return;
    function handleAfterPrint() {
      printingRef.current = false;
      setPrintQueue((prev) => prev.slice(1));
    }
    window.addEventListener("afterprint", handleAfterPrint);
    return () => window.removeEventListener("afterprint", handleAfterPrint);
  }, [open]);

  useKeypadKeyboard(open && isCash && !isConfirming && !printPickerOpen, {
    onDigit: enterDigit,
    onDecimal: enterDecimal,
    onBackspace: backspace,
    onClear: clearTender,
    onConfirm: () => void handleValidateSale(),
  });

  const displayTender = formatPosDh(tenderMad, 2, locale);
  const linesSummary = session ? articleSummary(session.lines) : "";

  return (
    <>
      <PosDialog open={open} onOpenChange={() => {}}>
        <PosDialogContent
          showCloseButton={false}
          className="border-sidebar-border bg-surface-container-lowest text-on-surface top-0 left-0 flex h-[100dvh] w-full max-w-none translate-x-0 translate-y-0 flex-col gap-0 overflow-hidden rounded-none p-0 sm:top-1/2 sm:left-1/2 sm:h-auto sm:max-h-[98dvh] sm:w-[calc(100%-2rem)] sm:max-w-2xl sm:translate-x-[-50%] sm:translate-y-[-50%] sm:rounded-3xl"
        >
          <PosDialogHeader className="border-sidebar-border/80 shrink-0 space-y-1 border-b px-4 py-3 text-center sm:px-5">
            <PosDialogDescription className="text-primary text-[10px] font-bold tracking-widest uppercase">
              {tr("Caisse — vente en cours", "الصندوق — بيع جاري")}
            </PosDialogDescription>
            <div className="flex items-center justify-between gap-3">
              <PosDialogTitle className="text-base font-black sm:text-lg">
                {tr("Encaissement", "التحصيل")}
              </PosDialogTitle>
              <p
                className="text-primary text-2xl leading-none font-black tabular-nums sm:text-3xl"
                aria-live="polite"
              >
                {formatPosDh(totalMad, 2, locale)}
              </p>
            </div>
            {session ? (
              <p className="text-on-surface-variant flex items-center justify-center gap-1 text-xs font-medium sm:text-sm">
                <UserRound className="size-3.5 shrink-0" aria-hidden />
                <span className="truncate">{session.clientName}</span>
                <span className="text-outline shrink-0">·</span>
                <span
                  className={cn(
                    "shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-black uppercase",
                    isCash
                      ? "bg-secondary-container text-on-secondary-container"
                      : "bg-tertiary-fixed text-on-tertiary-fixed",
                  )}
                >
                  {isCash
                    ? tr("Espèces", "نقدًا")
                    : tr("Crédit", "آجل")}
                </span>
              </p>
            ) : null}
            {linesSummary ? (
              <p className="text-on-surface-variant truncate text-[11px] font-medium">
                {linesSummary}
              </p>
            ) : null}
          </PosDialogHeader>

          <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-hidden px-4 py-2 sm:gap-3 sm:px-5 sm:py-3">
            {isCash ? (
              <div className="grid min-h-0 flex-1 grid-cols-2 gap-2 sm:gap-3">
                <div className="flex flex-col gap-2">
                  <div>
                    <p className="text-on-surface-variant text-[9px] font-bold tracking-widest uppercase">
                      {tr("Montant reçu", "المبلغ المُستَلَم")}
                    </p>
                    <p className="text-on-surface text-xl font-black tabular-nums sm:text-2xl">
                      {displayTender}
                    </p>
                  </div>
                  <div className="flex gap-1.5">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="border-secondary/35 bg-secondary-container/35 text-on-secondary-container hover:bg-secondary-container/55 h-8 flex-1 rounded-lg px-2 text-[11px] font-bold"
                      onClick={setExactTender}
                      disabled={isConfirming}
                    >
                      {tr("Exact", "بالضبط")}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="text-error border-error/40 bg-error-container/30 hover:bg-error-container/50 h-8 flex-1 rounded-lg px-2 text-[11px] font-bold"
                      onClick={clearTender}
                      disabled={isConfirming}
                    >
                      {tr("Effacer", "مسح")}
                    </Button>
                  </div>
                  <div
                    className={cn(
                      "mt-auto rounded-xl border px-3 py-2 text-center",
                      tenderShort
                        ? "border-error/30 bg-error/8"
                        : changeMad > 0
                          ? "border-secondary/30 bg-secondary-container/40"
                          : "border-sidebar-border bg-surface-container-low/80",
                    )}
                  >
                    <p className="text-on-surface-variant text-[9px] font-bold tracking-widest uppercase">
                      {tr("Monnaie à rendre", "الباقي للإرجاع")}
                    </p>
                    <p
                      className={cn(
                        "mt-0.5 text-xl font-black tabular-nums sm:text-2xl",
                        tenderShort
                          ? "text-error"
                          : changeMad > 0
                            ? "text-secondary"
                            : "text-on-surface",
                      )}
                    >
                      {tenderMad <= 0
                        ? "—"
                        : tenderShort
                          ? tr("Insuffisant", "غير كافٍ")
                          : formatPosDh(changeMad, 2, locale)}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-1.5 sm:gap-2">
                  {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((digit) => (
                    <CaisseKey
                      key={digit}
                      label={digit}
                      onPress={() => enterDigit(digit)}
                    />
                  ))}
                  <CaisseKey
                    label={locale === "ar" ? "." : ","}
                    ariaLabel={tr("Décimales", "الفاصلة العشرية")}
                    onPress={enterDecimal}
                  />
                  <CaisseKey label="0" onPress={() => enterDigit("0")} />
                  <CaisseKey
                    label="⌫"
                    ariaLabel={tr("Effacer chiffre", "مسح رقم")}
                    onPress={backspace}
                    className="border-error/25 bg-error-container/25 text-error hover:bg-error-container/45 border"
                  />
                </div>
              </div>
            ) : (
              <div className="bg-tertiary-fixed/45 text-tertiary border-tertiary/25 flex flex-1 items-center justify-center rounded-xl border px-4 py-3 text-center text-sm font-bold">
                <CreditCard className="me-2 size-4 shrink-0" aria-hidden />
                {tr(
                  "Pas de monnaie — encours à la validation.",
                  "لا باقي — يُحدَّث الرصيد عند التأكيد.",
                )}
              </div>
            )}

            {hasClient ? (
              <div className="bg-surface-container-low border-sidebar-border grid shrink-0 grid-cols-2 gap-1 rounded-xl border p-1">
                <button
                  type="button"
                  disabled={isConfirming}
                  onClick={() => setKeepClient(true)}
                  className={cn(
                    "inline-flex h-10 items-center justify-center gap-1.5 rounded-lg text-[11px] font-black transition-colors sm:text-xs",
                    keepClient
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "text-on-surface-variant hover:bg-surface-container-high",
                  )}
                >
                  <UserRound className="size-3.5" aria-hidden />
                  {tr("Garder le client", "إبقاء العميل")}
                </button>
                <button
                  type="button"
                  disabled={isConfirming}
                  onClick={() => setKeepClient(false)}
                  className={cn(
                    "inline-flex h-10 items-center justify-center gap-1.5 rounded-lg text-[11px] font-black transition-colors sm:text-xs",
                    !keepClient
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "text-on-surface-variant hover:bg-surface-container-high",
                  )}
                >
                  {tr("Client suivant", "العميل التالي")}
                </button>
              </div>
            ) : null}

            {printPickerOpen ? (
              <div className="shrink-0 space-y-1.5">
                <p className="text-on-surface-variant text-center text-[9px] font-bold tracking-widest uppercase">
                  {tr("Imprimer le ticket", "طباعة التذكرة")}
                </p>
                <div className="grid grid-cols-3 gap-1.5 sm:gap-2">
                  <button
                    type="button"
                    disabled={isConfirming}
                    onClick={() => queueDraftPrint("client")}
                    className="border-primary/25 bg-primary/10 text-primary hover:bg-primary/15 flex h-11 flex-col items-center justify-center gap-0.5 rounded-xl border-2 px-1 text-[10px] font-black sm:h-12 sm:text-xs"
                  >
                    <ReceiptText className="size-4 stroke-[1.75] sm:size-5" aria-hidden />
                    {tr("Client", "زبون")}
                  </button>
                  <button
                    type="button"
                    disabled={isConfirming}
                    onClick={() => queueDraftPrint("owner")}
                    className="border-sidebar-border bg-surface-container-low text-on-surface-variant hover:bg-surface-container flex h-11 flex-col items-center justify-center gap-0.5 rounded-xl border-2 px-1 text-[10px] font-black sm:h-12 sm:text-xs"
                  >
                    <Printer className="size-4 stroke-[1.75] sm:size-5" aria-hidden />
                    {tr("Interne", "متجر")}
                  </button>
                  <button
                    type="button"
                    disabled={isConfirming}
                    onClick={() => queueDraftPrint("both")}
                    className="border-secondary/30 bg-secondary-container/50 text-on-secondary-container hover:bg-secondary-container flex h-11 flex-col items-center justify-center gap-0.5 rounded-xl border-2 px-1 text-[10px] font-black sm:h-12 sm:text-xs"
                  >
                    <Printer className="size-4 stroke-[1.75] sm:size-5" aria-hidden />
                    {tr("Les deux", "كلاهما")}
                  </button>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="mx-auto flex h-8 text-[11px] font-bold"
                  onClick={() => setPrintPickerOpen(false)}
                  disabled={isConfirming}
                >
                  {tr("Annuler l’impression", "إلغاء الطباعة")}
                </Button>
              </div>
            ) : null}
          </div>

          <div className="border-sidebar-border/80 shrink-0 space-y-2 border-t px-4 py-3 sm:px-5">
            <div className="grid grid-cols-2 gap-2">
              <Button
                type="button"
                variant="outline"
                className="border-tertiary/35 bg-tertiary-fixed/30 text-tertiary hover:bg-tertiary-fixed/50 h-11 rounded-xl text-xs font-black sm:text-sm"
                onClick={onReturnToCart}
                disabled={isConfirming}
              >
                <ArrowLeft className="me-1.5 size-4 stroke-[2.5]" aria-hidden />
                {tr("Retour panier", "رجوع للسلة")}
              </Button>
              <Button
                type="button"
                variant="outline"
                className="border-primary/30 bg-primary/10 text-primary hover:bg-primary/15 h-11 rounded-xl text-xs font-black sm:text-sm"
                onClick={() => setPrintPickerOpen(true)}
                disabled={isConfirming || printPickerOpen}
              >
                <Printer className="me-1.5 size-4 stroke-[2]" aria-hidden />
                {tr("Imprimer", "طباعة")}
              </Button>
            </div>
            <Button
              type="button"
              className="from-secondary to-on-secondary-container text-on-secondary h-12 w-full rounded-xl bg-linear-to-br text-sm font-black shadow-[0_6px_16px_rgba(0,108,73,0.25)]"
              onClick={() => void handleValidateSale()}
              disabled={isConfirming}
            >
              {isConfirming ? (
                <>
                  <Loader2 className="me-1.5 size-4 animate-spin" aria-hidden />
                  {tr("…", "…")}
                </>
              ) : (
                <>
                  <Check className="me-1.5 size-4 stroke-[2.5]" aria-hidden />
                  {tr("Valider la vente", "تأكيد البيع")}
                </>
              )}
            </Button>
          </div>
        </PosDialogContent>
      </PosDialog>

      {printInvoice ? (
        <div className="invoice-print-host" aria-hidden>
          <InvoiceReceiptPreview
            invoice={printInvoice}
            mode={receiptMode}
            showModeSwitch={false}
            layout="full"
            printRootId="invoice-print-area"
            printOnly
          />
        </div>
      ) : null}
    </>
  );
}
