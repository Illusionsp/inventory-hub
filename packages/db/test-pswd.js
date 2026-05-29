import pg from 'pg';
const { Client } = pg;
const client = new Client({ connectionString: process.env.DATABASE_URL });
await client.connect();
const res = await client.query('SELECT email, "password_hash" FROM users WHERE email = $1', ['admin@inventorypro.com']);
console.log("Admin in DB:", res.rows);
await client.end();
