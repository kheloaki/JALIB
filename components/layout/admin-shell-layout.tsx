"use client";

import { Suspense, useEffect, useRef } from "react";
import { usePathname } from "next/navigation";

import { AdminAppHeader } from "@/components/layout/admin-app-header";
import { useAdminChrome } from "@/components/layout/admin-chrome-context";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { MobileBottomNav } from "@/components/layout/mobile-bottom-nav";
import { SidebarInset, useSidebar } from "@/components/ui/sidebar";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";

function PosFocusSidebarSync() {
  const pathname = usePathname();
  const isPos = pathname?.includes("/pos") ?? false;
  const { isPosFocusMode } = useAdminChrome();
  const { setOpen, setOpenMobile } = useSidebar();
  const setOpenRef = useRef(setOpen);
  const setOpenMobileRef = useRef(setOpenMobile);

  setOpenRef.current = setOpen;
  setOpenMobileRef.current = setOpenMobile;

  useEffect(() => {
    if (!isPos || !isPosFocusMode) return;
    setOpenRef.current(false);
    setOpenMobileRef.current(false);
  }, [isPos, isPosFocusMode]);

  return null;
}

export function AdminShellLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isPos = pathname?.includes("/pos") ?? false;
  const isMobile = useIsMobile();
  const { isPosFocusMode } = useAdminChrome();
  const hideChrome = isPos && (isPosFocusMode || isMobile);

  return (
    <div className="pf-shell-canvas flex h-full min-h-0 flex-1 flex-col overflow-hidden">
      <div className="pf-shell-frame flex h-full min-h-0 flex-1 overflow-hidden">
        <PosFocusSidebarSync />
        {!hideChrome ? (
          <div className="hidden md:contents">
            <AppSidebar />
          </div>
        ) : null}
        <SidebarInset
          className={cn(
            "pf-shell-main flex min-h-0 min-w-0 flex-1 flex-col",
            hideChrome && "!m-0 !rounded-none",
          )}
        >
          <Suspense fallback={<div className="h-16 shrink-0" />}>
            <AdminAppHeader />
          </Suspense>
          <div className="flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
            {children}
          </div>
        </SidebarInset>
      </div>
      {!hideChrome ? <MobileBottomNav /> : null}
    </div>
  );
}
