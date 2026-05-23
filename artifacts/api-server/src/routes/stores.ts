import { Router } from "express";
import { eq } from "drizzle-orm";
import { db, storesTable } from "@workspace/db";
import { requireAuth } from "../lib/auth";

const router = Router();

router.get("/stores", requireAuth, async (_req, res): Promise<void> => {
  const stores = await db.select().from(storesTable);
  res.json(stores);
});

router.post("/stores", requireAuth, async (req, res): Promise<void> => {
  const { name, type, location, managerId } = req.body;
  if (!name || !type) { res.status(400).json({ error: "Missing required fields" }); return; }
  const [store] = await db.insert(storesTable).values({ name, type, location: location ?? null, managerId: managerId ?? null }).returning();
  res.status(201).json(store);
});

router.get("/stores/:id", requireAuth, async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  const [store] = await db.select().from(storesTable).where(eq(storesTable.id, id));
  if (!store) { res.status(404).json({ error: "Not found" }); return; }
  res.json(store);
});

router.patch("/stores/:id", requireAuth, async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  const updates: Record<string, unknown> = {};
  const fields = ["name", "location", "isActive", "managerId"];
  for (const f of fields) if (req.body[f] !== undefined) updates[f] = req.body[f];
  const [store] = await db.update(storesTable).set(updates).where(eq(storesTable.id, id)).returning();
  if (!store) { res.status(404).json({ error: "Not found" }); return; }
  res.json(store);
});

export default router;
