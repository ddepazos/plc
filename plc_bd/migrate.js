import pg from 'pg';
import { readFile } from 'node:fs/promises';

const url = process.env.DATABASE_URL;
if (!url) throw new Error('Define DATABASE_URL antes de ejecutar la migración.');
const sql = await readFile(new URL('./schema.sql', import.meta.url), 'utf8');
const pool = new pg.Pool({ connectionString: url });
try {
  await pool.query(sql);
  console.log('PLC_BD: esquema PostgreSQL aplicado.');
} finally {
  await pool.end();
}
