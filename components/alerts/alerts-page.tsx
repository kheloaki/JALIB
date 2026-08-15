"use client";

import { useMemo, useState } from "react";
import { useQuery } from "convex/react";
import { useLocale } from "next-intl";
import {
  AlertCircle,
  AlertTriangle,
  CalendarX,
  ChevronDown,
  Eye,
  ListFilter,
  Mail,
  MessageCircle,
  Package,
  Phone,
  Plus,
  Send,
} from "lucide-react";

import { AlertAdvancedFiltersDialog } from "@/components/alerts/alert-advanced-filters-dialog";
import { AlertRuleDialog } from "@/components/alerts/alert-rule-dialog";
import { useAdminChrome } from "@/components/layout/admin-chrome-context";
import { AdminFilterSummary } from "@/components/layout/admin-filter-summary";
import { AlertsPageSkeleton } from "@/components/skeletons";
import {
  DEFAULT_ALERT_ADVANCED_FILTERS,
  isDefaultAlertAdvancedFilters,
  type AlertAdvancedFilters,
} from "@/lib/alerts/advanced-filters";
import type { AlertItem, AlertTabFilter, QuickContactClient } from "@/lib/alerts/types";
import {
  creditOverLimitMessageAr,
  creditOverLimitMessageFr,
  whatsappHref,
} from "@/lib/alerts/whatsapp";
import { STORE_NAME } from "@/lib/brand/constants";
import { Button } from "@/components/ui/button";
import { api } from "@/convex/_generated/api";
import { canManageAlerts } from "@/lib/auth/permissions";
import { cn } from "@/lib/utils";
import { useAlertFeed } from "@/hooks/use-alert-feed";

const WA_GREEN =
  "bg-[#25D366] text-white shadow-md shadow-green-500/20 hover:brightness-95";

const iconSm = "size-4 shrink-0 stroke-[1.75]";

function tabMatches(tab: AlertTabFilter, category: AlertItem["category"]) {
  if (tab === "all") return true;
  if (tab === "credit")
    return category === "credit_over" || category === "credit_warn";
  if (tab === "unpaid")
    return category === "unpaid" || category === "installment_missed";
  if (tab === "stock") return category === "stock";
  return true;
}

