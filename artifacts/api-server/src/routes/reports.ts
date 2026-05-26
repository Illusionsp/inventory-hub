import { Router } from "express";
import { eq, and, gte, lte, SQL } from "drizzle-orm";
import { db, salesTable, customersTable } from "@workspace/db";
import { requireAuth } from "../lib/auth";

const router = Router();

router.get("/reports/sales", requireAuth, async (req, res): Promise<void> => {
  const { from, to, groupBy = "daily" } = req.query as Record<string, string>;

  const today = new Date();
  const dateFrom = from || `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-01`;
  const dateTo = to || today.toISOString().split("T")[0];

  const conditions: SQL[] = [
    gte(salesTable.saleDate, dateFrom),
    lte(salesTable.saleDate, dateTo),
  ];
  const where = and(...conditions);

  const rows = await db
    .select({
      id: salesTable.id,
      invoiceNumber: salesTable.invoiceNumber,
      saleDate: salesTable.saleDate,
      customerId: salesTable.customerId,
      customerName: customersTable.name,
      paymentType: salesTable.paymentType,
      status: salesTable.status,
      totalAmount: salesTable.totalAmount,
      vatAmount: salesTable.vatAmount,
      paidAmount: salesTable.paidAmount,
      balanceDue: salesTable.balanceDue,
    })
    .from(salesTable)
    .leftJoin(customersTable, eq(salesTable.customerId, customersTable.id))
    .where(where)
    .orderBy(salesTable.saleDate);

  let totalRevenue = 0;
  let cashRevenue = 0;
  let creditRevenue = 0;
  let vatCollected = 0;

  const buckets: Record<string, { invoiceCount: number; revenue: number; vatAmount: number; cashRevenue: number; creditRevenue: number }> = {};

  for (const row of rows) {
    const amt = parseFloat(String(row.totalAmount || 0));
    const vat = parseFloat(String(row.vatAmount || 0));
    totalRevenue += amt;
    vatCollected += vat;
    if (row.paymentType === "cash") cashRevenue += amt;
    else creditRevenue += amt;

    const period = groupBy === "monthly" ? row.saleDate.substring(0, 7) : row.saleDate;
    if (!buckets[period]) buckets[period] = { invoiceCount: 0, revenue: 0, vatAmount: 0, cashRevenue: 0, creditRevenue: 0 };
    buckets[period].invoiceCount++;
    buckets[period].revenue += amt;
    buckets[period].vatAmount += vat;
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
      cashRevenue,
      creditRevenue,
      vatCollected,
    },
    series,
    invoices: rows.map(r => ({
      id: r.id,
      invoiceNumber: r.invoiceNumber,
      saleDate: r.saleDate,
      customerName: r.customerName,
      paymentType: r.paymentType,
      status: r.status,
      totalAmount: parseFloat(String(r.totalAmount || 0)),
      vatAmount: parseFloat(String(r.vatAmount || 0)),
      paidAmount: parseFloat(String(r.paidAmount || 0)),
      balanceDue: parseFloat(String(r.balanceDue || 0)),
    })).reverse(),
  });
});

export default router;
