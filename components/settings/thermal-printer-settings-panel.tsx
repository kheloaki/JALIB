"use client";

import { useState } from "react";
import {
  CheckCircle2,
  Loader2,
  Printer,
  Unplug,
  Usb,
  AlertTriangle,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toaster";
import { useThermalPrinter } from "@/hooks/use-thermal-printer";
import { EscPosBuilder } from "@/lib/print/escpos-builder";
import { printRawEscPos } from "@/lib/print/thermal-printer";
import { cn } from "@/lib/utils";

type ThermalPrinterSettingsPanelProps = {
  tr: (fr: string, ar: string) => string;
  className?: string;
};

export function ThermalPrinterSettingsPanel({
  tr,
  className,
}: ThermalPrinterSettingsPanelProps) {
  const toast = useToast();
  const printer = useThermalPrinter();
  const [busy, setBusy] = useState<"usb" | "serial" | "test" | null>(null);

  async function connect(kind: "usb" | "serial") {
    setBusy(kind);
    try {
      await printer.connect(kind);
      toast.success(
        tr("Imprimante connectée", "تم ربط الطابعة"),
        tr(
          "Les tickets client s’imprimeront directement à la caisse.",
          "ستُطبع تذاكر الزبون مباشرة من الصندوق.",
        ),
      );
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : tr("Connexion annulée ou échouée.", "أُلغي الاتصال أو فشل.");
      toast.error(tr("Connexion impossible", "تعذر الاتصال"), message);
    } finally {
      setBusy(null);
    }
  }

  async function disconnect() {
    setBusy("usb");
    try {
      await printer.disconnect();
      toast.success(
        tr("Imprimante déconnectée", "تم فصل الطابعة"),
        tr(
          "L’impression repassera par la boîte de dialogue du navigateur.",
          "ستعود الطباعة عبر نافذة المتصفح.",
        ),
      );
    } finally {
      setBusy(null);
    }
  }

  async function testPrint() {
    if (!printer.connected) return;
    setBusy("test");
    try {
      const payload = new EscPosBuilder()
        .init()
        .align("center")
        .bold(true)
        .line("Jamaa Market")
        .bold(false)
        .line(tr("Test imprimante thermique", "اختبار الطابعة الحرارية"))
        .separator("-")
        .align("left")
        .line(
          tr(
            "Si vous lisez ceci, la connexion ESC/POS fonctionne.",
            "إذا قرأت هذا، فاتصال ESC/POS يعمل.",
          ),
        )
        .feed(2)
        .cut()
        .build();
      await printRawEscPos(payload);
      toast.success(
        tr("Ticket de test envoyé", "أُرسلت تذكرة الاختبار"),
        tr("Vérifiez l’imprimante thermique.", "تحقق من الطابعة الحرارية."),
      );
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : tr("Échec de l’impression.", "فشل الطباعة.");
      toast.error(tr("Test échoué", "فشل الاختبار"), message);
    } finally {
      setBusy(null);
    }
  }

  if (!printer.supported && !printer.restoring) {
    return (
      <section
        className={cn(
          "border-sidebar-border bg-surface-container-lowest space-y-3 rounded-2xl border p-4 shadow-sm sm:p-5",
          className,
        )}
      >
        <div>
          <h2 className="text-sm font-bold tracking-tight">
            {tr("Imprimante thermique", "الطابعة الحرارية")}
          </h2>
          <p className="text-on-surface-variant mt-0.5 text-xs">
            {tr(
              "WebUSB / Web Serial non disponibles. Utilisez Chrome ou Edge en HTTPS.",
              "WebUSB / Web Serial غير متاحين. استخدم Chrome أو Edge عبر HTTPS.",
            )}
          </p>
        </div>
      </section>
    );
  }

  return (
    <section
      className={cn(
        "border-sidebar-border bg-surface-container-lowest space-y-4 rounded-2xl border p-4 shadow-sm sm:p-5",
        className,
      )}
    >
      <div>
        <h2 className="text-sm font-bold tracking-tight">
          {tr("Imprimante thermique", "الطابعة الحرارية")}
        </h2>
        <p className="text-on-surface-variant mt-0.5 text-xs">
          {tr(
            "Connectez l’imprimante une fois ici. À la caisse, le ticket client s’imprime sans boîte de dialogue.",
            "اربط الطابعة مرة هنا. في الصندوق تُطبع تذكرة الزبون بدون نافذة حوار.",
          )}
        </p>
      </div>

      <div
        className={cn(
          "flex flex-col gap-3 rounded-xl border px-3 py-3 sm:flex-row sm:items-center sm:justify-between",
          printer.connected
            ? "border-emerald-500/30 bg-emerald-500/10"
            : "border-sidebar-border bg-surface-container-low",
        )}
      >
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-sm font-bold">
            {printer.connected ? (
              <CheckCircle2 className="size-4 shrink-0 text-emerald-600" aria-hidden />
            ) : printer.restoring ? (
              <Loader2 className="size-4 shrink-0 animate-spin" aria-hidden />
            ) : (
              <Printer className="text-on-surface-variant size-4 shrink-0" aria-hidden />
            )}
            {printer.connected
              ? tr("Connectée", "متصلة")
              : printer.restoring
                ? tr("Recherche…", "جاري البحث...")
                : tr("Non connectée", "غير متصلة")}
          </div>
          <p className="text-on-surface-variant mt-0.5 truncate text-xs">
            {printer.connected
              ? printer.label ||
                (printer.transport === "serial"
                  ? tr("Port série / COM", "منفذ تسلسلي")
                  : tr("USB", "USB"))
              : tr(
                  "Aucune imprimante active sur ce navigateur.",
                  "لا طابعة نشطة على هذا المتصفح.",
                )}
          </p>
          {printer.lastError ? (
            <p className="text-error mt-1 flex items-start gap-1.5 text-[11px]">
              <AlertTriangle className="mt-0.5 size-3.5 shrink-0" aria-hidden />
              {printer.lastError}
            </p>
          ) : null}
        </div>

        <div className="flex flex-wrap gap-2">
          {printer.connected ? (
            <>
              <Button
                type="button"
                variant="outline"
                className="h-10 rounded-xl font-bold"
                disabled={busy !== null}
                onClick={() => void testPrint()}
              >
                {busy === "test" ? (
                  <Loader2 className="size-4 animate-spin" aria-hidden />
                ) : (
                  <Printer className="size-4" aria-hidden />
                )}
                {tr("Tester", "اختبار")}
              </Button>
              <Button
                type="button"
                variant="ghost"
                className="h-10 rounded-xl font-bold"
                disabled={busy !== null}
                onClick={() => void disconnect()}
              >
                <Unplug className="size-4" aria-hidden />
                {tr("Déconnecter", "فصل")}
              </Button>
            </>
          ) : (
            <>
              <Button
                type="button"
                className="h-10 rounded-xl font-bold"
                disabled={busy !== null || printer.restoring}
                onClick={() => void connect("usb")}
              >
                {busy === "usb" ? (
                  <Loader2 className="size-4 animate-spin" aria-hidden />
                ) : (
                  <Usb className="size-4" aria-hidden />
                )}
                {tr("Connecter USB", "ربط USB")}
              </Button>
              <Button
                type="button"
                variant="outline"
                className="h-10 rounded-xl font-bold"
                disabled={busy !== null || printer.restoring}
                onClick={() => void connect("serial")}
              >
                {busy === "serial" ? (
                  <Loader2 className="size-4 animate-spin" aria-hidden />
                ) : (
                  <Printer className="size-4" aria-hidden />
                )}
                {tr("Série / COM", "تسلسلي / COM")}
              </Button>
            </>
          )}
        </div>
      </div>

      <ul className="text-on-surface-variant list-disc space-y-1 ps-4 text-[11px] leading-relaxed">
        <li>
          {tr(
            "Chrome ou Edge uniquement (pas Safari / Firefox).",
            "Chrome أو Edge فقط (ليس Safari / Firefox).",
          )}
        </li>
        <li>
          {tr(
            "La connexion est enregistrée sur ce navigateur / cet appareil.",
            "يُحفظ الاتصال على هذا المتصفح / هذا الجهاز.",
          )}
        </li>
        <li>
          {tr(
            "Windows : si « Access denied », installez WinUSB avec Zadig pour l’imprimante.",
            "ويندوز: إذا ظهر Access denied، ثبّت WinUSB عبر Zadig للطابعة.",
          )}
        </li>
      </ul>
    </section>
  );
}
