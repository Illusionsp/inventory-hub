import { Router } from "express";
import { eq, and, SQL } from "drizzle-orm";
import { db, paymentsTable, salesTable, customersTable } from "@workspace/db";
import { requireAuth } from "../lib/auth";

const router = Router();

router.get("/payments", requireAuth, async (req, res): Promise<void> => {
  const { saleId, customerId, page = "1", limit = "20" } = req.query as Record<string, string>;
  const pageNum = parseInt(page, 10);
  const limitNum = parseInt(limit, 10);
  const offset = (pageNum - 1) * limitNum;

  const conditions: SQL[] = [];
  if (saleId) conditions.push(eq(paymentsTable.saleId, parseInt(saleId, 10)));
  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const rows = await db
    .select({ id: paymentsTable.id, saleId: paymentsTable.saleId, invoiceNumber: salesTable.invoiceNumber, customerId: salesTable.customerId, customerName: customersTable.name, amount: paymentsTable.amount, paymentDate: paymentsTable.paymentDate, paymentMethod: paymentsTable.paymentMethod, bankName: paymentsTable.bankName, reference: paymentsTable.reference, notes: paymentsTable.notes, createdAt: paymentsTable.createdAt })
    .from(paymentsTable)
    .leftJoin(salesTable, eq(paymentsTable.saleId, salesTable.id))
    .leftJoin(customersTable, eq(salesTable.customerId, customersTable.id))
    .where(where)
    .limit(limitNum)
    .offset(offset);

  const total = await db.$count(paymentsTable, where);
  res.json({ data: rows, total, page: pageNum, limit: limitNum });
});

router.post("/payments", requireAuth, async (req, res): Promise<void> => {
  const { saleId, amount, paymentDate, paymentMethod, bankName, reference, notes } = req.body;
  if (!saleId || !amount || !paymentDate || !paymentMethod) {
    res.status(400).json({ error: "Missing required fields" });
    return;
  }

  const [payment] = await db.insert(paymentsTable).values({
    saleId, amount: amount.toString(), paymentDate, paymentMethod, bankName: bankName ?? null, reference: reference ?? null, notes: notes ?? null, createdById: req.session.userId,
  }).returning();

  // Update sale paid amount and status
  const [sale] = await db.select().from(salesTable).where(eq(salesTable.id, saleId));
  if (sale) {
    const newPaid = parseFloat(sale.paidAmount as string) + parseFloat(amount.toString());
    const newBalance = parseFloat(sale.totalAmount as string) - newPaid;
    const newStatus = newBalance <= 0 ? "paid" : "partially_paid";
    await db.update(salesTable).set({
      paidAmount: newPaid.toString(), balanceDue: Math.max(0, newBalance).toString(), status: newStatus,
    }).where(eq(salesTable.id, saleId));
  }

  res.status(201).json(payment);
});

export default router;
