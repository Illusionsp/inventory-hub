import { Router } from "express";
import { eq, and, or, SQL } from "drizzle-orm";
import { db, storeRequestsTable, storeRequestItemsTable, usersTable, productsTable, inventoryTable, inventoryMovementsTable } from "@workspace/db";
import { requireAuth, requirePermission } from "../lib/auth";
import { notifyByPermission } from "../lib/notify";

const router = Router();

async function nextRequestNumber(): Promise<string> {
  const rows = await db.select({ id: storeRequestsTable.id }).from(storeRequestsTable);
  return `SRQ-${String(rows.length + 1001).padStart(6, "0")}`;
}

/** Resolve storeId for the current user */
async function getUserStoreId(userId: number): Promise<number | null> {
  const [user] = await db.select({ storeId: usersTable.storeId }).from(usersTable).where(eq(usersTable.id, userId));
  return user?.storeId ?? null;
}

router.get("/store-requests", requireAuth, async (req, res): Promise<void> => {
  const { status, direction, page = "1", limit = "20" } = req.query as Record<string, string>;
  const pageNum = parseInt(page, 10);
  const limitNum = parseInt(limit, 10);
  const offset = (pageNum - 1) * limitNum;

  const userStoreId = await getUserStoreId(req.session.userId!);
  const userRole = req.session.userRole;

  const conditions: SQL[] = [];
  if (status) conditions.push(eq(storeRequestsTable.status, status));

  // Store managers only see requests related to their own store
  if (userRole === "store_manager" && userStoreId) {
    if (direction === "outgoing") {
      conditions.push(eq(storeRequestsTable.requestingStoreId, userStoreId));
    } else if (direction === "incoming") {
      conditions.push(eq(storeRequestsTable.receivingStoreId, userStoreId));
    } else {
      conditions.push(
        or(
          eq(storeRequestsTable.requestingStoreId, userStoreId),
          eq(storeRequestsTable.receivingStoreId, userStoreId),
        )!,
      );
    }
  }

  const where = conditions.length > 0 ? and(...conditions) : undefined;
  const rows = await db.select().from(storeRequestsTable).where(where).orderBy(storeRequestsTable.createdAt).limit(limitNum).offset(offset);
  const total = await db.$count(storeRequestsTable, where);

  res.json({ data: rows, total, page: pageNum, limit: limitNum });
});

router.post("/store-requests", requireAuth, requirePermission("can_create_store_requests"), async (req, res): Promise<void> => {
  const { requestingStoreId, receivingStoreId, notes, items } = req.body;
  if (!requestingStoreId || !receivingStoreId || !items?.length) {
    res.status(400).json({ error: "requestingStoreId, receivingStoreId, and items are required" });
    return;
  }
  if (requestingStoreId === receivingStoreId) {
    res.status(400).json({ error: "Requesting and receiving stores must differ" });
    return;
  }

  const requestNumber = await nextRequestNumber();
  const [request] = await db
    .insert(storeRequestsTable)
    .values({
      requestNumber,
      requestingStoreId,
      receivingStoreId,
      notes: notes ?? null,
      requestedById: req.session.userId,
    })
    .returning();

  for (const item of items) {
    await db.insert(storeRequestItemsTable).values({
      requestId: request.id,
      productId: item.productId,
      quantity: item.quantity.toString(),
      unit: item.unit ?? null,
    });
  }

  const insertedItems = await db
    .select()
    .from(storeRequestItemsTable)
    .where(eq(storeRequestItemsTable.requestId, request.id));

  await notifyByPermission("can_approve_store_requests", receivingStoreId, {
    type: "store_request", title: "New Store Request — Awaiting Your Approval",
    message: `Request ${requestNumber} has been submitted by another store and requires your approval.`,
    entityType: "store_request", entityId: request.id,
  });

  res.status(201).json({ ...request, items: insertedItems });
});

router.get("/store-requests/:id", requireAuth, async (req, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  const [request] = await db.select().from(storeRequestsTable).where(eq(storeRequestsTable.id, id));
  if (!request) { res.status(404).json({ error: "Not found" }); return; }

  const items = await db
    .select({
      id: storeRequestItemsTable.id,
      requestId: storeRequestItemsTable.requestId,
      productId: storeRequestItemsTable.productId,
      quantity: storeRequestItemsTable.quantity,
      unit: storeRequestItemsTable.unit,
      productName: productsTable.name,
      productSku: productsTable.sku,
    })
    .from(storeRequestItemsTable)
    .leftJoin(productsTable, eq(storeRequestItemsTable.productId, productsTable.id))
    .where(eq(storeRequestItemsTable.requestId, id));

  res.json({ ...request, items });
});

router.post("/store-requests/:id/approve", requireAuth, requirePermission("can_approve_store_requests"), async (req, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  const [request] = await db
    .update(storeRequestsTable)
    .set({ status: "approved", updatedAt: new Date() })
    .where(and(eq(storeRequestsTable.id, id), eq(storeRequestsTable.status, "pending")))
    .returning();
  if (!request) { res.status(404).json({ error: "Not found or not pending" }); return; }

  await notifyByPermission("can_create_store_requests", request.requestingStoreId, {
    type: "store_request", title: "Store Request Approved",
    message: `Your request ${request.requestNumber} has been approved. Items will be dispatched to your store.`,
    entityType: "store_request", entityId: id,
  });

  const items = await db.select().from(storeRequestItemsTable).where(eq(storeRequestItemsTable.requestId, id));
  res.json({ ...request, items });
});

