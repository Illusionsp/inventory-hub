import { pgTable, serial, integer, text, numeric, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const transfersTable = pgTable("transfers", {
  id: serial("id").primaryKey(),
  transferNumber: text("transfer_number").notNull().unique(),
  fromStoreId: integer("from_store_id").notNull(),
  toStoreId: integer("to_store_id").notNull(),
  status: text("status").notNull().default("pending"), // pending | approved | rejected | shipped | received
  notes: text("notes"),
  requestedById: integer("requested_by_id"),
  approvedById: integer("approved_by_id"),
  rejectionReason: text("rejection_reason"),
  shippedAt: timestamp("shipped_at"),
  receivedAt: timestamp("received_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const transferItemsTable = pgTable("transfer_items", {
  id: serial("id").primaryKey(),
  transferId: integer("transfer_id").notNull(),
  productId: integer("product_id").notNull(),
  requestedQty: numeric("requested_qty", { precision: 12, scale: 3 }).notNull(),
  approvedQty: numeric("approved_qty", { precision: 12, scale: 3 }),
  shippedQty: numeric("shipped_qty", { precision: 12, scale: 3 }),
  receivedQty: numeric("received_qty", { precision: 12, scale: 3 }),
});

export const insertTransferSchema = createInsertSchema(transfersTable).omit({ id: true, createdAt: true, updatedAt: true });
export const insertTransferItemSchema = createInsertSchema(transferItemsTable).omit({ id: true });
export type InsertTransfer = z.infer<typeof insertTransferSchema>;
export type Transfer = typeof transfersTable.$inferSelect;
export type TransferItem = typeof transferItemsTable.$inferSelect;
