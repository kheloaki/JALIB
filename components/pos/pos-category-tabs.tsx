"use client";

interface PosCategoryTabsProps {
  tabs: string[];
  active: string;
  onChange: (category: string) => void;
}

export function PosCategoryTabs({ tabs, active, onChange }: PosCategoryTabsProps) {
  return (
    <div className="px-6 pt-5 pb-2 sm:px-8">
      <div
        role="tablist"
        className="pf-tabs no-scrollbar flex-nowrap overflow-x-auto"
      >
        {tabs.map((c) => {
          const safeKey = c.toLowerCase().replace(/\s+/g, "-");
          const isActive = c === active;
          return (
            <button
              key={c}
              id={`tab-${safeKey}`}
              role="tab"
              aria-selected={isActive}
              aria-controls={`panel-${safeKey}`}
              type="button"
              onClick={() => onChange(c)}
              className={isActive ? "pf-tab pf-tab-active shrink-0" : "pf-tab shrink-0"}
            >
              {c}
            </button>
          );
        })}
      </div>
    </div>
  );
}
