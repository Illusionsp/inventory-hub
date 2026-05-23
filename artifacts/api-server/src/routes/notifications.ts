import { Router } from "express";
import { eq, and, SQL } from "drizzle-orm";
import { db, notificationsTable } from "@workspace/db";
import { requireAuth } from "../lib/auth";
import { sql } from "drizzle-orm";

const router = Router();

router.get("/notifications", requireAuth, async (req, res): Promise<void> => {
  const { unreadOnly, page = "1", limit = "20" } = req.query as Record<string, string>;
  const pageNum = parseInt(page, 10);
  const limitNum = parseInt(limit, 10);
  const offset = (pageNum - 1) * limitNum;

  const conditions: SQL[] = [];
  if (unreadOnly === "true") conditions.push(eq(notificationsTable.isRead, false));
  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const rows = await db.select().from(notificationsTable).where(where).orderBy(notificationsTable.createdAt).limit(limitNum).offset(offset);
  const total = await db.$count(notificationsTable, where);
  const [unreadCountResult] = await db.select({ count: sql<number>`count(*)` }).from(notificationsTable).where(eq(notificationsTable.isRead, false));

  res.json({ data: rows, total, unreadCount: Number(unreadCountResult?.count ?? 0) });
});

router.patch("/notifications/:id/read", requireAuth, async (req, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  const [n] = await db.update(notificationsTable).set({ isRead: true }).where(eq(notificationsTable.id, id)).returning();
  if (!n) { res.status(404).json({ error: "Not found" }); return; }
  res.json(n);
});

router.post("/notifications/read-all", requireAuth, async (_req, res): Promise<void> => {
  await db.update(notificationsTable).set({ isRead: true }).where(eq(notificationsTable.isRead, false));
  res.json({ success: true });
});

export default router;
