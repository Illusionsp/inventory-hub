import { Router } from "express";
import { db, inventoryTable, productsTable, grnsTable, transfersTable, salesTable, productionBatchesTable, saleItemsTable } from "@workspace/db";
import { requireAuth } from "../lib/auth";
import { eq, sql, and, lte, gte } from "drizzle-orm";

const router = Router();

router.get("/dashboard/summary", requireAuth, async (_req, res): Promise<void> => {
  const today = new Date().toISOString().split("T")[0];
  const monthStart = today.slice(0, 7) + "-01";

  const [invSummary] = await db.select({ count: sql<number>`count(*)`, totalStock: sql<number>`coalesce(sum(quantity::numeric), 0)` }).from(inventoryTable);
  const [productCount] = await db.select({ count: sql<number>`count(*)` }).from(productsTable).where(eq(productsTable.isActive, true));
  const [lowStockCount] = await db.select({ count: sql<number>`count(*)` }).from(inventoryTable).leftJoin(productsTable, eq(inventoryTable.productId, productsTable.id)).where(sql`inventory.quantity::numeric <= products.reorder_level::numeric`);

  const [pendingGrns] = await db.select({ count: sql<number>`count(*)` }).from(grnsTable).where(eq(grnsTable.status, "pending_approval"));
  const [pendingTransfers] = await db.select({ count: sql<number>`count(*)` }).from(transfersTable).where(eq(transfersTable.status, "pending"));

  const [todaySalesData] = await db.select({ total: sql<number>`coalesce(sum(total_amount::numeric), 0)`, count: sql<number>`count(*)` }).from(salesTable).where(eq(salesTable.saleDate, today));
  const [monthSalesData] = await db.select({ total: sql<number>`coalesce(sum(total_amount::numeric), 0)`, count: sql<number>`count(*)` }).from(salesTable).where(gte(salesTable.saleDate, monthStart));
  const [outstanding] = await db.select({ total: sql<number>`coalesce(sum(balance_due::numeric), 0)` }).from(salesTable).where(sql`balance_due::numeric > 0`);
  const [activeBatches] = await db.select({ count: sql<number>`count(*)` }).from(productionBatchesTable).where(eq(productionBatchesTable.status, "in_progress"));

  res.json({
    totalStockValue: Number(invSummary?.totalStock ?? 0),
    totalProducts: Number(productCount?.count ?? 0),
    lowStockCount: Number(lowStockCount?.count ?? 0),
    pendingApprovalsCount: Number(pendingGrns?.count ?? 0) + Number(pendingTransfers?.count ?? 0),
    todaySales: Number(todaySalesData?.total ?? 0),
    monthSales: Number(monthSalesData?.total ?? 0),
    outstandingPayments: Number(outstanding?.total ?? 0),
    activeBatches: Number(activeBatches?.count ?? 0),
    todaySalesCount: Number(todaySalesData?.count ?? 0),
    monthSalesCount: Number(monthSalesData?.count ?? 0),
  });
});

router.get("/dashboard/alerts", requireAuth, async (_req, res): Promise<void> => {
  const alerts: Array<{ id: number; type: string; severity: string; message: string; entityType: string | null; entityId: number | null; createdAt: string }> = [];
  let alertId = 1;
  const now = new Date().toISOString();

  // Low stock
  const lowStockItems = await db.select({ id: inventoryTable.id, productId: inventoryTable.productId, productName: productsTable.name, quantity: inventoryTable.quantity, reorderLevel: productsTable.reorderLevel })
    .from(inventoryTable).leftJoin(productsTable, eq(inventoryTable.productId, productsTable.id))
    .where(sql`inventory.quantity::numeric <= products.reorder_level::numeric`).limit(5);
  for (const item of lowStockItems) {
    alerts.push({ id: alertId++, type: "low_stock", severity: "warning", message: `Low stock: ${item.productName} (${item.quantity} remaining)`, entityType: "product", entityId: item.productId, createdAt: now });
  }

  // Pending approvals
  const pendingGrns = await db.select({ id: grnsTable.id, grnNumber: grnsTable.grnNumber }).from(grnsTable).where(eq(grnsTable.status, "pending_approval")).limit(3);
  for (const g of pendingGrns) {
    alerts.push({ id: alertId++, type: "pending_approval", severity: "info", message: `GRN ${g.grnNumber} is pending approval`, entityType: "grn", entityId: g.id, createdAt: now });
  }

  // Overdue payments
  const today = new Date().toISOString().split("T")[0];
  const overdue = await db.select({ id: salesTable.id, invoiceNumber: salesTable.invoiceNumber }).from(salesTable).where(and(sql`balance_due::numeric > 0`, lte(salesTable.dueDate, today))).limit(3);
  for (const s of overdue) {
    alerts.push({ id: alertId++, type: "overdue_payment", severity: "critical", message: `Invoice ${s.invoiceNumber} is overdue`, entityType: "sale", entityId: s.id, createdAt: now });
  }

  res.json(alerts);
});

