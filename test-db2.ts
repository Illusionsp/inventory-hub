import { db, salesTable, productionBatchesTable } from "./packages/db/src/index";
import { lte, gte } from "drizzle-orm";

async function main() {
    const sales = await db.select().from(salesTable);
    console.log("ALL SALES DATES:", sales.map(s => ({ id: s.id, date: s.saleDate, invoice: s.invoiceNumber })));

    const dateFrom = "2026-05-01";
    const dateTo = "2026-05-28";

    console.log("\nREPORT FILTER TEST:");
    const filteredSales = await db.select().from(salesTable).where(
        gte(salesTable.saleDate, dateFrom)
    );
    console.log("GTE only:", filteredSales.map(s => ({ id: s.id, date: s.saleDate })));

    const batches = await db.select().from(productionBatchesTable);
    console.log("\nALL BATCHES STATUS & DATES:", batches.map(b => ({ id: b.id, status: b.status, date: b.productionDate, completedAt: b.completedAt })));

    process.exit(0);
}

main().catch(console.error);
