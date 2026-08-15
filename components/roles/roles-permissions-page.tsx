"use client";

import { useEffect, useState, useMemo } from "react";
import { useMutation, useQuery, useAction } from "convex/react";
import { useLocale } from "next-intl";
import {
  BadgeCheck,
  Boxes,
  ClipboardList,
  CreditCard,
  KeyRound,
  PlusCircle,
  Save,
  ShoppingCart,
  UserCog,
  Users,
} from "lucide-react";

import { PasswordStrengthIndicator } from "@/components/auth/password-strength-indicator";
import { useAdminChrome } from "@/components/layout/admin-chrome-context";
import { AdminFilterSummary } from "@/components/layout/admin-filter-summary";
import { RolesPageSkeleton, RolesUsersListSkeleton } from "@/components/skeletons";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/components/ui/toaster";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { canCreateUsers } from "@/lib/auth/permissions";
import { formatDateShortFr } from "@/lib/dates/format-date";
import { isPasswordAcceptableForSignUp } from "@/lib/auth/password-strength";
import { cn } from "@/lib/utils";
import { createDefaultRbacStore } from "@/lib/rbac/constants";
import type { PermissionCategory, RbacStore, Role } from "@/lib/rbac/types";

type UserRoleAssignment = {
  id: Id<"users">;
  name: string;
  email: string | null;
  roleId: Id<"roles"> | null;
  roleName: string | null;
  createdAt: number;
  isCurrentUser: boolean;
};

function categoryIcon(category: PermissionCategory) {
  switch (category) {
    case "Ventes":
      return ShoppingCart;
    case "Stock":
      return Boxes;
    case "Clients":
      return UserCog;
    case "Crédits":
      return CreditCard;
    case "Rapports":
      return ClipboardList;
    case "Administration":
      return BadgeCheck;
    default:
      return BadgeCheck;
  }
}

function badgeClasses(badge: Role["badge"]) {
  if (badge === "Plein accès") {
    return "bg-secondary-container text-on-secondary-container";
  }
  if (badge === "Limité") {
    return "bg-surface-container-high text-on-surface-variant";
  }
  return "bg-surface-container-high text-on-surface-variant";
}

function translateCategoryLabel(category: PermissionCategory, isAr: boolean): string {
  if (!isAr) return category;
  if (category === "Ventes") return "المبيعات";
  if (category === "Stock") return "المخزون";
  if (category === "Clients") return "العملاء";
  if (category === "Crédits") return "الاعتمادات";
  if (category === "Administration") return "الإدارة";
  return "التقارير";
}

function translateBadgeLabel(badge: Role["badge"], isAr: boolean): string {
  if (!badge) return "";
  if (!isAr) return badge;
  return badge === "Plein accès" ? "وصول كامل" : "محدود";
}

function translateRoleName(role: Role, isAr: boolean): string {
  if (!isAr) return role.name;
  if (role.legacyId === "role:admin") return "مدير";
  if (role.legacyId === "role:manager") return "مسير";
  if (role.legacyId === "role:cashier") return "أمين الصندوق";
  if (role.legacyId === "role:cashier_assist") return "مساعد الصندوق";
  if (role.legacyId === "role:stockkeeper") return "مسؤول المخزون";
  return role.name;
}

function translatePermissionLabel(id: string, label: string, isAr: boolean): string {
  if (!isAr) return label;
  const map: Record<string, string> = {
    "dashboard.view": "عرض لوحة التحكم",
    "sales.view": "عرض المبيعات",
    "sales.create": "إنشاء عملية بيع",
    "sales.assist_cart": "مساعدة العميل في السلة",
    "sales.park_cart": "إرسال السلة بانتظار الصندوق",
    "sales.cancel": "إلغاء عملية بيع",
    "sales.reopen": "إعادة فتح عملية بيع",
    "sales.credit": "البيع الآجل",
    "sales.edit_price": "تعديل السعر عند الصندوق",
    "returns.view": "عرض المرتجعات",
    "returns.process": "معالجة المرتجعات",
    "clients.view": "عرض العملاء",
    "clients.manage": "إدارة العملاء",
    "stock.view": "عرض المخزون",
    "stock.edit_products": "تعديل المنتجات",
    "stock.adjust": "تعديل الكميات",
    "stock.replenish": "توريد المخزون",
    "procurement.view": "عرض قائمة المشتريات",
    "procurement.manage": "إدارة قائمة المشتريات",
    "procurement.fulfill": "تسجيل المشتريات",
    "credits.approve": "الموافقة على الاعتمادات",
    "credits.collect": "تحصيل الديون",
    "credits.view": "عرض الائتمانات",
    "alerts.view": "عرض التنبيهات",
    "alerts.manage": "إدارة قواعد التنبيه",
    "reports.revenue": "الوصول إلى الإيرادات",
    "reports.export": "تصدير البيانات",
    "admin.manage_roles": "إدارة الأدوار",
    "admin.create_users": "إنشاء الحسابات",
    "admin.manage_settings": "إدارة الإعدادات",
  };
  return map[id] ?? label;
}

