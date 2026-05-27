import { pgTable, serial, integer, text, numeric, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const productionBatchesTable = pgTable("production_batches", {
  id: serial("id").primaryKey(),
  batchNumber: text("batch_number").notNull().unique(),
  type: text("type").notNull(), // raw_to_semi | semi_to_finished
  status: text("status").notNull().default("in_progress"), // in_progress | completed | cancelled
  stageFromStoreId: integer("stage_from_store_id").notNull(),
  stageToStoreId: integer("stage_to_store_id").notNull(),
  plannedOutputQty: numeric("planned_output_qty", { precision: 12, scale: 3 }).notNull(),
  actualOutputQty: numeric("actual_output_qty", { precision: 12, scale: 3 }),
  wastageQty: numeric("wastage_qty", { precision: 12, scale: 3 }),
  wastagePercent: numeric("wastage_percent", { precision: 7, scale: 2 }),
  yieldPercent: numeric("yield_percent", { precision: 7, scale: 2 }),
  outputUnit: text("output_unit").notNull().default("KG"),
  productionDate: text("production_date"),
  completedAt: timestamp("completed_at"),
  responsibleUserId: integer("responsible_user_id"),
  notes: text("notes"),
  dispatchedToStoreId: integer("dispatched_to_store_id"),
  dispatchedAt: timestamp("dispatched_at"),
  finalProductName: text("final_product_name"),
  packageType: text("package_type"),
  packageSize: numeric("package_size", { precision: 10, scale: 3 }),
  packageSizeUnit: text("package_size_unit"),
  packagesProduced: numeric("packages_produced", { precision: 12, scale: 3 }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const productionInputsTable = pgTable("production_inputs", {
  id: serial("id").primaryKey(),
  batchId: integer("batch_id").notNull(),
  productId: integer("product_id").notNull(),
  quantity: numeric("quantity", { precision: 12, scale: 3 }).notNull(),
  unit: text("unit").notNull(),
});

export const productionOutputsTable = pgTable("production_outputs", {
  id: serial("id").primaryKey(),
  batchId: integer("batch_id").notNull(),
  productId: integer("product_id").notNull(),
  quantity: numeric("quantity", { precision: 12, scale: 3 }).notNull(),
  unit: text("unit").notNull(),
});

export const insertProductionBatchSchema = createInsertSchema(productionBatchesTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertProductionBatch = z.infer<typeof insertProductionBatchSchema>;
export type ProductionBatch = typeof productionBatchesTable.$inferSelect;
