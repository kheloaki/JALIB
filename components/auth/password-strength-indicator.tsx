"use client";

import { useMemo } from "react";

import {
  getPasswordStrength,
  type PasswordStrength,
} from "@/lib/auth/password-strength";
import { cn } from "@/lib/utils";

type PasswordStrengthIndicatorProps = {
  id?: string;
  password: string;
  invalid?: boolean;
  message?: string;
  labels: {
    weak: string;
    medium: string;
    strong: string;
    hint: string;
  };
};

const SEGMENTS: PasswordStrength[] = ["weak", "medium", "strong"];

function segmentActive(strength: PasswordStrength, segment: PasswordStrength) {
  if (strength === "empty") return false;
  const order = { weak: 1, medium: 2, strong: 3, empty: 0 };
  return order[strength] >= order[segment];
}

export function PasswordStrengthIndicator({
  id,
  password,
  invalid = false,
  message,
  labels,
}: PasswordStrengthIndicatorProps) {
  const strength = useMemo(() => getPasswordStrength(password), [password]);

  if (strength === "empty") {
    return (
      <p
        id={id}
        aria-live="polite"
        className={cn(
          "text-xs leading-snug font-medium",
          invalid ? "text-error" : "text-outline",
        )}
      >
        {message ?? labels.hint}
      </p>
    );
  }

  const label =
    strength === "weak"
      ? labels.weak
      : strength === "medium"
        ? labels.medium
        : labels.strong;

  return (
    <div id={id} className="space-y-2" aria-live="polite">
      <div className="flex items-center justify-between gap-2">
        <div className="flex flex-1 gap-1.5" role="presentation">
          {SEGMENTS.map((segment) => (
            <div
              key={segment}
              className={cn(
                "h-1.5 flex-1 rounded-full transition-colors duration-200",
                segmentActive(strength, segment)
                  ? strength === "weak"
                    ? "bg-error"
                    : strength === "medium"
                      ? "bg-tertiary-fixed-dim"
                      : "bg-secondary"
                  : "bg-outline-variant/40",
              )}
            />
          ))}
        </div>
        <span
          className={cn(
            "shrink-0 text-xs font-bold",
            strength === "weak" && "text-error",
            strength === "medium" && "text-tertiary",
            strength === "strong" && "text-secondary",
          )}
        >
          {label}
        </span>
      </div>
      <p
        className={cn(
          "text-xs leading-snug font-medium",
          invalid
            ? "text-error"
            : strength === "strong"
              ? "text-secondary"
              : strength === "medium"
                ? "text-tertiary"
                : "text-outline",
        )}
      >
        {message ?? labels.hint}
      </p>
    </div>
  );
}
