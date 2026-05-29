import pg from 'pg';
const { Client } = pg;
const client = new Client({ connectionString: process.env.DATABASE_URL });
await client.connect();
const res = await client.query('SELECT count(*) FROM session');
console.log("Session table count:", res.rows[0].count);
const u = await client.query('SELECT email FROM users');
console.log("Users in DB:", u.rows);
await client.end();
