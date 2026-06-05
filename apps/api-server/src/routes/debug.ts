import { Router } from "express";
import { sql } from "drizzle-orm";
import { db } from "@workspace/db";

const router = Router();

router.get("/debug/schema", async (req, res) => {
    try {
        const result = await db.execute(sql`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'production_batches'
    `);
        res.json(result.rows);
    } catch (err: any) {
        res.json({ error: err.message, stack: err.stack });
    }
});

export default router;
