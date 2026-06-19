import { pgTable, serial, integer, text, numeric, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const salesTable = pgTable("sales", {
  id: serial("id").primaryKey(),
  invoiceNumber: text("invoice_number").notNull().unique(),
  saleDate: text("sale_date").notNull(),
  customerId: integer("customer_id").notNull(),
  fsNumber: text("fs_number"),
  machineNumber: text("machine_number"),
  paymentType: text("payment_type").notNull(), // cash | credit
  paymentMethod: text("payment_method"), // cash | bank_transfer | cheque
  bankName: text("bank_name"),
  status: text("status").notNull().default("paid"), // paid | credit | partially_paid | overdue
  subtotal: numeric("subtotal", { precision: 14, scale: 2 }).notNull().default("0"),
  vatApplicable: boolean("vat_applicable").notNull().default(false),
  vatAmount: numeric("vat_amount", { precision: 14, scale: 2 }).notNull().default("0"),
  withholdingAmount: numeric("withholding_amount", { precision: 14, scale: 2 }).notNull().default("0"),
  discountAmount: numeric("discount_amount", { precision: 14, scale: 2 }).notNull().default("0"),
  totalAmount: numeric("total_amount", { precision: 14, scale: 2 }).notNull().default("0"),
  paidAmount: numeric("paid_amount", { precision: 14, scale: 2 }).notNull().default("0"),
  balanceDue: numeric("balance_due", { precision: 14, scale: 2 }).notNull().default("0"),
  dueDate: text("due_date"),
  salespersonId: integer("salesperson_id"),
  storeId: integer("store_id"),
  remarks: text("remarks"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const saleItemsTable = pgTable("sale_items", {
  id: serial("id").primaryKey(),
  saleId: integer("sale_id").notNull(),
  productId: integer("product_id").notNull(),
  quantity: numeric("quantity", { precision: 12, scale: 3 }).notNull(),
  unit: text("unit").notNull(),
  unitPrice: numeric("unit_price", { precision: 14, scale: 4 }).notNull(),
  discount: numeric("discount", { precision: 14, scale: 2 }).notNull().default("0"),
  totalPrice: numeric("total_price", { precision: 14, scale: 2 }).notNull(),
});

export const insertSaleSchema = createInsertSchema(salesTable).omit({ id: true, createdAt: true, updatedAt: true });
export const insertSaleItemSchema = createInsertSchema(saleItemsTable).omit({ id: true });
export type InsertSale = z.infer<typeof insertSaleSchema>;
export type Sale = typeof salesTable.$inferSelect;
export type SaleItem = typeof saleItemsTable.$inferSelect;
