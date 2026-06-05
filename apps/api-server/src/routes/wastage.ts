import { Router } from "express";
import { eq, and, or, inArray, SQL } from "drizzle-orm";
import {
    db,
    productionBatchesTable, productionInputsTable,
    productsTable, storesTable,
} from "@workspace/db";
import { requireAuth } from "../lib/auth";

const router = Router();

router.get("/wastage-report", requireAuth, async (req, res): Promise<void> => {
    const from = req.query.from as string | undefined;
    const to = req.query.to as string | undefined;
    const storeIdStr = req.query.storeId as string | undefined;
    const productIdStr = req.query.productId as string | undefined;
    const groupBy = (req.query.groupBy as string) || "daily";

    const today = new Date();
    const dateFrom = from || `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-01`;
    const dateTo = to || `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

    try {
        const conditions: SQL[] = [eq(productionBatchesTable.status, "completed")];
        if (storeIdStr) {
            const sid = parseInt(storeIdStr, 10);
            if (!isNaN(sid)) {
                conditions.push(or(
                    eq(productionBatchesTable.stageFromStoreId, sid),
                    eq(productionBatchesTable.stageToStoreId, sid),
                )!);
            }
        }

        const batches = await db
            .select()
            .from(productionBatchesTable)
            .where(and(...conditions));

        // In-memory date filtering
        const filteredByDate = batches.filter(b => {
            if (!b.completedAt) return false;
            const completedStr = new Date(b.completedAt).toISOString().split("T")[0];
            if (from && completedStr < from) return false;
            if (to && completedStr > to) return false;
            return true;
        });

        const batchIdList = filteredByDate.map(b => b.id);

        // Fetch inputs
        const allInputs = batchIdList.length > 0
            ? await db
                .select({
                    batchId: productionInputsTable.batchId,
                    productId: productionInputsTable.productId,
                    quantity: productionInputsTable.quantity,
                    unit: productionInputsTable.unit,
                    productName: productsTable.name,
                })
                .from(productionInputsTable)
                .leftJoin(productsTable, eq(productionInputsTable.productId, productsTable.id))
                .where(inArray(productionInputsTable.batchId, batchIdList))
            : [];

        let filteredIds = new Set(batchIdList);
        if (productIdStr) {
            const pid = parseInt(productIdStr, 10);
            if (!isNaN(pid)) {
                const matching = new Set(allInputs.filter(i => i.productId === pid).map(i => i.batchId));
                filteredIds = matching;
            }
        }

        const filteredBatches = batches.filter(b => filteredIds.has(b.id));
        const filteredInputs = allInputs.filter(i => filteredIds.has(i.batchId));

        // Resolve stores
        const usedStoreIds = [...new Set([...filteredBatches.map(b => b.stageFromStoreId), ...filteredBatches.map(b => b.stageToStoreId)])];
        const storeNames: Record<number, string> = {};
        if (usedStoreIds.length > 0) {
            const stores = await db.select({ id: storesTable.id, name: storesTable.name }).from(storesTable).where(inArray(storesTable.id, usedStoreIds));
            for (const s of stores) storeNames[s.id] = s.name;
        }

        const safeNum = (v: any) => {
            const n = parseFloat(String(v || 0));
            return isNaN(n) ? 0 : n;
        };

        let tIn = 0, tOut = 0, tWast = 0, wSum = 0, ySum = 0, pCnt = 0;
        for (const i of filteredInputs) tIn += safeNum(i.quantity);
        for (const b of filteredBatches) {
            tOut += safeNum(b.actualOutputQty);
            tWast += safeNum(b.wastageQty);
            if (b.wastagePercent != null) {
                wSum += safeNum(b.wastagePercent);
                ySum += safeNum(b.yieldPercent);
                pCnt++;
            }
        }

        res.json({
            from: dateFrom,
            to: dateTo,
            summary: {
                totalBatches: filteredBatches.length,
                totalInputQty: tIn,
                totalOutputQty: tOut,
                totalWastageQty: tWast,
                avgWastagePercent: pCnt > 0 ? wSum / pCnt : 0,
                avgYieldPercent: pCnt > 0 ? ySum / pCnt : 0,
            },
            byBatch: filteredBatches.map(b => ({
                ...b,
                storeFromName: storeNames[b.stageFromStoreId] ?? null,
                storeToName: storeNames[b.stageToStoreId] ?? null,
            })),
        });
    } catch (err: any) {
        res.status(500).json({ status: "error", message: err.message });
    }
});

export default router;
