"use client";

import { useState } from "react";
import { useMutation } from "convex/react";

import { MadPriceField } from "@/components/money/mad-price-field";
import { Button } from "@/components/ui/button";
import { usePosKeyboardOptional } from "@/components/pos/pos-keyboard-context";
import {
  PosDialog,
  PosDialogContent,
  PosDialogDescription,
  PosDialogFooter,
  PosDialogHeader,
  PosDialogTitle,
} from "@/components/pos/pos-dialog";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toaster";
import { api } from "@/convex/_generated/api";
import { cn } from "@/lib/utils";

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

type PosQuickAddClientDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (clientId: string) => void;
  tr: (fr: string, ar: string) => string;
};

export function PosQuickAddClientDialog({
  open,
  onOpenChange,
  onCreated,
  tr,
}: PosQuickAddClientDialogProps) {
  const toast = useToast();
  const posKeyboard = usePosKeyboardOptional();
  const createClient = useMutation(api.clients.create);
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [isCashOnly, setIsCashOnly] = useState(false);
  const [hasCreditLimit, setHasCreditLimit] = useState(false);
  const [creditLimit, setCreditLimit] = useState(0);
  const [initialSoldeMad, setInitialSoldeMad] = useState(0);
  const [saving, setSaving] = useState(false);

  function resetForm() {
    setFullName("");
    setPhone("");
    setIsCashOnly(false);
    setHasCreditLimit(false);
    setCreditLimit(0);
    setInitialSoldeMad(0);
  }

  function handleOpenChange(next: boolean) {
    if (!next) resetForm();
    onOpenChange(next);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const name = fullName.trim();
    const tel = normalizePhone(phone);
    if (!name || !tel || !phoneLooksValid(tel)) {
      toast.error(
        tr("Informations invalides", "بيانات غير صالحة"),
        tr(
          "Nom et téléphone valides requis (8 chiffres min.).",
          "الاسم والهاتف مطلوبان (8 أرقام على الأقل).",
        ),
      );
      return;
    }

    setSaving(true);
    try {
      let creditLimitMad: number | null = null;
      if (!isCashOnly && hasCreditLimit) {
        if (creditLimit <= 0) {
          toast.error(
            tr("Limite invalide", "حد غير صالح"),
            tr(
              "Entrez un montant entier supérieur à 0.",
              "أدخل مبلغًا صحيحًا أكبر من 0.",
            ),
          );
          setSaving(false);
          return;
        }
        creditLimitMad = creditLimit;
      }

      const created = await createClient({
        fullName: name,
        phone: tel,
        isCashOnly,
        creditLimitMad,
        initialSoldeMad,
      });
      toast.success(
        tr("Client ajouté", "تمت إضافة العميل"),
        tr(`${created.fullName} est disponible à la caisse.`, `${created.fullName} متاح في نقطة البيع.`),
      );
      onCreated(created.id);
      handleOpenChange(false);
    } catch (error) {
      const message = error instanceof Error ? error.message : undefined;
      toast.error(
        tr("Échec de l'ajout", "فشل الإضافة"),
        message ??
          tr(
            "Impossible de créer le client. Vérifiez vos droits.",
            "تعذر إنشاء العميل. تحقق من الصلاحيات.",
          ),
      );
    } finally {
      setSaving(false);
    }
  }

  const limitValid = isCashOnly || !hasCreditLimit || creditLimit > 0;

  const canSubmit =
    fullName.trim().length > 0 &&
    normalizePhone(phone).length > 0 &&
    phoneLooksValid(normalizePhone(phone)) &&
    limitValid;

  return (
    <PosDialog open={open} onOpenChange={handleOpenChange}>
        <PosDialogContent
        className={cn(
          "max-h-[min(90vh,720px)] max-w-md overflow-y-auto rounded-2xl",
          posKeyboard?.isEnabled &&
            posKeyboard.isOpen &&
            "pb-[min(42vh,320px)]",
        )}
      >
        <PosDialogHeader>
          <PosDialogTitle>{tr("Nouveau client", "عميل جديد")}</PosDialogTitle>
          <PosDialogDescription>
            {tr(
              "Ajoutez un client rapidement depuis la caisse.",
              "أضف عميلًا بسرعة من نقطة البيع.",
            )}
          </PosDialogDescription>
        </PosDialogHeader>
        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="space-y-1.5">
            <label className="text-xs font-bold uppercase" htmlFor="pos-client-name">
              {tr("Nom complet", "الاسم الكامل")}
            </label>
            <Input
              id="pos-client-name"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder={tr("Ex. Fatima Benali", "مثال: فاطمة بنعلي")}
              autoComplete="name"
              className="h-11 rounded-xl"
              required
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-bold uppercase" htmlFor="pos-client-phone">
              {tr("Téléphone", "الهاتف")}
            </label>
            <Input
              id="pos-client-phone"
              type="tel"
              inputMode="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="06 12 34 56 78"
              autoComplete="tel"
              className="h-11 rounded-xl"
              required
            />
            <p className="text-outline text-xs">
              {tr(
                "Au moins 8 chiffres (espaces et + autorisés).",
                "8 أرقام على الأقل (المسافات و + مسموح بها).",
              )}
            </p>
          </div>

          <div className="border-sidebar-border space-y-3 rounded-xl border border-dashed p-4">
            <label className="text-on-surface flex cursor-pointer items-start gap-3 text-sm font-medium">
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
                className="border-input text-primary focus-visible:ring-primary/30 mt-0.5 size-4 shrink-0 rounded"
              />
              <span>
                <span className="block text-xs font-bold tracking-wide uppercase">
                  {tr("Client comptant uniquement", "عميل نقدي فقط")}
                </span>
                <span className="text-on-surface-variant font-normal">
                  {tr(
                    "Désactive la vente à crédit pour ce client.",
                    "تعطيل البيع الآجل لهذا العميل.",
                  )}
                </span>
              </span>
            </label>
            <label className="text-on-surface flex cursor-pointer items-start gap-3 text-sm font-medium">
              <input
                type="checkbox"
                checked={hasCreditLimit}
                disabled={isCashOnly}
                onChange={(e) => {
                  setHasCreditLimit(e.target.checked);
                  if (!e.target.checked) setCreditLimit(0);
                }}
                className="border-input text-primary focus-visible:ring-primary/30 mt-0.5 size-4 shrink-0 rounded disabled:opacity-50"
              />
              <span>
                <span className="block text-xs font-bold tracking-wide uppercase">
                  {tr("Limite de crédit (optionnel)", "حد الائتمان (اختياري)")}
                </span>
                <span className="text-on-surface-variant font-normal">
                  {tr(
                    "Cochez et indiquez un montant si ce client ne doit pas dépasser un certain total dû au magasin : l'application pourra vous prévenir en cas de dépassement. Si vous ne cochez pas, aucune limite n'est enregistrée sur cette fiche (pas d'alerte liée à un plafond pour lui).",
                    "فعّل هذا الخيار وحدد مبلغًا إذا كان هذا العميل لا يجب أن يتجاوز مبلغًا معينًا مستحقًا للمتجر. سيقوم التطبيق بتنبيهك عند التجاوز. إذا لم تُفعّل الخيار فلن يتم حفظ أي حد لهذا العميل.",
                  )}
                </span>
              </span>
            </label>
            {hasCreditLimit ? (
              <div className="space-y-2 pl-7">
                <label
                  htmlFor="pos-client-credit-limit"
                  className="text-on-surface text-xs font-bold tracking-wide uppercase"
                >
                  {tr("Plafond (MAD)", "السقف (درهم)")}
                </label>
                <MadPriceField
                  id="pos-client-credit-limit"
                  value={creditLimit}
                  onValueChange={setCreditLimit}
                  min={1}
                  labelFr="Plafond"
                  labelAr="السقف"
                  wrapperClassName="max-w-xs"
                />
                {!limitValid ? (
                  <p className="text-error text-xs">
                    {tr(
                      "Entrez un montant entier supérieur à 0.",
                      "أدخل مبلغًا صحيحًا أكبر من 0.",
                    )}
                  </p>
                ) : null}
              </div>
            ) : null}
            <div className="space-y-1.5">
              <label
                htmlFor="pos-client-initial-solde"
                className="text-on-surface text-xs font-bold tracking-wide uppercase"
              >
                {tr("Solde initial (MAD)", "الرصيد الابتدائي (درهم)")}
              </label>
              <MadPriceField
                id="pos-client-initial-solde"
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

          <PosDialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              className="rounded-xl"
              onClick={() => handleOpenChange(false)}
            >
              {tr("Annuler", "إلغاء")}
            </Button>
            <Button type="submit" className="rounded-xl font-bold" disabled={!canSubmit || saving}>
              {saving ? tr("Enregistrement…", "جاري الحفظ…") : tr("Ajouter", "إضافة")}
            </Button>
          </PosDialogFooter>
        </form>
      </PosDialogContent>
    </PosDialog>
  );
}
