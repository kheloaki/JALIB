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
import { loadTicketLogoForThermal } from "@/lib/print/ticket-logo";
import { EscPosBuilder, thermalCodePageSummary } from "@/lib/print/escpos-builder";
import { THERMAL_PRINTER_PROFILE } from "@/lib/print/thermal-printer-profile";
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
      const ticket = new EscPosBuilder().init().align("center");
      const logo = await loadTicketLogoForThermal(120);
      if (logo) {
        ticket.raster(logo);
        ticket.feed(1);
      } else {
        ticket.bold(true).line("Jamaa Market").bold(false);
      }
      ticket.line(`WD8260 · ${THERMAL_PRINTER_PROFILE.paperWidthMm}mm`);
      ticket.line(`Fonts: ${thermalCodePageSummary()} · Font A`);
      await ticket.lineAuto(
        tr("Test imprimante thermique", "اختبار الطابعة الحرارية"),
        { align: "center", bold: true, fontSize: 28 },
      );
      ticket.separator("-").align("left");
      await ticket.lineAuto("Café · Total TTC · 12,50", {
        align: "left",
        bold: true,
      });
      await ticket.lineAuto("سكر · حليب · زيت", {
        align: "right",
        bold: true,
      });
      await ticket.lineAuto(
        tr(
          "Si vous lisez ceci, la connexion ESC/POS fonctionne.",
          "إذا قرأت هذا، فاتصال ESC/POS يعمل.",
        ),
        { fontSize: 24 },
      );
      ticket.separator("=");
      ticket.columns("Largeur", `${THERMAL_PRINTER_PROFILE.charsPerLine} cols`);
      ticket.columns("Points", String(THERMAL_PRINTER_PROFILE.dotsPerLine));
      const payload = ticket.feed(2).cut().build();
      await printRawEscPos(payload);
      toast.success(
        tr("Ticket de test WD8260 envoyé", "أُرسلت تذكرة اختبار WD8260"),
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
            {tr("Imprimante thermique WD8260", "طابعة حرارية WD8260")}
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
          {tr("Imprimante thermique WD8260", "طابعة حرارية WD8260")}
        </h2>
        <p className="text-on-surface-variant mt-0.5 text-xs">
          {tr(
            "Profil WDLink WD8260 — ticket 80 mm (576 points / 48 colonnes). Connectez une fois ici ; à la caisse le ticket client s’imprime sans boîte de dialogue.",
            "ملف WDLink WD8260 — تذكرة 80 مم (576 نقطة / 48 عموداً). اربط مرة هنا؛ في الصندوق تُطبع تذكرة الزبون بدون نافذة حوار.",
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
            "Papier : rouleau 80 mm (79,5 ± 0,5 mm) — commande ESC/POS.",
            "الورق: لفة 80 مم (79.5 ± 0.5 مم) — أوامر ESC/POS.",
          )}
        </li>
        <li>
          {tr(
            "Chrome ou Edge uniquement (pas Safari / Firefox).",
            "Chrome أو Edge فقط (ليس Safari / Firefox).",
          )}
        </li>
        <li>
          {tr(
            "Préférez USB. Série / COM utilise 115200 baud (adaptateurs USB-COM).",
            "فضّل USB. التسلسلي / COM يعمل على 115200 باود (محولات USB-COM).",
          )}
        </li>
        <li>
          {tr(
            "Windows : si « Access denied », installez WinUSB avec Zadig pour le WD8260.",
            "ويندوز: إذا ظهر Access denied، ثبّت WinUSB عبر Zadig لجهاز WD8260.",
          )}
        </li>
      </ul>
    </section>
  );
}
