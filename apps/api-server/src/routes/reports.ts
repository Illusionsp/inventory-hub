import { Router } from "express";
import { eq, and, gte, lte, lt, or, inArray, SQL, desc, sql } from "drizzle-orm";
import {
  db,
  salesTable, customersTable,
  productionBatchesTable, productionInputsTable, productionOutputsTable,
  productsTable, storesTable,
} from "@workspace/db";
import { requireAuth } from "../lib/auth";

const router = Router();

// ── Sales Report ────────────────────────────────────────────────────────────
router.get("/reports/sales", requireAuth, async (req, res): Promise<void> => {
  const {
    from,
    to,
    groupBy = "daily",
    paymentType,
    paymentMethod,
    status,
  } = req.query as Record<string, string>;

  const today = new Date();
  const dateFrom = from || `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-01`;
  const dateTo = to || `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

  const conditions: SQL[] = [
    gte(sql`${salesTable.saleDate}::date`, sql`${dateFrom}::date`),
    lte(sql`${salesTable.saleDate}::date`, sql`${dateTo}::date`),
  ];
  if (paymentType) conditions.push(eq(salesTable.paymentType, paymentType));
  if (paymentMethod) conditions.push(eq(salesTable.paymentMethod, paymentMethod));
  if (status) conditions.push(eq(salesTable.status, status));

  const where = and(...conditions);

  const rows = await db
    .select({
      id: salesTable.id,
      invoiceNumber: salesTable.invoiceNumber,
      saleDate: salesTable.saleDate,
      customerId: salesTable.customerId,
      customerName: customersTable.name,
      fsNumber: salesTable.fsNumber,
      paymentType: salesTable.paymentType,
      paymentMethod: salesTable.paymentMethod,
      bankName: salesTable.bankName,
      status: salesTable.status,
      vatApplicable: salesTable.vatApplicable,
      subtotal: salesTable.subtotal,
      vatAmount: salesTable.vatAmount,
      withholdingAmount: salesTable.withholdingAmount,
      discountAmount: salesTable.discountAmount,
      totalAmount: salesTable.totalAmount,
      paidAmount: salesTable.paidAmount,
      balanceDue: salesTable.balanceDue,
      createdAt: salesTable.createdAt,
    })
    .from(salesTable)
    .leftJoin(customersTable, eq(salesTable.customerId, customersTable.id))
    .where(where)
    .orderBy(desc(salesTable.saleDate), desc(salesTable.createdAt)); // Native DB sort descending

  let totalRevenue = 0;
  let cashRevenue = 0;
  let creditRevenue = 0;
  let vatCollected = 0;
  let withholdingTotal = 0;
  let subtotalSum = 0;
  let discountTotal = 0;

  const buckets: Record<string, {
    invoiceCount: number;
    revenue: number;
    subtotal: number;
    vatAmount: number;
    withholdingAmount: number;
    cashRevenue: number;
    creditRevenue: number;
  }> = {};

  for (const row of rows) {
    const amt = parseFloat(String(row.totalAmount || 0));
    const vat = parseFloat(String(row.vatAmount || 0));
    const wht = parseFloat(String(row.withholdingAmount || 0));
    const sub = parseFloat(String(row.subtotal || 0));
    const disc = parseFloat(String(row.discountAmount || 0));

    totalRevenue += amt;
    vatCollected += vat;
    withholdingTotal += wht;
    subtotalSum += sub;
    discountTotal += disc;
    if (row.paymentType === "cash") cashRevenue += amt;
    else creditRevenue += amt;

    const period = groupBy === "monthly" ? row.saleDate.substring(0, 7) : row.saleDate;
    if (!buckets[period]) buckets[period] = { invoiceCount: 0, revenue: 0, subtotal: 0, vatAmount: 0, withholdingAmount: 0, cashRevenue: 0, creditRevenue: 0 };
    buckets[period].invoiceCount++;
    buckets[period].revenue += amt;
    buckets[period].subtotal += sub;
    buckets[period].vatAmount += vat;
    buckets[period].withholdingAmount += wht;
    if (row.paymentType === "cash") buckets[period].cashRevenue += amt;
    else buckets[period].creditRevenue += amt;
  }

  const series = Object.entries(buckets)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([period, data]) => ({ period, ...data }));

  res.json({
    from: dateFrom,
    to: dateTo,
    groupBy,
    summary: {
      totalInvoices: rows.length,
      totalRevenue,
      subtotalSum,
      cashRevenue,
      creditRevenue,
      vatCollected,
      withholdingTotal,
      discountTotal,
    },
    series,
    invoices: rows.map(r => ({
      id: r.id,
      invoiceNumber: r.invoiceNumber,
      saleDate: r.saleDate,
      customerName: r.customerName,
      fsNumber: r.fsNumber,
      paymentType: r.paymentType,
      paymentMethod: r.paymentMethod,
      bankName: r.bankName,
      status: r.status,
      vatApplicable: r.vatApplicable,
      subtotal: parseFloat(String(r.subtotal || 0)),
      vatAmount: parseFloat(String(r.vatAmount || 0)),
      withholdingAmount: parseFloat(String(r.withholdingAmount || 0)),
      discountAmount: parseFloat(String(r.discountAmount || 0)),
      totalAmount: parseFloat(String(r.totalAmount || 0)),
      paidAmount: parseFloat(String(r.paidAmount || 0)),
      balanceDue: parseFloat(String(r.balanceDue || 0)),
    })), // Removed .reverse() 
  });
});

// ── Wastage Report ───────────────────────────────────────────────────────────
router.get("/reports/wastage", requireAuth, async (req, res): Promise<void> => {
  const { from, to, storeId, productId, groupBy = "daily" } = req.query as Record<string, string>;

  const today = new Date();
  const dateFrom = from || `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-01`;
  const dateTo = to || `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

  // Only completed batches have wastage data
  const conditions: SQL[] = [eq(productionBatchesTable.status, "completed")];
  if (from) conditions.push(gte(productionBatchesTable.completedAt, new Date(dateFrom)));
  if (to) {
    const nextDay = new Date(dateTo);
    nextDay.setDate(nextDay.getDate() + 1);
    conditions.push(lt(productionBatchesTable.completedAt, nextDay));
  }
  if (storeId) {
    const sid = parseInt(storeId, 10);
    conditions.push(or(
      eq(productionBatchesTable.stageFromStoreId, sid),
      eq(productionBatchesTable.stageToStoreId, sid),
    )!);
  }

  try {
    const batches = await db
      .select({
        id: productionBatchesTable.id,
        batchNumber: productionBatchesTable.batchNumber,
        type: productionBatchesTable.type,
        finalProductName: productionBatchesTable.finalProductName,
        productionDate: productionBatchesTable.productionDate,
        completedAt: productionBatchesTable.completedAt,
        plannedOutputQty: productionBatchesTable.plannedOutputQty,
        actualOutputQty: productionBatchesTable.actualOutputQty,
        wastageQty: productionBatchesTable.wastageQty,
        wastagePercent: productionBatchesTable.wastagePercent,
        yieldPercent: productionBatchesTable.yieldPercent,
        outputUnit: productionBatchesTable.outputUnit,
        stageFromStoreId: productionBatchesTable.stageFromStoreId,
        stageToStoreId: productionBatchesTable.stageToStoreId,
        packagesProduced: productionBatchesTable.packagesProduced,
        packageSize: productionBatchesTable.packageSize,
        packageSizeUnit: productionBatchesTable.packageSizeUnit,
      })
      .from(productionBatchesTable)
      .where(and(...conditions))
      .orderBy(productionBatchesTable.productionDate);

    const batchIdList = batches.map(b => b.id);

    // Fetch inputs for all batches (joined with product names)
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

    // Optional product filter — keep only batches that used this input product
    let filteredIds = new Set(batchIdList);
    if (productId) {
      const pid = parseInt(productId, 10);
      const matching = new Set(allInputs.filter(i => i.productId === pid).map(i => i.batchId));
      filteredIds = matching;
    }

    const filteredBatches = batches.filter(b => filteredIds.has(b.id));
    const filteredInputs = allInputs.filter(i => filteredIds.has(i.batchId));

    // Resolve store names
    const usedStoreIds = [
      ...new Set([
        ...filteredBatches.map(b => b.stageFromStoreId),
        ...filteredBatches.map(b => b.stageToStoreId),
      ]),
    ];
    const storeNames: Record<number, string> = {};
    if (usedStoreIds.length > 0) {
      const stores = await db
        .select({ id: storesTable.id, name: storesTable.name })
        .from(storesTable)
        .where(inArray(storesTable.id, usedStoreIds));
      for (const s of stores) storeNames[s.id] = s.name;
    }

    // Summary aggregation
    let totalInputQty = 0;
    let totalOutputQty = 0;
    let totalWastageQty = 0;
    let wastagePercSum = 0;
    let yieldPercSum = 0;
    let percCount = 0;

    for (const inp of filteredInputs) totalInputQty += parseFloat(String(inp.quantity || 0));

    for (const b of filteredBatches) {
      totalOutputQty += parseFloat(String(b.actualOutputQty || 0));
      totalWastageQty += parseFloat(String(b.wastageQty || 0));
      if (b.wastagePercent != null) {
        wastagePercSum += parseFloat(String(b.wastagePercent));
        yieldPercSum += parseFloat(String(b.yieldPercent || 0));
        percCount++;
      }
    }

    // By-product breakdown
    const productMap: Record<number, { productName: string; unit: string; totalInputQty: number; batchCount: number }> = {};
    for (const inp of filteredInputs) {
      if (!productMap[inp.productId]) {
        productMap[inp.productId] = { productName: inp.productName ?? "Unknown", unit: inp.unit, totalInputQty: 0, batchCount: 0 };
      }
      productMap[inp.productId].totalInputQty += parseFloat(String(inp.quantity || 0));
      productMap[inp.productId].batchCount++;
    }

    // By-date breakdown
    const dateMap: Record<string, { batchCount: number; totalWastageQty: number; totalOutputQty: number; wPercSum: number; wPercCount: number }> = {};
    for (const b of filteredBatches) {
      const raw = b.productionDate ?? (b.completedAt ? new Date(b.completedAt).toISOString().split("T")[0] : null);
      const key = raw
        ? (groupBy === "monthly" ? raw.substring(0, 7) : raw)
        : "Unknown";
      if (!dateMap[key]) dateMap[key] = { batchCount: 0, totalWastageQty: 0, totalOutputQty: 0, wPercSum: 0, wPercCount: 0 };
      dateMap[key].batchCount++;
      dateMap[key].totalWastageQty += parseFloat(String(b.wastageQty || 0));
      dateMap[key].totalOutputQty += parseFloat(String(b.actualOutputQty || 0));
      if (b.wastagePercent != null) {
        dateMap[key].wPercSum += parseFloat(String(b.wastagePercent));
        dateMap[key].wPercCount++;
      }
    }

    res.json({
      from: dateFrom,
      to: dateTo,
      groupBy,
      summary: {
        totalBatches: filteredBatches.length,
        totalInputQty: parseFloat(totalInputQty.toFixed(3)),
        totalOutputQty: parseFloat(totalOutputQty.toFixed(3)),
        totalWastageQty: parseFloat(totalWastageQty.toFixed(3)),
        avgWastagePercent: percCount > 0 ? parseFloat((wastagePercSum / percCount).toFixed(2)) : 0,
        avgYieldPercent: percCount > 0 ? parseFloat((yieldPercSum / percCount).toFixed(2)) : 0,
      },
      byBatch: filteredBatches.map(b => ({
        id: b.id,
        batchNumber: b.batchNumber,
        type: b.type,
        finalProductName: b.finalProductName,
        productionDate: b.productionDate,
        completedAt: b.completedAt,
        plannedOutputQty: parseFloat(String(b.plannedOutputQty || 0)),
        actualOutputQty: parseFloat(String(b.actualOutputQty || 0)),
        wastageQty: parseFloat(String(b.wastageQty || 0)),
        wastagePercent: parseFloat(String(b.wastagePercent || 0)),
        yieldPercent: parseFloat(String(b.yieldPercent || 0)),
        outputUnit: b.outputUnit,
        storeFromName: storeNames[b.stageFromStoreId] ?? null,
        storeToName: storeNames[b.stageToStoreId] ?? null,
        packagesProduced: b.packagesProduced ? parseFloat(String(b.packagesProduced)) : null,
        packageSize: b.packageSize ? parseFloat(String(b.packageSize)) : null,
        packageSizeUnit: b.packageSizeUnit ?? null,
      })),
      byProduct: Object.entries(productMap)
        .map(([pid, d]) => ({ productId: parseInt(pid), ...d, totalInputQty: parseFloat(d.totalInputQty.toFixed(3)) }))
        .sort((a, b) => b.totalInputQty - a.totalInputQty),
      byDate: Object.entries(dateMap)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([period, d]) => ({
          period,
          batchCount: d.batchCount,
          totalWastageQty: parseFloat(d.totalWastageQty.toFixed(3)),
          totalOutputQty: parseFloat(d.totalOutputQty.toFixed(3)),
          avgWastagePercent: d.wPercCount > 0 ? parseFloat((d.wPercSum / d.wPercCount).toFixed(2)) : 0,
        })),
    });
  } catch (err: any) {
    res.status(500).json({ error: "Report calculation failed", message: err.message, stack: err.stack });
  }
});

export default router;