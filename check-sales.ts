import { db, salesTable } from "./packages/db/src/index";
import { gte, lte, and } from "drizzle-orm";

async function checkSales() {
    const today = new Date();
    const dateStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

    console.log("Checking sales for date:", dateStr);

    const sales = await db.select().from(salesTable).where(
        and(
            gte(salesTable.saleDate, dateStr),
            lte(salesTable.saleDate, `${dateStr} 23:59:59`)
        )
    );

    console.log("Found sales count:", sales.length);
    if (sales.length > 0) {
        console.log("First sale sample:", JSON.stringify(sales[0], null, 2));
    }

    // Also check all sales for today without the 23:59:59 buffer just in case
    const allToday = await db.select().from(salesTable).where(gte(salesTable.saleDate, dateStr));
    console.log("Total sales since start of today:", allToday.length);

    process.exit(0);
}

checkSales().catch(err => {
    console.error(err);
    process.exit(1);
});
