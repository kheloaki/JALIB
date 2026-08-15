"use client";

import { Suspense, useEffect, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { useRouter, useSearchParams } from "next/navigation";
import { useLocale } from "next-intl";
import { Save, SlidersHorizontal } from "lucide-react";

import { QtyKeypadField } from "@/components/money/qty-keypad-field";
import {
  ParametersGeneralFormSkeleton,
  ParametersPageSkeleton,
} from "@/components/skeletons";
import { MobileAppSettingsPanel } from "@/components/pwa/mobile-app-settings-panel";
import { AccountAvatarPanel } from "@/components/settings/account-avatar-panel";
import { AccountPasswordPanel } from "@/components/settings/account-password-panel";
import { DevicesAdminPanel } from "@/components/settings/devices-admin-panel";
import { DataBackupSettingsPanel } from "@/components/settings/data-backup-settings-panel";
import { ThermalPrinterSettingsPanel } from "@/components/settings/thermal-printer-settings-panel";
import { RolesPermissionsContent } from "@/components/roles/roles-permissions-page";
import { useSwitchLocale } from "@/components/layout/language-switcher";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toaster";
import { api } from "@/convex/_generated/api";
import { canManageDevices } from "@/lib/auth/permissions";
import { cn } from "@/lib/utils";

type FormState = {
  businessName: string;
  storePhone: string;
  storeAddress: string;
  taxIce: string;
  taxIf: string;
  taxRc: string;
  defaultLocale: "fr" | "ar";
  documentLocale: "fr" | "ar";
  lowStockThreshold: number;
  enableWhatsappAlerts: boolean;
  receiptFooter: string;
};

type ParametersTab = "account" | "general" | "roles" | "devices" | "mobile-app";

function parseParametersTab(raw: string | null): ParametersTab {
  if (raw === "account") return "account";
  if (raw === "roles") return "roles";
  if (raw === "devices" || raw === "appareils") return "devices";
  if (raw === "mobile-app" || raw === "mobile") return "mobile-app";
  return "general";
}

export function ParametersPage() {
  return (
    <Suspense fallback={<ParametersPageSkeleton />}>
      <ParametersPageContent />
    </Suspense>
  );
}

function ParametersPageContent() {
  const locale = useLocale();
  const isAr = locale === "ar";
  const tr = (fr: string, ar: string) => (isAr ? ar : fr);
  const router = useRouter();
  const searchParams = useSearchParams();
  const currentUser = useQuery(api.authz.currentUser);
  const permissions = currentUser?.permissions ?? [];
  const canManageSettings = permissions.includes("admin.manage_settings");
  const canManageRoles = permissions.includes("admin.manage_roles");
  const canManageDevicesTab = canManageDevices(permissions);

  const tabFromUrl = parseParametersTab(searchParams.get("tab"));
  const [tab, setTab] = useState<ParametersTab>(tabFromUrl);

  useEffect(() => {
    setTab(tabFromUrl);
  }, [tabFromUrl]);

  const visibleTab: ParametersTab = (() => {
    if (tab === "general" && !canManageSettings) {
      if (canManageRoles) return "roles";
      if (canManageDevicesTab) return "devices";
      return "account";
    }
    if (tab === "roles" && !canManageRoles) return "account";
    if (tab === "devices" && !canManageDevicesTab) return "account";
    if (tab === "mobile-app" && !canManageSettings) return "account";
    return tab;
  })();

  function selectTab(next: ParametersTab) {
    setTab(next);
    const params = new URLSearchParams(searchParams.toString());
    if (next === "general") {
      params.delete("tab");
    } else {
      params.set("tab", next);
    }
    const qs = params.toString();
    router.replace(qs ? `?${qs}` : "?", { scroll: false });
  }

  const tabs: { id: ParametersTab; label: string; show: boolean }[] = [
    { id: "account", label: tr("Mon compte", "حسابي"), show: true },
    { id: "general", label: tr("Général", "عام"), show: canManageSettings },
    {
      id: "roles",
      label: tr("Rôles & permissions", "الأدوار والأذونات"),
      show: canManageRoles,
    },
    {
      id: "devices",
      label: tr("Appareils", "الأجهزة"),
      show: canManageDevicesTab,
    },
    {
      id: "mobile-app",
      label: tr("Application mobile", "التطبيق المحمول"),
      show: canManageSettings,
    },
  ];

  return (
    <div className="bg-surface text-on-surface flex min-h-0 flex-1 flex-col overflow-hidden">
      <div className="border-outline-variant/30 bg-surface sticky top-0 z-20 border-b px-4 py-3 sm:px-8">
        <header className="mb-3">
          <div className="text-primary flex items-center gap-2 text-xs font-bold tracking-widest uppercase">
            <SlidersHorizontal className="size-4 stroke-[1.75]" aria-hidden />
            {tr("Configuration", "الإعدادات")}
          </div>
        </header>
        <div
          className="bg-surface-container-low flex w-full gap-1 overflow-x-auto rounded-xl p-1"
          role="tablist"
          aria-label={tr("Navigation paramètres", "تنقل الإعدادات")}
        >
          {tabs
            .filter((item) => item.show)
            .map((item) => (
              <button
                key={item.id}
                type="button"
                role="tab"
                aria-selected={visibleTab === item.id}
                onClick={() => selectTab(item.id)}
                className={cn(
                  "shrink-0 rounded-lg px-4 py-2.5 text-sm font-bold whitespace-nowrap transition-colors",
                  visibleTab === item.id
                    ? "bg-primary text-on-primary shadow-sm"
                    : "text-on-surface-variant hover:bg-surface-container-high",
                )}
              >
                {item.label}
              </button>
            ))}
        </div>
      </div>

      {visibleTab === "account" ? (
        <main className="w-full flex-1 overflow-auto px-4 py-6 sm:px-8">
          <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
            <AccountAvatarPanel tr={tr} />
            <AccountPasswordPanel tr={tr} />
          </div>
        </main>
      ) : visibleTab === "general" ? (
        <ParametersGeneralTab tr={tr} />
      ) : visibleTab === "roles" ? (
        <RolesPermissionsContent />
      ) : visibleTab === "devices" ? (
        <DevicesAdminPanel />
      ) : (
        <main className="w-full flex-1 overflow-auto px-4 py-6 sm:px-8">
          <MobileAppSettingsPanel />
        </main>
      )}
    </div>
  );
}

function ParametersGeneralTab({
  tr,
}: {
  tr: (fr: string, ar: string) => string;
}) {
  const locale = useLocale();
  const switchLocale = useSwitchLocale();
  const toast = useToast();
  const settings = useQuery(api.settings.getAppSettings);
  const updateSettings = useMutation(api.settings.updateAppSettings);

  const [draft, setDraft] = useState<FormState | null>(null);
  const [saving, setSaving] = useState(false);
  const form = draft ?? settings ?? null;

  function updateDraft<K extends keyof FormState>(
    key: K,
    value: FormState[K],
  ) {
    setDraft((prev) => {
      const base = prev ?? settings;
      return base ? { ...base, [key]: value } : prev;
    });
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!form) return;
    setSaving(true);
    try {
      const savedSettings = await updateSettings({
        businessName: form.businessName,
        storePhone: form.storePhone,
        storeAddress: form.storeAddress,
        taxIce: form.taxIce,
        taxIf: form.taxIf,
        taxRc: form.taxRc,
        defaultLocale: form.defaultLocale,
        documentLocale: form.documentLocale,
        lowStockThreshold: form.lowStockThreshold,
        enableWhatsappAlerts: form.enableWhatsappAlerts,
        receiptFooter: form.receiptFooter,
      });
      setDraft(savedSettings);
      if (savedSettings.defaultLocale !== locale) {
        switchLocale(savedSettings.defaultLocale);
      }
      toast.success(
        tr("Paramètres enregistrés", "تم حفظ الإعدادات"),
        tr("Les modifications ont été sauvegardées.", "تم حفظ التعديلات بنجاح."),
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : undefined;
      toast.error(tr("Erreur de sauvegarde", "خطأ أثناء الحفظ"), message);
    } finally {
      setSaving(false);
    }
  }

  const fieldLabelClass =
    "text-on-surface-variant block text-[10px] font-bold tracking-wide uppercase sm:text-xs";
  const selectClass =
    "border-input bg-surface-container-low text-on-surface h-11 w-full rounded-xl border px-3 text-sm";

  return (
    <main className="w-full flex-1 overflow-auto px-4 py-6 sm:px-8">
      {!form ? (
        <ParametersGeneralFormSkeleton />
      ) : (
        <form
          onSubmit={onSubmit}
          className="admin-page-scroll-content mx-auto flex w-full max-w-3xl flex-col gap-4"
        >
          <section className="border-sidebar-border bg-surface-container-lowest space-y-4 rounded-2xl border p-4 shadow-sm sm:p-5">
            <div>
              <h2 className="text-sm font-bold tracking-tight">
                {tr("Magasin", "المتجر")}
              </h2>
              <p className="text-on-surface-variant mt-0.5 text-xs">
                {tr(
                  "Nom, contact et adresse affichés sur les documents.",
                  "الاسم والاتصال والعنوان المعروضة على المستندات.",
                )}
              </p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="min-w-0 space-y-1 sm:col-span-2">
                <span className={fieldLabelClass}>
                  {tr("Nom du magasin", "اسم المتجر")}
                </span>
                <Input
                  value={form.businessName}
                  onChange={(e) => updateDraft("businessName", e.target.value)}
                  placeholder={tr("Ex. Jamaa Market", "مثال: جامع ماركت")}
                  className="h-11 rounded-xl"
                />
              </label>
              <label className="min-w-0 space-y-1">
                <span className={fieldLabelClass}>
                  {tr("Téléphone", "الهاتف")}
                </span>
                <Input
                  value={form.storePhone}
                  onChange={(e) => updateDraft("storePhone", e.target.value)}
                  placeholder="+212..."
                  className="h-11 rounded-xl"
                />
              </label>
              <label className="min-w-0 space-y-1 sm:col-span-2">
                <span className={fieldLabelClass}>
                  {tr("Adresse du magasin", "عنوان المتجر")}
                </span>
                <Input
                  value={form.storeAddress}
                  onChange={(e) => updateDraft("storeAddress", e.target.value)}
                  placeholder={tr("Rue, ville…", "الشارع، المدينة...")}
                  className="h-11 rounded-xl"
                />
              </label>
            </div>
          </section>

          <section className="border-sidebar-border bg-surface-container-lowest space-y-4 rounded-2xl border p-4 shadow-sm sm:p-5">
            <div>
              <h2 className="text-sm font-bold tracking-tight">
                {tr("Langues", "اللغات")}
              </h2>
              <p className="text-on-surface-variant mt-0.5 text-xs">
                {tr(
                  "Interface et documents imprimés.",
                  "واجهة التطبيق والمستندات المطبوعة.",
                )}
              </p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="min-w-0 space-y-1">
                <span className={fieldLabelClass}>
                  {tr("Langue par défaut", "اللغة الافتراضية")}
                </span>
                <select
                  value={form.defaultLocale}
                  onChange={(e) =>
                    updateDraft(
                      "defaultLocale",
                      e.target.value === "ar" ? "ar" : "fr",
                    )
                  }
                  className={selectClass}
                >
                  <option value="fr">Français</option>
                  <option value="ar">العربية</option>
                </select>
                <p className="text-on-surface-variant text-[11px]">
                  {tr(
                    "Menus et boutons de l'application.",
                    "قوائم وأزرار التطبيق.",
                  )}
                </p>
              </label>
              <label className="min-w-0 space-y-1">
                <span className={fieldLabelClass}>
                  {tr("Langue des documents", "لغة المستندات")}
                </span>
                <select
                  value={form.documentLocale}
                  onChange={(e) =>
                    updateDraft(
                      "documentLocale",
                      e.target.value === "ar" ? "ar" : "fr",
                    )
                  }
                  className={selectClass}
                >
                  <option value="fr">Français</option>
                  <option value="ar">العربية</option>
                </select>
                <p className="text-on-surface-variant text-[11px]">
                  {tr(
                    "Factures, tickets et exports PDF.",
                    "الفواتير والتذاكر وتصدير PDF.",
                  )}
                </p>
              </label>
            </div>
          </section>

          <section className="border-sidebar-border bg-surface-container-lowest space-y-4 rounded-2xl border p-4 shadow-sm sm:p-5">
            <div>
              <h2 className="text-sm font-bold tracking-tight">
                {tr("Identifiants légaux", "المعرفات القانونية")}
              </h2>
              <p className="text-on-surface-variant mt-0.5 text-xs">
                {tr(
                  "Informations fiscales sur les factures.",
                  "المعلومات الضريبية على الفواتير.",
                )}
              </p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="min-w-0 space-y-1">
                <span className={fieldLabelClass}>ICE</span>
                <Input
                  value={form.taxIce}
                  onChange={(e) => updateDraft("taxIce", e.target.value)}
                  placeholder={tr(
                    "Identifiant Commun de l'Entreprise",
                    "المعرف الموحد للمقاولة",
                  )}
                  className="h-11 rounded-xl"
                />
              </label>
              <label className="min-w-0 space-y-1">
                <span className={fieldLabelClass}>IF</span>
                <Input
                  value={form.taxIf}
                  onChange={(e) => updateDraft("taxIf", e.target.value)}
                  placeholder={tr("Identifiant Fiscal", "المعرف الضريبي")}
                  className="h-11 rounded-xl"
                />
              </label>
              <label className="min-w-0 space-y-1 sm:col-span-2">
                <span className={fieldLabelClass}>RC</span>
                <Input
                  value={form.taxRc}
                  onChange={(e) => updateDraft("taxRc", e.target.value)}
                  placeholder={tr("Registre de Commerce", "السجل التجاري")}
                  className="h-11 rounded-xl"
                />
              </label>
            </div>
          </section>

          <section className="border-sidebar-border bg-surface-container-lowest space-y-4 rounded-2xl border p-4 shadow-sm sm:p-5">
            <div>
              <h2 className="text-sm font-bold tracking-tight">
                {tr("Stock & alertes", "المخزون والتنبيهات")}
              </h2>
              <p className="text-on-surface-variant mt-0.5 text-xs">
                {tr(
                  "Seuils et notifications automatiques.",
                  "الحدود والإشعارات التلقائية.",
                )}
              </p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="min-w-0 space-y-1">
                <span className={fieldLabelClass}>
                  {tr("Seuil stock faible", "حد المخزون المنخفض")}
                </span>
                <QtyKeypadField
                  value={form.lowStockThreshold}
                  onValueChange={(lowStockThreshold) =>
                    updateDraft("lowStockThreshold", lowStockThreshold)
                  }
                  min={0}
                  keypadTitle={tr("Seuil stock faible", "حد المخزون المنخفض")}
                  wrapperClassName="w-full"
                />
              </label>
              <label className="min-w-0 space-y-1">
                <span className={fieldLabelClass}>
                  {tr("Alertes WhatsApp", "تنبيهات واتساب")}
                </span>
                <label className="border-input bg-surface-container-low flex h-11 items-center gap-2 rounded-xl border px-3 text-sm">
                  <input
                    type="checkbox"
                    checked={form.enableWhatsappAlerts}
                    onChange={(e) =>
                      updateDraft("enableWhatsappAlerts", e.target.checked)
                    }
                  />
                  {tr("Activer", "تفعيل")}
                </label>
              </label>
            </div>
          </section>

          <section className="border-sidebar-border bg-surface-container-lowest space-y-4 rounded-2xl border p-4 shadow-sm sm:p-5">
            <div>
              <h2 className="text-sm font-bold tracking-tight">
                {tr("Tickets de caisse", "إيصالات الصندوق")}
              </h2>
              <p className="text-on-surface-variant mt-0.5 text-xs">
                {tr(
                  "Message affiché en bas des reçus.",
                  "الرسالة المعروضة أسفل الإيصالات.",
                )}
              </p>
            </div>
            <label className="block min-w-0 space-y-1">
              <span className={fieldLabelClass}>
                {tr("Pied de ticket", "تذييل الإيصال")}
              </span>
              <Input
                value={form.receiptFooter}
                onChange={(e) => updateDraft("receiptFooter", e.target.value)}
                placeholder={tr("Merci pour votre confiance.", "شكرا لثقتكم.")}
                className="h-11 rounded-xl"
              />
            </label>
          </section>

          <ThermalPrinterSettingsPanel tr={tr} />

          <div className="border-sidebar-border bg-surface-container-lowest sticky bottom-0 flex justify-end rounded-2xl border p-4 shadow-sm sm:static sm:border-0 sm:bg-transparent sm:p-0 sm:shadow-none">
            <Button
              type="submit"
              className="h-11 w-full rounded-xl px-5 font-bold sm:w-auto"
              disabled={saving}
            >
              <Save className="size-4 stroke-[1.75]" aria-hidden />
              {saving
                ? tr("Enregistrement…", "جاري الحفظ...")
                : tr("Enregistrer", "حفظ")}
            </Button>
          </div>
        </form>
      )}

      {/* Outside the form so “send backup” is never tied to Enregistrer */}
      {form ? (
        <div className="mx-auto mt-4 w-full max-w-3xl px-0 pb-8">
          <DataBackupSettingsPanel tr={tr} />
        </div>
      ) : null}
    </main>
  );
}
