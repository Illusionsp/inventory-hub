import { pgTable, serial, integer, text, numeric, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const grnsTable = pgTable("grns", {
  id: serial("id").primaryKey(),
  grnNumber: text("grn_number").notNull().unique(),
  status: text("status").notNull().default("draft"), // draft | pending_approval | approved | rejected | paid
  supplierId: integer("supplier_id").notNull(),
  storeId: integer("store_id").notNull(),
  invoiceNumber: text("invoice_number"),
  poNumber: text("po_number"),
  deliveryNoteNumber: text("delivery_note_number"),
  receivedDate: text("received_date").notNull(),
  totalCost: numeric("total_cost", { precision: 14, scale: 2 }).notNull().default("0"),
  notes: text("notes"),
  createdById: integer("created_by_id"),
  approvedById: integer("approved_by_id"),
  approvedAt: timestamp("approved_at"),
  rejectionReason: text("rejection_reason"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const grnItemsTable = pgTable("grn_items", {
  id: serial("id").primaryKey(),
  grnId: integer("grn_id").notNull(),
  productId: integer("product_id").notNull(),
  quantity: numeric("quantity", { precision: 12, scale: 3 }).notNull(),
  unit: text("unit").notNull(),
  unitCost: numeric("unit_cost", { precision: 14, scale: 4 }).notNull(),
  totalCost: numeric("total_cost", { precision: 14, scale: 2 }).notNull(),
  batchNumber: text("batch_number"),
  expiryDate: text("expiry_date"),
});

export const insertGrnSchema = createInsertSchema(grnsTable).omit({ id: true, createdAt: true, updatedAt: true });
export const insertGrnItemSchema = createInsertSchema(grnItemsTable).omit({ id: true });
export type InsertGrn = z.infer<typeof insertGrnSchema>;
export type Grn = typeof grnsTable.$inferSelect;
export type GrnItem = typeof grnItemsTable.$inferSelect;
