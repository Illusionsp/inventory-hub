import { Router } from "express";
import { eq, and, SQL } from "drizzle-orm";
import { db, grnsTable, grnItemsTable, suppliersTable, storesTable, usersTable, inventoryTable, inventoryMovementsTable } from "@workspace/db";
import { requireAuth } from "../lib/auth";

const router = Router();

let grnCounter = 1000;

async function nextGrnNumber(): Promise<string> {
  const rows = await db.select({ id: grnsTable.id }).from(grnsTable).orderBy(grnsTable.id);
  return `GRN-${String((rows.length + 1001)).padStart(6, "0")}`;
}

router.get("/grns", requireAuth, async (req, res): Promise<void> => {
  const { status, supplierId, startDate, endDate, page = "1", limit = "20" } = req.query as Record<string, string>;
  const pageNum = parseInt(page, 10);
  const limitNum = parseInt(limit, 10);
  const offset = (pageNum - 1) * limitNum;

  const conditions: SQL[] = [];
  if (status) conditions.push(eq(grnsTable.status, status));
  if (supplierId) conditions.push(eq(grnsTable.supplierId, parseInt(supplierId, 10)));

  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const rows = await db
    .select({
      id: grnsTable.id, grnNumber: grnsTable.grnNumber, status: grnsTable.status,
      supplierId: grnsTable.supplierId, supplierName: suppliersTable.name,
      storeId: grnsTable.storeId, storeName: storesTable.name,
      invoiceNumber: grnsTable.invoiceNumber, poNumber: grnsTable.poNumber,
      deliveryNoteNumber: grnsTable.deliveryNoteNumber, receivedDate: grnsTable.receivedDate,
      totalCost: grnsTable.totalCost, notes: grnsTable.notes,
      approvedById: grnsTable.approvedById, approvedAt: grnsTable.approvedAt,
      rejectionReason: grnsTable.rejectionReason, createdAt: grnsTable.createdAt,
    })
    .from(grnsTable)
    .leftJoin(suppliersTable, eq(grnsTable.supplierId, suppliersTable.id))
    .leftJoin(storesTable, eq(grnsTable.storeId, storesTable.id))
    .where(where)
    .limit(limitNum)
    .offset(offset);

  const total = await db.$count(grnsTable, where);
  const data = rows.map(r => ({ ...r, approverName: null, items: [] }));
  res.json({ data, total, page: pageNum, limit: limitNum });
});

router.post("/grns", requireAuth, async (req, res): Promise<void> => {
  const { supplierId, storeId, invoiceNumber, poNumber, deliveryNoteNumber, receivedDate, notes, items } = req.body;
  if (!supplierId || !storeId || !receivedDate || !items?.length) {
    res.status(400).json({ error: "Missing required fields" });
    return;
  }

  const totalCost = items.reduce((s: number, i: { totalCost: number }) => s + Number(i.totalCost), 0);
  const grnNumber = await nextGrnNumber();

  const [grn] = await db.insert(grnsTable).values({
    grnNumber, supplierId, storeId, invoiceNumber: invoiceNumber ?? null, poNumber: poNumber ?? null,
    deliveryNoteNumber: deliveryNoteNumber ?? null, receivedDate, totalCost: totalCost.toString(),
    notes: notes ?? null, createdById: req.session.userId,
  }).returning();

  for (const item of items) {
    await db.insert(grnItemsTable).values({
      grnId: grn.id, productId: item.productId, quantity: item.quantity.toString(),
      unit: item.unit, unitCost: item.unitCost.toString(), totalCost: item.totalCost.toString(),
      batchNumber: item.batchNumber ?? null, expiryDate: item.expiryDate ?? null,
    });
  }

  res.status(201).json({ ...grn, supplierName: null, storeName: null, approverName: null, items });
});

