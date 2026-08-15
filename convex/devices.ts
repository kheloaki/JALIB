import { getAuthSessionId } from "@convex-dev/auth/server";
import { v } from "convex/values";

import type { Doc, Id } from "./_generated/dataModel";
import { mutation, query } from "./_generated/server";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import {
  ensureDefaultRbac,
  requireAuthenticatedUser,
  requirePermission,
  type PermissionKey,
} from "./authz";

const CHALLENGE_TTL_MS = 10 * 60 * 1000;
const QR_PREFIX = "matjar-device:";
const MANAGE_DEVICES: PermissionKey = "admin.manage_devices";

const deviceStatusView = v.object({
  status: v.union(
    v.literal("none"),
    v.literal("pending"),
    v.literal("approved"),
    v.literal("revoked"),
    v.literal("expired"),
  ),
  challengeToken: v.union(v.string(), v.null()),
  challengeExpiresAt: v.union(v.number(), v.null()),
  label: v.union(v.string(), v.null()),
  bootstrapped: v.boolean(),
});

type AuthzCtx = QueryCtx | MutationCtx;

function createChallengeToken() {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

function parseChallengeToken(raw: string) {
  const trimmed = raw.trim();
  if (trimmed.startsWith(QR_PREFIX)) {
    return trimmed.slice(QR_PREFIX.length).trim();
  }
  return trimmed;
}

async function permissionKeyToId(ctx: AuthzCtx, key: string) {
  const permission = await ctx.db
    .query("permissions")
    .withIndex("by_key", (q) => q.eq("key", key))
    .unique();
  return permission?._id ?? null;
}

async function userHasPermission(
  ctx: AuthzCtx,
  user: Doc<"users">,
  permissionKey: PermissionKey,
) {
  if (!user.roleId) return false;
  const permissionId = await permissionKeyToId(ctx, permissionKey);
  if (!permissionId) return false;
  const link = await ctx.db
    .query("rolePermissions")
    .withIndex("by_roleId_permissionId", (q) =>
      q.eq("roleId", user.roleId!).eq("permissionId", permissionId),
    )
    .unique();
  return Boolean(link?.enabled);
}

async function findDeviceForUser(
  ctx: AuthzCtx,
  userId: Id<"users">,
  deviceId: string,
) {
  return ctx.db
    .query("trustedDevices")
    .withIndex("by_userId_and_deviceId", (q) =>
      q.eq("userId", userId).eq("deviceId", deviceId),
    )
    .unique();
}

async function countApprovedAdminDevices(ctx: AuthzCtx) {
  const approved = await ctx.db
    .query("trustedDevices")
    .withIndex("by_status", (q) => q.eq("status", "approved"))
    .take(500);
  let count = 0;
  for (const device of approved) {
    const user = await ctx.db.get(device.userId);
    if (!user) continue;
    if (await userHasPermission(ctx, user, MANAGE_DEVICES)) {
      count += 1;
    }
  }
  return count;
}

async function isDeviceApprovedForUser(
  ctx: AuthzCtx,
  userId: Id<"users">,
  deviceId: string,
) {
  const device = await findDeviceForUser(ctx, userId, deviceId);
  return device?.status === "approved";
}

async function deleteAuthSession(
  ctx: MutationCtx,
  sessionId: Id<"authSessions"> | undefined,
) {
  if (!sessionId) return;
  const session = await ctx.db.get(sessionId);
  if (!session) return;
  const tokens = await ctx.db
    .query("authRefreshTokens")
    .withIndex("sessionId", (q) => q.eq("sessionId", sessionId))
    .take(50);
  for (const token of tokens) {
    await ctx.db.delete(token._id);
  }
  await ctx.db.delete(sessionId);
}

function toStatusView(
  device: Doc<"trustedDevices"> | null,
  bootstrapped = false,
) {
  if (!device) {
    return {
      status: "none" as const,
      challengeToken: null,
      challengeExpiresAt: null,
      label: null,
      bootstrapped,
    };
  }
  if (device.status === "approved") {
    return {
      status: "approved" as const,
      challengeToken: null,
      challengeExpiresAt: null,
      label: device.label ?? null,
      bootstrapped,
    };
  }
  if (device.status === "revoked") {
    return {
      status: "revoked" as const,
      challengeToken: null,
      challengeExpiresAt: null,
      label: device.label ?? null,
      bootstrapped,
    };
  }
  const now = Date.now();
  const expired =
    !device.challengeToken ||
    !device.challengeExpiresAt ||
    device.challengeExpiresAt <= now;
  return {
    status: (expired ? "expired" : "pending") as "pending" | "expired",
    challengeToken: expired ? null : (device.challengeToken ?? null),
    challengeExpiresAt: device.challengeExpiresAt ?? null,
    label: device.label ?? null,
    bootstrapped,
  };
}

async function approveDeviceRecord(
  ctx: MutationCtx,
  device: Doc<"trustedDevices">,
  args: {
    approvedByUserId: Id<"users"> | null;
    authSessionId?: Id<"authSessions"> | null;
  },
) {
  const now = Date.now();
  await ctx.db.patch(device._id, {
    status: "approved",
    challengeToken: undefined,
    challengeExpiresAt: undefined,
    approvedAt: now,
    approvedByUserId: args.approvedByUserId ?? undefined,
    revokedAt: undefined,
    revokedByUserId: undefined,
    lastSeenAt: now,
    ...(args.authSessionId ? { authSessionId: args.authSessionId } : {}),
  });
}

/**
 * Live status for the signed-in user's current browser/device.
 */
export const getMyDeviceStatus = query({
  args: { deviceId: v.string() },
  returns: deviceStatusView,
  handler: async (ctx, args) => {
    const { userId } = await requireAuthenticatedUser(ctx);
    const device = await findDeviceForUser(ctx, userId, args.deviceId.trim());
    return toStatusView(device);
  },
});

/**
 * Register a pending challenge (or refresh an expired one).
 * Auto-approves when no Administrateur device exists yet (bootstrap/recovery).
 */
export const registerOrRefreshPendingDevice = mutation({
  args: {
    deviceId: v.string(),
    label: v.optional(v.string()),
  },
  returns: deviceStatusView,
  handler: async (ctx, args) => {
    const { userId, user } = await requireAuthenticatedUser(ctx);
    await ensureDefaultRbac(ctx);
    const deviceId = args.deviceId.trim();
    if (!deviceId) throw new Error("Invalid device");

    const now = Date.now();
    const sessionId = await getAuthSessionId(ctx);
    let device = await findDeviceForUser(ctx, userId, deviceId);

    if (device?.status === "approved") {
      await ctx.db.patch(device._id, {
        lastSeenAt: now,
        ...(args.label ? { label: args.label } : {}),
        ...(sessionId ? { authSessionId: sessionId } : {}),
      });
      return toStatusView({ ...device, lastSeenAt: now });
    }

    const adminDeviceCount = await countApprovedAdminDevices(ctx);
    const isAdmin = await userHasPermission(ctx, user, MANAGE_DEVICES);
    if (adminDeviceCount === 0 && isAdmin) {
      if (!device) {
        const id = await ctx.db.insert("trustedDevices", {
          userId,
          deviceId,
          label: args.label,
          status: "approved",
          approvedAt: now,
          lastSeenAt: now,
          createdAt: now,
          ...(sessionId ? { authSessionId: sessionId } : {}),
        });
        device = (await ctx.db.get(id))!;
      } else {
        await approveDeviceRecord(ctx, device, {
          approvedByUserId: null,
          authSessionId: sessionId,
        });
        if (args.label) {
          await ctx.db.patch(device._id, { label: args.label });
        }
        device = (await ctx.db.get(device._id))!;
      }
      return toStatusView(device, true);
    }

    const token = createChallengeToken();
    const expiresAt = now + CHALLENGE_TTL_MS;

    if (!device) {
      const id = await ctx.db.insert("trustedDevices", {
        userId,
        deviceId,
        label: args.label,
        status: "pending",
        challengeToken: token,
        challengeExpiresAt: expiresAt,
        lastSeenAt: now,
        createdAt: now,
        ...(sessionId ? { authSessionId: sessionId } : {}),
      });
      device = (await ctx.db.get(id))!;
    } else {
      await ctx.db.patch(device._id, {
        status: "pending",
        challengeToken: token,
        challengeExpiresAt: expiresAt,
        lastSeenAt: now,
        revokedAt: undefined,
        revokedByUserId: undefined,
        ...(args.label ? { label: args.label } : {}),
        ...(sessionId ? { authSessionId: sessionId } : {}),
      });
      device = (await ctx.db.get(device._id))!;
    }

    return toStatusView(device);
  },
});

/**
 * Admin scan: approve a pending device by challenge token.
 * Caller must have manage_devices and be on an approved device
 * (unless this would be the bootstrap case — already handled by auto-approve).
 */
export const approveDeviceByToken = mutation({
  args: {
    token: v.string(),
    adminDeviceId: v.string(),
  },
  returns: v.object({
    ok: v.boolean(),
    userName: v.union(v.string(), v.null()),
    label: v.union(v.string(), v.null()),
  }),
  handler: async (ctx, args) => {
    await ensureDefaultRbac(ctx);
    const { userId: adminUserId } = await requirePermission(
      ctx,
      MANAGE_DEVICES,
    );

    const adminDeviceId = args.adminDeviceId.trim();
    const adminApproved = await isDeviceApprovedForUser(
      ctx,
      adminUserId,
      adminDeviceId,
    );
    if (!adminApproved) {
      throw new Error("ADMIN_DEVICE_NOT_APPROVED");
    }

    const token = parseChallengeToken(args.token);
    if (!token) throw new Error("INVALID_TOKEN");

    const pending = await ctx.db
      .query("trustedDevices")
      .withIndex("by_challengeToken", (q) => q.eq("challengeToken", token))
      .unique();

    if (!pending || pending.status !== "pending") {
      throw new Error("INVALID_TOKEN");
    }
    if (
      !pending.challengeExpiresAt ||
      pending.challengeExpiresAt <= Date.now()
    ) {
      throw new Error("TOKEN_EXPIRED");
    }

    await approveDeviceRecord(ctx, pending, {
      approvedByUserId: adminUserId,
    });

    const targetUser = await ctx.db.get(pending.userId);
    return {
      ok: true,
      userName: targetUser?.name ?? targetUser?.email ?? null,
      label: pending.label ?? null,
    };
  },
});

export const listTrustedDevices = query({
  args: {},
  returns: v.array(
    v.object({
      id: v.id("trustedDevices"),
      userId: v.id("users"),
      userName: v.string(),
      userEmail: v.union(v.string(), v.null()),
      deviceId: v.string(),
      label: v.union(v.string(), v.null()),
      status: v.union(
        v.literal("pending"),
        v.literal("approved"),
        v.literal("revoked"),
      ),
      approvedAt: v.union(v.number(), v.null()),
      revokedAt: v.union(v.number(), v.null()),
      lastSeenAt: v.number(),
      createdAt: v.number(),
      challengeExpiresAt: v.union(v.number(), v.null()),
    }),
  ),
  handler: async (ctx) => {
    await requirePermission(ctx, MANAGE_DEVICES);
    const devices = await ctx.db.query("trustedDevices").take(500);
    const rows = [];
    for (const device of devices) {
      const user = await ctx.db.get(device.userId);
      rows.push({
        id: device._id,
        userId: device.userId,
        userName: user?.name ?? user?.email ?? "Utilisateur",
        userEmail: user?.email ?? null,
        deviceId: device.deviceId,
        label: device.label ?? null,
        status: device.status,
        approvedAt: device.approvedAt ?? null,
        revokedAt: device.revokedAt ?? null,
        lastSeenAt: device.lastSeenAt,
        createdAt: device.createdAt,
        challengeExpiresAt: device.challengeExpiresAt ?? null,
      });
    }
    rows.sort((a, b) => b.lastSeenAt - a.lastSeenAt);
    return rows;
  },
});

export const revokeDevice = mutation({
  args: {
    deviceRecordId: v.id("trustedDevices"),
    adminDeviceId: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ensureDefaultRbac(ctx);
    const { userId: adminUserId } = await requirePermission(
      ctx,
      MANAGE_DEVICES,
    );

    const adminApproved = await isDeviceApprovedForUser(
      ctx,
      adminUserId,
      args.adminDeviceId.trim(),
    );
    if (!adminApproved) {
      throw new Error("ADMIN_DEVICE_NOT_APPROVED");
    }

    const device = await ctx.db.get(args.deviceRecordId);
    if (!device) throw new Error("DEVICE_NOT_FOUND");
    if (device.status === "revoked") return null;

    // Prevent locking the store out when this is the last approved admin device.
    if (device.status === "approved") {
      const targetUser = await ctx.db.get(device.userId);
      const targetIsAdmin =
        targetUser !== null &&
        (await userHasPermission(ctx, targetUser, MANAGE_DEVICES));
      if (targetIsAdmin) {
        const approvedAdminCount = await countApprovedAdminDevices(ctx);
        if (approvedAdminCount <= 1) {
          throw new Error("LAST_ADMIN_DEVICE");
        }
      }
    }

    const now = Date.now();
    await ctx.db.patch(device._id, {
      status: "revoked",
      challengeToken: undefined,
      challengeExpiresAt: undefined,
      revokedAt: now,
      revokedByUserId: adminUserId,
      lastSeenAt: now,
    });

    await deleteAuthSession(ctx, device.authSessionId);
    return null;
  },
});
