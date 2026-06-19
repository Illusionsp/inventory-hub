import { db, salesTable, productionBatchesTable } from "./packages/db/src/index";
import { lte, gte, sql } from "drizzle-orm";

async function main() {
    try {
        await db.execute(sql`ALTER TABLE categories ADD COLUMN code TEXT UNIQUE`);
        console.log("Column added");
    } catch (e: any) {
        console.error(e.message);
    }
    process.exit(0);
}

main().catch(console.error);