router.get("/grns/:id", requireAuth, async (req, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);

  const rows = await db
    .select({
      id: grnsTable.id, grnNumber: grnsTable.grnNumber, status: grnsTable.status,
      supplierId: grnsTable.supplierId, supplierName: suppliersTable.name,
      storeId: grnsTable.storeId, storeName: storesTable.name,
      invoiceNumber: grnsTable.invoiceNumber, poNumber: grnsTable.poNumber,
      deliveryNoteNumber: grnsTable.deliveryNoteNumber, receivedDate: grnsTable.receivedDate,
      totalCost: grnsTable.totalCost, notes: grnsTable.notes,
      createdById: grnsTable.createdById,
      approvedById: grnsTable.approvedById, approvedAt: grnsTable.approvedAt,
      rejectionReason: grnsTable.rejectionReason, createdAt: grnsTable.createdAt,
    })
    .from(grnsTable)
    .leftJoin(suppliersTable, eq(grnsTable.supplierId, suppliersTable.id))
    .leftJoin(storesTable, eq(grnsTable.storeId, storesTable.id))
    .where(eq(grnsTable.id, id));

  if (!rows.length) { res.status(404).json({ error: "Not found" }); return; }
  const grn = rows[0];

  let createdByName: string | null = null;
  let approverName: string | null = null;

  if (grn.createdById) {
    const [u] = await db.select({ name: usersTable.name }).from(usersTable).where(eq(usersTable.id, grn.createdById));
    if (u) createdByName = u.name;
  }
  if (grn.approvedById) {
    const [u] = await db.select({ name: usersTable.name }).from(usersTable).where(eq(usersTable.id, grn.approvedById));
    if (u) approverName = u.name;
  }

  const items = await db.select().from(grnItemsTable).where(eq(grnItemsTable.grnId, id));
  res.json({ ...grn, createdByName, approverName, items });
});

router.patch("/grns/:id", requireAuth, async (req, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  const updates: Record<string, unknown> = {};
  for (const f of ["invoiceNumber", "poNumber", "deliveryNoteNumber", "receivedDate", "notes"])
    if (req.body[f] !== undefined) updates[f] = req.body[f];
  const [grn] = await db.update(grnsTable).set(updates).where(eq(grnsTable.id, id)).returning();
  if (!grn) { res.status(404).json({ error: "Not found" }); return; }
  res.json({ ...grn, supplierName: null, storeName: null, approverName: null, items: [] });
});

router.post("/grns/:id/submit", requireAuth, async (req, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  const [grn] = await db.update(grnsTable).set({ status: "pending_approval" }).where(eq(grnsTable.id, id)).returning();
  if (!grn) { res.status(404).json({ error: "Not found" }); return; }
  res.json({ ...grn, supplierName: null, storeName: null, approverName: null, items: [] });
});

router.post("/grns/:id/approve", requireAuth, async (req, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  const [grn] = await db.update(grnsTable).set({ status: "approved", approvedById: req.session.userId, approvedAt: new Date() }).where(eq(grnsTable.id, id)).returning();
  if (!grn) { res.status(404).json({ error: "Not found" }); return; }

  // Update inventory
  const items = await db.select().from(grnItemsTable).where(eq(grnItemsTable.grnId, id));
  for (const item of items) {
    const [existing] = await db.select().from(inventoryTable).where(and(eq(inventoryTable.productId, item.productId), eq(inventoryTable.storeId, grn.storeId)));
    if (existing) {
      const newQty = (parseFloat(existing.quantity as string) + parseFloat(item.quantity as string)).toString();
      await db.update(inventoryTable).set({ quantity: newQty, updatedAt: new Date() }).where(eq(inventoryTable.id, existing.id));
    } else {
      await db.insert(inventoryTable).values({ productId: item.productId, storeId: grn.storeId, quantity: item.quantity });
    }
    await db.insert(inventoryMovementsTable).values({ productId: item.productId, storeId: grn.storeId, movementType: "grn_receipt", quantity: item.quantity, referenceId: id, referenceType: "grn", createdBy: req.session.userId });
  }

  res.json({ ...grn, supplierName: null, storeName: null, approverName: null, items });
});

router.post("/grns/:id/reject", requireAuth, async (req, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  const { notes } = req.body;
  const [grn] = await db.update(grnsTable).set({ status: "rejected", rejectionReason: notes ?? null }).where(eq(grnsTable.id, id)).returning();
  if (!grn) { res.status(404).json({ error: "Not found" }); return; }
  res.json({ ...grn, supplierName: null, storeName: null, approverName: null, items: [] });
});

router.post("/grns/:id/pay", requireAuth, async (req, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  const [grn] = await db.update(grnsTable).set({ status: "paid" }).where(eq(grnsTable.id, id)).returning();
  if (!grn) { res.status(404).json({ error: "Not found" }); return; }
  res.json({ ...grn, supplierName: null, storeName: null, approverName: null, items: [] });
});

export default router;
