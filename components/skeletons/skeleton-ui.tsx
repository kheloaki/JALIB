import { cn } from "@/lib/utils";

export function Sk({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      aria-hidden
      className={cn(
        "animate-pulse rounded-md bg-[var(--shell-main-muted)]/80",
        className,
      )}
      {...props}
    />
  );
}

export function SkLine({ className }: { className?: string }) {
  return <Sk className={cn("h-3 rounded-full", className)} />;
}

export function SkCircle({ className }: { className?: string }) {
  return <Sk className={cn("rounded-full", className)} />;
}

export function SkButton({ className }: { className?: string }) {
  return <Sk className={cn("h-10 rounded-xl", className)} />;
}

export function SkPfTabs({ count = 4 }: { count?: number }) {
  return (
    <div className="pf-tabs">
      {Array.from({ length: count }).map((_, i) => (
        <Sk key={i} className="h-10 flex-1 rounded-full" />
      ))}
    </div>
  );
}

export function SkShellTabs({ count = 4 }: { count?: number }) {
  return (
    <div className="bg-surface-container-low flex w-full gap-1 rounded-xl p-1">
      {Array.from({ length: count }).map((_, i) => (
        <Sk key={i} className="h-10 flex-1 rounded-lg" />
      ))}
    </div>
  );
}

export function SkTableHead({ cols }: { cols: number }) {
  return (
    <div className="border-sidebar-border bg-surface-container-low/50 flex border-b px-4 py-3">
      {Array.from({ length: cols }).map((_, i) => (
        <SkLine
          key={i}
          className={cn("flex-1", i === cols - 1 && "max-w-20 ml-auto")}
        />
      ))}
    </div>
  );
}

export function SkTableRows({
  cols,
  rows = 6,
}: {
  cols: number;
  rows?: number;
}) {
  return (
    <div className="divide-sidebar-border/60 divide-y">
      {Array.from({ length: rows }).map((_, row) => (
        <div key={row} className="flex items-center gap-4 px-4 py-4">
          {Array.from({ length: cols }).map((_, col) => (
            <div key={col} className="min-w-0 flex-1">
              {col === 0 ? (
                <div className="flex items-center gap-3">
                  <SkCircle className="size-10 shrink-0" />
                  <div className="min-w-0 flex-1 space-y-2">
                    <SkLine className="w-3/4" />
                    <SkLine className="w-1/2 h-2.5" />
                  </div>
                </div>
              ) : (
                <SkLine className={cn(col === cols - 1 ? "ml-auto w-16" : "w-2/3")} />
              )}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

export function SkWhiteCard({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "overflow-hidden rounded-xl border border-[rgba(61,43,31,0.08)] bg-white shadow-[0_4px_20px_rgba(61,43,31,0.07)]",
        className,
      )}
    >
      {children}
    </div>
  );
}
