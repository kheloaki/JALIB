"use client";

import { useEffect, useState } from "react";
import { Volume2, VolumeX } from "lucide-react";
import { useLocale } from "next-intl";

import { Button } from "@/components/ui/button";
import {
  isPosSoundsEnabled,
  playPosSound,
  setPosSoundsEnabled,
  warmupPosSounds,
} from "@/lib/pos/pos-sounds";

export function PosSoundsToggle() {
  const locale = useLocale();
  const isAr = locale === "ar";
  const tr = (fr: string, ar: string) => (isAr ? ar : fr);
  const [enabled, setEnabled] = useState(true);

  useEffect(() => {
    setEnabled(isPosSoundsEnabled());
    warmupPosSounds();
  }, []);

  function toggle() {
    const next = !enabled;
    setEnabled(next);
    setPosSoundsEnabled(next);
    if (next) playPosSound("add");
  }

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className="text-on-surface-variant hover:text-on-surface size-8 shrink-0 rounded-lg"
      onClick={toggle}
      aria-label={
        enabled
          ? tr("Couper les sons caisse", "كتم أصوات الصندوق")
          : tr("Activer les sons caisse", "تفعيل أصوات الصندوق")
      }
      title={
        enabled
          ? tr("Sons activés", "الأصوات مفعّلة")
          : tr("Sons coupés", "الأصوات مكتومة")
      }
    >
      {enabled ? (
        <Volume2 className="size-4 stroke-[1.75]" aria-hidden />
      ) : (
        <VolumeX className="size-4 stroke-[1.75]" aria-hidden />
      )}
    </Button>
  );
}