router.get("/dashboard/sales-trend", requireAuth, async (req, res): Promise<void> => {
  const { period = "monthly" } = req.query as Record<string, string>;

  let rows: Array<{ label: string; value: number; count: number }> = [];

  if (period === "daily") {
    const data = await db.select({
      label: sql<string>`DATE(created_at)::text`,
      value: sql<number>`coalesce(sum(total_amount::numeric), 0)`,
      count: sql<number>`count(*)`,
    }).from(salesTable).where(gte(salesTable.createdAt, new Date(Date.now() - 30 * 86400000))).groupBy(sql`DATE(created_at)`).orderBy(sql`DATE(created_at)`);
    rows = data.map(r => ({ label: r.label, value: Number(r.value), count: Number(r.count) }));
  } else if (period === "monthly") {
    const data = await db.select({
      label: sql<string>`to_char(created_at, 'YYYY-MM')`,
      value: sql<number>`coalesce(sum(total_amount::numeric), 0)`,
      count: sql<number>`count(*)`,
    }).from(salesTable).where(gte(salesTable.createdAt, new Date(Date.now() - 365 * 86400000))).groupBy(sql`to_char(created_at, 'YYYY-MM')`).orderBy(sql`to_char(created_at, 'YYYY-MM')`);
    rows = data.map(r => ({ label: r.label, value: Number(r.value), count: Number(r.count) }));
  } else {
    const data = await db.select({
      label: sql<string>`to_char(created_at, 'YYYY')`,
      value: sql<number>`coalesce(sum(total_amount::numeric), 0)`,
      count: sql<number>`count(*)`,
    }).from(salesTable).groupBy(sql`to_char(created_at, 'YYYY')`).orderBy(sql`to_char(created_at, 'YYYY')`);
    rows = data.map(r => ({ label: r.label, value: Number(r.value), count: Number(r.count) }));
  }

  res.json(rows);
});

router.get("/dashboard/production-summary", requireAuth, async (_req, res): Promise<void> => {
  const [totals] = await db.select({
    total: sql<number>`count(*)`,
    completed: sql<number>`sum(case when status = 'completed' then 1 else 0 end)`,
    inProgress: sql<number>`sum(case when status = 'in_progress' then 1 else 0 end)`,
    avgYield: sql<number>`coalesce(avg(case when yield_percent is not null then yield_percent::numeric end), 0)`,
    avgWastage: sql<number>`coalesce(avg(case when wastage_percent is not null then wastage_percent::numeric end), 0)`,
    totalOutput: sql<number>`coalesce(sum(case when actual_output_qty is not null then actual_output_qty::numeric else 0 end), 0)`,
  }).from(productionBatchesTable);

  res.json({
    totalBatches: Number(totals?.total ?? 0),
    completedBatches: Number(totals?.completed ?? 0),
    inProgressBatches: Number(totals?.inProgress ?? 0),
    avgYield: Number(totals?.avgYield ?? 0),
    avgWastage: Number(totals?.avgWastage ?? 0),
    totalOutputQty: Number(totals?.totalOutput ?? 0),
  });
});

router.get("/dashboard/top-products", requireAuth, async (req, res): Promise<void> => {
  const { limit = "10" } = req.query as Record<string, string>;
  const limitNum = parseInt(limit, 10);

  const rows = await db.select({
    productId: saleItemsTable.productId,
    productName: productsTable.name,
    totalQty: sql<number>`coalesce(sum(sale_items.quantity::numeric), 0)`,
    totalRevenue: sql<number>`coalesce(sum(sale_items.total_price::numeric), 0)`,
  }).from(saleItemsTable)
    .leftJoin(productsTable, eq(saleItemsTable.productId, productsTable.id))
    .groupBy(saleItemsTable.productId, productsTable.name)
    .orderBy(sql`sum(sale_items.total_price::numeric) desc`)
    .limit(limitNum);

  res.json(rows.map(r => ({ productId: r.productId, productName: r.productName, totalQty: Number(r.totalQty), totalRevenue: Number(r.totalRevenue) })));
});

router.get("/dashboard/pending-approvals", requireAuth, async (_req, res): Promise<void> => {
  const [grns] = await db.select({ count: sql<number>`count(*)` }).from(grnsTable).where(eq(grnsTable.status, "pending_approval"));
  const [transfers] = await db.select({ count: sql<number>`count(*)` }).from(transfersTable).where(eq(transfersTable.status, "pending"));
  const grnCount = Number(grns?.count ?? 0);
  const transferCount = Number(transfers?.count ?? 0);
  res.json({ grns: grnCount, transfers: transferCount, total: grnCount + transferCount });
});

export default router;
