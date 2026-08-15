"use client";

import { useEffect, useState } from "react";

import { QtyKeypadField } from "@/components/money/qty-keypad-field";
import type { AlertCategory } from "@/lib/alerts/types";
import type { AlertRule, AlertRuleKind } from "@/lib/alerts/rules";
import { appendAlertRule } from "@/lib/alerts/rules";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toaster";

type AlertRuleDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tr: (fr: string, ar: string) => string;
};

const CATEGORY_OPTIONS: { value: AlertCategory; labelFr: string; labelAr: string }[] =
  [
    { value: "credit_warn", labelFr: "Crédit (attention)", labelAr: "ائتمان (تنبيه)" },
    { value: "credit_over", labelFr: "Crédit (urgent)", labelAr: "ائتمان (عاجل)" },
    { value: "stock", labelFr: "Stock", labelAr: "مخزون" },
    { value: "unpaid", labelFr: "Impayé", labelAr: "غير مدفوع" },
  ];

export function AlertRuleDialog({ open, onOpenChange, tr }: AlertRuleDialogProps) {
  const toast = useToast();
  const [label, setLabel] = useState("");
  const [kind, setKind] = useState<AlertRuleKind>("credit_percent");
  const [creditPercent, setCreditPercent] = useState(80);
  const [stockThreshold, setStockThreshold] = useState(5);
  const [customTitle, setCustomTitle] = useState("");
  const [customDetail, setCustomDetail] = useState("");
  const [customCategory, setCustomCategory] = useState<AlertCategory>("credit_warn");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setLabel("");
    setKind("credit_percent");
    setCreditPercent(80);
    setStockThreshold(5);
    setCustomTitle("");
    setCustomDetail("");
    setCustomCategory("credit_warn");
  }, [open]);

  const labelValid = label.trim().length > 0;
  const creditValid =
    kind !== "credit_percent" ||
    (creditPercent >= 1 && creditPercent <= 100);
  const stockValid =
    kind !== "stock_threshold" || stockThreshold >= 0;
  const customValid =
    kind !== "custom" ||
    (customTitle.trim().length > 0 && customDetail.trim().length > 0);
  const canSave = labelValid && creditValid && stockValid && customValid && !saving;

  function handleOpenChange(next: boolean) {
    onOpenChange(next);
  }

  async function handleSave() {
    if (!canSave) return;
    setSaving(true);
    try {
      const rule: AlertRule = {
        id: `rule:${crypto.randomUUID()}`,
        label: label.trim(),
        kind,
        enabled: true,
        createdAt: Date.now(),
        ...(kind === "credit_percent"
          ? {
              creditPercentThreshold: Math.min(100, Math.max(1, creditPercent)),
            }
          : {}),
        ...(kind === "stock_threshold"
          ? {
              stockThreshold: Math.max(0, stockThreshold),
            }
          : {}),
        ...(kind === "custom"
          ? {
              customTitle: customTitle.trim(),
              customDetail: customDetail.trim(),
              customCategory,
            }
          : {}),
      };
      appendAlertRule(rule);
      toast.success(
        tr("Règle enregistrée", "تم حفظ القاعدة"),
        rule.label,
      );
      handleOpenChange(false);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-md rounded-2xl">
        <DialogHeader>
          <DialogTitle>{tr("Nouvelle règle", "قاعدة جديدة")}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <label
              htmlFor="rule-label"
              className="text-on-surface text-xs font-bold tracking-wide uppercase"
            >
              {tr("Nom de la règle", "اسم القاعدة")}
            </label>
            <Input
              id="rule-label"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder={tr("Ex. Alerte crédit 80%", "مثال: تنبيه ائتمان 80%")}
              className="bg-surface-container-low border-transparent h-11 rounded-xl"
            />
          </div>

          <div className="space-y-1.5">
            <label
              htmlFor="rule-kind"
              className="text-on-surface text-xs font-bold tracking-wide uppercase"
            >
              {tr("Type", "النوع")}
            </label>
            <select
              id="rule-kind"
              value={kind}
              onChange={(e) => setKind(e.target.value as AlertRuleKind)}
              className="border-input bg-surface-container-low text-on-surface focus-visible:ring-primary/25 h-11 w-full rounded-xl border px-3 text-sm outline-none focus-visible:ring-2"
            >
              <option value="credit_percent">
                {tr("Crédit — seuil (%)", "ائتمان — عتبة (%)")}
              </option>
              <option value="stock_threshold">
                {tr("Stock — seuil (unités)", "مخزون — عتبة (وحدات)")}
              </option>
              <option value="custom">
                {tr("Alerte personnalisée", "تنبيه مخصص")}
              </option>
            </select>
          </div>

          {kind === "credit_percent" ? (
            <div className="space-y-1.5">
              <label
                htmlFor="rule-credit-pct"
                className="text-on-surface text-xs font-bold tracking-wide uppercase"
              >
                {tr("Seuil crédit (%)", "عتبة الائتمان (%)")}
              </label>
              <QtyKeypadField
                id="rule-credit-pct"
                value={creditPercent}
                onValueChange={setCreditPercent}
                min={1}
                max={100}
                keypadTitle={tr("Seuil crédit (%)", "عتبة الائتمان (%)")}
                wrapperClassName="max-w-xs"
              />
              <p className="text-outline text-xs">
                {tr(
                  "Alerte quand l'encours client atteint ce pourcentage de sa limite.",
                  "تنبيه عند وصول رصيد العميل إلى هذه النسبة من حده.",
                )}
              </p>
            </div>
          ) : null}

          {kind === "stock_threshold" ? (
            <div className="space-y-1.5">
              <label
                htmlFor="rule-stock-threshold"
                className="text-on-surface text-xs font-bold tracking-wide uppercase"
              >
                {tr("Seuil stock (unités)", "عتبة المخزون (وحدات)")}
              </label>
              <QtyKeypadField
                id="rule-stock-threshold"
                value={stockThreshold}
                onValueChange={setStockThreshold}
                min={0}
                keypadTitle={tr("Seuil stock (unités)", "عتبة المخزون (وحدات)")}
                wrapperClassName="max-w-xs"
              />
              <p className="text-outline text-xs">
                {tr(
                  "Alerte pour chaque produit dont le stock est à ou sous ce seuil.",
                  "تنبيه لكل منتج مخزونه عند أو تحت هذه العتبة.",
                )}
              </p>
            </div>
          ) : null}

          {kind === "custom" ? (
            <>
              <div className="space-y-1.5">
                <label
                  htmlFor="rule-custom-title"
                  className="text-on-surface text-xs font-bold tracking-wide uppercase"
                >
                  {tr("Titre", "العنوان")}
                </label>
                <Input
                  id="rule-custom-title"
                  value={customTitle}
                  onChange={(e) => setCustomTitle(e.target.value)}
                  className="bg-surface-container-low border-transparent h-11 rounded-xl"
                />
              </div>
              <div className="space-y-1.5">
                <label
                  htmlFor="rule-custom-detail"
                  className="text-on-surface text-xs font-bold tracking-wide uppercase"
                >
                  {tr("Détail", "التفاصيل")}
                </label>
                <Input
                  id="rule-custom-detail"
                  value={customDetail}
                  onChange={(e) => setCustomDetail(e.target.value)}
                  className="bg-surface-container-low border-transparent h-11 rounded-xl"
                />
              </div>
              <div className="space-y-1.5">
                <label
                  htmlFor="rule-custom-category"
                  className="text-on-surface text-xs font-bold tracking-wide uppercase"
                >
                  {tr("Catégorie", "الفئة")}
                </label>
                <select
                  id="rule-custom-category"
                  value={customCategory}
                  onChange={(e) =>
                    setCustomCategory(e.target.value as AlertCategory)
                  }
                  className="border-input bg-surface-container-low text-on-surface focus-visible:ring-primary/25 h-11 w-full rounded-xl border px-3 text-sm outline-none focus-visible:ring-2"
                >
                  {CATEGORY_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {tr(opt.labelFr, opt.labelAr)}
                    </option>
                  ))}
                </select>
              </div>
            </>
          ) : null}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            type="button"
            variant="outline"
            onClick={() => handleOpenChange(false)}
          >
            {tr("Annuler", "إلغاء")}
          </Button>
          <Button type="button" disabled={!canSave} onClick={() => void handleSave()}>
            {saving ? tr("Enregistrement…", "جاري الحفظ…") : tr("Enregistrer", "حفظ")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
