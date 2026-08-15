"use client";

import { useEffect, useState } from "react";

import type { AlertAdvancedFilters, AlertSourceFilter } from "@/lib/alerts/advanced-filters";
import {
  ALERT_CATEGORY_OPTIONS,
  DEFAULT_ALERT_ADVANCED_FILTERS,
} from "@/lib/alerts/advanced-filters";
import type { AlertCategory } from "@/lib/alerts/types";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

type AlertAdvancedFiltersDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  filters: AlertAdvancedFilters;
  onApply: (filters: AlertAdvancedFilters) => void;
  tr: (fr: string, ar: string) => string;
};

export function AlertAdvancedFiltersDialog({
  open,
  onOpenChange,
  filters,
  onApply,
  tr,
}: AlertAdvancedFiltersDialogProps) {
  const [draft, setDraft] = useState<AlertAdvancedFilters>(filters);

  useEffect(() => {
    if (open) setDraft(filters);
  }, [open, filters]);

  function toggleCategory(category: AlertCategory) {
    setDraft((prev) => {
      const has = prev.categories.includes(category);
      const next = has
        ? prev.categories.filter((c) => c !== category)
        : [...prev.categories, category];
      return { ...prev, categories: next };
    });
  }

  function handleReset() {
    setDraft(DEFAULT_ALERT_ADVANCED_FILTERS);
  }

  function handleApply() {
    onApply({
      ...draft,
      categories:
        draft.categories.length > 0
          ? draft.categories
          : [...DEFAULT_ALERT_ADVANCED_FILTERS.categories],
    });
    onOpenChange(false);
  }

  const sourceOptions: { value: AlertSourceFilter; labelFr: string; labelAr: string }[] =
    [
      { value: "all", labelFr: "Toutes les alertes", labelAr: "كل التنبيهات" },
      { value: "auto", labelFr: "Automatiques", labelAr: "تلقائية" },
      { value: "rules", labelFr: "Règles personnalisées", labelAr: "قواعد مخصصة" },
    ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md rounded-2xl">
        <DialogHeader>
          <DialogTitle>{tr("Filtres avancés", "فلاتر متقدمة")}</DialogTitle>
        </DialogHeader>

        <div className="space-y-5">
          <div className="space-y-2">
            <p className="text-on-surface text-xs font-bold tracking-wide uppercase">
              {tr("Source", "المصدر")}
            </p>
            <div className="flex flex-wrap gap-2">
              {sourceOptions.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setDraft((p) => ({ ...p, source: opt.value }))}
                  className={cn(
                    "rounded-xl px-3 py-2 text-xs font-bold transition-colors",
                    draft.source === opt.value
                      ? "bg-primary text-on-primary"
                      : "bg-surface-container-low text-on-surface-variant hover:bg-surface-container",
                  )}
                >
                  {tr(opt.labelFr, opt.labelAr)}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-on-surface text-xs font-bold tracking-wide uppercase">
              {tr("Catégories", "الفئات")}
            </p>
            <div className="space-y-2">
              {ALERT_CATEGORY_OPTIONS.map((opt) => (
                <label
                  key={opt.value}
                  className="text-on-surface flex cursor-pointer items-center gap-3 text-sm"
                >
                  <input
                    type="checkbox"
                    checked={draft.categories.includes(opt.value)}
                    onChange={() => toggleCategory(opt.value)}
                    className="border-input text-primary size-4 rounded"
                  />
                  {tr(opt.labelFr, opt.labelAr)}
                </label>
              ))}
            </div>
          </div>

          <div className="border-sidebar-border space-y-3 rounded-xl border border-dashed p-4">
            <label className="text-on-surface flex cursor-pointer items-center gap-3 text-sm">
              <input
                type="checkbox"
                checked={draft.showDismissed}
                onChange={(e) =>
                  setDraft((p) => ({ ...p, showDismissed: e.target.checked }))
                }
                className="border-input text-primary size-4 rounded"
              />
              {tr("Afficher les alertes ignorées", "إظهار التنبيهات المتجاهلة")}
            </label>
            <label className="text-on-surface flex cursor-pointer items-center gap-3 text-sm">
              <input
                type="checkbox"
                checked={draft.whatsappOnly}
                onChange={(e) =>
                  setDraft((p) => ({ ...p, whatsappOnly: e.target.checked }))
                }
                className="border-input text-primary size-4 rounded"
              />
              {tr("Avec contact WhatsApp uniquement", "مع واتساب فقط")}
            </label>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button type="button" variant="outline" onClick={handleReset}>
            {tr("Réinitialiser", "إعادة تعيين")}
          </Button>
          <Button type="button" onClick={handleApply} className="font-bold">
            {tr("Appliquer", "تطبيق")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
