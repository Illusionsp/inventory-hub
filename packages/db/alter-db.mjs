import pg from 'pg';
const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
async function start() {
    try {
        await pool.query('ALTER TABLE categories ADD COLUMN code TEXT UNIQUE');
        console.log("Column added");
    } catch (e) { console.error(e.message); }
    process.exit(0);
}
start();
