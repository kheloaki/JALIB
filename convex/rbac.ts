import { v } from "convex/values";

import { mutation, query } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { recordAuditForUser } from "./audit";
import {
  ensureDefaultRbac,
  requirePermission,
  type PermissionKey,
} from "./authz";

const permissionCategory = v.union(
  v.literal("Ventes"),
  v.literal("Stock"),
  v.literal("Clients"),
  v.literal("Crédits"),
  v.literal("Rapports"),
  v.literal("Administration"),
);

const permissionView = v.object({
  id: v.string(),
  category: permissionCategory,
  label: v.string(),
  description: v.string(),
});

const roleView = v.object({
  id: v.id("roles"),
  legacyId: v.union(v.string(), v.null()),
  name: v.string(),
  description: v.union(v.string(), v.null()),
  assignedUsersCount: v.number(),
  badge: v.union(v.literal("Plein accès"), v.literal("Limité"), v.null()),
});

const storeView = v.object({
  roles: v.array(roleView),
  permissions: v.array(permissionView),
  rolePermissionsByRoleId: v.record(v.string(), v.record(v.string(), v.boolean())),
});

const userRoleAssignmentView = v.object({
  id: v.id("users"),
  name: v.string(),
  email: v.union(v.string(), v.null()),
  roleId: v.union(v.id("roles"), v.null()),
  roleName: v.union(v.string(), v.null()),
  createdAt: v.number(),
  isCurrentUser: v.boolean(),
});

function roleToView(role: Doc<"roles">, assignedUsersCount: number) {
  return {
    id: role._id,
    legacyId: role.legacyId ?? null,
    name: role.name,
    description: role.description ?? null,
    assignedUsersCount,
    badge: role.badge ?? null,
  };
}

async function countUsersForRole(
  ctx: QueryCtx | MutationCtx,
  roleId: Id<"roles">,
) {
  const users = await ctx.db
    .query("users")
    .withIndex("by_roleId", (q) => q.eq("roleId", roleId))
    .take(1000);
  return users.length;
}

export const getStore = query({
  args: {},
  returns: storeView,
  handler: async (ctx) => {
    await requirePermission(ctx, "admin.manage_roles");
    const roles = await ctx.db.query("roles").order("desc").take(100);
    const permissions = await ctx.db.query("permissions").take(300);
    const permissionById = new Map(
      permissions.map((permission) => [permission._id, permission]),
    );
    const rolePermissionsByRoleId: Record<string, Record<string, boolean>> = {};

    for (const role of roles) {
      const links = await ctx.db
        .query("rolePermissions")
        .withIndex("by_roleId", (q) => q.eq("roleId", role._id))
        .take(300);
      const state: Record<string, boolean> = {};
      for (const link of links) {
        const permission = permissionById.get(link.permissionId);
        if (!permission) continue;
        state[permission.key] = link.enabled;
      }
      rolePermissionsByRoleId[role._id] = state;
    }

    return {
      roles: await Promise.all(
        roles.map(async (role) =>
          roleToView(role, await countUsersForRole(ctx, role._id)),
        ),
      ),
      permissions: permissions.map((permission) => ({
        id: permission.key,
        category: permission.category,
        label: permission.label,
        description: permission.description,
      })),
      rolePermissionsByRoleId,
    };
  },
});

export const ensureDefaults = mutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    await requirePermission(ctx, "admin.manage_roles");
    await ensureDefaultRbac(ctx);
    return null;
  },
});

export const createRole = mutation({
  args: { name: v.string() },
  returns: roleView,
  handler: async (ctx, args) => {
    const { userId, user } = await requirePermission(ctx, "admin.manage_roles");
    const now = Date.now();
    const name = args.name.trim();
    if (!name) throw new Error("Role name is required.");

    const roleId = await ctx.db.insert("roles", {
      name,
      description: "Rôle personnalisé",
      assignedUsersCount: 0,
      badge: "Limité",
      createdAt: now,
      updatedAt: now,
    });

    const role = await ctx.db.get(roleId);
    if (!role) throw new Error("Role creation failed.");

    const permissions = await ctx.db.query("permissions").take(300);
    const cashier = await ctx.db
      .query("roles")
      .withIndex("by_legacyId", (q) => q.eq("legacyId", "role:cashier"))
      .unique();
    const cashierLinks = cashier
      ? await ctx.db
          .query("rolePermissions")
          .withIndex("by_roleId", (q) => q.eq("roleId", cashier._id))
          .take(300)
      : [];
    const cashierEnabled = new Map(
      cashierLinks.map((link) => [link.permissionId, link.enabled]),
    );

    for (const permission of permissions) {
      await ctx.db.insert("rolePermissions", {
        roleId,
        permissionId: permission._id,
        enabled: cashierEnabled.get(permission._id) ?? false,
      });
    }

    await recordAuditForUser(ctx, userId, user, {
      action: "rbac.createRole",
      entityType: "role",
      entityId: roleId,
      summary: `Rôle créé: ${name}`,
      payload: { name },
      source: "manual",
    });

    return roleToView(role, 0);
  },
});

