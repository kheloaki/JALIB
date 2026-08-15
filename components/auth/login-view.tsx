"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { CircleAlert, Lock, LogIn, Mail } from "lucide-react";
import { useTranslations, useLocale } from "next-intl";
import { useAuthActions, useConvexAuth } from "@convex-dev/auth/react";

import { StoreLogo } from "@/components/brand/store-logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { STORE_NAME, STORE_TAGLINE_FR } from "@/lib/brand/constants";
import { cn } from "@/lib/utils";
import { LanguageSwitcher } from "@/components/layout/language-switcher";
import { PasswordStrengthIndicator } from "@/components/auth/password-strength-indicator";
import { getAuthErrorMessage } from "@/lib/auth/auth-error-message";
import {
  getPasswordStrength,
  isPasswordAcceptableForSignUp,
} from "@/lib/auth/password-strength";

type AuthMode = "signIn" | "resetRequest" | "resetVerify";
type AuthField = "email" | "password" | "code" | "confirmPassword";
type AuthFieldErrors = Partial<Record<AuthField, string>>;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const LOGIN_BACKGROUND_SRC = "/login-background.png";

function authInputClassName(invalid: boolean) {
  return cn(
    "border-transparent bg-surface-container-low focus-visible:ring-primary/25 h-11 rounded-xl py-2 pr-4 pl-11 text-sm shadow-none",
    invalid &&
      "border-error/60 bg-error-container/20 focus-visible:ring-error/25",
  );
}

function FieldError({
  id,
  message,
}: {
  id: string;
  message?: string;
}) {
  if (!message) return null;

  return (
    <p
      id={id}
      role="alert"
      className="text-error flex items-start gap-1.5 text-xs leading-snug font-medium"
    >
      <CircleAlert className="mt-0.5 size-3.5 shrink-0" aria-hidden />
      <span>{message}</span>
    </p>
  );
}

function resetAuthErrorMessage(
  err: unknown,
  copy: {
    resetEmailNotConfigured: string;
    resetCodeInvalid: string;
    invalidCredentials: string;
    emailInvalid: string;
    passwordRequired: string;
    passwordTooShort: string;
    passwordTooWeak: string;
    accountExists: string;
    accountNotFound: string;
    networkError: string;
    serverError: string;
    generic: string;
  },
) {
  const raw =
    err instanceof Error
      ? err.message
      : typeof err === "string"
        ? err
        : "";
  const lower = raw.toLowerCase();
  if (
    lower.includes("not configured") ||
    lower.includes("not enabled") ||
    lower.includes("password reset is not")
  ) {
    return copy.resetEmailNotConfigured;
  }
  if (lower.includes("invalid code") || lower.includes("expired")) {
    return copy.resetCodeInvalid;
  }
  return getAuthErrorMessage(err, copy, "signIn");
}

