import fs from 'fs';
import pg from 'pg';
const { Client } = pg;
const client = new Client({ connectionString: process.env.DATABASE_URL });
await client.connect();
const sql = fs.readFileSync('drizzle/0000_flippant_omega_flight.sql', 'utf8');
await client.query(sql);
console.log("Migration applied successfully!");
await client.end();
