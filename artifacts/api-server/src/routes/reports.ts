import { Router } from "express";
import { eq, and, gte, lte, SQL } from "drizzle-orm";
import { db, salesTable, customersTable } from "@workspace/db";
import { requireAuth } from "../lib/auth";

const router = Router();

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
  const dateTo = to || today.toISOString().split("T")[0];

  const conditions: SQL[] = [
    gte(salesTable.saleDate, dateFrom),
    lte(salesTable.saleDate, dateTo),
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
    })
    .from(salesTable)
    .leftJoin(customersTable, eq(salesTable.customerId, customersTable.id))
    .where(where)
    .orderBy(salesTable.saleDate);

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
    })).reverse(),
  });
});

export default router;
