"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { useLocale } from "next-intl";
import { usePathname, useRouter } from "next/navigation";
import { LockKeyhole } from "lucide-react";
import { useConvexAuth } from "@convex-dev/auth/react";

import { DeviceApprovalGate } from "@/components/auth/device-approval-gate";
import { Button } from "@/components/ui/button";
import { api } from "@/convex/_generated/api";
import {
  canAccessPath,
  firstAccessiblePath,
  requiredPermissionForPath,
} from "@/lib/auth/permissions";
import { getOrCreateDeviceId } from "@/lib/auth/device-id";
import { NotificationPermissionPrompt } from "@/components/pwa/notification-permission-prompt";
import { AdminRouteSkeleton } from "@/components/skeletons/admin-route-skeleton";

type AdminAuthGateProps = {
  children: React.ReactNode;
};

function AdminAuthLoadingContent({ pathname }: { pathname: string | null }) {
  return (
    <div className="bg-surface flex h-svh max-h-svh min-h-0 w-full flex-col overflow-hidden">
      <AdminRouteSkeleton pathname={pathname} />
    </div>
  );
}

export function AdminAuthGate({ children }: AdminAuthGateProps) {
  const router = useRouter();
  const pathname = usePathname();
  const locale = useLocale();
  const { isAuthenticated, isLoading } = useConvexAuth();
  const ensureCurrentUser = useMutation(api.authz.ensureCurrentUser);
  const currentUser = useQuery(api.authz.currentUser);
  const ensureStarted = useRef(false);
  const [deviceId, setDeviceId] = useState("");

  useEffect(() => {
    setDeviceId(getOrCreateDeviceId());
  }, []);

  const deviceStatus = useQuery(
    api.devices.getMyDeviceStatus,
    isAuthenticated && deviceId ? { deviceId } : "skip",
  );

  useEffect(() => {
    if (isLoading) return;
    if (!isAuthenticated) {
      ensureStarted.current = false;
      router.replace(`/${locale}`);
    }
  }, [isAuthenticated, isLoading, locale, router]);

  useEffect(() => {
    if (!isAuthenticated || ensureStarted.current) return;
    ensureStarted.current = true;
    void ensureCurrentUser({}).catch(() => {
      ensureStarted.current = false;
    });
  }, [ensureCurrentUser, isAuthenticated]);

  const hasAccess = useMemo(() => {
    if (!currentUser) return false;
    return canAccessPath(pathname, currentUser.permissions);
  }, [currentUser, pathname]);
  const fallbackPath = useMemo(() => {
    if (!currentUser) return "/dashboard";
    return firstAccessiblePath(currentUser.permissions);
  }, [currentUser]);

  useEffect(() => {
    if (!currentUser || hasAccess || !pathname?.includes("/dashboard")) return;
    router.replace(`/${locale}${fallbackPath}`);
  }, [currentUser, fallbackPath, hasAccess, locale, pathname, router]);

  if (
    isLoading ||
    !isAuthenticated ||
    currentUser === undefined ||
    currentUser === null ||
    currentUser.role === null ||
    !deviceId ||
    deviceStatus === undefined
  ) {
    return <AdminAuthLoadingContent pathname={pathname} />;
  }

  if (deviceStatus.status !== "approved") {
    return <DeviceApprovalGate />;
  }

  if (!hasAccess) {
    const requiredPermission = requiredPermissionForPath(pathname);

    return (
      <div className="bg-surface flex h-svh max-h-svh min-h-0 flex-1 items-center justify-center overflow-auto px-6 py-10">
        <div className="border-sidebar-border bg-surface-container-lowest w-full max-w-md rounded-2xl border p-8 text-center shadow-sm">
          <div className="bg-error-container text-on-error-container mx-auto mb-5 flex size-12 items-center justify-center rounded-xl">
            <LockKeyhole className="size-6 stroke-[1.75]" aria-hidden />
          </div>
          <h1 className="text-xl font-black tracking-tight">
            {locale === "ar" ? "الوصول غير مصرح" : "Accès non autorisé"}
          </h1>
          <p className="text-on-surface-variant mt-2 text-sm">
            {locale === "ar"
              ? "لا يملك دورك الصلاحية المطلوبة لهذه الصفحة."
              : "Votre rôle ne possède pas la permission requise pour cette page."}
          </p>
          {requiredPermission ? (
            <p className="text-outline mt-3 text-xs">
              {requiredPermission}
            </p>
          ) : null}
          <Button
            type="button"
            className="mt-6 rounded-xl font-bold"
            onClick={() => router.replace(`/${locale}${fallbackPath}`)}
          >
            {locale === "ar" ? "الذهاب لصفحة مسموحة" : "Aller à une page autorisée"}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <>
      <NotificationPermissionPrompt />
      {children}
    </>
  );
}