function translatePermissionDescription(
  id: string,
  description: string,
  isAr: boolean,
): string {
  if (!isAr) return description;
  const map: Record<string, string> = {
    "dashboard.view": "الوصول إلى ملخص النشاط",
    "sales.view": "الوصول إلى سجل المعاملات",
    "sales.create": "تنفيذ عمليات تحصيل جديدة",
    "sales.assist_cart": "تكوين سلة العميل دون تحصيل",
    "sales.park_cart": "إرسال السلة لأمين الصندوق",
    "sales.cancel": "حذف أو استرجاع معاملة",
    "sales.reopen": "إعادة فتح فاتورة مغلقة من الصندوق",
    "sales.credit": "تسجيل بيع بدفع مؤجل في نقطة البيع",
    "sales.edit_price": "تعديل سعر الوحدة أثناء البيع",
    "returns.view": "الاطلاع على سجل المرتجعات",
    "returns.process": "تسجيل مرتجع واسترداد المبلغ",
    "clients.view": "الاطلاع على ملفات العملاء",
    "clients.manage": "إنشاء وتعديل ملفات العملاء",
    "stock.view": "الاطلاع على مستويات المخزون",
    "stock.edit_products": "تغيير الأسعار والتكاليف والفئات والأوصاف",
    "stock.adjust": "تصحيح المخزون يدويًا",
    "stock.replenish": "إدخالات التوريد والكميات وأسعار الشراء",
    "procurement.view": "الاطلاع على قوائم التوريد وتاريخ الأسعار",
    "procurement.manage": "إنشاء وتعديل ونشر قوائم التسوق",
    "procurement.fulfill": "تحديد المشتريات وتسجيل السعر المدفوع",
    "credits.approve": "السماح بالدفع المؤجل",
    "credits.collect": "تسجيل سداد العميل وإدارة الخطط",
    "credits.view": "عرض الأرصدة والكشوفات دون تحصيل",
    "alerts.view": "الاطلاع على تنبيهات المخزون والائتمان",
    "alerts.manage": "إنشاء وتعديل قواعد التنبيه المخصصة",
    "reports.revenue": "عرض رسوم رقم المعاملات",
    "reports.export": "إنشاء ملفات PDF وExcel",
    "admin.manage_roles": "إنشاء الأدوار وتعديل الصلاحيات",
    "admin.create_users": "إنشاء حسابات المستخدمين (البريد + كلمة المرور + الدور)",
    "admin.manage_settings": "تعديل معلومات المتجر والتفضيلات العامة",
  };
  return map[id] ?? description;
}

function roleTileTone(active: boolean) {
  return active
    ? "bg-primary text-on-primary shadow-lg shadow-primary/20 ring-4 ring-primary/10"
    : "bg-surface-container-lowest border-sidebar-border shadow-sm hover:bg-surface-container-low hover:border-primary/15";
}

export function RolesPermissionsPage() {
  return <RolesPermissionsContent />;
}