export function LoginView() {
  const router = useRouter();
  const locale = useLocale();
  const t = useTranslations("auth");
  const tCommon = useTranslations("common");
  const { signIn } = useAuthActions();
  const { isAuthenticated } = useConvexAuth();
  const [authMode, setAuthMode] = useState<AuthMode>("signIn");
  const [password, setPassword] = useState("");
  const [resetEmail, setResetEmail] = useState("");
  const [resetCode, setResetCode] = useState("");
  const [resetNewPassword, setResetNewPassword] = useState("");
  const [resetConfirmPassword, setResetConfirmPassword] = useState("");
  const [resetInfo, setResetInfo] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<AuthFieldErrors>({});

  const isResetRequest = authMode === "resetRequest";
  const isResetVerify = authMode === "resetVerify";

  const passwordStrength = getPasswordStrength(
    isResetVerify ? resetNewPassword : password,
  );
  const activePassword = isResetVerify ? resetNewPassword : password;
  const signUpPasswordOk =
    activePassword.length >= 8 && isPasswordAcceptableForSignUp(activePassword);
  const passwordInvalid =
    Boolean(fieldErrors.password) ||
    (isResetVerify && activePassword.length > 0 && !signUpPasswordOk);
  const passwordFeedbackMessage =
    fieldErrors.password ??
    (activePassword.length === 0
      ? t("passwordStrength.hint")
      : activePassword.length < 8
        ? t("passwordStrength.tooShort", { count: 8 - activePassword.length })
        : !isPasswordAcceptableForSignUp(activePassword)
          ? t("passwordStrength.needsComplexity")
          : t(
              passwordStrength === "strong"
                ? "passwordStrength.strongMessage"
                : "passwordStrength.accepted",
            ));

  const errorCopy = {
    invalidCredentials: t("errors.invalidCredentials"),
    emailInvalid: t("errors.emailInvalid"),
    passwordRequired: t("errors.passwordRequired"),
    passwordTooShort: t("errors.passwordTooShort"),
    passwordTooWeak: t("errors.passwordTooWeak"),
    accountExists: t("errors.accountExists"),
    accountNotFound: t("errors.accountNotFound"),
    networkError: t("errors.networkError"),
    serverError: t("errors.serverError"),
    generic: t("errors.generic"),
    resetCodeInvalid: t("errors.resetCodeInvalid"),
    resetEmailNotConfigured: t("errors.resetEmailNotConfigured"),
  };

  useEffect(() => {
    if (isAuthenticated) {
      router.replace(`/${locale}/dashboard`);
    }
  }, [isAuthenticated, locale, router]);

  const clearFieldError = useCallback((field: AuthField) => {
    setFieldErrors((current) => {
      if (!current[field]) return current;
      const next = { ...current };
      delete next[field];
      return next;
    });
    setError(null);
  }, []);

  function switchToSignIn() {
    setAuthMode("signIn");
    setPassword("");
    setResetEmail("");
    setResetCode("");
    setResetNewPassword("");
    setResetConfirmPassword("");
    setResetInfo(null);
    setError(null);
    setFieldErrors({});
  }

  const onSubmit = useCallback(
    async (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      const formData = new FormData(e.currentTarget);
      const email = String(formData.get("email") ?? resetEmail)
        .trim()
        .toLowerCase();
      const passwordValue = String(formData.get("password") ?? password);
      const nextFieldErrors: AuthFieldErrors = {};

      if (isResetRequest) {
        if (!email) {
          nextFieldErrors.email = t("errors.emailRequired");
        } else if (!EMAIL_PATTERN.test(email)) {
          nextFieldErrors.email = t("errors.emailInvalid");
        }
        if (Object.keys(nextFieldErrors).length > 0) {
          setFieldErrors(nextFieldErrors);
          setError(null);
          return;
        }

        setIsSubmitting(true);
        setError(null);
        setFieldErrors({});
        try {
          await signIn("password", { flow: "reset", email });
          setResetEmail(email);
          setResetInfo(t("resetCodeSent"));
          setAuthMode("resetVerify");
        } catch (err) {
          setError(resetAuthErrorMessage(err, errorCopy));
        } finally {
          setIsSubmitting(false);
        }
        return;
      }

      if (isResetVerify) {
        if (!resetCode.trim()) {
          nextFieldErrors.code = t("errors.resetCodeRequired");
        }
        if (!resetNewPassword) {
          nextFieldErrors.password = t("errors.passwordRequired");
        } else if (resetNewPassword.length < 8) {
          nextFieldErrors.password = t("errors.passwordTooShort");
        } else if (!isPasswordAcceptableForSignUp(resetNewPassword)) {
          nextFieldErrors.password = t("errors.passwordTooWeak");
        }
        if (!resetConfirmPassword) {
          nextFieldErrors.confirmPassword = t("errors.passwordRequired");
        } else if (resetNewPassword !== resetConfirmPassword) {
          nextFieldErrors.confirmPassword = t("errors.resetPasswordMismatch");
        }
        if (Object.keys(nextFieldErrors).length > 0) {
          setFieldErrors(nextFieldErrors);
          setError(null);
          return;
        }

        setIsSubmitting(true);
        setError(null);
        setFieldErrors({});
        try {
          await signIn("password", {
            flow: "reset-verification",
            email: resetEmail,
            code: resetCode.trim(),
            newPassword: resetNewPassword,
          });
          setResetInfo(t("resetSuccessDescription"));
        } catch (err) {
          setError(resetAuthErrorMessage(err, errorCopy));
        } finally {
          setIsSubmitting(false);
        }
        return;
      }

      if (!email) {
        nextFieldErrors.email = t("errors.emailRequired");
      } else if (!EMAIL_PATTERN.test(email)) {
        nextFieldErrors.email = t("errors.emailInvalid");
      }
      if (!passwordValue) {
        nextFieldErrors.password = t("errors.passwordRequired");
      }

      if (Object.keys(nextFieldErrors).length > 0) {
        setFieldErrors(nextFieldErrors);
        setError(null);
        return;
      }

      setIsSubmitting(true);
      setError(null);
      setFieldErrors({});
      try {
        await signIn("password", {
          flow: "signIn",
          email,
          password: passwordValue,
        });
      } catch (err) {
        const authError = getAuthErrorMessage(err, errorCopy, "signIn");
        const serverFieldErrors: AuthFieldErrors = {};
        if (authError === t("errors.emailInvalid")) {
          serverFieldErrors.email = authError;
        } else if (
          authError === t("errors.passwordRequired") ||
          authError === t("errors.passwordTooShort") ||
          authError === t("errors.passwordTooWeak")
        ) {
          serverFieldErrors.password = authError;
        }
        if (Object.keys(serverFieldErrors).length > 0) {
          setFieldErrors(serverFieldErrors);
          setError(null);
        } else {
          setError(authError);
        }
      } finally {
        setIsSubmitting(false);
      }
    },
    [
      errorCopy,
      isResetRequest,
      isResetVerify,
      password,
      resetCode,
      resetConfirmPassword,
      resetEmail,
      resetNewPassword,
      signIn,
      t,
    ],
  );

  const title =
    isResetRequest || isResetVerify
      ? t("resetPasswordTitle")
      : STORE_NAME;
  const description =
    isResetRequest
      ? t("resetPasswordDescription")
      : isResetVerify
        ? t("resetVerifyDescription")
        : t("loginDescription");

  const submitLabel = isResetRequest
    ? t("sendResetCode")
    : isResetVerify
      ? t("confirmResetPassword")
      : t("signIn");

  return (
    <div className="relative flex min-h-svh flex-col items-center justify-center overflow-hidden p-4 sm:p-6">
      <Image
        src={LOGIN_BACKGROUND_SRC}
        alt=""
        fill
        priority
        sizes="100vw"
        className="object-cover object-center"
      />
      <div
        className="absolute inset-0 bg-slate-950/60 backdrop-blur-[2px]"
        aria-hidden
      />

      <div className="relative z-10 w-full max-w-[420px]">
        <div
          className={cn(
            "border-sidebar-border/60 bg-surface-container-lowest/95 shadow-[0_24px_64px_-16px_rgba(0,0,0,0.45)]",
            "rounded-2xl border p-8 backdrop-blur-md sm:p-10",
          )}
        >
          <div className="mb-8 flex flex-col items-center text-center">
            <StoreLogo variant="white" size="lg" className="mb-2 w-full max-w-[220px]" priority />
            {title === STORE_NAME ? null : (
              <h1 className="text-on-surface text-2xl font-bold tracking-tight">
                {title}
              </h1>
            )}
            {!isResetRequest && !isResetVerify ? (
              <p className="text-on-surface-variant mt-1 text-xs font-bold tracking-wider uppercase">
                {STORE_TAGLINE_FR}
              </p>
            ) : null}
            <p className="text-muted-foreground mt-6 text-sm">{description}</p>
            <div className="mt-4 flex justify-center">
              <LanguageSwitcher variant="surface" />
            </div>
          </div>

          {resetInfo ? (
            <div className="bg-secondary-container/35 text-on-secondary-container mb-5 rounded-xl px-4 py-3 text-sm font-medium">
              {resetInfo}
            </div>
          ) : null}

          <form className="flex flex-col gap-5" onSubmit={onSubmit} noValidate>
            {!isResetVerify ? (
              <div className="space-y-2">
                <label
                  htmlFor="login-email"
                  className="text-on-surface block text-xs font-bold tracking-wide uppercase"
                >
                  {tCommon("email")}
                </label>
                <div className="relative">
                  <Mail
                    className="text-outline pointer-events-none absolute top-1/2 left-3.5 z-10 size-5 -translate-y-1/2 stroke-[1.75]"
                    aria-hidden
                  />
                  <Input
                    id="login-email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    defaultValue={resetEmail}
                    aria-invalid={Boolean(fieldErrors.email)}
                    aria-describedby={
                      fieldErrors.email ? "login-email-error" : undefined
                    }
                    onChange={() => clearFieldError("email")}
                    placeholder={
                      locale === "ar" ? "أنت@مثال.كوم" : "vous@exemple.com"
                    }
                    className={authInputClassName(Boolean(fieldErrors.email))}
                  />
                </div>
                <FieldError id="login-email-error" message={fieldErrors.email} />
              </div>
            ) : null}

            {isResetVerify ? (
              <>
                <div className="space-y-2">
                  <label
                    htmlFor="reset-email-readonly"
                    className="text-on-surface block text-xs font-bold tracking-wide uppercase"
                  >
                    {tCommon("email")}
                  </label>
                  <Input
                    id="reset-email-readonly"
                    type="email"
                    value={resetEmail}
                    readOnly
                    className="bg-surface-container-low h-11 rounded-xl text-sm"
                  />
                </div>
                <div className="space-y-2">
                  <label
                    htmlFor="reset-code"
                    className="text-on-surface block text-xs font-bold tracking-wide uppercase"
                  >
                    {t("resetCode")}
                  </label>
                  <Input
                    id="reset-code"
                    name="code"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    value={resetCode}
                    onChange={(event) => {
                      setResetCode(event.target.value);
                      clearFieldError("code");
                    }}
                    placeholder="12345678"
                    className={authInputClassName(Boolean(fieldErrors.code))}
                  />
                  <FieldError id="reset-code-error" message={fieldErrors.code} />
                </div>
                <div className="space-y-2">
                  <label
                    htmlFor="reset-new-password"
                    className="text-on-surface block text-xs font-bold tracking-wide uppercase"
                  >
                    {t("resetNewPassword")}
                  </label>
                  <div className="relative">
                    <Lock
                      className="text-outline pointer-events-none absolute top-1/2 left-3.5 z-10 size-5 -translate-y-1/2 stroke-[1.75]"
                      aria-hidden
                    />
                    <Input
                      id="reset-new-password"
                      name="password"
                      type="password"
                      autoComplete="new-password"
                      value={resetNewPassword}
                      onChange={(event) => {
                        setResetNewPassword(event.target.value);
                        clearFieldError("password");
                      }}
                      className={authInputClassName(passwordInvalid)}
                    />
                  </div>
                  <PasswordStrengthIndicator
                    password={resetNewPassword}
                    invalid={passwordInvalid}
                    message={passwordFeedbackMessage}
                    labels={{
                      weak: t("passwordStrength.weak"),
                      medium: t("passwordStrength.medium"),
                      strong: t("passwordStrength.strong"),
                      hint: t("passwordStrength.hint"),
                    }}
                  />
                </div>
                <div className="space-y-2">
                  <label
                    htmlFor="reset-confirm-password"
                    className="text-on-surface block text-xs font-bold tracking-wide uppercase"
                  >
                    {t("resetConfirmPassword")}
                  </label>
                  <div className="relative">
                    <Lock
                      className="text-outline pointer-events-none absolute top-1/2 left-3.5 z-10 size-5 -translate-y-1/2 stroke-[1.75]"
                      aria-hidden
                    />
                    <Input
                      id="reset-confirm-password"
                      type="password"
                      autoComplete="new-password"
                      value={resetConfirmPassword}
                      onChange={(event) => {
                        setResetConfirmPassword(event.target.value);
                        clearFieldError("confirmPassword");
                      }}
                      className={authInputClassName(
                        Boolean(fieldErrors.confirmPassword),
                      )}
                    />
                  </div>
                  <FieldError
                    id="reset-confirm-password-error"
                    message={fieldErrors.confirmPassword}
                  />
                </div>
              </>
            ) : null}

            {!isResetRequest && !isResetVerify ? (
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <label
                    htmlFor="login-password"
                    className="text-on-surface block text-xs font-bold tracking-wide uppercase"
                  >
                    {t("password")}
                  </label>
                  {authMode === "signIn" ? (
                    <button
                      type="button"
                      className="text-primary text-xs font-bold hover:underline"
                      onClick={() => {
                        setAuthMode("resetRequest");
                        setError(null);
                        setFieldErrors({});
                        setResetInfo(null);
                      }}
                    >
                      {t("forgotPassword")}
                    </button>
                  ) : null}
                </div>
                <div className="relative">
                  <Lock
                    className="text-outline pointer-events-none absolute top-1/2 left-3.5 z-10 size-5 -translate-y-1/2 stroke-[1.75]"
                    aria-hidden
                  />
                  <Input
                    id="login-password"
                    name="password"
                    type="password"
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      clearFieldError("password");
                    }}
                    autoComplete="current-password"
                    aria-invalid={passwordInvalid}
                    aria-describedby={
                      fieldErrors.password ? "login-password-error" : undefined
                    }
                    placeholder="••••••••"
                    className={authInputClassName(passwordInvalid)}
                  />
                </div>
                <FieldError
                  id="login-password-error"
                  message={fieldErrors.password}
                />
              </div>
            ) : null}

            {error ? (
              <div
                role="alert"
                aria-live="polite"
                className="bg-error-container text-on-error-container rounded-xl px-4 py-3"
              >
                <p className="text-sm font-bold">
                  {isResetRequest || isResetVerify
                    ? t("resetPasswordTitle")
                    : t("errorTitle")}
                </p>
                <p className="mt-1 text-sm leading-snug font-medium">{error}</p>
              </div>
            ) : null}

            <Button
              type="submit"
              disabled={isSubmitting}
              className={cn(
                "from-primary to-primary-container text-on-primary mt-2 h-12 w-full rounded-xl bg-linear-to-br text-base font-bold shadow-[0_8px_20px_rgba(61,43,31,0.22)] transition-all",
                "hover:opacity-[0.96] active:scale-[0.99]",
              )}
            >
              <LogIn className="mr-2 size-5 shrink-0 stroke-[1.75]" aria-hidden />
              {submitLabel}
            </Button>

            {isResetRequest || isResetVerify ? (
              <Button
                type="button"
                variant="ghost"
                className="text-primary h-auto rounded-xl py-2 text-sm font-bold"
                onClick={switchToSignIn}
              >
                {t("backToSignIn")}
              </Button>
            ) : null}
          </form>
        </div>

        <p className="text-white/90 mt-6 text-center text-xs drop-shadow-sm">
          {locale === "ar" ? "هل تحتاج مساعدة؟" : "Besoin d'aide ?"}{" "}
          <Link href="#" className="font-semibold text-white hover:underline">
            {locale === "ar" ? "الاتصال بالدعم" : "Contacter le support"}
          </Link>
        </p>
      </div>
    </div>
  );
}
