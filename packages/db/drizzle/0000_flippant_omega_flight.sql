CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"password_hash" text NOT NULL,
	"role" text DEFAULT 'sales_officer' NOT NULL,
	"store_id" integer,
	"is_active" boolean DEFAULT true NOT NULL,
	"permissions" text[],
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "stores" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"type" text NOT NULL,
	"location" text,
	"manager_id" integer,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "categories" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "categories_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "products" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"sku" text,
	"type" text NOT NULL,
	"unit" text NOT NULL,
	"category_id" integer,
	"reorder_level" numeric(12, 3) DEFAULT '0' NOT NULL,
	"unit_cost" numeric(14, 4),
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "suppliers" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"contact_person" text,
	"email" text,
	"phone" text,
	"address" text,
	"tax_number" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "customers" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"type" text DEFAULT 'company' NOT NULL,
	"email" text,
	"phone" text,
	"address" text,
	"tax_number" text,
	"credit_balance" numeric(14, 2) DEFAULT '0' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "inventory_movements" (
	"id" serial PRIMARY KEY NOT NULL,
	"product_id" integer NOT NULL,
	"store_id" integer NOT NULL,
	"movement_type" text NOT NULL,
	"quantity" numeric(12, 3) NOT NULL,
	"reference_id" integer,
	"reference_type" text,
	"notes" text,
	"created_by" integer,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "inventory" (
	"id" serial PRIMARY KEY NOT NULL,
	"product_id" integer NOT NULL,
	"store_id" integer NOT NULL,
	"quantity" numeric(12, 3) DEFAULT '0' NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "grn_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"grn_id" integer NOT NULL,
	"item_name" text,
	"product_id" integer,
	"quantity" numeric(12, 3) NOT NULL,
	"unit" text NOT NULL,
	"unit_cost" numeric(14, 4) NOT NULL,
	"total_cost" numeric(14, 2) NOT NULL,
	"batch_number" text,
	"expiry_date" text
);
--> statement-breakpoint
CREATE TABLE "grns" (
	"id" serial PRIMARY KEY NOT NULL,
	"grn_number" text NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"supplier_id" integer NOT NULL,
	"store_id" integer NOT NULL,
	"invoice_number" text,
	"po_number" text,
	"delivery_note_number" text,
	"received_date" text NOT NULL,
	"total_cost" numeric(14, 2) DEFAULT '0' NOT NULL,
	"vat_applicable" boolean DEFAULT false NOT NULL,
	"vat_amount" numeric(14, 2) DEFAULT '0' NOT NULL,
	"notes" text,
	"store_manager_name" text,
	"approver_signature_name" text,
	"created_by_id" integer,
	"approved_by_id" integer,
	"approved_at" timestamp,
	"rejection_reason" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "grns_grn_number_unique" UNIQUE("grn_number")
);
--> statement-breakpoint
CREATE TABLE "transfer_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"transfer_id" integer NOT NULL,
	"product_id" integer NOT NULL,
	"requested_qty" numeric(12, 3) NOT NULL,
	"approved_qty" numeric(12, 3),
	"shipped_qty" numeric(12, 3),
	"received_qty" numeric(12, 3)
);
--> statement-breakpoint
CREATE TABLE "transfers" (
	"id" serial PRIMARY KEY NOT NULL,
	"transfer_number" text NOT NULL,
	"from_store_id" integer NOT NULL,
	"to_store_id" integer NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"notes" text,
	"requested_by_id" integer,
	"approved_by_id" integer,
	"rejection_reason" text,
	"shipped_at" timestamp,
	"received_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "transfers_transfer_number_unique" UNIQUE("transfer_number")
);
--> statement-breakpoint
CREATE TABLE "store_request_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"request_id" integer NOT NULL,
	"product_id" integer NOT NULL,
	"quantity" numeric(12, 3) NOT NULL,
	"unit" text
);
--> statement-breakpoint
CREATE TABLE "store_requests" (
	"id" serial PRIMARY KEY NOT NULL,
	"request_number" text NOT NULL,
	"requesting_store_id" integer NOT NULL,
	"receiving_store_id" integer NOT NULL,
	"requested_by_id" integer,
	"status" text DEFAULT 'pending' NOT NULL,
	"notes" text,
	"rejection_reason" text,
	"sent_at" timestamp,
	"received_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "store_requests_request_number_unique" UNIQUE("request_number")
);
--> statement-breakpoint
CREATE TABLE "production_batches" (
	"id" serial PRIMARY KEY NOT NULL,
	"batch_number" text NOT NULL,
	"type" text NOT NULL,
	"status" text DEFAULT 'in_progress' NOT NULL,
	"stage_from_store_id" integer NOT NULL,
	"stage_to_store_id" integer NOT NULL,
	"planned_output_qty" numeric(12, 3) NOT NULL,
	"actual_output_qty" numeric(12, 3),
	"wastage_qty" numeric(12, 3),
	"wastage_percent" numeric(7, 2),
	"yield_percent" numeric(7, 2),
	"output_unit" text DEFAULT 'KG' NOT NULL,
	"production_date" text,
	"completed_at" timestamp,
	"responsible_user_id" integer,
	"notes" text,
	"dispatched_to_store_id" integer,
	"dispatched_at" timestamp,
	"final_product_name" text,
	"package_type" text,
	"package_size" numeric(10, 3),
	"package_size_unit" text,
	"packages_produced" numeric(12, 3),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "production_batches_batch_number_unique" UNIQUE("batch_number")
);
--> statement-breakpoint
CREATE TABLE "production_inputs" (
	"id" serial PRIMARY KEY NOT NULL,
	"batch_id" integer NOT NULL,
	"product_id" integer NOT NULL,
	"quantity" numeric(12, 3) NOT NULL,
	"unit" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "production_outputs" (
	"id" serial PRIMARY KEY NOT NULL,
	"batch_id" integer NOT NULL,
	"product_id" integer NOT NULL,
	"quantity" numeric(12, 3) NOT NULL,
	"unit" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sale_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"sale_id" integer NOT NULL,
	"product_id" integer NOT NULL,
	"quantity" numeric(12, 3) NOT NULL,
	"unit" text NOT NULL,
	"unit_price" numeric(14, 4) NOT NULL,
	"discount" numeric(14, 2) DEFAULT '0' NOT NULL,
	"total_price" numeric(14, 2) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sales" (
	"id" serial PRIMARY KEY NOT NULL,
	"invoice_number" text NOT NULL,
	"sale_date" text NOT NULL,
	"customer_id" integer NOT NULL,
	"fs_number" text,
	"payment_type" text NOT NULL,
	"payment_method" text,
	"bank_name" text,
	"status" text DEFAULT 'paid' NOT NULL,
	"subtotal" numeric(14, 2) DEFAULT '0' NOT NULL,
	"vat_applicable" boolean DEFAULT false NOT NULL,
	"vat_amount" numeric(14, 2) DEFAULT '0' NOT NULL,
	"withholding_amount" numeric(14, 2) DEFAULT '0' NOT NULL,
	"discount_amount" numeric(14, 2) DEFAULT '0' NOT NULL,
	"total_amount" numeric(14, 2) DEFAULT '0' NOT NULL,
	"paid_amount" numeric(14, 2) DEFAULT '0' NOT NULL,
	"balance_due" numeric(14, 2) DEFAULT '0' NOT NULL,
	"due_date" text,
	"salesperson_id" integer,
	"store_id" integer,
	"remarks" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "sales_invoice_number_unique" UNIQUE("invoice_number")
);
--> statement-breakpoint
CREATE TABLE "payments" (
	"id" serial PRIMARY KEY NOT NULL,
	"sale_id" integer NOT NULL,
	"amount" numeric(14, 2) NOT NULL,
	"payment_date" text NOT NULL,
	"payment_method" text NOT NULL,
	"bank_name" text,
	"reference" text,
	"notes" text,
	"created_by_id" integer,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer,
	"type" text NOT NULL,
	"title" text NOT NULL,
	"message" text NOT NULL,
	"is_read" boolean DEFAULT false NOT NULL,
	"entity_type" text,
	"entity_id" integer,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"action" text NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" integer,
	"changes" text,
	"ip_address" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "opening_stock" (
	"id" serial PRIMARY KEY NOT NULL,
	"store_id" integer NOT NULL,
	"product_id" integer,
	"item_name" text NOT NULL,
	"quantity" numeric(12, 3) NOT NULL,
	"unit" text NOT NULL,
	"stock_type" text DEFAULT 'raw_material' NOT NULL,
	"batch_details" text,
	"entry_date" text NOT NULL,
	"notes" text,
	"created_by" integer,
	"created_at" timestamp DEFAULT now() NOT NULL
);