export const deleteRole = mutation({
  args: { roleId: v.id("roles") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { userId, user } = await requirePermission(ctx, "admin.manage_roles");
    const role = await ctx.db.get(args.roleId);
    if (!role) return null;
    if (role.legacyId === "role:admin") throw new Error("Admin role is required.");
    const users = await ctx.db
      .query("users")
      .withIndex("by_roleId", (q) => q.eq("roleId", args.roleId))
      .take(1);
    if (users.length > 0) throw new Error("Role is assigned to users.");

    const links = await ctx.db
      .query("rolePermissions")
      .withIndex("by_roleId", (q) => q.eq("roleId", args.roleId))
      .take(300);
    for (const link of links) {
      await ctx.db.delete(link._id);
    }
    await ctx.db.delete(args.roleId);
    await recordAuditForUser(ctx, userId, user, {
      action: "rbac.deleteRole",
      entityType: "role",
      entityId: args.roleId,
      summary: `Rôle supprimé: ${role.name}`,
      payload: { name: role.name },
      source: "manual",
    });
    return null;
  },
});

export const setPermission = mutation({
  args: {
    roleId: v.id("roles"),
    permissionKey: v.string(),
    enabled: v.boolean(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { userId, user } = await requirePermission(ctx, "admin.manage_roles");
    const role = await ctx.db.get(args.roleId);
    if (!role) throw new Error("Role not found.");
    if (role.legacyId === "role:admin" && !args.enabled) {
      throw new Error("Admin permissions cannot be disabled.");
    }
    const permission = await ctx.db
      .query("permissions")
      .withIndex("by_key", (q) => q.eq("key", args.permissionKey as PermissionKey))
      .unique();
    if (!permission) throw new Error("Permission not found.");

    const existing = await ctx.db
      .query("rolePermissions")
      .withIndex("by_roleId_permissionId", (q) =>
        q.eq("roleId", args.roleId).eq("permissionId", permission._id),
      )
      .unique();
    if (existing) {
      await ctx.db.patch(existing._id, { enabled: args.enabled });
    } else {
      await ctx.db.insert("rolePermissions", {
        roleId: args.roleId,
        permissionId: permission._id,
        enabled: args.enabled,
      });
    }
    await recordAuditForUser(ctx, userId, user, {
      action: "rbac.setPermission",
      entityType: "role",
      entityId: args.roleId,
      summary: args.enabled
        ? `Permission activée: ${args.permissionKey}`
        : `Permission désactivée: ${args.permissionKey}`,
      payload: {
        roleName: role.name,
        permissionKey: args.permissionKey,
        enabled: args.enabled,
      },
      source: "manual",
    });
    return null;
  },
});

export const listUsers = query({
  args: {},
  returns: v.array(userRoleAssignmentView),
  handler: async (ctx) => {
    const { userId: currentUserId } = await requirePermission(
      ctx,
      "admin.manage_roles",
    );
    const roles = await ctx.db.query("roles").take(300);
    const roleById = new Map(roles.map((role) => [role._id, role]));
    const users = await ctx.db.query("users").order("desc").take(300);

    return users.map((user) => {
      const role = user.roleId ? roleById.get(user.roleId) : null;
      return {
        id: user._id,
        name: user.name ?? user.email ?? "User",
        email: user.email ?? null,
        roleId: user.roleId ?? null,
        roleName: role?.name ?? null,
        createdAt: user._creationTime,
        isCurrentUser: user._id === currentUserId,
      };
    });
  },
});

export const setUserRole = mutation({
  args: {
    userId: v.id("users"),
    roleId: v.id("roles"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { userId: currentUserId, user: actorUser } = await requirePermission(
      ctx,
      "admin.manage_roles",
    );
    const targetUser = await ctx.db.get(args.userId);
    if (!targetUser) throw new Error("User not found.");
    const nextRole = await ctx.db.get(args.roleId);
    if (!nextRole) throw new Error("Role not found.");

    if (args.userId === currentUserId && targetUser.roleId !== args.roleId) {
      throw new Error("You cannot change your own role.");
    }

    if (targetUser.roleId && targetUser.roleId !== args.roleId) {
      const currentRole = await ctx.db.get(targetUser.roleId);
      if (currentRole?.legacyId === "role:admin") {
        const admins = await ctx.db
          .query("users")
          .withIndex("by_roleId", (q) => q.eq("roleId", targetUser.roleId!))
          .take(2);
        if (admins.length <= 1) {
          throw new Error("At least one administrator is required.");
        }
      }
    }

    await ctx.db.patch(args.userId, {
      roleId: args.roleId,
      updatedAt: Date.now(),
    });
    const targetName =
      targetUser.name?.trim() || targetUser.email?.trim() || "Utilisateur";
    await recordAuditForUser(ctx, currentUserId, actorUser, {
      action: "rbac.setUserRole",
      entityType: "role",
      entityId: args.roleId,
      summary: `Rôle assigné: ${targetName} → ${nextRole.name}`,
      payload: {
        userId: args.userId,
        roleName: nextRole.name,
      },
      source: "manual",
    });
    return null;
  },
});
