"use client";

import { useMemo, useState } from "react";
import { useLocale } from "next-intl";
import { useQuery } from "convex/react";
import { ChevronDown, ChevronRight, Search } from "lucide-react";

import { AdminPageContent } from "@/components/layout/admin-page-content";
import { InlineTableSkeleton } from "@/components/skeletons";
import { FrenchDateInput } from "@/components/ui/french-date-input";
import { Input } from "@/components/ui/input";
import { api } from "@/convex/_generated/api";
import { cn } from "@/lib/utils";

const ENTITY_LABELS_FR: Record<string, string> = {
  client: "Client",
  product: "Produit",
  category: "Catégorie",
  brand: "Marque",
  invoice: "Facture",
  payment: "Paiement",
  plan: "Plan",
  return: "Retour",
  procurement: "Achats",
  settings: "Paramètres",
  role: "Rôle",
  user: "Utilisateur",
};

function formatDateTime(ms: number, locale: string): string {
  try {
    return new Intl.DateTimeFormat(locale === "ar" ? "ar-MA" : "fr-FR", {
      dateStyle: "short",
      timeStyle: "medium",
    }).format(new Date(ms));
  } catch {
    return new Date(ms).toISOString();
  }
}

function prettyPayload(payloadJson: string | null): string {
  if (!payloadJson) return "";
  try {
    return JSON.stringify(JSON.parse(payloadJson), null, 2);
  } catch {
    return payloadJson;
  }
}

