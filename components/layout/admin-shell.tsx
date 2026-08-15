"use client";

import { AdminAuthGate } from "@/components/layout/admin-auth-gate";
import { AdminChromeProvider } from "@/components/layout/admin-chrome-context";
import { AdminShellLayout } from "@/components/layout/admin-shell-layout";
import { PosBarcodeScanProvider } from "@/components/pos/pos-barcode-scan-context";
import { PosKeyboardProvider } from "@/components/pos/pos-keyboard-context";
import { PosKeyboardAutoCapture } from "@/components/pos/pos-keyboard-auto-capture";
import { SidebarProvider } from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";

type AdminShellProps = {
  children: React.ReactNode;
  className?: string;
};

/**
 * Chrome admin partagé : sidebar + barre du haut (même style que la caisse) + contenu.
 * Device approval runs outside the shell so nothing else is visible until approved.
 */
export function AdminShell({ children, className }: AdminShellProps) {
  return (
    <AdminChromeProvider>
      <PosKeyboardProvider>
        <PosBarcodeScanProvider>
          <PosKeyboardAutoCapture />
          <SidebarProvider
            defaultOpen
            className={cn(
              "text-on-background h-svh max-h-svh overflow-hidden",
              className,
            )}
          >
            <AdminAuthGate>
              <AdminShellLayout>{children}</AdminShellLayout>
            </AdminAuthGate>
          </SidebarProvider>
        </PosBarcodeScanProvider>
      </PosKeyboardProvider>
    </AdminChromeProvider>
  );
}
