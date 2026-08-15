"use client";

import { useEffect, useState } from "react";

import { MadPriceField } from "@/components/money/mad-price-field";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import type { ClientEditPayload } from "@/components/clients/clients-edit-dialog";

function normalizePhone(raw: string): string {
  return raw.replace(/\s+/g, " ").trim();
}

function phoneLooksValid(phone: string): boolean {
  return phone.replace(/\D/g, "").length >= 8;
}

function parsePositiveMad(raw: string): number | null {
  const n = Number.parseInt(raw.replace(/\s/g, ""), 10);
  if (!Number.isFinite(n) || n <= 0) return null;
  return n;
}

type ClientsCreateDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreate: (payload: ClientEditPayload) => Promise<void>;
  tr: (fr: string, ar: string) => string;
};

export function ClientsCreateDialog({
  open,
  onOpenChange,
  onCreate,
  tr,
}: ClientsCreateDialogProps) {
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [isCashOnly, setIsCashOnly] = useState(false);
  const [hasCreditLimit, setHasCreditLimit] = useState(false);
  const [creditLimit, setCreditLimit] = useState(0);
  const [initialSoldeMad, setInitialSoldeMad] = useState(0);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setFullName("");
    setPhone("");
    setIsCashOnly(false);
    setHasCreditLimit(false);
    setCreditLimit(0);
    setInitialSoldeMad(0);
  }, [open]);

  const limitValid = isCashOnly || !hasCreditLimit || creditLimit > 0;
  const basicsValid =
    fullName.trim().length > 0 &&
    normalizePhone(phone).length > 0 &&
    phoneLooksValid(normalizePhone(phone));
  const canSave = basicsValid && limitValid && !saving;

  async function handleSave() {
    if (!canSave) return;
    let creditLimitMad: number | null = null;
    if (!isCashOnly && hasCreditLimit) {
      if (creditLimit <= 0) return;
      creditLimitMad = creditLimit;
    }
    setSaving(true);
    try {
      await onCreate({
        fullName: fullName.trim(),
        phone: normalizePhone(phone),
        isCashOnly,
        creditLimitMad,
        initialSoldeMad,
      });
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{tr("Nouveau client", "عميل جديد")}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <label
              htmlFor="create-client-name"
              className="text-on-surface text-xs font-bold tracking-wide uppercase"
            >
              {tr("Nom complet", "الاسم الكامل")}
            </label>
            <Input
              id="create-client-name"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder={tr("Ex. Fatima Benali", "مثال: فاطمة بنعلي")}
              autoComplete="name"
              className="bg-surface-container-low border-transparent h-11 rounded-xl"
            />
          </div>
          <div className="space-y-1.5">
            <label
              htmlFor="create-client-phone"
              className="text-on-surface text-xs font-bold tracking-wide uppercase"
            >
              {tr("Téléphone", "الهاتف")}
            </label>
            <Input
              id="create-client-phone"
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="06 12 34 56 78"
              autoComplete="tel"
              className="bg-surface-container-low border-transparent h-11 rounded-xl"
            />
          </div>
          <label className="text-on-surface flex cursor-pointer items-center gap-3 text-sm">
            <input
              type="checkbox"
              checked={isCashOnly}
              onChange={(e) => {
                setIsCashOnly(e.target.checked);
                if (e.target.checked) {
                  setHasCreditLimit(false);
                  setCreditLimit(0);
                }
              }}
              className="border-input text-primary size-4 rounded"
            />
            {tr("Client comptant uniquement", "عميل نقدي فقط")}
          </label>
          <label className="text-on-surface flex cursor-pointer items-center gap-3 text-sm">
            <input
              type="checkbox"
              checked={hasCreditLimit}
              disabled={isCashOnly}
              onChange={(e) => {
                setHasCreditLimit(e.target.checked);
                if (!e.target.checked) setCreditLimit(0);
              }}
              className="border-input text-primary size-4 rounded"
            />
            {tr("Plafond de crédit (MAD)", "حد الائتمان (درهم)")}
          </label>
          {hasCreditLimit ? (
            <MadPriceField
              value={creditLimit}
              onValueChange={setCreditLimit}
              min={1}
              labelFr="Plafond crédit"
              labelAr="حد الائتمان"
              wrapperClassName="max-w-xs"
            />
          ) : null}
          <div className="space-y-1.5">
            <label
              htmlFor="create-client-initial-solde"
              className="text-on-surface text-xs font-bold tracking-wide uppercase"
            >
              {tr("Solde initial (MAD)", "الرصيد الابتدائي (درهم)")}
            </label>
            <MadPriceField
              id="create-client-initial-solde"
              value={initialSoldeMad}
              onValueChange={setInitialSoldeMad}
              min={-999_999.99}
              useKeypad={false}
              labelFr="Solde initial"
              labelAr="الرصيد الابتدائي"
              wrapperClassName="max-w-xs"
            />
            <p className="text-on-surface-variant text-[11px]">
              {tr(
                "Négatif = dette · Positif = avoir · 0 = aucun",
                "سالب = دين · موجب = رصيد دائن · 0 = لا شيء",
              )}
            </p>
          </div>
        </div>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            {tr("Annuler", "إلغاء")}
          </Button>
          <Button type="button" disabled={!canSave} onClick={() => void handleSave()}>
            {saving ? tr("Enregistrement…", "جاري الحفظ…") : tr("Ajouter", "إضافة")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
