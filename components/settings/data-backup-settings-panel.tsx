"use client";

import { useState } from "react";
import { ConvexError } from "convex/values";
import { useAction } from "convex/react";
import { DatabaseBackup, Loader2, Send } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toaster";
import { api } from "@/convex/_generated/api";
import { cn } from "@/lib/utils";

function backupErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof ConvexError) {
    const data = error.data;
    if (typeof data === "string" && data.trim()) return data;
    if (
      data &&
      typeof data === "object" &&
      "message" in data &&
      typeof (data as { message: unknown }).message === "string"
    ) {
      return (data as { message: string }).message;
    }
  }
  if (error instanceof Error && error.message.trim()) return error.message;
  return fallback;
}

type DataBackupSettingsPanelProps = {
  tr: (fr: string, ar: string) => string;
  className?: string;
};

export function DataBackupSettingsPanel({
  tr,
  className,
}: DataBackupSettingsPanelProps) {
  const toast = useToast();
  const sendNow = useAction(api.dataBackup.sendNow);
  const [busy, setBusy] = useState(false);

  async function onSendNow() {
    setBusy(true);
    try {
      const result = await sendNow({});
      toast.success(
        tr("Données envoyées", "تم إرسال البيانات"),
        tr(
          result.mode === "attachment"
            ? `ZIP « ${result.filename} » envoyé à ${result.recipientCount} destinataire(s).`
            : `Lien de téléchargement envoyé (${result.filename}).`,
          result.mode === "attachment"
            ? `تم إرسال « ${result.filename} » إلى ${result.recipientCount} مستلم.`
            : `تم إرسال رابط التحميل (${result.filename}).`,
        ),
      );
    } catch (error) {
      const message = backupErrorMessage(
        error,
        tr("Échec de l’envoi.", "فشل الإرسال."),
      );
      toast.error(tr("Envoi impossible", "تعذر الإرسال"), message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section
      className={cn(
        "border-primary/25 bg-primary/5 space-y-4 rounded-2xl border p-4 shadow-sm sm:p-5",
        className,
      )}
    >
      <div className="flex items-start gap-3">
        <div className="bg-primary text-on-primary flex size-10 shrink-0 items-center justify-center rounded-xl">
          <DatabaseBackup className="size-5 stroke-[1.75]" aria-hidden />
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-bold tracking-tight">
            {tr("Envoyer les données (sauvegarde)", "إرسال البيانات (نسخة احتياطية)")}
          </h2>
          <p className="text-on-surface-variant mt-1 text-xs leading-relaxed">
            {tr(
              "Envoie maintenant un ZIP (CSV) de toutes les données métier à marketjamaa@gmail.com. Un envoi automatique part aussi chaque jour à 03:00.",
              "يرسل الآن أرشيف ZIP (CSV) لكل بيانات المنصة إلى marketjamaa@gmail.com. يُرسل أيضًا تلقائيًا كل يوم الساعة 03:00.",
            )}
          </p>
        </div>
      </div>

      <Button
        type="button"
        className="h-12 w-full rounded-xl text-sm font-bold sm:w-auto sm:min-w-[16rem]"
        disabled={busy}
        onClick={() => void onSendNow()}
      >
        {busy ? (
          <Loader2 className="size-4 animate-spin stroke-[1.75]" aria-hidden />
        ) : (
          <Send className="size-4 stroke-[1.75]" aria-hidden />
        )}
        {busy
          ? tr("Envoi en cours…", "جاري الإرسال…")
          : tr("Envoyer les données par e-mail", "إرسال البيانات بالبريد")}
      </Button>
    </section>
  );
}