export function RolesPermissionsContent() {
  const locale = useLocale();
  const isAr = locale === "ar";
  const tr = (fr: string, ar: string) => (isAr ? ar : fr);
  const toast = useToast();
  const { headerSearchQuery, setHeaderSearchQuery } = useAdminChrome();
  const storeQuery = useQuery(api.rbac.getStore);
  const createRoleMutation = useMutation(api.rbac.createRole);
  const setPermissionMutation = useMutation(api.rbac.setPermission);
  const ensureDefaultsMutation = useMutation(api.rbac.ensureDefaults);
  const usersQuery = useQuery(api.rbac.listUsers);
  const currentUser = useQuery(api.authz.currentUser);
  const setUserRoleMutation = useMutation(api.rbac.setUserRole);
  const adminResetUserPassword = useAction(api.passwords.adminResetUserPassword);
  const adminCreateUser = useAction(api.passwords.adminCreateUser);
  const store: RbacStore = storeQuery ?? createDefaultRbacStore();
  const users: UserRoleAssignment[] = usersQuery ?? [];
  const hydrated = storeQuery !== undefined;
  const canCreateAccounts = canCreateUsers(currentUser?.permissions ?? []);
  const [selectedRoleId, setSelectedRoleId] = useState<string>("");
  const [pendingUserId, setPendingUserId] = useState<string | null>(null);
  const [roleAssignmentError, setRoleAssignmentError] = useState<string | null>(
    null,
  );

  const [createOpen, setCreateOpen] = useState(false);
  const [newRoleName, setNewRoleName] = useState("");
  const [createUserOpen, setCreateUserOpen] = useState(false);
  const [newUserName, setNewUserName] = useState("");
  const [newUserEmail, setNewUserEmail] = useState("");
  const [newUserPassword, setNewUserPassword] = useState("");
  const [newUserPasswordConfirm, setNewUserPasswordConfirm] = useState("");
  const [newUserRoleId, setNewUserRoleId] = useState<string>("");
  const [createUserSaving, setCreateUserSaving] = useState(false);
  const [resetUser, setResetUser] = useState<UserRoleAssignment | null>(null);
  const [resetPassword, setResetPassword] = useState("");
  const [resetPasswordConfirm, setResetPasswordConfirm] = useState("");
  const [resetSaving, setResetSaving] = useState(false);

  useEffect(() => {
    void ensureDefaultsMutation({});
  }, [ensureDefaultsMutation]);

  const activeRoleId =
    selectedRoleId && store.roles.some((role) => role.id === selectedRoleId)
      ? selectedRoleId
      : (store.roles[0]?.id ?? "");

  const selectedRole = store.roles.find((r) => r.id === activeRoleId) ?? null;

  const rolePerms = store.rolePermissionsByRoleId[activeRoleId] ?? {};

  const searchQuery = headerSearchQuery.trim().toLowerCase();

  const filteredRoles = useMemo(() => {
    if (!searchQuery) return store.roles;
    return store.roles.filter((role) => {
      const hay = [
        role.name,
        translateRoleName(role, isAr),
        role.badge ?? "",
      ]
        .join(" ")
        .toLowerCase();
      return hay.includes(searchQuery);
    });
  }, [isAr, searchQuery, store.roles]);

  const filteredUsers = useMemo(() => {
    if (!searchQuery) return users;
    return users.filter((user) => {
      const hay = [
        user.name,
        user.email ?? "",
        user.roleName ?? "",
      ]
        .join(" ")
        .toLowerCase();
      return hay.includes(searchQuery);
    });
  }, [searchQuery, users]);

  const filteredPermissionsByCategory = useMemo(() => {
    const map = new Map<PermissionCategory, typeof store.permissions>();
    for (const permission of store.permissions) {
      if (searchQuery) {
        const hay = [
          permission.label,
          permission.id,
          translatePermissionLabel(permission.id, permission.label, isAr),
          translateCategoryLabel(permission.category, isAr),
          permission.category,
        ]
          .join(" ")
          .toLowerCase();
        if (!hay.includes(searchQuery)) continue;
      }
      const prev = map.get(permission.category) ?? [];
      map.set(permission.category, [...prev, permission]);
    }
    return map;
  }, [isAr, searchQuery, store.permissions]);

  const rolesFilterCount = filteredRoles.length;
  const usersFilterCount = filteredUsers.length;
  const permissionsFilterCount = useMemo(() => {
    let count = 0;
    for (const perms of filteredPermissionsByCategory.values()) {
      count += perms.length;
    }
    return count;
  }, [filteredPermissionsByCategory]);

  const rolesFilterTotal = store.roles.length;
  const usersFilterTotal = users.length;
  const permissionsFilterTotal = store.permissions.length;

  const combinedFilteredCount = rolesFilterCount + usersFilterCount + permissionsFilterCount;
  const combinedTotalCount =
    rolesFilterTotal + usersFilterTotal + permissionsFilterTotal;

  async function setPermission(roleId: string, permId: string, enabled: boolean) {
    await setPermissionMutation({
      roleId: roleId as Id<"roles">,
      permissionKey: permId,
      enabled,
    });
  }

  async function handleCreateRole() {
    const name = newRoleName.trim();
    if (!name) return;
    const role = await createRoleMutation({ name });
    setSelectedRoleId(role.id);
    setNewRoleName("");
    setCreateOpen(false);
  }

  async function handleAssignUserRole(userId: Id<"users">, roleId: Id<"roles">) {
    setPendingUserId(userId);
    setRoleAssignmentError(null);
    try {
      await setUserRoleMutation({ userId, roleId });
    } catch (err) {
      setRoleAssignmentError(
        err instanceof Error
          ? err.message
          : tr("Impossible de changer ce rôle.", "تعذر تغيير هذا الدور."),
      );
    } finally {
      setPendingUserId(null);
    }
  }

  const resetPasswordOk =
    resetPassword.length >= 8 && isPasswordAcceptableForSignUp(resetPassword);
  const resetPasswordsMatch =
    resetPassword.length > 0 && resetPassword === resetPasswordConfirm;
  const canResetPassword =
    resetPasswordOk && resetPasswordsMatch && !resetSaving && resetUser != null;

  const defaultCreateRoleId =
    newUserRoleId && store.roles.some((role) => role.id === newUserRoleId)
      ? newUserRoleId
      : (store.roles.find((role) => role.legacyId === "role:cashier")?.id ??
        store.roles[0]?.id ??
        "");
  const newUserPasswordOk =
    newUserPassword.length >= 8 &&
    isPasswordAcceptableForSignUp(newUserPassword);
  const newUserPasswordsMatch =
    newUserPassword.length > 0 && newUserPassword === newUserPasswordConfirm;
  const canSubmitCreateUser =
    canCreateAccounts &&
    !createUserSaving &&
    newUserName.trim().length > 0 &&
    newUserEmail.trim().includes("@") &&
    newUserPasswordOk &&
    newUserPasswordsMatch &&
    Boolean(defaultCreateRoleId);

  function resetCreateUserForm() {
    setNewUserName("");
    setNewUserEmail("");
    setNewUserPassword("");
    setNewUserPasswordConfirm("");
    setNewUserRoleId("");
  }

  async function handleCreateUser() {
    if (!canSubmitCreateUser || !defaultCreateRoleId) return;
    setCreateUserSaving(true);
    try {
      await adminCreateUser({
        name: newUserName.trim(),
        email: newUserEmail.trim(),
        password: newUserPassword,
        roleId: defaultCreateRoleId as Id<"roles">,
      });
      toast.success(
        tr("Compte créé", "تم إنشاء الحساب"),
        newUserName.trim() || newUserEmail.trim(),
      );
      setCreateUserOpen(false);
      resetCreateUserForm();
    } catch (error) {
      toast.error(
        tr("Création impossible", "تعذر الإنشاء"),
        error instanceof Error
          ? error.message
          : tr("Réessayez.", "حاول مجددًا."),
      );
    } finally {
      setCreateUserSaving(false);
    }
  }

  async function handleAdminResetPassword() {
    if (!resetUser || !canResetPassword) return;
    setResetSaving(true);
    try {
      await adminResetUserPassword({
        userId: resetUser.id,
        newPassword: resetPassword,
      });
      toast.success(
        tr("Mot de passe réinitialisé", "تمت إعادة تعيين كلمة المرور"),
        resetUser.name,
      );
      setResetUser(null);
      setResetPassword("");
      setResetPasswordConfirm("");
    } catch (error) {
      toast.error(
        tr("Réinitialisation impossible", "تعذرت إعادة التعيين"),
        error instanceof Error
          ? error.message
          : tr("Réessayez.", "حاول مجددًا."),
      );
    } finally {
      setResetSaving(false);
    }
  }

  return (
    <div className="bg-surface text-on-surface flex min-h-0 flex-1 flex-col overflow-hidden">
      {!hydrated ? (
        <RolesPageSkeleton />
      ) : (
      <main className="min-h-0 flex-1 overflow-auto">
        <div className="grid w-full gap-6 p-4 sm:p-6 lg:grid-cols-[320px_minmax(0,1fr)] xl:grid-cols-[360px_minmax(0,1fr)] xl:p-8">
        <AdminFilterSummary
          filteredCount={combinedFilteredCount}
          totalCount={combinedTotalCount}
          searchQuery={headerSearchQuery}
          onClearSearch={() => setHeaderSearchQuery("")}
          itemLabel={tr("élément", "عنصر")}
          itemLabelPlural={tr("éléments", "عناصر")}
          className="lg:col-span-2"
        />
        <section className="min-w-0 space-y-4 lg:sticky lg:top-0 lg:max-h-[calc(100svh-8rem)] lg:self-start lg:overflow-auto lg:pr-1">
          <div className="flex items-end justify-between gap-4 px-1">
            <div>
              <div className="text-primary flex items-center gap-2 text-xs font-bold tracking-widest uppercase">
                <UserCog className="size-4 stroke-[1.75]" aria-hidden />
                {tr("Écosystème", "النظام")}
              </div>
              <h1 className="text-2xl font-black tracking-tight sm:text-3xl">
                {tr("Rôles actifs", "الأدوار النشطة")}
              </h1>
            </div>
            <Dialog open={createOpen} onOpenChange={setCreateOpen}>
              <DialogTrigger
                render={
                  <Button
                    type="button"
                    variant="ghost"
                    className="text-primary h-10 gap-2 rounded-xl px-3 font-bold"
                  />
                }
              >
                <PlusCircle className="size-4 stroke-[1.75]" aria-hidden />
                {tr("Ajouter", "إضافة")}
              </DialogTrigger>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle>{tr("Ajouter un rôle", "إضافة دور")}</DialogTitle>
                </DialogHeader>
                <div className="space-y-2">
                  <label
                    htmlFor="new-role-name"
                    className="text-on-surface text-xs font-bold tracking-wide uppercase"
                  >
                    {tr("Nom du rôle", "اسم الدور")}
                  </label>
                  <Input
                    id="new-role-name"
                    value={newRoleName}
                    onChange={(e) => setNewRoleName(e.target.value)}
                    placeholder={tr("Ex. Superviseur", "مثال: مشرف")}
                    className="bg-surface-container-low border-transparent h-11 rounded-xl"
                    autoFocus
                  />
                </div>
                <DialogFooter>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setCreateOpen(false)}
                    className="rounded-xl"
                  >
                    {tr("Annuler", "إلغاء")}
                  </Button>
                  <Button
                    type="button"
                    onClick={() => void handleCreateRole()}
                    disabled={!newRoleName.trim()}
                    className="rounded-xl font-bold"
                  >
                    {tr("Créer", "إنشاء")}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>

          {store.roles.length === 0 ? (
            <p className="text-on-surface-variant border-sidebar-border bg-surface-container-low/40 rounded-2xl border px-4 py-8 text-center text-sm">
              {tr("Aucun rôle. Ajoutez-en un.", "لا يوجد أي دور. أضف دورًا جديدًا.")}
            </p>
          ) : filteredRoles.length === 0 ? (
            <p className="text-on-surface-variant border-sidebar-border bg-surface-container-low/40 rounded-2xl border px-4 py-8 text-center text-sm">
              {tr("Aucun rôle ne correspond à la recherche.", "لا يوجد دور يطابق البحث.")}
            </p>
          ) : (
            <div className="grid gap-3">
              {filteredRoles.map((role) => {
                const active = role.id === activeRoleId;
                const Icon = role.legacyId === "role:admin" ? BadgeCheck : UserCog;

                return (
                  <button
                    key={role.id}
                    type="button"
                    onClick={() => setSelectedRoleId(role.id)}
                    className={cn(
                      "w-full rounded-xl border p-4 text-left transition-all",
                      roleTileTone(active),
                    )}
                  >
                    <div className="mb-3 flex items-start justify-between gap-3">
                      <div
                        className={cn(
                          "flex size-10 items-center justify-center rounded-xl",
                          active
                            ? "bg-white/15 text-white"
                            : "bg-primary/10 text-primary",
                        )}
                      >
                        <Icon className="size-5 stroke-[1.75]" aria-hidden />
                      </div>
                      {role.badge ? (
                        <span
                          className={cn(
                            "rounded-full px-2 py-1 text-[10px] font-black tracking-wider uppercase",
                            active ? "bg-white/15 text-white" : badgeClasses(role.badge),
                          )}
                        >
                          {active
                            ? tr("Sélectionné", "محدد")
                            : translateBadgeLabel(role.badge, isAr)}
                        </span>
                      ) : null}
                    </div>
                    <p className={cn("text-base font-bold", active ? "text-white" : "text-on-surface")}>
                      {translateRoleName(role, isAr)}
                    </p>
                    <p
                      className={cn(
                        "mt-1 text-sm",
                        active ? "text-primary-fixed-dim" : "text-on-surface-variant",
                      )}
                    >
                      {role.assignedUsersCount}{" "}
                      {tr("utilisateur(s) assigné(s)", "مستخدم/مستخدمين مخصصين")}
                    </p>
                  </button>
                );
              })}
            </div>
          )}
        </section>

        <section className="border-sidebar-border bg-surface-container-lowest min-w-0 rounded-2xl border p-4 shadow-sm sm:p-6 xl:p-8">
          <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <div className="text-primary mb-2 flex flex-wrap items-center gap-2 text-xs font-bold tracking-widest uppercase">
                {tr("Édition des permissions", "تعديل الصلاحيات")}
                <span className="text-outline-variant font-black">/</span>
                <span className="text-on-surface-variant normal-case font-semibold tracking-normal">
                  {tr("Rôle", "الدور")} :{" "}
                  {selectedRole ? translateRoleName(selectedRole, isAr) : "—"}
                </span>
              </div>
              <h2 className="text-2xl font-black tracking-tight sm:text-3xl">
                {tr("Matrice de contrôle", "مصفوفة التحكم")}
              </h2>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                className="from-primary to-primary-container h-11 gap-2 rounded-xl bg-linear-to-r font-bold text-white shadow-lg shadow-primary/25"
                disabled
              >
                <Save className="size-4 stroke-[1.75]" aria-hidden />
                {tr("Synchronisé", "متزامن")}
              </Button>
            </div>
          </div>

          <Separator className="bg-outline-variant/50 mb-6" />

          <div className="mb-8">
            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <div className="text-primary mb-2 flex items-center gap-2 text-xs font-bold tracking-widest uppercase">
                  <Users className="size-4 stroke-[1.75]" aria-hidden />
                  {tr("Utilisateurs", "المستخدمون")}
                </div>
                <h3 className="text-xl font-black tracking-tight">
                  {tr("Affectation des rôles", "تعيين الأدوار")}
                </h3>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {canCreateAccounts ? (
                  <Dialog
                    open={createUserOpen}
                    onOpenChange={(open) => {
                      setCreateUserOpen(open);
                      if (!open) resetCreateUserForm();
                    }}
                  >
                    <DialogTrigger
                      render={
                        <Button
                          type="button"
                          className="h-10 gap-2 rounded-xl font-bold"
                        />
                      }
                    >
                      <PlusCircle className="size-4 stroke-[1.75]" aria-hidden />
                      {tr("Nouvel utilisateur", "مستخدم جديد")}
                    </DialogTrigger>
                    <DialogContent className="max-w-md">
                      <DialogHeader>
                        <DialogTitle>
                          {tr("Créer un compte", "إنشاء حساب")}
                        </DialogTitle>
                      </DialogHeader>
                      <div className="space-y-3">
                        <div className="space-y-2">
                          <label
                            htmlFor="new-user-name"
                            className="text-on-surface text-xs font-bold tracking-wide uppercase"
                          >
                            {tr("Nom", "الاسم")}
                          </label>
                          <Input
                            id="new-user-name"
                            value={newUserName}
                            onChange={(e) => setNewUserName(e.target.value)}
                            placeholder={tr("Ex. Fatima Zahra", "مثال: فاطمة الزهراء")}
                            className="bg-surface-container-low border-transparent h-11 rounded-xl"
                            autoFocus
                          />
                        </div>
                        <div className="space-y-2">
                          <label
                            htmlFor="new-user-email"
                            className="text-on-surface text-xs font-bold tracking-wide uppercase"
                          >
                            {tr("Email", "البريد الإلكتروني")}
                          </label>
                          <Input
                            id="new-user-email"
                            type="email"
                            autoComplete="off"
                            value={newUserEmail}
                            onChange={(e) => setNewUserEmail(e.target.value)}
                            placeholder="user@example.com"
                            className="bg-surface-container-low border-transparent h-11 rounded-xl"
                          />
                        </div>
                        <div className="space-y-2">
                          <label
                            htmlFor="new-user-role"
                            className="text-on-surface text-xs font-bold tracking-wide uppercase"
                          >
                            {tr("Rôle", "الدور")}
                          </label>
                          <select
                            id="new-user-role"
                            value={defaultCreateRoleId}
                            onChange={(e) => setNewUserRoleId(e.target.value)}
                            className="bg-surface-container-low text-on-surface focus:ring-primary/20 h-11 w-full rounded-xl border border-transparent px-3 text-sm font-semibold focus:ring-2"
                          >
                            {store.roles.map((role) => (
                              <option key={role.id} value={role.id}>
                                {translateRoleName(role, isAr)}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className="space-y-2">
                          <label
                            htmlFor="new-user-password"
                            className="text-on-surface text-xs font-bold tracking-wide uppercase"
                          >
                            {tr("Mot de passe", "كلمة المرور")}
                          </label>
                          <Input
                            id="new-user-password"
                            type="password"
                            autoComplete="new-password"
                            value={newUserPassword}
                            onChange={(e) => setNewUserPassword(e.target.value)}
                            className="bg-surface-container-low border-transparent h-11 rounded-xl"
                          />
                          <PasswordStrengthIndicator
                            password={newUserPassword}
                            invalid={
                              newUserPassword.length > 0 && !newUserPasswordOk
                            }
                            message={
                              newUserPassword.length === 0
                                ? tr("8 caractères minimum.", "8 أحرف على الأقل.")
                                : !newUserPasswordOk
                                  ? tr(
                                      "Mot de passe trop faible.",
                                      "كلمة المرور ضعيفة.",
                                    )
                                  : tr(
                                      "Mot de passe accepté.",
                                      "كلمة المرور مقبولة.",
                                    )
                            }
                            labels={{
                              weak: tr("Faible", "ضعيف"),
                              medium: tr("Moyen", "متوسط"),
                              strong: tr("Fort", "قوي"),
                              hint: tr("Force", "القوة"),
                            }}
                          />
                        </div>
                        <div className="space-y-2">
                          <label
                            htmlFor="new-user-password-confirm"
                            className="text-on-surface text-xs font-bold tracking-wide uppercase"
                          >
                            {tr("Confirmer", "تأكيد")}
                          </label>
                          <Input
                            id="new-user-password-confirm"
                            type="password"
                            autoComplete="new-password"
                            value={newUserPasswordConfirm}
                            onChange={(e) =>
                              setNewUserPasswordConfirm(e.target.value)
                            }
                            className="bg-surface-container-low border-transparent h-11 rounded-xl"
                          />
                          {newUserPasswordConfirm.length > 0 &&
                          !newUserPasswordsMatch ? (
                            <p className="text-error text-xs font-medium">
                              {tr(
                                "Les mots de passe ne correspondent pas.",
                                "كلمتا المرور غير متطابقتين.",
                              )}
                            </p>
                          ) : null}
                        </div>
                      </div>
                      <DialogFooter>
                        <Button
                          type="button"
                          variant="outline"
                          disabled={createUserSaving}
                          onClick={() => setCreateUserOpen(false)}
                          className="rounded-xl"
                        >
                          {tr("Annuler", "إلغاء")}
                        </Button>
                        <Button
                          type="button"
                          disabled={!canSubmitCreateUser}
                          onClick={() => void handleCreateUser()}
                          className="rounded-xl font-bold"
                        >
                          {createUserSaving
                            ? tr("Création…", "جاري الإنشاء…")
                            : tr("Créer le compte", "إنشاء الحساب")}
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                ) : null}
                <div className="bg-surface-container-high text-on-surface-variant rounded-full px-3 py-1 text-xs font-bold">
                  {users.length} {tr("compte(s)", "حساب/حسابات")}
                </div>
              </div>
            </div>

            {roleAssignmentError ? (
              <p className="bg-error-container text-on-error-container mb-4 rounded-xl px-3 py-2 text-sm font-medium">
                {roleAssignmentError}
              </p>
            ) : null}

            {usersQuery === undefined ? (
              <RolesUsersListSkeleton />
            ) : users.length === 0 ? (
              <p className="text-on-surface-variant bg-surface-container-low rounded-2xl px-4 py-6 text-center text-sm">
                {tr(
                  "Aucun utilisateur pour le moment.",
                  "لا يوجد مستخدمون حاليًا.",
                )}
              </p>
            ) : filteredUsers.length === 0 ? (
              <p className="text-on-surface-variant bg-surface-container-low rounded-2xl px-4 py-6 text-center text-sm">
                {tr(
                  "Aucun utilisateur ne correspond à la recherche.",
                  "لا يوجد مستخدم يطابق البحث.",
                )}
              </p>
            ) : (
              <div className="divide-outline-variant/60 overflow-hidden rounded-2xl border border-outline-variant/60">
                {filteredUsers.map((user) => {
                  const roleValue = user.roleId ?? "";
                  const createdLabel = formatDateShortFr(
                    new Date(user.createdAt).toISOString().slice(0, 10),
                  );

                  return (
                    <div
                      key={user.id}
                      className="bg-surface-container-lowest flex flex-col gap-3 border-b border-outline-variant/60 p-4 last:border-b-0 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-on-surface truncate text-sm font-black">
                            {user.name}
                          </p>
                          {user.isCurrentUser ? (
                            <span className="bg-primary/10 text-primary rounded-full px-2 py-0.5 text-[10px] font-black uppercase">
                              {tr("Vous", "أنت")}
                            </span>
                          ) : null}
                        </div>
                        <p className="text-on-surface-variant truncate text-xs">
                          {user.email ?? tr("Sans email", "بدون بريد")}
                        </p>
                        <p className="text-outline mt-1 text-[11px]">
                          {tr("Créé le", "أُنشئ في")} {createdLabel}
                        </p>
                      </div>

                      <div className="flex min-w-0 flex-col gap-2 sm:w-64">
                        <label
                          htmlFor={`role:${user.id}`}
                          className="text-on-surface-variant text-[10px] font-black tracking-wide uppercase"
                        >
                          {tr("Rôle", "الدور")}
                        </label>
                        <select
                          id={`role:${user.id}`}
                          value={roleValue}
                          disabled={user.isCurrentUser || pendingUserId === user.id}
                          onChange={(event) =>
                            void handleAssignUserRole(
                              user.id,
                              event.target.value as Id<"roles">,
                            )
                          }
                          className="bg-surface-container-low text-on-surface focus:ring-primary/20 h-10 rounded-xl border border-outline-variant/50 px-3 text-sm font-semibold focus:ring-2 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          <option value="" disabled>
                            {tr("Choisir un rôle", "اختر دورًا")}
                          </option>
                          {store.roles.map((role) => (
                            <option key={role.id} value={role.id}>
                              {translateRoleName(role, isAr)}
                            </option>
                          ))}
                        </select>
                        <Button
                          type="button"
                          variant="outline"
                          className="h-10 gap-2 rounded-xl font-bold"
                          onClick={() => {
                            setResetUser(user);
                            setResetPassword("");
                            setResetPasswordConfirm("");
                          }}
                        >
                          <KeyRound className="size-4 stroke-[1.75]" aria-hidden />
                          {tr("Mot de passe", "كلمة المرور")}
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <Separator className="bg-outline-variant/50 mb-6" />

          {!selectedRole ? (
            <p className="text-on-surface-variant text-sm">
              {tr("Sélectionnez un rôle à gauche.", "اختر دورًا من الجهة اليسرى.")}
            </p>
          ) : (
            <div className="space-y-8">
              {[...filteredPermissionsByCategory.entries()].map(([category, perms]) => {
                const Icon = categoryIcon(category);
                return (
                  <div key={category}>
                    <div className="mb-5 flex items-center gap-3">
                      <div className="bg-primary/10 text-primary flex size-9 items-center justify-center rounded-xl">
                        <Icon className="size-4.5 stroke-[1.75]" aria-hidden />
                      </div>
                      <h3 className="text-lg font-bold">
                        {translateCategoryLabel(category, isAr)}
                      </h3>
                      <div className="bg-surface-container-high flex-1 h-px" />
                    </div>
                    <div className="grid gap-4 lg:grid-cols-2">
                      {perms.map((p) => {
                        const enabled = Boolean(rolePerms[p.id]);
                        const inputId = `perm:${activeRoleId}:${p.id}`;
                        return (
                          <label
                            key={p.id}
                            htmlFor={inputId}
                            className="bg-surface-container-low hover:bg-surface-container-high flex cursor-pointer items-center justify-between gap-4 rounded-xl p-4 transition-colors"
                          >
                            <span className="min-w-0">
                              <span className="block truncate text-sm font-bold">
                                {translatePermissionLabel(p.id, p.label, isAr)}
                              </span>
                              <span className="text-on-surface-variant block truncate text-xs">
                                {translatePermissionDescription(
                                  p.id,
                                  p.description,
                                  isAr,
                                )}
                              </span>
                            </span>
                            <span className="relative inline-flex items-center">
                              <input
                                id={inputId}
                                type="checkbox"
                                checked={enabled}
                                onChange={(e) =>
                                  void setPermission(
                                    activeRoleId,
                                    p.id,
                                    e.target.checked,
                                  )
                                }
                                className="peer sr-only"
                                disabled={selectedRole.legacyId === "role:admin"}
                              />
                              <span
                                className={cn(
                                  "h-6 w-11 rounded-full bg-slate-300 transition-colors",
                                  "after:absolute after:top-[2px] after:left-[2px] after:h-5 after:w-5 after:rounded-full after:bg-white after:transition-transform",
                                  "peer-checked:bg-primary peer-checked:after:translate-x-full",
                                  "peer-disabled:opacity-60",
                                )}
                                aria-hidden
                              />
                            </span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                );
              })}

            </div>
          )}
        </section>
        </div>
      </main>
      )}

      <Dialog
        open={resetUser != null}
        onOpenChange={(open) => {
          if (!open && !resetSaving) {
            setResetUser(null);
            setResetPassword("");
            setResetPasswordConfirm("");
          }
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {tr("Réinitialiser le mot de passe", "إعادة تعيين كلمة المرور")}
            </DialogTitle>
          </DialogHeader>
          {resetUser ? (
            <div className="space-y-4">
              <p className="text-on-surface-variant text-sm">
                {tr("Nouveau mot de passe pour", "كلمة مرور جديدة لـ")}{" "}
                <span className="text-on-surface font-bold">{resetUser.name}</span>
              </p>
              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase" htmlFor="admin-reset-password">
                  {tr("Nouveau mot de passe", "كلمة المرور الجديدة")}
                </label>
                <Input
                  id="admin-reset-password"
                  type="password"
                  autoComplete="new-password"
                  value={resetPassword}
                  onChange={(event) => setResetPassword(event.target.value)}
                  className="h-11 rounded-xl"
                />
                <PasswordStrengthIndicator
                  password={resetPassword}
                  invalid={resetPassword.length > 0 && !resetPasswordOk}
                  message={
                    resetPassword.length === 0
                      ? tr("8 caractères minimum.", "8 أحرف على الأقل.")
                      : !resetPasswordOk
                        ? tr("Mot de passe trop faible.", "كلمة المرور ضعيفة.")
                        : tr("Mot de passe accepté.", "كلمة المرور مقبولة.")
                  }
                  labels={{
                    weak: tr("Faible", "ضعيف"),
                    medium: tr("Moyen", "متوسط"),
                    strong: tr("Fort", "قوي"),
                    hint: tr("Force", "القوة"),
                  }}
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase" htmlFor="admin-reset-password-confirm">
                  {tr("Confirmer", "تأكيد")}
                </label>
                <Input
                  id="admin-reset-password-confirm"
                  type="password"
                  autoComplete="new-password"
                  value={resetPasswordConfirm}
                  onChange={(event) => setResetPasswordConfirm(event.target.value)}
                  className="h-11 rounded-xl"
                />
              </div>
            </div>
          ) : null}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              className="rounded-xl"
              disabled={resetSaving}
              onClick={() => setResetUser(null)}
            >
              {tr("Annuler", "إلغاء")}
            </Button>
            <Button
              type="button"
              className="rounded-xl font-bold"
              disabled={!canResetPassword}
              onClick={() => void handleAdminResetPassword()}
            >
              {resetSaving
                ? tr("Enregistrement…", "جاري الحفظ…")
                : tr("Enregistrer", "حفظ")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
