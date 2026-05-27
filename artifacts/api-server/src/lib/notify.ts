import { eq } from "drizzle-orm";
import { db, notificationsTable, usersTable, getEffectivePermissions } from "@workspace/db";
import { pushSseToUser } from "./sseClients";

export interface NotifyOpts {
  title: string;
  message: string;
  type: string;
  entityType: string;
  entityId: number;
}

async function insertNotifications(targets: { id: number }[], opts: NotifyOpts): Promise<void> {
  const seen = new Set<number>();
  for (const u of targets) {
    if (seen.has(u.id)) continue;
    seen.add(u.id);
    const [notification] = await db.insert(notificationsTable).values({
      userId: u.id,
      type: opts.type,
      title: opts.title,
      message: opts.message,
      entityType: opts.entityType,
      entityId: opts.entityId,
    }).returning();
    if (notification) pushSseToUser(u.id, { type: "new_notification", notification });
  }
}

/**
 * Notify every active user who holds a specific permission.
 * super_admin users are always included (globally).
 * Other users are scoped to `storeId` when provided.
 * Effective permissions are computed from role defaults + custom overrides.
 */
export async function notifyByPermission(
  permission: string,
  storeId: number | null,
  opts: NotifyOpts,
): Promise<void> {
  const allUsers = await db
    .select({
      id: usersTable.id,
      role: usersTable.role,
      permissions: usersTable.permissions,
      storeId: usersTable.storeId,
    })
    .from(usersTable)
    .where(eq(usersTable.isActive, true));

  const targets = allUsers.filter(u => {
    if (u.role === "super_admin") return true;
    if (storeId != null && u.storeId !== storeId) return false;
    return getEffectivePermissions(u).includes(permission);
  });

  await insertNotifications(targets, opts);
}

/**
 * Notify every active user whose role is in `roles`.
 * super_admin users are always targeted globally (no store filter).
 * Other roles are scoped to `storeId` when provided.
 * @deprecated Prefer notifyByPermission for workflow steps.
 */
export async function notifyUsers(
  roles: string[],
  storeId: number | null,
  opts: NotifyOpts,
): Promise<void> {
  const allUsers = await db
    .select({ id: usersTable.id, role: usersTable.role, storeId: usersTable.storeId })
    .from(usersTable)
    .where(eq(usersTable.isActive, true));

  const targets = allUsers.filter(u => {
    if (!roles.includes(u.role)) return false;
    if (u.role === "super_admin") return true;
    return storeId == null || u.storeId === storeId;
  });

  await insertNotifications(targets, opts);
}
