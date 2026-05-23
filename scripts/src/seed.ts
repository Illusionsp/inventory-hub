import { db, usersTable, storesTable, categoriesTable, productsTable, suppliersTable, customersTable, inventoryTable, salesTable } from "@workspace/db";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";

async function seed() {
  console.log("Seeding database...");

  // Stores
  const existingStores = await db.select().from(storesTable);
  if (existingStores.length === 0) {
    await db.insert(storesTable).values([
      { name: "Main Raw Material Store", type: "main_raw_material", location: "Warehouse A, Building 1" },
      { name: "Semi-Finished Production Store", type: "semi_finished", location: "Production Floor, Building 2" },
      { name: "Final Production Store", type: "final_production", location: "Production Floor, Building 3" },
      { name: "Main Finished Product Store", type: "main_finished", location: "Warehouse B, Building 4" },
    ]);
    console.log("Stores seeded");
  }

  const stores = await db.select().from(storesTable);
  const rawStore = stores.find(s => s.type === "main_raw_material")!;
  const semiStore = stores.find(s => s.type === "semi_finished")!;
  const finishedStore = stores.find(s => s.type === "main_finished")!;

  // Users
  const existingUsers = await db.select().from(usersTable);
  if (existingUsers.length === 0) {
    const adminHash = await bcrypt.hash("admin123", 10);
    const managerHash = await bcrypt.hash("manager123", 10);
    await db.insert(usersTable).values([
      { name: "Super Admin", email: "admin@inventorypro.com", passwordHash: adminHash, role: "super_admin" },
      { name: "Store Manager", email: "store.manager@inventorypro.com", passwordHash: managerHash, role: "store_manager" },
      { name: "Production Manager", email: "production@inventorypro.com", passwordHash: managerHash, role: "production_manager" },
      { name: "Sales Officer", email: "sales@inventorypro.com", passwordHash: managerHash, role: "sales_officer" },
      { name: "Finance Officer", email: "finance@inventorypro.com", passwordHash: managerHash, role: "finance_officer" },
      { name: "General Manager", email: "gm@inventorypro.com", passwordHash: adminHash, role: "approver" },
    ]);
    console.log("Users seeded");
  }

  // Categories
  const existingCats = await db.select().from(categoriesTable);
  if (existingCats.length === 0) {
    await db.insert(categoriesTable).values([
      { name: "Raw Materials", description: "Unprocessed materials for production" },
      { name: "Semi-Finished Goods", description: "Partially processed production items" },
      { name: "Finished Products", description: "Final products ready for sale" },
      { name: "Packaging Materials", description: "Materials used for packaging finished goods" },
      { name: "Chemicals", description: "Chemical compounds used in production" },
    ]);
    console.log("Categories seeded");
  }

  const cats = await db.select().from(categoriesTable);
  const rawCat = cats.find(c => c.name === "Raw Materials")!;
  const semiCat = cats.find(c => c.name === "Semi-Finished Goods")!;
  const finishedCat = cats.find(c => c.name === "Finished Products")!;
  const packagingCat = cats.find(c => c.name === "Packaging Materials")!;
  const chemCat = cats.find(c => c.name === "Chemicals")!;

  // Suppliers
  const existingSuppliers = await db.select().from(suppliersTable);
  if (existingSuppliers.length === 0) {
    await db.insert(suppliersTable).values([
      { name: "Alpha Materials Ltd", contactPerson: "John Kamau", email: "john@alphamaterials.co", phone: "+254 700 100 001", address: "Industrial Area, Nairobi" },
      { name: "Beta Chemicals Co", contactPerson: "Jane Wanjiku", email: "jane@betachem.co", phone: "+254 700 100 002", address: "Mombasa Road, Nairobi" },
      { name: "Gamma Packaging", contactPerson: "Peter Ochieng", email: "peter@gammapkg.co", phone: "+254 700 100 003", address: "Ngong Road, Nairobi" },
    ]);
    console.log("Suppliers seeded");
  }

  // Customers
  const existingCustomers = await db.select().from(customersTable);
  if (existingCustomers.length === 0) {
    await db.insert(customersTable).values([
      { name: "Nairobi Supermart Ltd", type: "company", email: "orders@nairobisupermart.co", phone: "+254 720 200 001", address: "Westlands, Nairobi", creditBalance: "0" },
      { name: "Mombasa Trading Co", type: "company", email: "procurement@mombsatrade.co", phone: "+254 720 200 002", address: "Old Town, Mombasa", creditBalance: "85000" },
      { name: "Walk-in Customer", type: "walk_in", creditBalance: "0" },
    ]);
    console.log("Customers seeded");
  }

  // Products
  const existingProducts = await db.select().from(productsTable);
  if (existingProducts.length === 0) {
    await db.insert(productsTable).values([
      { name: "Raw Sugar", sku: "RM-001", type: "raw_material", unit: "KG", categoryId: rawCat.id, reorderLevel: "500", unitCost: "45.00" },
      { name: "Palm Oil", sku: "RM-002", type: "raw_material", unit: "LITRE", categoryId: rawCat.id, reorderLevel: "200", unitCost: "180.00" },
      { name: "Sodium Hydroxide", sku: "RM-003", type: "raw_material", unit: "KG", categoryId: chemCat.id, reorderLevel: "100", unitCost: "95.00" },
      { name: "Semi-Processed Mix A", sku: "SF-001", type: "semi_finished", unit: "KG", categoryId: semiCat.id, reorderLevel: "100", unitCost: "250.00" },
      { name: "Premium Soap Bar", sku: "FP-001", type: "finished", unit: "PCS", categoryId: finishedCat.id, reorderLevel: "200", unitCost: "85.00" },
      { name: "Deluxe Lotion 500ml", sku: "FP-002", type: "finished", unit: "PCS", categoryId: finishedCat.id, reorderLevel: "150", unitCost: "320.00" },
      { name: "Carton Box (24pcs)", sku: "PK-001", type: "packaging", unit: "PCS", categoryId: packagingCat.id, reorderLevel: "50", unitCost: "120.00" },
      { name: "Plastic Bottle 500ml", sku: "PK-002", type: "packaging", unit: "PCS", categoryId: packagingCat.id, reorderLevel: "100", unitCost: "25.00" },
      { name: "Product Label A", sku: "PK-003", type: "packaging", unit: "PCS", categoryId: packagingCat.id, reorderLevel: "500", unitCost: "3.50" },
    ]);
    console.log("Products seeded");
  }

  const products = await db.select().from(productsTable);
  const rm001 = products.find(p => p.sku === "RM-001")!;
  const rm002 = products.find(p => p.sku === "RM-002")!;
  const rm003 = products.find(p => p.sku === "RM-003")!;
  const sf001 = products.find(p => p.sku === "SF-001")!;
  const fp001 = products.find(p => p.sku === "FP-001")!;
  const fp002 = products.find(p => p.sku === "FP-002")!;
  const pk001 = products.find(p => p.sku === "PK-001")!;
  const pk002 = products.find(p => p.sku === "PK-002")!;
  const pk003 = products.find(p => p.sku === "PK-003")!;

  // Inventory
  const existingInventory = await db.select().from(inventoryTable);
  if (existingInventory.length === 0) {
    await db.insert(inventoryTable).values([
      { productId: rm001.id, storeId: rawStore.id, quantity: "1200" },
      { productId: rm002.id, storeId: rawStore.id, quantity: "450" },
      { productId: rm003.id, storeId: rawStore.id, quantity: "85" },
      { productId: sf001.id, storeId: semiStore.id, quantity: "300" },
      { productId: fp001.id, storeId: finishedStore.id, quantity: "850" },
      { productId: fp002.id, storeId: finishedStore.id, quantity: "320" },
      { productId: pk001.id, storeId: rawStore.id, quantity: "200" },
      { productId: pk002.id, storeId: rawStore.id, quantity: "800" },
      { productId: pk003.id, storeId: rawStore.id, quantity: "2000" },
    ]);
    console.log("Inventory seeded");
  }

  // Sample sales
  const existingSales = await db.select().from(salesTable);
  if (existingSales.length === 0) {
    const customers = await db.select().from(customersTable);
    const walkIn = customers.find(c => c.name === "Walk-in Customer")!;
    const mombasaTrading = customers.find(c => c.name === "Mombasa Trading Co")!;

    const today = new Date().toISOString().split("T")[0];
    const dueDate = new Date(Date.now() + 30 * 86400000).toISOString().split("T")[0];

    await db.insert(salesTable).values([
      {
        invoiceNumber: "INV-001001", saleDate: today, customerId: walkIn.id,
        paymentType: "cash", paymentMethod: "cash", status: "paid",
        subtotal: "42500", vatApplicable: false, vatAmount: "0", withholdingAmount: "0",
        discountAmount: "0", totalAmount: "42500", paidAmount: "42500", balanceDue: "0",
        remarks: "Cash sale",
      },
      {
        invoiceNumber: "INV-001002", saleDate: today, customerId: mombasaTrading.id,
        paymentType: "credit", status: "credit",
        subtotal: "127500", vatApplicable: true, vatAmount: "19125", withholdingAmount: "0",
        discountAmount: "0", totalAmount: "146625", paidAmount: "0", balanceDue: "146625",
        dueDate, remarks: "Credit sale - 30 days",
      },
    ]);
    console.log("Sales seeded");
  }

  console.log("Seeding complete!");
  process.exit(0);
}

seed().catch(err => { console.error(err); process.exit(1); });
