"use client";

import { cn } from "@/lib/utils";

type AdminPageContentProps = {
  children: React.ReactNode;
  className?: string;
  mainClassName?: string;
  fullBleed?: boolean;
};

export function AdminPageContent({
  children,
  className,
  mainClassName,
  fullBleed = false,
}: AdminPageContentProps) {
  return (
    <div className="admin-page flex min-h-0 flex-1 flex-col text-foreground">
      <main
        className={cn(
          "flex-1 overflow-auto px-3 pt-2 sm:p-6 lg:p-8",
          fullBleed && "p-0",
          mainClassName,
        )}
      >
        <div className={cn("admin-page-scroll-content flex w-full flex-col gap-6", className)}>{children}</div>
      </main>
    </div>
  );
}
