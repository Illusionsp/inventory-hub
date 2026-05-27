import { pgTable, serial, integer, text, numeric, timestamp } from "drizzle-orm/pg-core";

export const openingStockTable = pgTable("opening_stock", {
  id: serial("id").primaryKey(),
  storeId: integer("store_id").notNull(),
  productId: integer("product_id"),
  itemName: text("item_name").notNull(),
  quantity: numeric("quantity", { precision: 12, scale: 3 }).notNull(),
  unit: text("unit").notNull(),
  stockType: text("stock_type").notNull().default("raw_material"),
  batchDetails: text("batch_details"),
  entryDate: text("entry_date").notNull(),
  notes: text("notes"),
  createdBy: integer("created_by"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type OpeningStock = typeof openingStockTable.$inferSelect;
