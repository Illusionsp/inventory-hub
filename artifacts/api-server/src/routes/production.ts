import { Router } from "express";
import { eq, and, SQL, ilike } from "drizzle-orm";
import { db, productionBatchesTable, productionInputsTable, productionOutputsTable, productsTable, inventoryTable, inventoryMovementsTable } from "@workspace/db";
import { requireAuth, requirePermission } from "../lib/auth";
import { notifyByPermission } from "../lib/notify";

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
  const { type, stageFromStoreId, stageToStoreId, plannedOutputQty, outputUnit, productionDate, responsibleUserId, notes, inputMaterials } = req.body;
  if (!type || !stageFromStoreId || !stageToStoreId || !plannedOutputQty) {
    res.status(400).json({ error: "Missing required fields" });
    return;
  }
  const batchNumber = await nextBatchNumber();
  const [batch] = await db.insert(productionBatchesTable).values({
    batchNumber, type, stageFromStoreId, stageToStoreId, plannedOutputQty: plannedOutputQty.toString(),
    outputUnit: outputUnit ?? "KG",
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

// Helper: convert a quantity in `fromUnit` to `toUnit` (g↔kg, ml↔L only)
function convertUnit(qty: number, fromUnit: string, toUnit: string): number {
  const from = fromUnit.toLowerCase();
  const to = toUnit.toLowerCase();
  if (from === to) return qty;
  if (from === "g" && to === "kg") return qty / 1000;
  if (from === "kg" && to === "g") return qty * 1000;
  if (from === "ml" && to === "l") return qty / 1000;
  if (from === "l" && to === "ml") return qty * 1000;
  if (from === "mg" && to === "g") return qty / 1000;
  if (from === "g" && to === "mg") return qty * 1000;
  return qty; // no conversion known — assume same unit
}

router.post("/production-batches/:id/complete", requireAuth, async (req, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  const { actualOutputQty, wastageQty, notes, outputProducts, finalProductName, packageType, packageSize, packageSizeUnit, packagesProduced } = req.body;
  const [batch] = await db.select().from(productionBatchesTable).where(eq(productionBatchesTable.id, id));
  if (!batch) { res.status(404).json({ error: "Not found" }); return; }

  const plannedQty = parseFloat(batch.plannedOutputQty as string);
  const actual = parseFloat(actualOutputQty.toString());
  const wastage = parseFloat(wastageQty.toString());
  const yieldPct = ((actual / plannedQty) * 100).toFixed(2);
  const wastagePct = ((wastage / plannedQty) * 100).toFixed(2);

  const hasPackaging = finalProductName && packageType && packageSize && packageSizeUnit && packagesProduced;

  const [updated] = await db.update(productionBatchesTable).set({
    status: "completed",
    actualOutputQty: actualOutputQty.toString(),
    wastageQty: wastageQty.toString(),
    wastagePercent: wastagePct,
    yieldPercent: yieldPct,
    completedAt: new Date(),
    notes: notes ?? batch.notes,
    finalProductName: finalProductName ?? null,
    packageType: packageType ?? null,
    packageSize: packageSize != null ? packageSize.toString() : null,
    packageSizeUnit: packageSizeUnit ?? null,
    packagesProduced: packagesProduced != null ? packagesProduced.toString() : null,
  }).where(eq(productionBatchesTable.id, id)).returning();

  // ── Bulk output products ──────────────────────────────────────────────────
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

  // ── Packaging conversion ──────────────────────────────────────────────────
  if (hasPackaging) {
    const pkgSize = parseFloat(packageSize.toString());
    const pkgCount = parseFloat(packagesProduced.toString());

    // Build canonical packaged product name, e.g. "Raw Honey 100g bottle"
    const pkgProductName = `${String(finalProductName).trim()} ${pkgSize}${String(packageSizeUnit).trim()} ${String(packageType).trim()}`;

    // Find or auto-create the packaged product
    let pkgProductId: number;
    const [foundPkg] = await db.select({ id: productsTable.id }).from(productsTable).where(ilike(productsTable.name, pkgProductName));
    if (foundPkg) {
      pkgProductId = foundPkg.id;
    } else {
      const [created] = await db.insert(productsTable).values({
        name: pkgProductName,
        type: "finished_good",
        unit: "pcs",
        reorderLevel: "0",
      }).returning({ id: productsTable.id });
      pkgProductId = created.id;
    }

    // Deduct bulk consumed from each bulk output (pro-rata across outputs)
    // Total bulk consumed = packagesProduced * packageSize, converted to the bulk output unit
    const bulkOutputs = outputProducts ?? [];
    if (bulkOutputs.length > 0) {
      const totalBulkQty = bulkOutputs.reduce((sum: number, o: any) => sum + parseFloat(o.quantity.toString()), 0);
      const bulkUnit = bulkOutputs[0].unit as string; // all outputs assumed same unit

      // Convert total packaged mass/volume to bulk unit
      const totalBulkConsumed = convertUnit(pkgCount * pkgSize, String(packageSizeUnit), bulkUnit);
      // Distribute deduction proportionally across outputs
      const ratio = totalBulkQty > 0 ? Math.min(totalBulkConsumed / totalBulkQty, 1) : 0;

      for (const out of bulkOutputs) {
        const deduct = parseFloat(out.quantity.toString()) * ratio;
        const [inv] = await db.select().from(inventoryTable).where(and(eq(inventoryTable.productId, out.productId), eq(inventoryTable.storeId, batch.stageToStoreId)));
        if (inv) {
          const newQty = Math.max(0, parseFloat(inv.quantity as string) - deduct).toString();
          await db.update(inventoryTable).set({ quantity: newQty, updatedAt: new Date() }).where(eq(inventoryTable.id, inv.id));
        }
        await db.insert(inventoryMovementsTable).values({ productId: out.productId, storeId: batch.stageToStoreId, movementType: "packaging_input", quantity: (-deduct).toString(), referenceId: id, referenceType: "production_batch", createdBy: req.session.userId });
      }
    }

    // Add packaged units to inventory
    const [pkgInv] = await db.select().from(inventoryTable).where(and(eq(inventoryTable.productId, pkgProductId), eq(inventoryTable.storeId, batch.stageToStoreId)));
    if (pkgInv) {
      const newQty = (parseFloat(pkgInv.quantity as string) + pkgCount).toString();
      await db.update(inventoryTable).set({ quantity: newQty, updatedAt: new Date() }).where(eq(inventoryTable.id, pkgInv.id));
    } else {
      await db.insert(inventoryTable).values({ productId: pkgProductId, storeId: batch.stageToStoreId, quantity: pkgCount.toString() });
    }
    await db.insert(inventoryMovementsTable).values({ productId: pkgProductId, storeId: batch.stageToStoreId, movementType: "packaging_output", quantity: pkgCount.toString(), referenceId: id, referenceType: "production_batch", createdBy: req.session.userId });
  }

  const inputs = await db.select().from(productionInputsTable).where(eq(productionInputsTable.batchId, id));
  const outputs = await db.select().from(productionOutputsTable).where(eq(productionOutputsTable.batchId, id));

  await notifyByPermission("can_create_batch_production", updated.stageToStoreId, {
    type: "production_completed", title: "Batch Completed — Ready to Dispatch",
    message: `Production batch ${updated.batchNumber} is complete and ready to be dispatched to the final product store.`,
    entityType: "production_batch", entityId: id,
  });

  res.json({ ...updated, responsibleUserName: null, inputMaterials: inputs, outputProducts: outputs });
});

// ── Dispatch finished products → target store ───────────────────────────────
router.post("/production-batches/:id/dispatch", requireAuth, async (req, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  const { targetStoreId } = req.body;

  if (!targetStoreId) { res.status(400).json({ error: "targetStoreId is required" }); return; }

  const [batch] = await db.select().from(productionBatchesTable).where(eq(productionBatchesTable.id, id));
  if (!batch) { res.status(404).json({ error: "Not found" }); return; }
  if (batch.status !== "completed") { res.status(400).json({ error: "Batch must be completed before dispatching" }); return; }
  if (batch.dispatchedAt) { res.status(409).json({ error: "Batch has already been dispatched" }); return; }

  const target = parseInt(targetStoreId.toString(), 10);

  // Collect everything credited to stageToStore by this batch (production_output + packaging_output)
  const credited = await db
    .select()
    .from(inventoryMovementsTable)
    .where(and(
      eq(inventoryMovementsTable.referenceId, id),
      eq(inventoryMovementsTable.referenceType, "production_batch"),
      eq(inventoryMovementsTable.storeId, batch.stageToStoreId),
    ));

  const outboundMovements = credited.filter(m =>
    m.movementType === "production_output" || m.movementType === "packaging_output"
  );

  for (const mv of outboundMovements) {
    const qty = parseFloat(mv.quantity as string);
    if (qty <= 0) continue;

    // Deduct from production/packaging store
    const [fromInv] = await db.select().from(inventoryTable).where(
      and(eq(inventoryTable.productId, mv.productId!), eq(inventoryTable.storeId, batch.stageToStoreId))
    );
    if (fromInv) {
      const newQty = Math.max(0, parseFloat(fromInv.quantity as string) - qty).toString();
      await db.update(inventoryTable).set({ quantity: newQty, updatedAt: new Date() }).where(eq(inventoryTable.id, fromInv.id));
    }
    await db.insert(inventoryMovementsTable).values({
      productId: mv.productId!, storeId: batch.stageToStoreId,
      movementType: "dispatch_out", quantity: (-qty).toString(),
      referenceId: id, referenceType: "production_batch", createdBy: req.session.userId,
    });

    // Add to target store
    const [toInv] = await db.select().from(inventoryTable).where(
      and(eq(inventoryTable.productId, mv.productId!), eq(inventoryTable.storeId, target))
    );
    if (toInv) {
      const newQty = (parseFloat(toInv.quantity as string) + qty).toString();
      await db.update(inventoryTable).set({ quantity: newQty, updatedAt: new Date() }).where(eq(inventoryTable.id, toInv.id));
    } else {
      await db.insert(inventoryTable).values({ productId: mv.productId!, storeId: target, quantity: qty.toString() });
    }
    await db.insert(inventoryMovementsTable).values({
      productId: mv.productId!, storeId: target,
      movementType: "dispatch_in", quantity: qty.toString(),
      referenceId: id, referenceType: "production_batch", createdBy: req.session.userId,
    });
  }

  const [updated] = await db.update(productionBatchesTable)
    .set({ dispatchedToStoreId: target, dispatchedAt: new Date() })
    .where(eq(productionBatchesTable.id, id))
    .returning();

  const inputs = await db.select().from(productionInputsTable).where(eq(productionInputsTable.batchId, id));
  const outputs = await db.select().from(productionOutputsTable).where(eq(productionOutputsTable.batchId, id));

  await notifyByPermission("can_manage_inventory", target, {
    type: "dispatch_received", title: "Finished Products Added to Your Store",
    message: `Products from batch ${updated.batchNumber} have been dispatched and added to your store's inventory. Ready for sale.`,
    entityType: "production_batch", entityId: id,
  });

  res.json({ ...updated, responsibleUserName: null, inputMaterials: inputs, outputProducts: outputs });
});

export default router;
