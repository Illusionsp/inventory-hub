import pg from 'pg';

const { Client } = pg;
const client = new Client({ connectionString: process.env.DATABASE_URL });

async function run() {
    await client.connect();
    console.log("Connected...");
    try {
        await client.query("ALTER TABLE categories ADD COLUMN code TEXT UNIQUE;");
        console.log("Column added successfully.");
    } catch (err) {
        if (err.message.includes("already exists")) {
            console.log("Column already exists.");
        } else {
            console.error("Error:", err.message);
        }
    }
    await client.end();
}

run();
