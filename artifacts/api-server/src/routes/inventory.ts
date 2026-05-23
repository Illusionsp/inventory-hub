import { Router } from "express";
import { eq, and, SQL, lte } from "drizzle-orm";
import { db, inventoryTable, inventoryMovementsTable, productsTable, storesTable } from "@workspace/db";
import { requireAuth } from "../lib/auth";

const router = Router();

router.get("/inventory", requireAuth, async (req, res): Promise<void> => {
  const { storeId, productId, lowStock, page = "1", limit = "50" } = req.query as Record<string, string>;
  const pageNum = parseInt(page, 10);
  const limitNum = parseInt(limit, 10);
  const offset = (pageNum - 1) * limitNum;

  const conditions: SQL[] = [];
  if (storeId) conditions.push(eq(inventoryTable.storeId, parseInt(storeId, 10)));
  if (productId) conditions.push(eq(inventoryTable.productId, parseInt(productId, 10)));
  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const rows = await db
    .select({
      id: inventoryTable.id, productId: inventoryTable.productId, productName: productsTable.name,
      productType: productsTable.type, storeId: inventoryTable.storeId, storeName: storesTable.name,
      quantity: inventoryTable.quantity, unit: productsTable.unit, reorderLevel: productsTable.reorderLevel,
    })
    .from(inventoryTable)
    .leftJoin(productsTable, eq(inventoryTable.productId, productsTable.id))
    .leftJoin(storesTable, eq(inventoryTable.storeId, storesTable.id))
    .where(where)
    .limit(limitNum)
    .offset(offset);

  const total = await db.$count(inventoryTable, where);
  const data = rows.map(r => ({
    ...r,
    isLowStock: parseFloat(r.quantity as string) <= parseFloat(r.reorderLevel as string),
  })).filter(r => lowStock === "true" ? r.isLowStock : true);

  res.json({ data, total, page: pageNum, limit: limitNum });
});

router.get("/inventory/movements", requireAuth, async (req, res): Promise<void> => {
  const { storeId, productId, movementType, page = "1", limit = "50" } = req.query as Record<string, string>;
  const pageNum = parseInt(page, 10);
  const limitNum = parseInt(limit, 10);
  const offset = (pageNum - 1) * limitNum;

  const conditions: SQL[] = [];
  if (storeId) conditions.push(eq(inventoryMovementsTable.storeId, parseInt(storeId, 10)));
  if (productId) conditions.push(eq(inventoryMovementsTable.productId, parseInt(productId, 10)));
  if (movementType) conditions.push(eq(inventoryMovementsTable.movementType, movementType));
  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const rows = await db
    .select({
      id: inventoryMovementsTable.id, productId: inventoryMovementsTable.productId, productName: productsTable.name,
      storeId: inventoryMovementsTable.storeId, storeName: storesTable.name,
      movementType: inventoryMovementsTable.movementType, quantity: inventoryMovementsTable.quantity,
      referenceId: inventoryMovementsTable.referenceId, referenceType: inventoryMovementsTable.referenceType,
      notes: inventoryMovementsTable.notes, createdBy: inventoryMovementsTable.createdBy, createdAt: inventoryMovementsTable.createdAt,
    })
    .from(inventoryMovementsTable)
    .leftJoin(productsTable, eq(inventoryMovementsTable.productId, productsTable.id))
    .leftJoin(storesTable, eq(inventoryMovementsTable.storeId, storesTable.id))
    .where(where)
    .orderBy(inventoryMovementsTable.createdAt)
    .limit(limitNum)
    .offset(offset);

  const total = await db.$count(inventoryMovementsTable, where);
  res.json({ data: rows, total, page: pageNum, limit: limitNum });
});

router.post("/inventory/adjustments", requireAuth, async (req, res): Promise<void> => {
  const { productId, storeId, quantity, reason, notes } = req.body;
  if (!productId || !storeId || quantity === undefined || !reason) {
    res.status(400).json({ error: "Missing required fields" });
    return;
  }

  const [existing] = await db.select().from(inventoryTable).where(and(eq(inventoryTable.productId, productId), eq(inventoryTable.storeId, storeId)));
  if (existing) {
    const newQty = (parseFloat(existing.quantity as string) + parseFloat(quantity.toString())).toString();
    await db.update(inventoryTable).set({ quantity: newQty, updatedAt: new Date() }).where(eq(inventoryTable.id, existing.id));
  } else {
    await db.insert(inventoryTable).values({ productId, storeId, quantity: quantity.toString() });
  }

  const [movement] = await db.insert(inventoryMovementsTable).values({
    productId, storeId, movementType: "adjustment", quantity: quantity.toString(), notes: `${reason}${notes ? `: ${notes}` : ""}`, createdBy: req.session.userId,
  }).returning();

  res.status(201).json({ ...movement, productName: null, storeName: null });
});

export default router;
