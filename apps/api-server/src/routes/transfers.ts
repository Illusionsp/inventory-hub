import { Router } from "express";
import { eq, and, SQL } from "drizzle-orm";
import { db, transfersTable, transferItemsTable, storesTable, productsTable, inventoryTable, inventoryMovementsTable } from "@workspace/db";
import { requireAuth, requirePermission } from "../lib/auth";
import { notifyByPermission } from "../lib/notify";

const router = Router();

async function nextTransferNumber(): Promise<string> {
  const rows = await db.select({ id: transfersTable.id }).from(transfersTable);
  return `TRF-${String((rows.length + 1001)).padStart(6, "0")}`;
}

router.get("/transfers", requireAuth, async (req, res): Promise<void> => {
  const { status, fromStoreId, toStoreId, page = "1", limit = "20" } = req.query as Record<string, string>;
  const pageNum = parseInt(page, 10);
  const limitNum = parseInt(limit, 10);
  const offset = (pageNum - 1) * limitNum;

  const conditions: SQL[] = [];
  if (status) conditions.push(eq(transfersTable.status, status));
  if (fromStoreId) conditions.push(eq(transfersTable.fromStoreId, parseInt(fromStoreId, 10)));
  if (toStoreId) conditions.push(eq(transfersTable.toStoreId, parseInt(toStoreId, 10)));
  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const rows = await db.select().from(transfersTable).where(where).limit(limitNum).offset(offset);
  const total = await db.$count(transfersTable, where);
  const data = rows.map(r => ({ ...r, fromStoreName: null, toStoreName: null, items: [] }));
  res.json({ data, total, page: pageNum, limit: limitNum });
});

router.post("/transfers", requireAuth, async (req, res): Promise<void> => {
  const { fromStoreId, toStoreId, notes, items } = req.body;
  if (!fromStoreId || !toStoreId || !items?.length) {
    res.status(400).json({ error: "Missing required fields" });
    return;
  }

  const transferNumber = await nextTransferNumber();
  const [transfer] = await db.insert(transfersTable).values({
    transferNumber, fromStoreId, toStoreId, notes: notes ?? null, requestedById: req.session.userId,
  }).returning();

  for (const item of items) {
    await db.insert(transferItemsTable).values({
      transferId: transfer.id, productId: item.productId, requestedQty: item.requestedQty.toString(),
    });
  }

  const insertedItems = await db.select().from(transferItemsTable).where(eq(transferItemsTable.transferId, transfer.id));

  // Notify approvers at the destination store — they must review the request
  await notifyByPermission("can_approve_store_requests", toStoreId, {
    type: "transfer_pending",
    title: `Transfer Request — ${transferNumber}`,
    message: `A new stock transfer request is awaiting your approval.`,
    entityType: "transfer",
    entityId: transfer.id,
  });

  res.status(201).json({ ...transfer, fromStoreName: null, toStoreName: null, items: insertedItems });
});

router.get("/transfers/:id", requireAuth, async (req, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  const [transfer] = await db.select().from(transfersTable).where(eq(transfersTable.id, id));
  if (!transfer) { res.status(404).json({ error: "Not found" }); return; }
  const items = await db.select().from(transferItemsTable).where(eq(transferItemsTable.transferId, id));
  res.json({ ...transfer, fromStoreName: null, toStoreName: null, items });
});

router.post("/transfers/:id/approve", requireAuth, requirePermission("can_approve_store_requests"), async (req, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  const { notes } = req.body;
  const items = await db.select().from(transferItemsTable).where(eq(transferItemsTable.transferId, id));
  for (const item of items) {
    await db.update(transferItemsTable).set({ approvedQty: item.requestedQty }).where(eq(transferItemsTable.id, item.id));
  }
  const [t] = await db.update(transfersTable).set({ status: "approved", approvedById: req.session.userId }).where(eq(transfersTable.id, id)).returning();
  if (!t) { res.status(404).json({ error: "Not found" }); return; }

  // Notify the source store's dispatchers — they must ship the goods
  await notifyByPermission("can_approve_dispatch", t.fromStoreId, {
    type: "transfer_approved",
    title: `Transfer Approved — ${t.transferNumber}`,
    message: `Transfer request has been approved. Please prepare and ship the items.`,
    entityType: "transfer",
    entityId: t.id,
  });

  res.json({ ...t, fromStoreName: null, toStoreName: null, items });
});

