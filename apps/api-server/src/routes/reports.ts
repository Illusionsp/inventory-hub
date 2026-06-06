import { Router } from "express";
import { eq, and, gte, lte, lt, or, inArray, SQL, desc, sql } from "drizzle-orm";
import {
  db,
  salesTable, saleItemsTable, customersTable,
  productionBatchesTable, productionInputsTable, productionOutputsTable,
  productsTable, storesTable,
} from "@workspace/db";
import { requireAuth } from "../lib/auth";

const router = Router();

function normalizeDate(d: string | null | undefined): string | null {
  if (!d) return null;
  const s = String(d).trim();
  if (!s) return null;
  // If it's already YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.substring(0, 10);
  // If it's MM/DD/YYYY or DD/MM/YYYY
  if (s.includes("/")) {
    const parts = s.split("/");
    if (parts.length === 3) {
      let [p1, p2, p3] = parts;
      // Assume YYYY at the end
      if (p3.length === 4) {
        // We don't know if p1 is MM or DD. But 99% of these systems use DD/MM/YYYY or YYYY-MM-DD.
        // Let's try to be smart: if p1 > 12, it's definitely DD.
        if (parseInt(p1, 10) > 12) return `${p3}-${p2.padStart(2, "0")}-${p1.padStart(2, "0")}`;
        // If p2 > 12, it's definitely MM/DD/YYYY
        if (parseInt(p2, 10) > 12) return `${p3}-${p1.padStart(2, "0")}-${p2.padStart(2, "0")}`;
        // Fallback: assume DD/MM/YYYY (common in Ethiopia/Europe)
        return `${p3}-${p2.padStart(2, "0")}-${p1.padStart(2, "0")}`;
      }
    }
  }
  // Try JS Date as last resort
  try {
    const parsed = new Date(s);
    if (!isNaN(parsed.getTime())) return parsed.toISOString().split("T")[0];
  } catch { }
  return s;
}

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
  const sixtyDaysAgo = new Date(today);
  sixtyDaysAgo.setDate(today.getDate() - 60);

  const pad = (n: number) => String(n).padStart(2, "0");
  const fallbackFrom = `${sixtyDaysAgo.getFullYear()}-${pad(sixtyDaysAgo.getMonth() + 1)}-${pad(sixtyDaysAgo.getDate())}`;
  const fallbackTo = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`;

  const dateFrom = from || fallbackFrom;
  const dateTo = to || fallbackTo;

  // Fetch more broadly and filter in-memory to handle varying date formats safely
  const allRows = await db
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
    .leftJoin(customersTable, eq(salesTable.customerId, customersTable.id));

  // Apply filters in JS for maximum reliability
  const normFrom = normalizeDate(dateFrom);
  const normTo = normalizeDate(dateTo);

  const rows = allRows.filter(r => {
    const d = normalizeDate(r.saleDate);
    if (!d) return false;
    if (normFrom && d < normFrom) return false;
    if (normTo && d > normTo) return false;
    if (paymentType && r.paymentType !== paymentType) return false;
    if (paymentMethod && r.paymentMethod !== paymentMethod) return false;
    if (status && r.status !== status) return false;
    return true;
  }).sort((a, b) => {
    // Sort descending by date
    const da = normalizeDate(a.saleDate) || "";
    const db = normalizeDate(b.saleDate) || "";
    if (da !== db) return db.localeCompare(da);
    return (b.createdAt?.getTime() ?? 0) - (a.createdAt?.getTime() ?? 0);
  });

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

  // ── Sales by Product Aggregation ───────────────────────────────────────────
  const invoiceIds = rows.map(r => r.id);
  const items = invoiceIds.length > 0
    ? await db
      .select({
        saleId: saleItemsTable.saleId,
        productId: saleItemsTable.productId,
        quantity: saleItemsTable.quantity,
        unit: saleItemsTable.unit,
        productName: productsTable.name,
      })
      .from(saleItemsTable)
      .leftJoin(productsTable, eq(saleItemsTable.productId, productsTable.id))
      .where(inArray(saleItemsTable.saleId, invoiceIds))
    : [];

  const productAgg: Record<number, { name: string; quantity: number; unit: string }> = {};
  const itemsBySale: Record<number, { name: string; quantity: number; unit: string }[]> = {};

  for (const item of items) {
    const pid = item.productId;
    const sid = item.saleId;

    // Summary aggregation
    if (!productAgg[pid]) {
      productAgg[pid] = { name: item.productName || "Unknown Product", quantity: 0, unit: item.unit };
    }
    productAgg[pid].quantity += parseFloat(String(item.quantity || 0));

    // Per-invoice mapping
    if (!itemsBySale[sid]) itemsBySale[sid] = [];
    itemsBySale[sid].push({
      name: item.productName || "Unknown Product",
      quantity: parseFloat(String(item.quantity || 0)),
      unit: item.unit,
    });
  }

  const byProduct = Object.entries(productAgg).map(([productId, data]) => ({
    productId: parseInt(productId, 10),
    ...data,
  })).sort((a, b) => b.quantity - a.quantity);

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
    byProduct,
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
      items: itemsBySale[r.id] || [],
    })), // Removed .reverse() 
  });
});

// ── Wastage Report ───────────────────────────────────────────────────────────
router.get("/reports/wastage", requireAuth, async (req, res): Promise<void> => {
  const from = req.query.from as string | undefined;
  const to = req.query.to as string | undefined;
  const storeIdStr = req.query.storeId as string | undefined;
  const productIdStr = req.query.productId as string | undefined;
  const groupBy = (req.query.groupBy as string) || "daily";
  const today = new Date();

  const sixtyDaysAgo = new Date(today);
  sixtyDaysAgo.setDate(today.getDate() - 60);

  const pad = (n: number) => String(n).padStart(2, "0");
  const fallbackFrom = `${sixtyDaysAgo.getFullYear()}-${pad(sixtyDaysAgo.getMonth() + 1)}-${pad(sixtyDaysAgo.getDate())}`;
  const fallbackTo = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`;

  const dateFrom = from || fallbackFrom;
  const dateTo = to || fallbackTo;

  try {
    const conditions: SQL[] = [eq(productionBatchesTable.status, "completed")];
    if (storeIdStr) {
      const sid = parseInt(storeIdStr, 10);
      conditions.push(or(
        eq(productionBatchesTable.stageFromStoreId, sid),
        eq(productionBatchesTable.stageToStoreId, sid),
      )!);
    }
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

    const normFrom = normalizeDate(dateFrom);
    const normTo = normalizeDate(dateTo);
    const filteredByDate = batches.filter(b => {
      const d = b.productionDate ? normalizeDate(b.productionDate) : (b.completedAt ? normalizeDate(b.completedAt.toISOString()) : null);
      if (!d) return false;
      if (normFrom && d < normFrom) return false;
      if (normTo && d > normTo) return false;
      return true;
    });

    const batchIdList = filteredByDate.map(b => b.id);

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
    if (productIdStr) {
      const pid = parseInt(productIdStr, 10);
      if (!isNaN(pid)) {
        const matching = new Set(allInputs.filter(i => i.productId === pid).map(i => i.batchId));
        filteredIds = matching;
      }
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

    const safeNum = (v: any) => {
      const n = parseFloat(String(v || 0));
      return isNaN(n) ? 0 : n;
    };

    // Summary aggregation
    let totalInputQty = 0;
    let totalOutputQty = 0;
    let totalWastageQty = 0;
    let wastagePercSum = 0;
    let yieldPercSum = 0;
    let percCount = 0;

    for (const inp of filteredInputs) {
      totalInputQty += safeNum(inp.quantity);
    }

    for (const b of filteredBatches) {
      totalOutputQty += safeNum(b.actualOutputQty);
      totalWastageQty += safeNum(b.wastageQty);
      if (b.wastagePercent != null) {
        wastagePercSum += safeNum(b.wastagePercent);
        yieldPercSum += safeNum(b.yieldPercent);
        percCount++;
      }
    }

    // By-product breakdown
    const productMap: Record<number, { productName: string; unit: string; totalInputQty: number; batchCount: number }> = {};
    for (const inp of filteredInputs) {
      if (!productMap[inp.productId]) {
        productMap[inp.productId] = { productName: inp.productName ?? "Unknown", unit: inp.unit, totalInputQty: 0, batchCount: 0 };
      }
      productMap[inp.productId].totalInputQty += safeNum(inp.quantity);
      productMap[inp.productId].batchCount++;
    }

    // By-date breakdown
    const dateMap: Record<string, { batchCount: number; totalWastageQty: number; totalOutputQty: number; wPercSum: number; wPercCount: number }> = {};
    for (const b of filteredBatches) {
      const raw = b.productionDate ?? (b.completedAt ? new Date(b.completedAt).toISOString().split("T")[0] : null);
      const key = raw
        ? (groupBy === "monthly" ? raw.substring(0, 7) : raw)
        : "Unknown";

      if (!dateMap[key]) {
        dateMap[key] = { batchCount: 0, totalWastageQty: 0, totalOutputQty: 0, wPercSum: 0, wPercCount: 0 };
      }
      dateMap[key].batchCount++;
      dateMap[key].totalWastageQty += safeNum(b.wastageQty);
      dateMap[key].totalOutputQty += safeNum(b.actualOutputQty);
      if (b.wastagePercent != null) {
        dateMap[key].wPercSum += safeNum(b.wastagePercent);
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