export function AuditPage() {
  const locale = useLocale();
  const isAr = locale === "ar";
  const tr = (fr: string, ar: string) => (isAr ? ar : fr);

  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [entityType, setEntityType] = useState("");
  const [search, setSearch] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const entityTypes = useQuery(api.audit.listEntityTypes);
  const rows = useQuery(api.audit.list, {
    limit: 200,
    dateFrom: dateFrom || undefined,
    dateTo: dateTo || undefined,
    entityType: entityType || undefined,
    search: search.trim().length >= 2 ? search.trim() : undefined,
  });

  const hydrated = rows !== undefined;
  const entityOptions = useMemo(() => {
    const fromServer = entityTypes ?? [];
    const known = Object.keys(ENTITY_LABELS_FR);
    return [...new Set([...known, ...fromServer])].sort((a, b) =>
      a.localeCompare(b, "fr"),
    );
  }, [entityTypes]);

  function entityLabel(type: string): string {
    if (isAr) return type;
    return ENTITY_LABELS_FR[type] ?? type;
  }

  return (
    <AdminPageContent>
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-black tracking-tight">
          {tr("Audit", "التدقيق")}
        </h1>
        <p className="text-on-surface-variant text-sm">
          {tr(
            "Historique des créations, modifications et suppressions importantes.",
            "سجل الإنشاءات والتعديلات والحذف المهمة.",
          )}
        </p>
      </div>

      <div className="border-sidebar-border bg-surface-container-lowest grid gap-3 rounded-2xl border p-4 shadow-sm sm:grid-cols-2 lg:grid-cols-4">
        <label className="flex flex-col gap-1.5 text-xs font-bold tracking-wide uppercase">
          <span className="text-on-surface-variant">{tr("Du", "من")}</span>
          <FrenchDateInput
            value={dateFrom}
            onValueChange={setDateFrom}
            className="h-10"
          />
        </label>
        <label className="flex flex-col gap-1.5 text-xs font-bold tracking-wide uppercase">
          <span className="text-on-surface-variant">{tr("Au", "إلى")}</span>
          <FrenchDateInput
            value={dateTo}
            onValueChange={setDateTo}
            className="h-10"
          />
        </label>
        <label className="flex flex-col gap-1.5 text-xs font-bold tracking-wide uppercase">
          <span className="text-on-surface-variant">
            {tr("Type", "النوع")}
          </span>
          <select
            value={entityType}
            onChange={(event) => setEntityType(event.target.value)}
            className="border-input bg-background h-10 rounded-md border px-3 text-sm font-medium"
          >
            <option value="">{tr("Tous", "الكل")}</option>
            {entityOptions.map((type) => (
              <option key={type} value={type}>
                {entityLabel(type)}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1.5 text-xs font-bold tracking-wide uppercase">
          <span className="text-on-surface-variant">
            {tr("Recherche", "بحث")}
          </span>
          <div className="relative">
            <Search
              className="text-on-surface-variant absolute top-1/2 left-3 size-4 -translate-y-1/2"
              aria-hidden
            />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={tr("Acteur, résumé…", "المستخدم، الملخص…")}
              className="h-10 pl-9"
            />
          </div>
        </label>
      </div>

      <div className="bg-surface-container-lowest border-sidebar-border overflow-hidden rounded-xl border shadow-sm">
        <div className="border-sidebar-border flex items-center justify-between border-b px-6 py-4">
          <h2 className="text-lg font-bold tracking-tight">
            {tr("Événements", "الأحداث")}
          </h2>
          <span className="bg-surface-container-high text-on-surface-variant rounded-full px-2 py-1 text-xs font-semibold">
            {rows?.length ?? "…"}
          </span>
        </div>

        {!hydrated ? (
          <InlineTableSkeleton cols={5} rows={8} />
        ) : rows.length === 0 ? (
          <p className="text-on-surface-variant px-6 py-10 text-sm">
            {tr(
              "Aucun événement d'audit pour ces filtres.",
              "لا توجد أحداث تدقيق لهذه الفلاتر.",
            )}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[880px] border-collapse">
              <thead>
                <tr className="bg-surface-container-low/50">
                  <th className="text-on-surface-variant px-4 py-3 text-left text-[10px] font-bold tracking-wider uppercase">
                    {tr("Date", "التاريخ")}
                  </th>
                  <th className="text-on-surface-variant px-4 py-3 text-left text-[10px] font-bold tracking-wider uppercase">
                    {tr("Acteur", "المستخدم")}
                  </th>
                  <th className="text-on-surface-variant px-4 py-3 text-left text-[10px] font-bold tracking-wider uppercase">
                    {tr("Action", "الإجراء")}
                  </th>
                  <th className="text-on-surface-variant px-4 py-3 text-left text-[10px] font-bold tracking-wider uppercase">
                    {tr("Entité", "الكيان")}
                  </th>
                  <th className="text-on-surface-variant px-4 py-3 text-left text-[10px] font-bold tracking-wider uppercase">
                    {tr("Résumé", "الملخص")}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-sidebar-border divide-y">
                {rows.map((row) => {
                  const open = expandedId === row.id;
                  const payload = prettyPayload(row.payloadJson);
                  return (
                    <tr key={row.id} className="align-top">
                      <td colSpan={5} className="p-0">
                        <button
                          type="button"
                          onClick={() =>
                            setExpandedId(open ? null : row.id)
                          }
                          className="hover:bg-surface-container-low/40 flex w-full items-start gap-0 text-left transition-colors"
                        >
                          <div className="text-on-surface-variant flex w-10 shrink-0 items-center justify-center pt-3.5">
                            {open ? (
                              <ChevronDown className="size-4" aria-hidden />
                            ) : (
                              <ChevronRight className="size-4" aria-hidden />
                            )}
                          </div>
                          <div className="grid min-w-0 flex-1 grid-cols-[10rem_9rem_10rem_7rem_1fr] gap-0">
                            <div className="px-2 py-3.5 text-sm font-semibold tabular-nums">
                              {formatDateTime(row.createdAt, locale)}
                            </div>
                            <div className="truncate px-2 py-3.5 text-sm font-medium">
                              {row.actorUserName}
                            </div>
                            <div className="truncate px-2 py-3.5 text-sm font-mono text-xs">
                              {row.action}
                            </div>
                            <div className="px-2 py-3.5 text-sm">
                              <span className="bg-surface-container-high rounded-full px-2 py-0.5 text-[10px] font-bold uppercase">
                                {entityLabel(row.entityType)}
                              </span>
                            </div>
                            <div className="min-w-0 px-2 py-3.5 text-sm">
                              <p className="truncate font-medium">
                                {row.summary}
                              </p>
                              {row.source ? (
                                <p className="text-on-surface-variant mt-0.5 text-[10px] font-bold uppercase">
                                  {row.source}
                                </p>
                              ) : null}
                            </div>
                          </div>
                        </button>
                        {open ? (
                          <div className="border-sidebar-border bg-surface-container-low/30 border-t px-6 py-4">
                            <dl className="grid gap-2 text-xs sm:grid-cols-2">
                              <div>
                                <dt className="text-on-surface-variant font-bold uppercase">
                                  {tr("ID entité", "معرّف الكيان")}
                                </dt>
                                <dd className="mt-0.5 font-mono">
                                  {row.entityId ?? "—"}
                                </dd>
                              </div>
                              <div>
                                <dt className="text-on-surface-variant font-bold uppercase">
                                  {tr("Action", "الإجراء")}
                                </dt>
                                <dd className="mt-0.5 font-mono">
                                  {row.action}
                                </dd>
                              </div>
                            </dl>
                            {payload ? (
                              <pre
                                className={cn(
                                  "border-sidebar-border bg-surface-container-lowest mt-3 max-h-64 overflow-auto rounded-lg border p-3 text-[11px] leading-relaxed",
                                )}
                              >
                                {payload}
                              </pre>
                            ) : (
                              <p className="text-on-surface-variant mt-3 text-xs">
                                {tr(
                                  "Aucun détail supplémentaire.",
                                  "لا توجد تفاصيل إضافية.",
                                )}
                              </p>
                            )}
                          </div>
                        ) : null}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </AdminPageContent>
  );
}
