"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";

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

type StockCategoriesDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

type CategoryFormState = {
  label: string;
};

export function StockCategoriesDialog({
  open,
  onOpenChange,
}: StockCategoriesDialogProps) {
  const t = useTranslations("categories");
  const toast = useToast();
  const categories = useQuery(
    api.products.listCategoryRows,
    open ? {} : "skip",
  );
  const createCategory = useMutation(api.products.createCategory);
  const updateCategory = useMutation(api.products.updateCategory);
  const removeCategory = useMutation(api.products.removeCategory);

  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<Id<"productCategories"> | null>(
    null,
  );
  const [form, setForm] = useState<CategoryFormState>({ label: "" });
  const [busy, setBusy] = useState(false);

  const sortedCategories = useMemo(
    () => categories ?? [],
    [categories],
  );

  function openCreate() {
    setEditingId(null);
    setForm({ label: "" });
    setFormOpen(true);
  }

  function openEdit(category: (typeof sortedCategories)[number]) {
    setEditingId(category.id);
    setForm({ label: category.label });
    setFormOpen(true);
  }

  async function handleSave() {
    const label = form.label.trim().replace(/\s+/g, " ");
    if (!label) {
      toast.error(t("nameRequiredTitle"), t("nameRequiredDescription"));
      return;
    }
    setBusy(true);
    try {
      if (editingId) {
        await updateCategory({ categoryId: editingId, label });
        toast.success(t("updatedTitle"), label);
      } else {
        await createCategory({ label });
        toast.success(t("createdTitle"), label);
      }
      setFormOpen(false);
    } catch (error) {
      toast.error(
        t("errorTitle"),
        error instanceof Error ? error.message : t("errorGeneric"),
      );
    } finally {
      setBusy(false);
    }
  }

  async function handleRemove(
    categoryId: Id<"productCategories">,
    label: string,
    productCount: number,
  ) {
    if (productCount > 0) {
      toast.error(t("inUseTitle"), t("inUseDescription", { count: productCount }));
      return;
    }
    setBusy(true);
    try {
      await removeCategory({ categoryId });
      toast.success(t("removedTitle"), label);
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
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="flex max-h-[min(92vh,720px)] max-w-2xl flex-col overflow-hidden rounded-2xl">
          <DialogHeader>
            <DialogTitle>{t("title")}</DialogTitle>
            <p className="text-muted-foreground text-sm">{t("description")}</p>
          </DialogHeader>

          <div className="flex justify-end">
            <Button type="button" className="rounded-xl" onClick={openCreate}>
              <Plus className="size-4" aria-hidden />
              {t("addCategory")}
            </Button>
          </div>

          <div className="min-h-0 flex-1 overflow-auto rounded-xl border bg-white shadow-sm">
            {categories === undefined ? (
              <div className="text-muted-foreground py-10 text-center text-sm">
                {t("loading")}
              </div>
            ) : sortedCategories.length === 0 ? (
              <div className="text-muted-foreground px-6 py-16 text-center text-sm">
                {t("empty")}
              </div>
            ) : (
              <table className="w-full border-collapse text-sm">
                <thead className="sticky top-0 z-10 bg-[var(--shell-main-muted)]/90 backdrop-blur-sm">
                  <tr className="border-b text-left">
                    <th className="px-4 py-3 text-xs font-bold uppercase">
                      {t("colName")}
                    </th>
                    <th className="px-4 py-3 text-xs font-bold uppercase">
                      {t("colProducts")}
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-bold uppercase">
                      {t("colActions")}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {sortedCategories.map((category) => (
                    <tr key={category.id} className="border-b last:border-b-0">
                      <td className="px-4 py-3 font-semibold">{category.label}</td>
                      <td className="text-muted-foreground px-4 py-3 tabular-nums">
                        {category.productCount}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            className="size-8 rounded-lg"
                            onClick={() => openEdit(category)}
                            disabled={busy}
                            aria-label={t("editCategory")}
                          >
                            <Pencil className="size-4" aria-hidden />
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            className="text-destructive size-8 rounded-lg"
                            onClick={() =>
                              void handleRemove(
                                category.id,
                                category.label,
                                category.productCount,
                              )
                            }
                            disabled={busy}
                            aria-label={t("removeCategory")}
                          >
                            <Trash2 className="size-4" aria-hidden />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {t("close")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle>
              {editingId ? t("editCategory") : t("addCategory")}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <label className="text-sm font-medium">{t("categoryName")}</label>
            <Input
              value={form.label}
              onChange={(e) => setForm({ label: e.target.value })}
              placeholder={t("categoryNamePlaceholder")}
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setFormOpen(false)}>
              {t("cancel")}
            </Button>
            <Button type="button" disabled={busy} onClick={() => void handleSave()}>
              {t("save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
