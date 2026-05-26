import { pgTable, serial, integer, text, numeric, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const storeRequestsTable = pgTable("store_requests", {
  id: serial("id").primaryKey(),
  requestNumber: text("request_number").notNull().unique(),
  requestingStoreId: integer("requesting_store_id").notNull(),
  receivingStoreId: integer("receiving_store_id").notNull(),
  requestedById: integer("requested_by_id"),
  status: text("status").notNull().default("pending"), // pending | approved | rejected | sent | received
  notes: text("notes"),
  rejectionReason: text("rejection_reason"),
  sentAt: timestamp("sent_at"),
  receivedAt: timestamp("received_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const storeRequestItemsTable = pgTable("store_request_items", {
  id: serial("id").primaryKey(),
  requestId: integer("request_id").notNull(),
  productId: integer("product_id").notNull(),
  quantity: numeric("quantity", { precision: 12, scale: 3 }).notNull(),
});

export const insertStoreRequestSchema = createInsertSchema(storeRequestsTable).omit({ id: true, createdAt: true, updatedAt: true });
export const insertStoreRequestItemSchema = createInsertSchema(storeRequestItemsTable).omit({ id: true });
export type InsertStoreRequest = z.infer<typeof insertStoreRequestSchema>;
export type StoreRequest = typeof storeRequestsTable.$inferSelect;
export type StoreRequestItem = typeof storeRequestItemsTable.$inferSelect;
