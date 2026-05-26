import { Router } from "express";
import { eq, and, SQL } from "drizzle-orm";
import { db, productionBatchesTable, productionInputsTable, productionOutputsTable, inventoryTable, inventoryMovementsTable } from "@workspace/db";
import { requireAuth, requirePermission } from "../lib/auth";

const router = Router();

async function nextBatchNumber(): Promise<string> {
  const rows = await db.select({ id: productionBatchesTable.id }).from(productionBatchesTable);
  return `BAT-${String((rows.length + 1001)).padStart(6, "0")}`;
}

router.get("/production-batches", requireAuth, async (req, res): Promise<void> => {
  const { status, page = "1", limit = "20" } = req.query as Record<string, string>;
  const pageNum = parseInt(page, 10);
  const limitNum = parseInt(limit, 10);
  const offset = (pageNum - 1) * limitNum;
  const conditions: SQL[] = [];
  if (status) conditions.push(eq(productionBatchesTable.status, status));
  const where = conditions.length > 0 ? and(...conditions) : undefined;
  const rows = await db.select().from(productionBatchesTable).where(where).limit(limitNum).offset(offset);
  const total = await db.$count(productionBatchesTable, where);
  const data = rows.map(r => ({ ...r, responsibleUserName: null, inputMaterials: [], outputProducts: [] }));
  res.json({ data, total, page: pageNum, limit: limitNum });
});

router.post("/production-batches", requireAuth, requirePermission("can_create_batch_production"), async (req, res): Promise<void> => {
  const { type, stageFromStoreId, stageToStoreId, plannedOutputQty, productionDate, responsibleUserId, notes, inputMaterials } = req.body;
  if (!type || !stageFromStoreId || !stageToStoreId || !plannedOutputQty) {
    res.status(400).json({ error: "Missing required fields" });
    return;
  }
  const batchNumber = await nextBatchNumber();
  const [batch] = await db.insert(productionBatchesTable).values({
    batchNumber, type, stageFromStoreId, stageToStoreId, plannedOutputQty: plannedOutputQty.toString(),
    productionDate: productionDate ?? null, responsibleUserId: responsibleUserId ?? null, notes: notes ?? null,
  }).returning();

  for (const mat of (inputMaterials ?? [])) {
    await db.insert(productionInputsTable).values({ batchId: batch.id, productId: mat.productId, quantity: mat.quantity.toString(), unit: mat.unit });
    // Deduct from source store
    const [inv] = await db.select().from(inventoryTable).where(and(eq(inventoryTable.productId, mat.productId), eq(inventoryTable.storeId, stageFromStoreId)));
    if (inv) {
      const newQty = Math.max(0, parseFloat(inv.quantity as string) - parseFloat(mat.quantity.toString())).toString();
      await db.update(inventoryTable).set({ quantity: newQty, updatedAt: new Date() }).where(eq(inventoryTable.id, inv.id));
    }
    await db.insert(inventoryMovementsTable).values({ productId: mat.productId, storeId: stageFromStoreId, movementType: "production_input", quantity: (-parseFloat(mat.quantity.toString())).toString(), referenceId: batch.id, referenceType: "production_batch", createdBy: req.session.userId });
  }

  const inputs = await db.select().from(productionInputsTable).where(eq(productionInputsTable.batchId, batch.id));
  res.status(201).json({ ...batch, responsibleUserName: null, inputMaterials: inputs, outputProducts: [] });
});

router.get("/production-batches/:id", requireAuth, async (req, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  const [batch] = await db.select().from(productionBatchesTable).where(eq(productionBatchesTable.id, id));
  if (!batch) { res.status(404).json({ error: "Not found" }); return; }
  const inputs = await db.select().from(productionInputsTable).where(eq(productionInputsTable.batchId, id));
  const outputs = await db.select().from(productionOutputsTable).where(eq(productionOutputsTable.batchId, id));
  res.json({ ...batch, responsibleUserName: null, inputMaterials: inputs, outputProducts: outputs });
});

router.post("/production-batches/:id/complete", requireAuth, async (req, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  const { actualOutputQty, wastageQty, notes, outputProducts } = req.body;
  const [batch] = await db.select().from(productionBatchesTable).where(eq(productionBatchesTable.id, id));
  if (!batch) { res.status(404).json({ error: "Not found" }); return; }

  const plannedQty = parseFloat(batch.plannedOutputQty as string);
  const actual = parseFloat(actualOutputQty.toString());
  const wastage = parseFloat(wastageQty.toString());
  const yieldPct = ((actual / plannedQty) * 100).toFixed(2);
  const wastagePct = ((wastage / plannedQty) * 100).toFixed(2);

  const [updated] = await db.update(productionBatchesTable).set({
    status: "completed", actualOutputQty: actualOutputQty.toString(), wastageQty: wastageQty.toString(),
    wastagePercent: wastagePct, yieldPercent: yieldPct, completedAt: new Date(), notes: notes ?? batch.notes,
  }).where(eq(productionBatchesTable.id, id)).returning();

  for (const out of (outputProducts ?? [])) {
    await db.insert(productionOutputsTable).values({ batchId: id, productId: out.productId, quantity: out.quantity.toString(), unit: out.unit });
    const [inv] = await db.select().from(inventoryTable).where(and(eq(inventoryTable.productId, out.productId), eq(inventoryTable.storeId, batch.stageToStoreId)));
    if (inv) {
      const newQty = (parseFloat(inv.quantity as string) + parseFloat(out.quantity.toString())).toString();
      await db.update(inventoryTable).set({ quantity: newQty, updatedAt: new Date() }).where(eq(inventoryTable.id, inv.id));
    } else {
      await db.insert(inventoryTable).values({ productId: out.productId, storeId: batch.stageToStoreId, quantity: out.quantity.toString() });
    }
    await db.insert(inventoryMovementsTable).values({ productId: out.productId, storeId: batch.stageToStoreId, movementType: "production_output", quantity: out.quantity.toString(), referenceId: id, referenceType: "production_batch", createdBy: req.session.userId });
  }

  const inputs = await db.select().from(productionInputsTable).where(eq(productionInputsTable.batchId, id));
  const outputs = await db.select().from(productionOutputsTable).where(eq(productionOutputsTable.batchId, id));
  res.json({ ...updated, responsibleUserName: null, inputMaterials: inputs, outputProducts: outputs });
});

export default router;