function AlertCardRow({
  item,
  onDismiss,
}: {
  item: AlertItem;
  onDismiss?: (id: string) => void;
}) {
  const waLink =
    item.whatsappPhone != null
      ? whatsappHref(
          item.whatsappPhone,
          `Bonjour, concernant votre compte ${STORE_NAME} — ${item.title}`,
        )
      : null;
  const phoneDigits = item.whatsappPhone?.replace(/\D/g, "") ?? "";
  const contactEmail =
    (item as AlertItem & { email?: string; contactEmail?: string }).contactEmail ??
    (item as AlertItem & { email?: string; contactEmail?: string }).email ??
    "";

  const isCritical = item.category === "credit_over";
  const isWarn = item.category === "credit_warn";
  const isInstallmentMissed = item.category === "installment_missed";

  return (
    <div
      className={cn(
        "group relative overflow-hidden rounded-2xl p-6 transition-all",
        isCritical &&
          "border-error bg-error-container/30 border-l-4 hover:bg-error-container/40",
        isWarn &&
          "border-tertiary bg-tertiary-fixed/20 border-l-4 hover:bg-tertiary-fixed/30",
        isInstallmentMissed &&
          "border-error/40 bg-error-container/15 border-l-4 hover:bg-error-container/25",
        !isCritical &&
          !isWarn &&
          !isInstallmentMissed &&
          "bg-surface-container-lowest shadow-sm hover:shadow-md",
      )}
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:justify-between sm:items-start">
        <div className="flex gap-4">
          <div
            className={cn(
              "flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-white",
              isCritical && "bg-error",
              isWarn && "bg-tertiary",
              item.category === "unpaid" &&
                "bg-surface-container-high text-error",
              isInstallmentMissed && "bg-error text-white",
              item.category === "stock" &&
                "bg-secondary-container/30 text-secondary",
            )}
          >
            {isCritical ? (
              <AlertTriangle className="size-6 stroke-[1.75]" aria-hidden />
            ) : isWarn ? (
              <AlertCircle className="size-6 stroke-[1.75]" aria-hidden />
            ) : item.category === "unpaid" || isInstallmentMissed ? (
              <CalendarX className="size-6 stroke-[1.75]" aria-hidden />
            ) : (
              <Package className="size-6 stroke-[1.75]" aria-hidden />
            )}
          </div>
          <div className="min-w-0">
            <div className="mb-1 flex flex-wrap items-center gap-2">
              <span
                className={cn(
                  "text-xs font-black tracking-tighter uppercase",
                  isCritical && "text-error",
                  isWarn && "text-on-tertiary-fixed-variant",
                  item.category === "unpaid" && "text-on-surface-variant",
                  isInstallmentMissed && "text-error",
                  item.category === "stock" && "text-secondary",
                )}
              >
                {item.badge}
              </span>
              <span
                className={cn(
                  "text-[10px] font-medium",
                  isCritical && "text-on-error-container/60",
                  isWarn && "text-on-tertiary-fixed-variant/60",
                  item.category === "unpaid" && "text-slate-400",
                  item.category === "stock" && "text-slate-400",
                )}
              >
                {item.timeLabel}
              </span>
            </div>
            <h3
              className={cn(
                "text-lg leading-snug font-bold",
                isCritical && "text-on-error-container",
                isWarn && "text-on-tertiary-fixed",
                item.category === "unpaid" && "text-error",
                isInstallmentMissed && "text-error",
                item.category === "stock" && "text-on-surface",
              )}
            >
              {item.title}
            </h3>
            <p
              className={cn(
                "mt-1 font-medium",
                isCritical && "text-on-error-container/80",
                isWarn && "text-on-tertiary-fixed/80",
                item.category === "unpaid" && "text-slate-600",
                item.category === "stock" && "text-slate-600",
              )}
            >
              {item.detail}
            </p>
          </div>
        </div>

        <div className="flex shrink-0 flex-col items-stretch gap-2 sm:items-end">
          {item.variant === "whatsapp_ignore" && waLink && (
            <>
              <a
                href={waLink}
                target="_blank"
                rel="noopener noreferrer"
                className={cn(
                  "inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-bold transition-all",
                  WA_GREEN,
                )}
              >
                <MessageCircle className={iconSm} aria-hidden />
                Ouvrir WhatsApp Web
              </a>
              <button
                type="button"
                onClick={() => onDismiss?.(item.id)}
                className="text-on-error-container/60 hover:text-on-error-container text-xs font-semibold underline"
              >
                Ignorer temporairement
              </button>
            </>
          )}
          {item.variant === "details" && (
            <Button
              type="button"
              variant="outline"
              className="border-tertiary/20 text-on-tertiary-fixed h-auto rounded-xl px-4 py-2 font-bold"
            >
              <Eye className={iconSm} aria-hidden />
              Détails
            </Button>
          )}
          {item.variant === "phone_mail" && (
            <div className="flex gap-2">
              {waLink ? (
                <a
                  href={waLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-slate-400 hover:text-primary rounded-xl bg-slate-50 p-2 transition-colors"
                  aria-label="WhatsApp"
                >
                  <MessageCircle className="size-5 stroke-[1.75]" aria-hidden />
                </a>
              ) : null}
              {phoneDigits ? (
                <a
                  href={`tel:${phoneDigits}`}
                  className="text-slate-400 hover:text-primary rounded-xl bg-slate-50 p-2 transition-colors"
                  aria-label="Appeler"
                >
                  <Phone className="size-5 stroke-[1.75]" aria-hidden />
                </a>
              ) : (
                <span
                  className="text-slate-400 rounded-xl bg-slate-50 p-2 opacity-50"
                  aria-label="Appeler indisponible"
                  aria-disabled="true"
                >
                  <Phone className="size-5 stroke-[1.75]" aria-hidden />
                </span>
              )}
              {contactEmail ? (
                <a
                  href={`mailto:${contactEmail}`}
                  className="text-slate-400 hover:text-primary rounded-xl bg-slate-50 p-2 transition-colors"
                  aria-label="E-mail"
                >
                  <Mail className="size-5 stroke-[1.75]" aria-hidden />
                </a>
              ) : (
                <span
                  className="text-slate-400 rounded-xl bg-slate-50 p-2 opacity-50"
                  aria-label="E-mail indisponible"
                  aria-disabled="true"
                >
                  <Mail className="size-5 stroke-[1.75]" aria-hidden />
                </span>
              )}
            </div>
          )}
          {item.variant === "order" && (
            <Button
              type="button"
              className="bg-primary-container/10 text-primary hover:bg-primary-container/20 h-auto rounded-xl px-4 py-2 font-bold"
            >
              Commander
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

const TABS: { id: AlertTabFilter; label: string }[] = [
  { id: "all", label: "Tous" },
  { id: "credit", label: "Crédit Limite" },
  { id: "unpaid", label: "Impayés" },
  { id: "stock", label: "Stock" },
];

export function AlertsPage() {
  return <AlertsPageContent />;
}

function AlertsPageContent() {
  const locale = useLocale();
  const isAr = locale === "ar";
  const tr = (fr: string, ar: string) => (isAr ? ar : fr);
  const { headerSearchQuery, setHeaderSearchQuery } = useAdminChrome();
  const [tab, setTab] = useState<AlertTabFilter>("all");
  const [ruleDialogOpen, setRuleDialogOpen] = useState(false);
  const [filterDialogOpen, setFilterDialogOpen] = useState(false);
  const [advancedFilters, setAdvancedFilters] = useState<AlertAdvancedFilters>(
    DEFAULT_ALERT_ADVANCED_FILTERS,
  );
  const [dismissed, setDismissed] = useState<Set<string>>(() => new Set());
  const [selectedClientId, setSelectedClientId] = useState<string>("");
  const currentUser = useQuery(api.authz.currentUser);
  const canManageAlertRules = canManageAlerts(currentUser?.permissions ?? []);
  const { alerts, clients, isLoading } = useAlertFeed();

  const quickClients = useMemo<QuickContactClient[]>(
    () =>
      clients
      .filter((c) => c.phone.replace(/\D/g, "").length >= 8)
      .map((c) => {
        const digits = c.phone.replace(/\D/g, "");
        return {
          id: c.id,
          name: c.fullName,
          nameAr: c.fullName,
          phoneDigits: digits,
          displayPhone: c.phone,
          limitDh: c.isCashOnly ? 0 : (c.creditLimitMad ?? 0),
        };
      }),
    [clients],
  );

  const effectiveSelectedClientId =
    selectedClientId && quickClients.some((c) => c.id === selectedClientId)
      ? selectedClientId
      : quickClients[0]?.id ?? "";

  const selectedClient = useMemo(
    () =>
      quickClients.find((c) => c.id === effectiveSelectedClientId) ??
      quickClients[0] ??
      null,
    [quickClients, effectiveSelectedClientId],
  );

  const msgFr = selectedClient ? creditOverLimitMessageFr(selectedClient) : "";
  const msgAr = selectedClient ? creditOverLimitMessageAr(selectedClient) : "";
  const sendHref =
    selectedClient ? whatsappHref(selectedClient.phoneDigits, msgFr) : "#";

  const visibleAlerts = useMemo(() => {
    const q = headerSearchQuery.trim().toLowerCase();
    return alerts.filter((a) => {
      if (!advancedFilters.showDismissed && dismissed.has(a.id)) return false;
      if (!tabMatches(tab, a.category)) return false;
      if (!advancedFilters.categories.includes(a.category)) return false;
      if (advancedFilters.source === "auto" && a.id.startsWith("rule:")) {
        return false;
      }
      if (advancedFilters.source === "rules" && !a.id.startsWith("rule:")) {
        return false;
      }
      if (advancedFilters.whatsappOnly && !a.whatsappPhone) return false;
      if (!q) return true;
      const hay = `${a.title} ${a.detail} ${a.clientName ?? ""}`.toLowerCase();
      return hay.includes(q);
    });
  }, [advancedFilters, alerts, dismissed, headerSearchQuery, tab]);

  const filtersActive = !isDefaultAlertAdvancedFilters(advancedFilters);

  const pageStats = useMemo(() => {
    const active = alerts.filter((a) => !dismissed.has(a.id));
    const critical = active.filter((a) => a.category === "credit_over").length;
    return {
      critical,
      pending: active.length - critical,
    };
  }, [alerts, dismissed]);

  return (
    <div className="bg-surface text-on-surface flex min-h-0 flex-1 flex-col">
      <main className="flex-1 overflow-auto px-4 py-6 sm:px-8">
        {isLoading ? (
          <div className="w-full">
            <AlertsPageSkeleton />
          </div>
        ) : (
          <div className="w-full">
            <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <span className="text-primary text-xs font-bold tracking-widest uppercase">
                  {tr("Gestion des Risques", "إدارة المخاطر")}
                </span>
              </div>
              <div className="flex flex-wrap gap-3">
                <Button
                  type="button"
                  variant="outline"
                  className={cn(
                    "bg-surface-container-lowest border-sidebar-border shadow-sm",
                    filtersActive && "border-primary text-primary",
                  )}
                  onClick={() => setFilterDialogOpen(true)}
                >
                  <ListFilter className={iconSm} aria-hidden />
                  {tr("Filtres Avancés", "فلاتر متقدمة")}
                  {filtersActive ? (
                    <span className="bg-primary text-on-primary ms-1 rounded-full px-1.5 py-0.5 text-[10px] font-black">
                      •
                    </span>
                  ) : null}
                </Button>
                <Button
                  type="button"
                  className="from-primary to-primary-container shadow-primary/20 rounded-xl bg-linear-to-br font-bold shadow-lg"
                  onClick={() => setRuleDialogOpen(true)}
                  disabled={!canManageAlertRules}
                  title={
                    canManageAlertRules
                      ? undefined
                      : tr(
                          "Permission requise pour gérer les règles",
                          "صلاحية مطلوبة لإدارة القواعد",
                        )
                  }
                >
                  <Plus className={iconSm} aria-hidden />
                  {tr("Nouvelle Règle", "قاعدة جديدة")}
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
              <div className="space-y-6 lg:col-span-8">
                <div className="bg-surface-container/50 flex w-fit flex-wrap items-center gap-2 rounded-2xl p-1.5 backdrop-blur-md">
                  {TABS.map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setTab(t.id)}
                      className={cn(
                        "rounded-xl px-5 py-2 text-sm font-semibold transition-all",
                        tab === t.id
                          ? "bg-surface-container-lowest text-primary shadow-sm"
                          : "text-on-surface-variant hover:bg-white/50",
                      )}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>

                <AdminFilterSummary
                  filteredCount={visibleAlerts.length}
                  totalCount={alerts.length}
                  searchQuery={headerSearchQuery}
                  onClearSearch={() => setHeaderSearchQuery("")}
                  extraActive={filtersActive || tab !== "all"}
                  extraLabel={
                    tab !== "all"
                      ? TABS.find((t) => t.id === tab)?.label
                      : filtersActive
                        ? tr("Filtres avancés", "فلاتر متقدمة")
                        : undefined
                  }
                  itemLabel={tr("alerte", "تنبيه")}
                  itemLabelPlural={tr("alertes", "تنبيهات")}
                />

                <div className="space-y-4">
                  {visibleAlerts.length === 0 ? (
                    <p className="text-on-surface-variant border-sidebar-border bg-surface-container-low/40 rounded-2xl border px-4 py-8 text-center text-sm">
                      {tr("Aucune alerte pour ce filtre.", "لا توجد تنبيهات لهذا الفلتر.")}
                    </p>
                  ) : (
                    visibleAlerts.map((item) => (
                      <AlertCardRow
                        key={item.id}
                        item={item}
                        onDismiss={(id) =>
                          setDismissed((prev) => new Set(prev).add(id))
                        }
                      />
                    ))
                  )}
                </div>
              </div>

              <div className="lg:col-span-4">
                <div className="lg:sticky lg:top-24 space-y-6">
                  <div className="bg-surface-container-lowest shadow-slate-200/50 rounded-[2rem] p-6 shadow-xl sm:p-8">
                    <div className="mb-8 flex items-center gap-4">
                      <div className="bg-secondary-container flex h-14 w-14 items-center justify-center rounded-2xl text-secondary">
                        <MessageCircle
                          className="size-8 stroke-[1.75]"
                          aria-hidden
                        />
                      </div>
                      <div>
                        <h2 className="text-xl leading-tight font-black">
                          {tr("Action Rapide", "إجراء سريع")}
                        </h2>
                        <p className="text-on-surface-variant text-xs font-medium">
                          {tr("Contacter via WhatsApp", "التواصل عبر واتساب")}
                        </p>
                      </div>
                    </div>

                    <div className="space-y-5">
                      <div>
                        <label
                          htmlFor="alert-client-select"
                          className="text-on-surface-variant mb-2 block px-1 text-[10px] font-black tracking-widest uppercase"
                        >
                          {tr("Sélectionner Client", "اختيار العميل")}
                        </label>
                        <div className="relative">
                          <select
                            id="alert-client-select"
                            value={effectiveSelectedClientId}
                            onChange={(e) =>
                              setSelectedClientId(e.target.value)
                            }
                            className="bg-surface-container-low text-on-surface w-full appearance-none rounded-xl border-none py-3 pr-10 pl-4 text-sm font-bold outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
                          >
                            {quickClients.length === 0 ? (
                              <option value="">
                                {tr("Aucun client (ajoutez d’abord un client)", "لا يوجد عميل (أضف عميلًا أولًا)")}
                              </option>
                            ) : null}
                            {quickClients.map((c) => (
                              <option key={c.id} value={c.id}>
                                {c.name} ({c.displayPhone})
                              </option>
                            ))}
                          </select>
                          <ChevronDown
                            className="text-on-surface-variant pointer-events-none absolute top-1/2 right-3 size-5 -translate-y-1/2 stroke-[1.75]"
                            aria-hidden
                          />
                        </div>
                      </div>

                      <div>
                        <span className="text-on-surface-variant mb-2 block px-1 text-[10px] font-black tracking-widest uppercase">
                          {tr("Modèle de Message", "نموذج الرسالة")}
                        </span>
                        <div className="bg-surface-container-low rounded-2xl p-4">
                          <p className="text-on-surface-variant mb-3 text-xs italic">
                            {tr("Prévisualisation:", "معاينة:")}
                          </p>
                          <p className="text-sm leading-relaxed font-medium">
                            &quot;Bonjour M.{" "}
                            <span className="text-primary">
                              {selectedClient?.name ?? "Client"}
                            </span>
                            , nous vous informons que votre crédit chez
                            {STORE_NAME} a dépassé la limite de{" "}
                            <span className="text-error">
                              {(selectedClient?.limitDh ?? 0).toLocaleString("fr-FR")}{" "}
                              MAD
                            </span>
                            . Merci de régulariser.&quot;
                          </p>
                          <hr className="border-sidebar-border my-4" />
                          <p
                            className="text-sm text-right font-medium"
                            dir="rtl"
                          >
                            &quot;{msgAr}&quot;
                          </p>
                        </div>
                      </div>

                      <a
                        href={sendHref}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={cn(
                          "flex w-full items-center justify-center gap-3 rounded-2xl py-4 text-lg font-black shadow-lg transition-all hover:scale-[1.02] active:scale-[0.98]",
                          WA_GREEN,
                          "shadow-green-500/30",
                          (!selectedClient || quickClients.length === 0) &&
                            "pointer-events-none opacity-60",
                        )}
                      >
                        <Send className="size-5 stroke-[1.75]" aria-hidden />
                        {tr("Envoyer maintenant", "إرسال الآن")}
                      </a>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="border-error/20 bg-surface-container-lowest rounded-2xl border-b-2 p-5 shadow-sm">
                      <p className="text-on-surface-variant text-[10px] font-bold uppercase">
                        {tr("Alertes Critiques", "تنبيهات حرجة")}
                      </p>
                      <p className="text-error mt-1 text-3xl font-black">
                        {pageStats.critical}
                      </p>
                    </div>
                    <div className="border-tertiary/20 bg-surface-container-lowest rounded-2xl border-b-2 p-5 shadow-sm">
                      <p className="text-on-surface-variant text-[10px] font-bold uppercase">
                        {tr("En Attente", "قيد الانتظار")}
                      </p>
                      <p className="text-tertiary mt-1 text-3xl font-black">
                        {String(pageStats.pending).padStart(2, "0")}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      <AlertAdvancedFiltersDialog
        open={filterDialogOpen}
        onOpenChange={setFilterDialogOpen}
        filters={advancedFilters}
        onApply={setAdvancedFilters}
        tr={tr}
      />

      <AlertRuleDialog
        open={ruleDialogOpen}
        onOpenChange={setRuleDialogOpen}
        tr={tr}
      />
    </div>
  );
}
