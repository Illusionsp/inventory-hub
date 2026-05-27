import { Router } from "express";
import { eq, and, desc, SQL } from "drizzle-orm";
import { db, notificationsTable } from "@workspace/db";
import { requireAuth } from "../lib/auth";
import { registerSseClient, unregisterSseClient } from "../lib/sseClients";
import { sql } from "drizzle-orm";

const router = Router();

router.get("/notifications", requireAuth, async (req, res): Promise<void> => {
  const { unreadOnly, page = "1" } = req.query as Record<string, string>;
  const userId = req.session.userId!;
  const pageNum = parseInt(page, 10);
  const limitNum = 50;
  const offset = (pageNum - 1) * limitNum;

  const conditions: SQL[] = [eq(notificationsTable.userId, userId)];
  if (unreadOnly === "true") conditions.push(eq(notificationsTable.isRead, false));
  const where = and(...conditions);

  const rows = await db
    .select()
    .from(notificationsTable)
    .where(where)
    .orderBy(desc(notificationsTable.createdAt))
    .limit(limitNum)
    .offset(offset);

  const total = await db.$count(notificationsTable, where);
  const [unreadResult] = await db
    .select({ count: sql<number>`count(*)` })
    .from(notificationsTable)
    .where(and(eq(notificationsTable.userId, userId), eq(notificationsTable.isRead, false)));

  res.json({ data: rows, total, unreadCount: Number(unreadResult?.count ?? 0) });
});

/**
 * SSE endpoint — pushes real-time notification events to the connected client.
 * The frontend connects via fetch+ReadableStream with an Authorization header
 * (Bearer token from sessionStorage), so requireAuth works as normal.
 */
router.get("/notifications/stream", requireAuth, (req, res): void => {
  const userId = req.session.userId!;

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders();

  res.write(`data: ${JSON.stringify({ type: "connected" })}\n\n`);

  registerSseClient(userId, res);

  const heartbeat = setInterval(() => {
    try {
      res.write(`data: ${JSON.stringify({ type: "heartbeat" })}\n\n`);
    } catch {
      clearInterval(heartbeat);
    }
  }, 25_000);

  req.on("close", () => {
    clearInterval(heartbeat);
    unregisterSseClient(userId, res);
  });
});

router.patch("/notifications/:id/read", requireAuth, async (req, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  const userId = req.session.userId!;
  const [n] = await db
    .update(notificationsTable)
    .set({ isRead: true })
    .where(and(eq(notificationsTable.id, id), eq(notificationsTable.userId, userId)))
    .returning();
  if (!n) { res.status(404).json({ error: "Not found" }); return; }
  res.json(n);
});

router.post("/notifications/read-all", requireAuth, async (req, res): Promise<void> => {
  const userId = req.session.userId!;
  await db
    .update(notificationsTable)
    .set({ isRead: true })
    .where(and(eq(notificationsTable.userId, userId), eq(notificationsTable.isRead, false)));
  res.json({ success: true });
});

export default router;
