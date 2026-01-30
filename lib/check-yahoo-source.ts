import 'dotenv/config';
import { createClient } from '@libsql/client';

const db = createClient({
  url: process.env.TURSO_DATABASE_URL!,
  authToken: process.env.TURSO_AUTH_TOKEN!,
});

async function check() {
  const result = await db.execute(`
    SELECT a.id, a.title, ms.code as source_code, ms.name_zh
    FROM articles a
    JOIN media_sources ms ON a.media_source_id = ms.id
    WHERE ms.code = 'yahoo'
    LIMIT 3
  `);
  console.log('Yahoo articles in DB:');
  for (const row of result.rows) {
    console.log('source_code:', row.source_code, '| name_zh:', row.name_zh);
    console.log('title:', String(row.title).substring(0, 50));
    console.log('---');
  }
}
check().catch(console.error);