router.post("/store-requests/:id/reject", requireAuth, requirePermission("can_approve_store_requests"), async (req, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  const { reason } = req.body;
  const [request] = await db
    .update(storeRequestsTable)
    .set({ status: "rejected", rejectionReason: reason ?? null, updatedAt: new Date() })
    .where(and(eq(storeRequestsTable.id, id), eq(storeRequestsTable.status, "pending")))
    .returning();
  if (!request) { res.status(404).json({ error: "Not found or not pending" }); return; }

  await notifyByPermission("can_create_store_requests", request.requestingStoreId, {
    type: "store_request", title: "Store Request Rejected",
    message: `Your request ${request.requestNumber} has been rejected.${reason ? ` Reason: ${reason}` : ""}`,
    entityType: "store_request", entityId: id,
  });

  const items = await db.select().from(storeRequestItemsTable).where(eq(storeRequestItemsTable.requestId, id));
  res.json({ ...request, items });
});

router.post("/store-requests/:id/send", requireAuth, requirePermission("can_approve_dispatch"), async (req, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  const [request] = await db
    .update(storeRequestsTable)
    .set({ status: "sent", sentAt: new Date(), updatedAt: new Date() })
    .where(and(eq(storeRequestsTable.id, id), eq(storeRequestsTable.status, "approved")))
    .returning();
  if (!request) { res.status(404).json({ error: "Not found or not approved" }); return; }

  const items = await db.select().from(storeRequestItemsTable).where(eq(storeRequestItemsTable.requestId, id));

  // Guard: ensure no item would make sending store's stock go negative
  for (const item of items) {
    const [existing] = await db
      .select()
      .from(inventoryTable)
      .where(and(eq(inventoryTable.productId, item.productId), eq(inventoryTable.storeId, request.receivingStoreId)));
    const currentQty = existing ? parseFloat(String(existing.quantity)) : 0;
    const requestedQty = parseFloat(String(item.quantity));
    if (currentQty < requestedQty) {
      // Roll back the status update — set back to approved
      await db.update(storeRequestsTable).set({ status: "approved", sentAt: null, updatedAt: new Date() }).where(eq(storeRequestsTable.id, id));
      res.status(400).json({ error: `Insufficient stock for product #${item.productId}. Available: ${currentQty}, Requested: ${requestedQty}` });
      return;
    }
  }

  // Deduct stock from the sending store (receivingStoreId = store that fulfils the request)
  for (const item of items) {
    const qty = parseFloat(String(item.quantity));
    const [existing] = await db
      .select()
      .from(inventoryTable)
      .where(and(eq(inventoryTable.productId, item.productId), eq(inventoryTable.storeId, request.receivingStoreId)));
    if (existing) {
      const newQty = (parseFloat(String(existing.quantity)) - qty).toString();
      await db.update(inventoryTable).set({ quantity: newQty, updatedAt: new Date() }).where(eq(inventoryTable.id, existing.id));
    } else {
      await db.insert(inventoryTable).values({ productId: item.productId, storeId: request.receivingStoreId, quantity: "0" });
    }
    await db.insert(inventoryMovementsTable).values({
      productId: item.productId,
      storeId: request.receivingStoreId,
      movementType: "transfer_out",
      quantity: (-qty).toString(),
      referenceId: id,
      referenceType: "store_request",
      createdBy: req.session.userId,
    });
  }

  await notifyByPermission("can_receive_items", request.requestingStoreId, {
    type: "store_request", title: "Items Dispatched — Ready to Receive",
    message: `Items for request ${request.requestNumber} are on their way. Please mark as received when they arrive.`,
    entityType: "store_request", entityId: id,
  });

  res.json({ ...request, items });
});

router.post("/store-requests/:id/receive", requireAuth, requirePermission("can_receive_items"), async (req, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  const [request] = await db
    .update(storeRequestsTable)
    .set({ status: "received", receivedAt: new Date(), updatedAt: new Date() })
    .where(and(eq(storeRequestsTable.id, id), eq(storeRequestsTable.status, "sent")))
    .returning();
  if (!request) { res.status(404).json({ error: "Not found or not sent" }); return; }

  const items = await db.select().from(storeRequestItemsTable).where(eq(storeRequestItemsTable.requestId, id));

  // Add stock to the requesting store (the store that made and receives the request)
  for (const item of items) {
    const qty = parseFloat(String(item.quantity));
    const [existing] = await db
      .select()
      .from(inventoryTable)
      .where(and(eq(inventoryTable.productId, item.productId), eq(inventoryTable.storeId, request.requestingStoreId)));
    if (existing) {
      const newQty = (parseFloat(String(existing.quantity)) + qty).toString();
      await db.update(inventoryTable).set({ quantity: newQty, updatedAt: new Date() }).where(eq(inventoryTable.id, existing.id));
    } else {
      await db.insert(inventoryTable).values({ productId: item.productId, storeId: request.requestingStoreId, quantity: qty.toString() });
    }
    await db.insert(inventoryMovementsTable).values({
      productId: item.productId,
      storeId: request.requestingStoreId,
      movementType: "transfer_in",
      quantity: qty.toString(),
      referenceId: id,
      referenceType: "store_request",
      createdBy: req.session.userId,
    });
  }

  await notifyByPermission("can_view_request_status", request.receivingStoreId, {
    type: "store_request", title: "Request Fulfilled — Items Received by Requester",
    message: `Items for request ${request.requestNumber} have been confirmed received. The transfer is now complete.`,
    entityType: "store_request", entityId: id,
  });

  res.json({ ...request, items });
});

export default router;
