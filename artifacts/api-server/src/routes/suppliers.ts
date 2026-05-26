import { Router } from "express";
import { eq, ilike, and, SQL } from "drizzle-orm";
import { db, suppliersTable, grnsTable } from "@workspace/db";
import { requireAuth } from "../lib/auth";

const router = Router();

router.get("/suppliers", requireAuth, async (req, res): Promise<void> => {
  const { search, page = "1", limit = "50" } = req.query as Record<string, string>;
  const pageNum = parseInt(page, 10);
  const limitNum = parseInt(limit, 10);
  const offset = (pageNum - 1) * limitNum;
  const conditions: SQL[] = [];
  if (search) conditions.push(ilike(suppliersTable.name, `%${search}%`));
  const where = conditions.length > 0 ? and(...conditions) : undefined;
  const rows = await db.select().from(suppliersTable).where(where).limit(limitNum).offset(offset);
  const total = await db.$count(suppliersTable, where);
  res.json({ data: rows, total, page: pageNum, limit: limitNum });
});

router.post("/suppliers", requireAuth, async (req, res): Promise<void> => {
  const { name, contactPerson, email, phone, address, taxNumber } = req.body;
  if (!name) { res.status(400).json({ error: "Name required" }); return; }
  const [s] = await db.insert(suppliersTable).values({ name, contactPerson: contactPerson ?? null, email: email ?? null, phone: phone ?? null, address: address ?? null, taxNumber: taxNumber ?? null }).returning();
  res.status(201).json(s);
});

router.get("/suppliers/:id", requireAuth, async (req, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  const [s] = await db.select().from(suppliersTable).where(eq(suppliersTable.id, id));
  if (!s) { res.status(404).json({ error: "Not found" }); return; }
  res.json(s);
});

router.patch("/suppliers/:id", requireAuth, async (req, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  const updates: Record<string, unknown> = {};
  for (const f of ["name", "contactPerson", "email", "phone", "address", "taxNumber", "isActive"])
    if (req.body[f] !== undefined) updates[f] = req.body[f];
  const [s] = await db.update(suppliersTable).set(updates).where(eq(suppliersTable.id, id)).returning();
  if (!s) { res.status(404).json({ error: "Not found" }); return; }
  res.json(s);
});

router.delete("/suppliers/:id", requireAuth, async (req, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const [s] = await db.select({ id: suppliersTable.id }).from(suppliersTable).where(eq(suppliersTable.id, id));
  if (!s) { res.status(404).json({ error: "Not found" }); return; }

  const grnCount = await db.$count(grnTable, eq(grnTable.supplierId, id));
  if (grnCount > 0) {
    res.status(409).json({
      error: `Cannot delete: this supplier has ${grnCount} GRN record(s). Deactivate them instead to preserve history.`,
    });
    return;
  }

  await db.delete(suppliersTable).where(eq(suppliersTable.id, id));
  res.status(204).end();
});

export default router;
