"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useLocale } from "next-intl";
import { Download, Smartphone } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toaster";
import { isStandaloneDisplay } from "@/lib/pwa/constants";
import { cn } from "@/lib/utils";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

export function MobileAppSettingsPanel({ className }: { className?: string }) {
  const locale = useLocale();
  const isAr = locale === "ar";
  const tr = (fr: string, ar: string) => (isAr ? ar : fr);
  const toast = useToast();

  const [installPrompt, setInstallPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const [installBusy, setInstallBusy] = useState(false);

  useEffect(() => {
    setInstalled(isStandaloneDisplay());

    function onBeforeInstallPrompt(event: Event) {
      event.preventDefault();
      setInstallPrompt(event as BeforeInstallPromptEvent);
    }

    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);
    window.addEventListener("appinstalled", () => {
      setInstalled(true);
      setInstallPrompt(null);
    });

    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
    };
  }, []);

  const installState = useMemo(() => {
    if (installed) return "installed" as const;
    if (installPrompt) return "ready" as const;
    return "manual" as const;
  }, [installed, installPrompt]);

  const handleInstall = useCallback(async () => {
    if (!installPrompt) return;
    setInstallBusy(true);
    try {
      await installPrompt.prompt();
      const choice = await installPrompt.userChoice;
      if (choice.outcome === "accepted") {
        toast.success(
          tr("Application installée", "تم تثبيت التطبيق"),
          tr(
            "Jamaa Market est sur votre écran d'accueil.",
            "جامع ماركت على شاشتك الرئيسية.",
          ),
        );
        setInstallPrompt(null);
      }
    } finally {
      setInstallBusy(false);
    }
  }, [installPrompt, toast, tr]);

  return (
    <section
      className={cn(
        "border-sidebar-border bg-surface-container-lowest space-y-4 rounded-2xl border p-5 shadow-sm",
        className,
      )}
    >
      <div className="flex items-start gap-3">
        <div className="bg-primary/10 text-primary flex size-11 shrink-0 items-center justify-center rounded-xl">
          <Smartphone className="size-5 stroke-[1.75]" aria-hidden />
        </div>
        <div>
          <h2 className="text-lg font-bold">
            {tr("Application mobile", "تطبيق الجوال")}
          </h2>
          <p className="text-on-surface-variant mt-1 text-sm">
            {tr(
              "Installez Jamaa Market sur l'écran d'accueil de votre téléphone.",
              "ثبّت جامع ماركت على الشاشة الرئيسية لهاتفك.",
            )}
          </p>
        </div>
      </div>

      <div className="bg-surface-container-low space-y-3 rounded-xl p-4">
        <p className="text-sm font-bold">
          {tr("Installer l'application", "تثبيت التطبيق")}
        </p>
        {installState === "installed" ? (
          <p className="text-secondary text-sm font-semibold">
            {tr(
              "✓ Application installée sur cet appareil",
              "✓ التطبيق مثبت على هذا الجهاز",
            )}
          </p>
        ) : installState === "ready" ? (
          <Button
            type="button"
            className="gap-2 rounded-xl font-bold"
            disabled={installBusy}
            onClick={() => void handleInstall()}
          >
            <Download className="size-4 stroke-[1.75]" aria-hidden />
            {tr("Installer l'application", "تثبيت التطبيق")}
          </Button>
        ) : (
          <div className="text-on-surface-variant space-y-2 text-sm leading-relaxed">
            <p>
              {tr(
                "Android (Chrome) : menu ⋮ → « Ajouter à l'écran d'accueil ».",
                "Android (Chrome): القائمة ⋮ → « إضافة إلى الشاشة الرئيسية ».",
              )}
            </p>
            <p>
              {tr(
                "iPhone (Safari) : partager → « Sur l'écran d'accueil ».",
                "iPhone (Safari): مشاركة → « على الشاشة الرئيسية ».",
              )}
            </p>
          </div>
        )}
      </div>

      <p className="text-on-surface-variant text-xs">
        {tr("Centre d'alertes :", "مركز التنبيهات:")}{" "}
        <Link
          href={`/${locale}/alertes`}
          className="text-primary font-semibold hover:underline"
        >
          {tr("Voir toutes les alertes", "عرض كل التنبيهات")}
        </Link>
      </p>
    </section>
  );
}
