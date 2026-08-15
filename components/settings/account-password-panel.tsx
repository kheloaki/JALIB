"use client";

import { useState } from "react";
import { useAction } from "convex/react";
import { KeyRound } from "lucide-react";

import { PasswordStrengthIndicator } from "@/components/auth/password-strength-indicator";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toaster";
import { api } from "@/convex/_generated/api";
import { isPasswordAcceptableForSignUp } from "@/lib/auth/password-strength";

export function AccountPasswordPanel({
  tr,
}: {
  tr: (fr: string, ar: string) => string;
}) {
  const toast = useToast();
  const changeOwnPassword = useAction(api.passwords.changeOwnPassword);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [saving, setSaving] = useState(false);

  const newPasswordOk =
    newPassword.length >= 8 && isPasswordAcceptableForSignUp(newPassword);
  const passwordsMatch =
    newPassword.length > 0 && newPassword === confirmPassword;
  const canSubmit =
    currentPassword.length > 0 && newPasswordOk && passwordsMatch && !saving;

  const newPasswordMessage =
    newPassword.length === 0
      ? tr(
          "8 caractères minimum, lettres et chiffres.",
          "8 أحرف على الأقل، حروف وأرقام.",
        )
      : newPassword.length < 8
        ? tr(
            `${8 - newPassword.length} caractère(s) restant(s).`,
            `${8 - newPassword.length} حرف/أحرف متبقية.`,
          )
        : !isPasswordAcceptableForSignUp(newPassword)
          ? tr(
              "Ajoutez des majuscules, chiffres ou symboles.",
              "أضف أحرفًا كبيرة أو أرقامًا أو رموزًا.",
            )
          : tr("Mot de passe accepté.", "كلمة المرور مقبولة.");

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canSubmit) return;
    setSaving(true);
    try {
      await changeOwnPassword({ currentPassword, newPassword });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      toast.success(
        tr("Mot de passe mis à jour", "تم تحديث كلمة المرور"),
        tr("Utilisez-le lors de votre prochaine connexion.", "استخدمها في تسجيل الدخول القادم."),
      );
    } catch (error) {
      toast.error(
        tr("Modification impossible", "تعذر التعديل"),
        error instanceof Error
          ? error.message
          : tr("Réessayez.", "حاول مجددًا."),
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="border-sidebar-border bg-surface-container-lowest space-y-5 rounded-2xl border p-5 shadow-sm sm:p-6">
      <form onSubmit={(event) => void onSubmit(event)} className="space-y-5">
        <div className="flex items-start gap-3">
          <div className="bg-primary/10 text-primary flex size-10 shrink-0 items-center justify-center rounded-xl">
            <KeyRound className="size-5 stroke-[1.75]" aria-hidden />
          </div>
          <div>
            <h2 className="text-lg font-black tracking-tight">
              {tr("Mot de passe", "كلمة المرور")}
            </h2>
            <p className="text-on-surface-variant mt-1 text-sm">
              {tr(
                "Modifiez votre mot de passe de connexion.",
                "غيّر كلمة مرور تسجيل الدخول.",
              )}
            </p>
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-bold uppercase" htmlFor="current-password">
            {tr("Mot de passe actuel", "كلمة المرور الحالية")}
          </label>
          <Input
            id="current-password"
            type="password"
            autoComplete="current-password"
            value={currentPassword}
            onChange={(event) => setCurrentPassword(event.target.value)}
            className="h-11 rounded-xl"
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-bold uppercase" htmlFor="new-password">
            {tr("Nouveau mot de passe", "كلمة المرور الجديدة")}
          </label>
          <Input
            id="new-password"
            type="password"
            autoComplete="new-password"
            value={newPassword}
            onChange={(event) => setNewPassword(event.target.value)}
            className="h-11 rounded-xl"
            aria-invalid={newPassword.length > 0 && !newPasswordOk}
          />
          <PasswordStrengthIndicator
            password={newPassword}
            invalid={newPassword.length > 0 && !newPasswordOk}
            message={newPasswordMessage}
            labels={{
              weak: tr("Faible", "ضعيف"),
              medium: tr("Moyen", "متوسط"),
              strong: tr("Fort", "قوي"),
              hint: tr("Force du mot de passe", "قوة كلمة المرور"),
            }}
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-bold uppercase" htmlFor="confirm-password">
            {tr("Confirmer le mot de passe", "تأكيد كلمة المرور")}
          </label>
          <Input
            id="confirm-password"
            type="password"
            autoComplete="new-password"
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
            className="h-11 rounded-xl"
            aria-invalid={
              confirmPassword.length > 0 && newPassword !== confirmPassword
            }
          />
          {confirmPassword.length > 0 && newPassword !== confirmPassword ? (
            <p className="text-error text-xs font-medium">
              {tr("Les mots de passe ne correspondent pas.", "كلمتا المرور غير متطابقتين.")}
            </p>
          ) : null}
        </div>

        <div className="flex justify-end">
          <Button
            type="submit"
            className="h-11 rounded-xl px-5 font-bold"
            disabled={!canSubmit}
          >
            {saving
              ? tr("Enregistrement…", "جاري الحفظ…")
              : tr("Mettre à jour", "تحديث")}
          </Button>
        </div>
      </form>
    </section>
  );
}
