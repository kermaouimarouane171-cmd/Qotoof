/* eslint-disable no-console */
import dotenv from 'dotenv';
import pg from 'pg';

dotenv.config();

const { Pool } = pg;

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.warn('[db] DATABASE_URL is not set. Database operations will fail until it is configured.');
}

export const db = new Pool({
  connectionString,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

export const connectDB = async () => {
  const client = await db.connect();
  try {
    await client.query('SELECT 1');
    console.log('[db] Connected');
  } finally {
    client.release();
  }
};
