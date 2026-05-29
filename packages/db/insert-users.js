import pg from 'pg';
const { Client } = pg;
const client = new Client({ connectionString: process.env.DATABASE_URL });
await client.connect();

const sql = `
CREATE EXTENSION IF NOT EXISTS pgcrypto;
INSERT INTO users (name, email, password_hash, role)
VALUES ('Super Admin', 'admin@inventorypro.com', crypt('admin123', gen_salt('bf', 10)), 'super_admin')
ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash;

INSERT INTO users (name, email, password_hash, role)
VALUES ('Store Manager', 'manager@inventorypro.com', crypt('manager123', gen_salt('bf', 10)), 'store_manager')
ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash;
`;

await client.query(sql);
console.log("Admin users created/updated successfully.");
await client.end();
