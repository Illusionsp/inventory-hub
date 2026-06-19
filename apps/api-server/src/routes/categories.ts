import { Router } from "express";
import { eq } from "drizzle-orm";
import { db, categoriesTable, productsTable } from "@workspace/db";
import { requireAuth } from "../lib/auth";

const router = Router();

router.get("/categories", requireAuth, async (_req, res): Promise<void> => {
  const cats = await db.select().from(categoriesTable);
  res.json(cats);
});

router.post("/categories", requireAuth, async (req, res): Promise<void> => {
  const { name, code, description } = req.body;
  if (!name) { res.status(400).json({ error: "Name required" }); return; }

  // Optional: check uniqueness manually to return a nice 409 error instead of a 500
  if (code) {
    const existing = await db.select({ id: categoriesTable.id }).from(categoriesTable).where(eq(categoriesTable.code, code)).limit(1);
    if (existing.length > 0) { res.status(409).json({ error: "Category code already in use" }); return; }
  }

  const [cat] = await db.insert(categoriesTable).values({
    name,
    code: code ?? null,
    description: description ?? null
  }).returning();
  res.status(201).json(cat);
});

router.delete("/categories/:id", requireAuth, async (req, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const products = await db.select({ id: productsTable.id }).from(productsTable)
    .where(eq(productsTable.categoryId, id)).limit(1);
  if (products.length > 0) {
    res.status(409).json({ error: "Cannot delete: category has products assigned to it. Reassign them first." });
    return;
  }

  await db.delete(categoriesTable).where(eq(categoriesTable.id, id));
  res.status(204).end();
});

export default router;
