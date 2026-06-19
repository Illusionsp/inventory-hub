import { Router } from "express";
import { eq, and, SQL, desc } from "drizzle-orm";
import { db, auditLogsTable, usersTable } from "@workspace/db";
import { requireAuth } from "../lib/auth";

const router = Router();

router.get("/audit-logs", requireAuth, async (req, res): Promise<void> => {
  const { userId, entityType, action, page = "1", limit = "50" } = req.query as Record<string, string>;
  const pageNum = parseInt(page, 10);
  const limitNum = parseInt(limit, 10);
  const offset = (pageNum - 1) * limitNum;

  const conditions: SQL[] = [];
  if (userId) conditions.push(eq(auditLogsTable.userId, parseInt(userId, 10)));
  if (entityType) conditions.push(eq(auditLogsTable.entityType, entityType));
  if (action) conditions.push(eq(auditLogsTable.action, action));
  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const rows = await db
    .select({ id: auditLogsTable.id, userId: auditLogsTable.userId, userName: usersTable.name, action: auditLogsTable.action, entityType: auditLogsTable.entityType, entityId: auditLogsTable.entityId, changes: auditLogsTable.changes, ipAddress: auditLogsTable.ipAddress, createdAt: auditLogsTable.createdAt })
    .from(auditLogsTable)
    .leftJoin(usersTable, eq(auditLogsTable.userId, usersTable.id))
    .where(where)
    .orderBy(desc(auditLogsTable.createdAt))
    .limit(limitNum)
    .offset(offset);

  const total = await db.$count(auditLogsTable, where);
  res.json({ data: rows, total, page: pageNum, limit: limitNum });
});

export default router;
