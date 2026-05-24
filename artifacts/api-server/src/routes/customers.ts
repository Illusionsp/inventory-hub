import { Router } from "express";
import { eq, ilike, and, SQL } from "drizzle-orm";
import { db, customersTable, salesTable, paymentsTable } from "@workspace/db";
import { requireAuth } from "../lib/auth";
import { sql } from "drizzle-orm";

const router = Router();

router.get("/customers", requireAuth, async (req, res): Promise<void> => {
  const { search, type, page = "1", limit = "50" } = req.query as Record<string, string>;
  const pageNum = parseInt(page, 10);
  const limitNum = parseInt(limit, 10);
  const offset = (pageNum - 1) * limitNum;

  const conditions: SQL[] = [];
  if (search) conditions.push(ilike(customersTable.name, `%${search}%`));
  if (type) conditions.push(eq(customersTable.type, type));
  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const rows = await db.select().from(customersTable).where(where).limit(limitNum).offset(offset);

  // FIX 1: Using the precise Drizzle syntax for conditional counting
  const total = await db.$count(customersTable, where);

  res.json({ data: rows, total, page: pageNum, limit: limitNum });
});

router.post("/customers", requireAuth, async (req, res): Promise<void> => {
  const { name, type, email, phone, address, taxNumber } = req.body;
  if (!name || !type) { res.status(400).json({ error: "Missing required fields" }); return; }

  const [c] = await db.insert(customersTable).values({ 
    name, 
    type, 
    email: email ?? null, 
    phone: phone ?? null, 
    address: address ?? null, 
    taxNumber: taxNumber ?? null 
  }).returning();

  res.status(201).json(c);
});

router.get("/customers/:id", requireAuth, async (req, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  const [c] = await db.select().from(customersTable).where(eq(customersTable.id, id));
  if (!c) { res.status(404).json({ error: "Not found" }); return; }
  res.json(c);
});

router.patch("/customers/:id", requireAuth, async (req, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);

  // FIX 2: Casting your dynamic update object to match the table's specific insert/update type schema
  const updates: Partial<typeof customersTable.$inferInsert> = {};

  const allowedFields = ["name", "type", "email", "phone", "address", "taxNumber", "isActive"] as const;
  for (const f of allowedFields) {
    if (req.body[f] !== undefined) {
      // Type casting helper to satisfy the index signature constraint safely
      (updates as Record<string, unknown>)[f] = req.body[f];
    }
  }

  const [c] = await db.update(customersTable).set(updates).where(eq(customersTable.id, id)).returning();
  if (!c) { res.status(404).json({ error: "Not found" }); return; }
  res.json(c);
});

router.delete("/customers/:id", requireAuth, async (req, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  const [c] = await db.select().from(customersTable).where(eq(customersTable.id, id));
  if (!c) { res.status(404).json({ error: "Not found" }); return; }
  await db.delete(customersTable).where(eq(customersTable.id, id));
  res.status(204).end();
});

router.get("/customers/:id/statement", requireAuth, async (req, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  const [customer] = await db.select().from(customersTable).where(eq(customersTable.id, id));
  if (!customer) { res.status(404).json({ error: "Not found" }); return; }

  const sales = await db.select().from(salesTable).where(eq(salesTable.customerId, id));
  const totalSales = sales.reduce((s, sale) => s + parseFloat(sale.totalAmount as string), 0);
  const totalPaid = sales.reduce((s, sale) => s + parseFloat(sale.paidAmount as string), 0);
  const outstandingBalance = totalSales - totalPaid;

  res.json({ customer, totalSales, totalPaid, outstandingBalance, sales });
});

export default router;