router.post("/transfers/:id/reject", requireAuth, requirePermission("can_approve_store_requests"), async (req, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  const { notes } = req.body;
  const [t] = await db.update(transfersTable).set({ status: "rejected", rejectionReason: notes ?? null }).where(eq(transfersTable.id, id)).returning();
  if (!t) { res.status(404).json({ error: "Not found" }); return; }

  // Notify the source store that their request was rejected
  await notifyByPermission("can_create_store_requests", t.fromStoreId, {
    type: "transfer_rejected",
    title: `Transfer Rejected — ${t.transferNumber}`,
    message: `Your transfer request has been rejected.${notes ? ` Reason: ${notes}` : ""}`,
    entityType: "transfer",
    entityId: t.id,
  });

  res.json({ ...t, fromStoreName: null, toStoreName: null, items: [] });
});

router.post("/transfers/:id/ship", requireAuth, async (req, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  const { items: shipItems } = req.body;
  const [transfer] = await db.select().from(transfersTable).where(eq(transfersTable.id, id));
  if (!transfer) { res.status(404).json({ error: "Not found" }); return; }

  for (const si of (shipItems ?? [])) {
    await db.update(transferItemsTable).set({ shippedQty: si.shippedQty.toString() }).where(eq(transferItemsTable.id, si.transferItemId));
    const [item] = await db.select().from(transferItemsTable).where(eq(transferItemsTable.id, si.transferItemId));
    if (item) {
      const [inv] = await db.select().from(inventoryTable).where(and(eq(inventoryTable.productId, item.productId), eq(inventoryTable.storeId, transfer.fromStoreId)));
      if (inv) {
        const newQty = Math.max(0, parseFloat(inv.quantity as string) - si.shippedQty).toString();
        await db.update(inventoryTable).set({ quantity: newQty, updatedAt: new Date() }).where(eq(inventoryTable.id, inv.id));
      }
      await db.insert(inventoryMovementsTable).values({ productId: item.productId, storeId: transfer.fromStoreId, movementType: "transfer_out", quantity: (-si.shippedQty).toString(), referenceId: id, referenceType: "transfer", createdBy: req.session.userId });
    }
  }

  const [t] = await db.update(transfersTable).set({ status: "shipped", shippedAt: new Date() }).where(eq(transfersTable.id, id)).returning();
  const updatedItems = await db.select().from(transferItemsTable).where(eq(transferItemsTable.transferId, id));

  // Notify the destination store — items are on the way, ready to receive
  await notifyByPermission("can_receive_items", t.toStoreId, {
    type: "transfer_shipped",
    title: `Items Shipped — ${t.transferNumber}`,
    message: `Stock has been dispatched and is on its way. Please mark as received when it arrives.`,
    entityType: "transfer",
    entityId: t.id,
  });

  res.json({ ...t, fromStoreName: null, toStoreName: null, items: updatedItems });
});

router.post("/transfers/:id/receive", requireAuth, requirePermission("can_receive_items"), async (req, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  const { items: recvItems } = req.body;
  const [transfer] = await db.select().from(transfersTable).where(eq(transfersTable.id, id));
  if (!transfer) { res.status(404).json({ error: "Not found" }); return; }

  for (const ri of (recvItems ?? [])) {
    await db.update(transferItemsTable).set({ receivedQty: ri.receivedQty.toString() }).where(eq(transferItemsTable.id, ri.transferItemId));
    const [item] = await db.select().from(transferItemsTable).where(eq(transferItemsTable.id, ri.transferItemId));
    if (item) {
      const [inv] = await db.select().from(inventoryTable).where(and(eq(inventoryTable.productId, item.productId), eq(inventoryTable.storeId, transfer.toStoreId)));
      if (inv) {
        const newQty = (parseFloat(inv.quantity as string) + ri.receivedQty).toString();
        await db.update(inventoryTable).set({ quantity: newQty, updatedAt: new Date() }).where(eq(inventoryTable.id, inv.id));
      } else {
        await db.insert(inventoryTable).values({ productId: item.productId, storeId: transfer.toStoreId, quantity: ri.receivedQty.toString() });
      }
      await db.insert(inventoryMovementsTable).values({ productId: item.productId, storeId: transfer.toStoreId, movementType: "transfer_in", quantity: ri.receivedQty.toString(), referenceId: id, referenceType: "transfer", createdBy: req.session.userId });
    }
  }

  const [t] = await db.update(transfersTable).set({ status: "received", receivedAt: new Date() }).where(eq(transfersTable.id, id)).returning();
  const updatedItems = await db.select().from(transferItemsTable).where(eq(transferItemsTable.transferId, id));

  // Notify the source store that the transfer was successfully received
  await notifyByPermission("can_view_request_status", t.fromStoreId, {
    type: "transfer_received",
    title: `Transfer Received — ${t.transferNumber}`,
    message: `The destination store has confirmed receipt of the transferred items.`,
    entityType: "transfer",
    entityId: t.id,
  });

  res.json({ ...t, fromStoreName: null, toStoreName: null, items: updatedItems });
});

export default router;
