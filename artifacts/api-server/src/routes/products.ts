import { Router } from "express";
import { eq, ilike, and, SQL } from "drizzle-orm";
import { db, productsTable, categoriesTable } from "@workspace/db";
import { requireAuth } from "../lib/auth";

const router = Router();

router.get("/products", requireAuth, async (req, res): Promise<void> => {
  const { categoryId, type, search, page = "1", limit = "50" } = req.query as Record<string, string>;
  const pageNum = parseInt(page, 10);
  const limitNum = parseInt(limit, 10);
  const offset = (pageNum - 1) * limitNum;

  const conditions: SQL[] = [];
  if (categoryId) conditions.push(eq(productsTable.categoryId, parseInt(categoryId, 10)));
  if (type) conditions.push(eq(productsTable.type, type));
  if (search) conditions.push(ilike(productsTable.name, `%${search}%`));

  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const rows = await db
    .select({
      id: productsTable.id,
      name: productsTable.name,
      sku: productsTable.sku,
      type: productsTable.type,
      unit: productsTable.unit,
      categoryId: productsTable.categoryId,
      categoryName: categoriesTable.name,
      reorderLevel: productsTable.reorderLevel,
      unitCost: productsTable.unitCost,
      isActive: productsTable.isActive,
      createdAt: productsTable.createdAt,
    })
    .from(productsTable)
    .leftJoin(categoriesTable, eq(productsTable.categoryId, categoriesTable.id))
    .where(where)
    .limit(limitNum)
    .offset(offset);

  const total = await db.$count(productsTable, where);
  res.json({ data: rows, total, page: pageNum, limit: limitNum });
});

router.post("/products", requireAuth, async (req, res): Promise<void> => {
  const { name, sku, type, unit, categoryId, reorderLevel, unitCost } = req.body;
  if (!name || !type || !unit) { res.status(400).json({ error: "Missing required fields" }); return; }
  const [p] = await db.insert(productsTable).values({
    name, sku: sku ?? null, type, unit,
    categoryId: categoryId ?? null,
    reorderLevel: reorderLevel?.toString() ?? "0",
    unitCost: unitCost?.toString() ?? null,
  }).returning();
  res.status(201).json({ ...p, categoryName: null });
});

router.get("/products/:id", requireAuth, async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  const [row] = await db
    .select({ id: productsTable.id, name: productsTable.name, sku: productsTable.sku, type: productsTable.type, unit: productsTable.unit, categoryId: productsTable.categoryId, categoryName: categoriesTable.name, reorderLevel: productsTable.reorderLevel, unitCost: productsTable.unitCost, isActive: productsTable.isActive, createdAt: productsTable.createdAt })
    .from(productsTable)
    .leftJoin(categoriesTable, eq(productsTable.categoryId, categoriesTable.id))
    .where(eq(productsTable.id, id));
  if (!row) { res.status(404).json({ error: "Not found" }); return; }
  res.json(row);
});

router.patch("/products/:id", requireAuth, async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  const updates: Record<string, unknown> = {};
  const fields = ["name", "sku", "type", "unit", "categoryId", "isActive"];
  for (const f of fields) if (req.body[f] !== undefined) updates[f] = req.body[f];
  if (req.body.reorderLevel !== undefined) updates.reorderLevel = req.body.reorderLevel.toString();
  if (req.body.unitCost !== undefined) updates.unitCost = req.body.unitCost?.toString() ?? null;
  const [p] = await db.update(productsTable).set(updates).where(eq(productsTable.id, id)).returning();
  if (!p) { res.status(404).json({ error: "Not found" }); return; }
  res.json({ ...p, categoryName: null });
});

router.delete("/products/:id", requireAuth, async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  await db.delete(productsTable).where(eq(productsTable.id, id));
  res.sendStatus(204);
});

export default router;
