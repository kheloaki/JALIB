"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";

import { ProductCatalogImage } from "@/components/products/product-catalog-image";
import { ProductPhotoField } from "@/components/products/product-photo-field";
import { useAdminChrome } from "@/components/layout/admin-chrome-context";
import { AdminFilterSummary } from "@/components/layout/admin-filter-summary";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toaster";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";

type BrandFormState = {
  name: string;
  logo: string | null;
};

export function StockBrandsTab() {
  const t = useTranslations("brands");
  const locale = useLocale();
  const isAr = locale === "ar";
  const tr = (fr: string, ar: string) => (isAr ? ar : fr);
  const toast = useToast();
  const { headerSearchQuery, setHeaderSearchQuery } = useAdminChrome();
  const brands = useQuery(api.brands.list);
  const createBrand = useMutation(api.brands.create);
  const updateBrand = useMutation(api.brands.update);
  const removeBrand = useMutation(api.brands.remove);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<Id<"brands"> | null>(null);
  const [form, setForm] = useState<BrandFormState>({ name: "", logo: null });
  const [busy, setBusy] = useState(false);

  const activeBrands = useMemo(
    () => (brands ?? []).filter((brand) => brand.active),
    [brands],
  );

  const visibleBrands = useMemo(() => {
    const q = headerSearchQuery.trim().toLowerCase();
    if (!q) return activeBrands;
    return activeBrands.filter((brand) =>
      brand.name.toLowerCase().includes(q),
    );
  }, [activeBrands, headerSearchQuery]);

  function openCreate() {
    setEditingId(null);
    setForm({ name: "", logo: null });
    setDialogOpen(true);
  }

  function openEdit(brand: (typeof activeBrands)[number]) {
    setEditingId(brand.id);
    setForm({ name: brand.name, logo: brand.logo });
    setDialogOpen(true);
  }

  async function handleSave() {
    if (!form.name.trim()) {
      toast.error(t("nameRequiredTitle"), t("nameRequiredDescription"));
      return;
    }
    if (!form.logo) {
      toast.error(t("logoRequiredTitle"), t("logoRequiredDescription"));
      return;
    }
    setBusy(true);
    try {
      if (editingId) {
        await updateBrand({
          brandId: editingId,
          name: form.name.trim(),
          logo: form.logo,
          logoAlt: form.name.trim(),
        });
        toast.success(t("updatedTitle"), form.name.trim());
      } else {
        await createBrand({
          name: form.name.trim(),
          logo: form.logo,
          logoAlt: form.name.trim(),
        });
        toast.success(t("createdTitle"), form.name.trim());
      }
      setDialogOpen(false);
    } catch (error) {
      toast.error(
        t("errorTitle"),
        error instanceof Error ? error.message : t("errorGeneric"),
      );
    } finally {
      setBusy(false);
    }
  }

  async function handleRemove(brandId: Id<"brands">, name: string) {
    setBusy(true);
    try {
      await removeBrand({ brandId });
      toast.success(t("removedTitle"), name);
    } catch (error) {
      toast.error(
        t("errorTitle"),
        error instanceof Error ? error.message : t("errorGeneric"),
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 p-4 sm:p-6 lg:px-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-on-background text-lg font-bold">{t("title")}</h2>
          <p className="text-muted-foreground mt-0.5 text-sm">{t("description")}</p>
        </div>
        <Button type="button" className="rounded-xl" onClick={openCreate}>
          <Plus className="size-4" aria-hidden />
          {t("addBrand")}
        </Button>
      </div>

      <AdminFilterSummary
        filteredCount={visibleBrands.length}
        totalCount={activeBrands.length}
        searchQuery={headerSearchQuery}
        onClearSearch={() => setHeaderSearchQuery("")}
        itemLabel={tr("marque", "علامة")}
        itemLabelPlural={tr("marques", "علامات")}
      />

      {brands === undefined ? (
        <div className="text-muted-foreground py-10 text-center text-sm">
          {tr("Chargement…", "جاري التحميل…")}
        </div>
      ) : activeBrands.length === 0 ? (
        <div className="text-muted-foreground rounded-xl border border-dashed px-6 py-16 text-center text-sm">
          {t("empty")}
        </div>
      ) : visibleBrands.length === 0 ? (
        <div className="text-muted-foreground rounded-xl border border-dashed px-6 py-16 text-center text-sm">
          {tr("Aucune marque ne correspond à la recherche.", "لا توجد علامة تطابق البحث.")}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border bg-white shadow-sm">
          <table className="w-full min-w-[640px] border-collapse text-sm">
            <thead>
              <tr className="border-b bg-[var(--shell-main-muted)]/60 text-left">
                <th className="px-4 py-3 text-xs font-bold uppercase">{t("colLogo")}</th>
                <th className="px-4 py-3 text-xs font-bold uppercase">{t("colName")}</th>
                <th className="px-4 py-3 text-right text-xs font-bold uppercase">
                  {t("colActions")}
                </th>
              </tr>
            </thead>
            <tbody>
              {visibleBrands.map((brand) => (
                <tr key={brand.id} className="border-b last:border-b-0">
                  <td className="px-4 py-3">
                    <div className="relative h-12 w-16 overflow-hidden rounded-sm border border-slate-200 bg-white">
                      <ProductCatalogImage
                        src={brand.logo}
                        alt={brand.logoAlt}
                        fit="contain"
                        sizes="64px"
                        wrapperClassName="relative size-full bg-white p-1"
                      />
                    </div>
                  </td>
                  <td className="px-4 py-3 font-semibold">{brand.name}</td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        className="size-8 rounded-lg"
                        onClick={() => openEdit(brand)}
                        disabled={busy}
                        aria-label={t("editBrand")}
                      >
                        <Pencil className="size-4" aria-hidden />
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        className="text-destructive size-8 rounded-lg"
                        onClick={() => void handleRemove(brand.id, brand.name)}
                        disabled={busy}
                        aria-label={t("removeBrand")}
                      >
                        <Trash2 className="size-4" aria-hidden />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg rounded-2xl">
          <DialogHeader>
            <DialogTitle>{editingId ? t("editBrand") : t("addBrand")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">{t("brandName")}</label>
              <Input
                value={form.name}
                onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
                placeholder={t("brandNamePlaceholder")}
              />
            </div>
            <ProductPhotoField
              value={form.logo}
              onChange={(logo) => setForm((prev) => ({ ...prev, logo }))}
              disabled={busy}
            />
            <p className="text-muted-foreground text-xs">{t("logoHint")}</p>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
              {t("cancel")}
            </Button>
            <Button type="button" disabled={busy} onClick={() => void handleSave()}>
              {t("save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
