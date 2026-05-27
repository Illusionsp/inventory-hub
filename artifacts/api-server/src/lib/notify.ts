import { and, eq, inArray } from "drizzle-orm";
import { db, notificationsTable, usersTable } from "@workspace/db";

export interface NotifyOpts {
  title: string;
  message: string;
  type: string;
  entityType: string;
  entityId: number;
}

/**
 * Insert a notification for every active user whose role is in `roles`.
 * super_admin users are always targeted globally (no store filter).
 * Other roles are scoped to `storeId` when provided.
 */
export async function notifyUsers(
  roles: string[],
  storeId: number | null,
  opts: NotifyOpts,
): Promise<void> {
  const admins = roles.includes("super_admin")
    ? await db.select({ id: usersTable.id })
        .from(usersTable)
        .where(and(eq(usersTable.role, "super_admin"), eq(usersTable.isActive, true)))
    : [];

  const otherRoles = roles.filter(r => r !== "super_admin");
  let others: { id: number }[] = [];
  if (otherRoles.length > 0) {
    others = storeId != null
      ? await db.select({ id: usersTable.id })
          .from(usersTable)
          .where(and(inArray(usersTable.role, otherRoles), eq(usersTable.storeId, storeId), eq(usersTable.isActive, true)))
      : await db.select({ id: usersTable.id })
          .from(usersTable)
          .where(and(inArray(usersTable.role, otherRoles), eq(usersTable.isActive, true)));
  }

  const seen = new Set<number>();
  for (const u of [...admins, ...others]) {
    if (seen.has(u.id)) continue;
    seen.add(u.id);
    await db.insert(notificationsTable).values({
      userId: u.id,
      type: opts.type,
      title: opts.title,
      message: opts.message,
      entityType: opts.entityType,
      entityId: opts.entityId,
    });
  }
}
