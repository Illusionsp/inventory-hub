import { Router } from "express";
import { db, categoriesTable } from "@workspace/db";
import { requireAuth } from "../lib/auth";

const router = Router();

router.get("/categories", requireAuth, async (_req, res): Promise<void> => {
  const cats = await db.select().from(categoriesTable);
  res.json(cats);
});

router.post("/categories", requireAuth, async (req, res): Promise<void> => {
  const { name, description } = req.body;
  if (!name) { res.status(400).json({ error: "Name required" }); return; }
  const [cat] = await db.insert(categoriesTable).values({ name, description: description ?? null }).returning();
  res.status(201).json(cat);
});

export default router;
