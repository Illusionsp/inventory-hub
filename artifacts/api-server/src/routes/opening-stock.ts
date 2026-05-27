import { Router } from "express";
import { eq, and, SQL, ilike } from "drizzle-orm";
import { db, openingStockTable, productsTable, inventoryTable, inventoryMovementsTable } from "@workspace/db";
import { requireAuth } from "../lib/auth";

const router = Router();

router.get("/opening-stock", requireAuth, async (req, res): Promise<void> => {
  const { storeId, page = "1", limit = "50" } = req.query as Record<string, string>;
  const pageNum = parseInt(page, 10);
  const limitNum = parseInt(limit, 10);
  const offset = (pageNum - 1) * limitNum;
  const conditions: SQL[] = [];
  if (storeId) conditions.push(eq(openingStockTable.storeId, parseInt(storeId, 10)));
  const where = conditions.length > 0 ? and(...conditions) : undefined;
  const rows = await db.select().from(openingStockTable).where(where).orderBy(openingStockTable.createdAt).limit(limitNum).offset(offset);
  const total = await db.$count(openingStockTable, where);
  res.json({ data: rows, total, page: pageNum, limit: limitNum });
});

router.post("/opening-stock", requireAuth, async (req, res): Promise<void> => {
  const { storeId, itemName, quantity, unit, stockType, batchDetails, entryDate, notes } = req.body;

  if (!storeId || !itemName || !quantity || !unit || !entryDate) {
    res.status(400).json({ error: "storeId, itemName, quantity, unit, and entryDate are required" });
    return;
  }

  // Find or create the product by name (case-insensitive)
  let productId: number;
  const [found] = await db
    .select({ id: productsTable.id })
    .from(productsTable)
    .where(ilike(productsTable.name, String(itemName).trim()));

  if (found) {
    productId = found.id;
  } else {
    const [created] = await db
      .insert(productsTable)
      .values({
        name: String(itemName).trim(),
        type: stockType ?? "raw_material",
        unit,
        reorderLevel: "0",
      })
      .returning({ id: productsTable.id });
    productId = created.id;
  }

  // Prevent duplicate: same product + same store already has an opening_stock entry
  const [duplicate] = await db
    .select({ id: openingStockTable.id })
    .from(openingStockTable)
    .where(and(
      eq(openingStockTable.storeId, parseInt(storeId, 10)),
      eq(openingStockTable.productId, productId),
    ));

  if (duplicate) {
    res.status(409).json({ error: `Opening stock for "${itemName}" in this store has already been registered (entry #${duplicate.id}). Edit the existing entry or use a different item name.` });
    return;
  }

  // Insert opening stock record
  const [record] = await db.insert(openingStockTable).values({
    storeId: parseInt(storeId, 10),
    productId,
    itemName: String(itemName).trim(),
    quantity: quantity.toString(),
    unit,
    stockType: stockType ?? "raw_material",
    batchDetails: batchDetails ?? null,
    entryDate,
    notes: notes ?? null,
    createdBy: req.session.userId,
  }).returning();

  // Update inventory — upsert
  const [inv] = await db
    .select()
    .from(inventoryTable)
    .where(and(eq(inventoryTable.productId, productId), eq(inventoryTable.storeId, parseInt(storeId, 10))));

  if (inv) {
    const newQty = (parseFloat(inv.quantity as string) + parseFloat(quantity.toString())).toString();
    await db.update(inventoryTable).set({ quantity: newQty, updatedAt: new Date() }).where(eq(inventoryTable.id, inv.id));
  } else {
    await db.insert(inventoryTable).values({ productId, storeId: parseInt(storeId, 10), quantity: quantity.toString() });
  }

  // Movement record
  await db.insert(inventoryMovementsTable).values({
    productId,
    storeId: parseInt(storeId, 10),
    movementType: "opening_stock",
    quantity: quantity.toString(),
    referenceId: record.id,
    referenceType: "opening_stock",
    createdBy: req.session.userId,
  });

  res.status(201).json(record);
});

export default router;
