import { Router } from "express";
import { eq, and, ilike, SQL, desc, gte, lte, sql } from "drizzle-orm";
import { db, salesTable, saleItemsTable, customersTable, inventoryTable, inventoryMovementsTable } from "@workspace/db";
import { requireAuth } from "../lib/auth";
import { notifyByPermission } from "../lib/notify";
import { usersTable } from "@workspace/db";

function normalizeDate(d: string | null | undefined): string | null {
  if (!d) return null;
  const s = String(d).trim();
  if (!s) return null;
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.substring(0, 10);
  if (s.includes("/")) {
    const parts = s.split("/");
    if (parts.length === 3) {
      let [p1, p2, p3] = parts;
      if (p3.length === 4) {
        if (parseInt(p1, 10) > 12) return `${p3}-${p2.padStart(2, "0")}-${p1.padStart(2, "0")}`;
        if (parseInt(p2, 10) > 12) return `${p3}-${p1.padStart(2, "0")}-${p2.padStart(2, "0")}`;
        return `${p3}-${p2.padStart(2, "0")}-${p1.padStart(2, "0")}`;
      }
    }
  }
  try {
    const parsed = new Date(s);
    if (!isNaN(parsed.getTime())) return parsed.toISOString().split("T")[0];
  } catch { }
  return s;
}

const router = Router();

async function nextInvoiceNumber(): Promise<string> {
  const rows = await db.select({ id: salesTable.id }).from(salesTable);
  return `INV-${String((rows.length + 1001)).padStart(6, "0")}`;
}

router.get("/sales", requireAuth, async (req, res): Promise<void> => {
  const { status, customerId, search, machineNumber, from, to, page = "1", limit = "20" } = req.query as Record<string, string>;
  const pageNum = parseInt(page, 10);
  const limitNum = parseInt(limit, 10);
  const offset = (pageNum - 1) * limitNum;

  const conditions: SQL[] = [];
  if (status) conditions.push(eq(salesTable.status, status));
  if (customerId) conditions.push(eq(salesTable.customerId, parseInt(customerId, 10)));
  if (machineNumber) conditions.push(ilike(salesTable.machineNumber, `%${machineNumber}%`));
  if (search) conditions.push(ilike(salesTable.invoiceNumber, `%${search}%`));

  const where = conditions.length > 0 ? and(...conditions) : undefined;

  // Fetch more broadly if date filters are present to handle format variations
  const allRows = await db
    .select({
      id: salesTable.id,
      invoiceNumber: salesTable.invoiceNumber,
      saleDate: salesTable.saleDate,
      customerId: salesTable.customerId,
      customerName: customersTable.name,
      fsNumber: salesTable.fsNumber,
      machineNumber: salesTable.machineNumber,
      paymentType: salesTable.paymentType,
      paymentMethod: salesTable.paymentMethod,
      status: salesTable.status,
      subtotal: salesTable.subtotal,
      vatApplicable: salesTable.vatApplicable,
      vatAmount: salesTable.vatAmount,
      withholdingAmount: salesTable.withholdingAmount,
      discountAmount: salesTable.discountAmount,
      totalAmount: salesTable.totalAmount,
      paidAmount: salesTable.paidAmount,
      balanceDue: salesTable.balanceDue,
      dueDate: salesTable.dueDate,
      salespersonId: salesTable.salespersonId,
      storeId: salesTable.storeId,
      remarks: salesTable.remarks,
      createdAt: salesTable.createdAt
    })
    .from(salesTable)
    .leftJoin(customersTable, eq(salesTable.customerId, customersTable.id))
    .where(where);

  // Apply date filters and sorting in-memory for robustness
  const normFrom = normalizeDate(from);
  const normTo = normalizeDate(to);

  const filteredRows = allRows.filter(r => {
    const d = normalizeDate(r.saleDate);
    if (!d) return (from || to) ? false : true;
    if (normFrom && d < normFrom) return false;
    if (normTo && d > normTo) return false;
    return true;
  }).sort((a, b) => {
    const da = normalizeDate(a.saleDate) || "";
    const db = normalizeDate(b.saleDate) || "";
    if (da !== db) return db.localeCompare(da);
    return (b.createdAt?.getTime() ?? 0) - (a.createdAt?.getTime() ?? 0);
  });

  const total = filteredRows.length;
  const data = filteredRows.slice(offset, offset + limitNum).map(r => ({ ...r, salespersonName: null, items: [] }));
  res.json({ data, total, page: pageNum, limit: limitNum });
});

