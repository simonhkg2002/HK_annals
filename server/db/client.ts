/**
 * 爬蟲專用的資料庫連接
 * 使用 dotenv 載入環境變數
 */

import 'dotenv/config';
import { createClient, Client } from '@libsql/client';

const url = process.env.TURSO_DATABASE_URL || process.env.VITE_TURSO_DATABASE_URL;
const authToken = process.env.TURSO_AUTH_TOKEN || process.env.VITE_TURSO_AUTH_TOKEN;

if (!url || !authToken) {
  throw new Error('Missing Turso database credentials. Please check your .env file.');
}

export const db: Client = createClient({
  url,
  authToken,
});

export async function testConnection(): Promise<boolean> {
  try {
    const result = await db.execute('SELECT 1 as test');
    console.log('✅ Turso connection successful');
    return true;
  } catch (error) {
    console.error('❌ Turso connection failed:', error);
    return false;
  }
}
