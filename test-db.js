import pg from 'pg';
const { Client } = pg;
const client = new Client({ connectionString: process.env.DATABASE_URL });
await client.connect();
const res = await client.query('SELECT id, email, role FROM users');
console.log("Users in DB:", res.rows);
await client.end();