router.post("/sales", requireAuth, async (req, res): Promise<void> => {
  const { customerId, saleDate, fsNumber, machineNumber, paymentType, paymentMethod, bankName, vatApplicable, dueDate, salespersonId, storeId, remarks, items } = req.body;
  if (!customerId || !saleDate || !paymentType || !items?.length) {
    res.status(400).json({ error: "Missing required fields" });
    return;
  }

  // Credit blocker logic: Prevent new credit sales if customer has unpaid balances
  if (paymentType === "credit") {
    // Check for previous unpaid sales
    const previousUnpaidSales = await db
      .select({ id: salesTable.id })
      .from(salesTable)
      .where(and(eq(salesTable.customerId, customerId), sql`${salesTable.balanceDue} > 0`));

    if (previousUnpaidSales.length > 0) {
      res.status(403).json({ error: `Customer has ${previousUnpaidSales.length} unpaid invoice(s). Must clear balances before taking new credit.` });
      return;
    }
  }

  const subtotal = items.reduce((s: number, i: { totalPrice: number }) => s + Number(i.totalPrice), 0);
  const vatAmount = vatApplicable ? subtotal * 0.15 : 0;
  const totalAmount = subtotal + vatAmount;
  const paidAmount = paymentType === "cash" ? totalAmount : 0;
  const balanceDue = totalAmount - paidAmount;
  const status = paymentType === "cash" ? "paid" : "credit";
  const invoiceNumber = await nextInvoiceNumber();

  const [sale] = await db.insert(salesTable).values({
    invoiceNumber, saleDate, customerId, fsNumber: fsNumber ?? null, machineNumber: machineNumber ?? null, paymentType, paymentMethod: paymentMethod ?? null,
    bankName: bankName ?? null, vatApplicable: vatApplicable ?? false, vatAmount: vatAmount.toString(),
    withholdingAmount: "0", discountAmount: "0", subtotal: subtotal.toString(), totalAmount: totalAmount.toString(),
    paidAmount: paidAmount.toString(), balanceDue: balanceDue.toString(), status, dueDate: dueDate ?? null,
    salespersonId: salespersonId ?? null, storeId: storeId ?? null, remarks: remarks ?? null,
  }).returning();

  for (const item of items) {
    await db.insert(saleItemsTable).values({
      saleId: sale.id, productId: item.productId, quantity: item.quantity.toString(),
      unit: item.unit, unitPrice: item.unitPrice.toString(), discount: (item.discount ?? 0).toString(),
      totalPrice: item.totalPrice.toString(),
    });

    // Deduct inventory if store specified
    if (storeId) {
      const [inv] = await db.select().from(inventoryTable).where(and(eq(inventoryTable.productId, item.productId), eq(inventoryTable.storeId, storeId)));
      if (inv) {
        const newQty = Math.max(0, parseFloat(inv.quantity as string) - parseFloat(item.quantity.toString())).toString();
        await db.update(inventoryTable).set({ quantity: newQty, updatedAt: new Date() }).where(eq(inventoryTable.id, inv.id));
      } else {
        await db.insert(inventoryTable).values({ productId: item.productId, storeId, quantity: (-parseFloat(item.quantity.toString())).toString() });
      }
      await db.insert(inventoryMovementsTable).values({ productId: item.productId, storeId, movementType: "sale", quantity: (-parseFloat(item.quantity.toString())).toString(), referenceId: sale.id, referenceType: "sale", createdBy: req.session.userId });
    }
  }

  // Update customer credit balance if credit sale
  if (paymentType === "credit") {
    // Fix: Add to existing balance instead of replacing
    await db
      .update(customersTable)
      .set({ creditBalance: sql`${customersTable.creditBalance} + ${balanceDue}` })
      .where(eq(customersTable.id, customerId));

    // Notify finance / supervisors about the new credit liability
    await notifyByPermission("can_view_reports", storeId ?? null, {
      type: "credit_sale",
      title: `Credit Sale — ${invoiceNumber}`,
      message: `New credit sale of ETB ${Number(totalAmount).toLocaleString(undefined, { minimumFractionDigits: 2 })} recorded. Balance due: ETB ${Number(balanceDue).toLocaleString(undefined, { minimumFractionDigits: 2 })}.`,
      entityType: "sale",
      entityId: sale.id,
    });
  }

  const saleItems = await db.select().from(saleItemsTable).where(eq(saleItemsTable.saleId, sale.id));
  res.status(201).json({ ...sale, customerName: null, salespersonName: null, items: saleItems });
});

router.get("/sales/:id", requireAuth, async (req, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  const [sale] = await db
    .select({
      id: salesTable.id,
      invoiceNumber: salesTable.invoiceNumber,
      saleDate: salesTable.saleDate,
      customerId: salesTable.customerId,
      customerName: customersTable.name,
      fsNumber: salesTable.fsNumber,
      machineNumber: salesTable.machineNumber,
      paymentType: salesTable.paymentType,
      paymentMethod: salesTable.paymentMethod,
      status: salesTable.status,
      subtotal: salesTable.subtotal,
      vatApplicable: salesTable.vatApplicable,
      vatAmount: salesTable.vatAmount,
      withholdingAmount: salesTable.withholdingAmount,
      discountAmount: salesTable.discountAmount,
      totalAmount: salesTable.totalAmount,
      paidAmount: salesTable.paidAmount,
      balanceDue: salesTable.balanceDue,
      dueDate: salesTable.dueDate,
      salespersonId: salesTable.salespersonId,
      storeId: salesTable.storeId,
      remarks: salesTable.remarks,
      createdAt: salesTable.createdAt
    })
    .from(salesTable)
    .leftJoin(customersTable, eq(salesTable.customerId, customersTable.id))
    .where(eq(salesTable.id, id));
  if (!sale) { res.status(404).json({ error: "Not found" }); return; }
  const items = await db.select().from(saleItemsTable).where(eq(saleItemsTable.saleId, id));
  res.json({ ...sale, salespersonName: null, items });
});

export default router;