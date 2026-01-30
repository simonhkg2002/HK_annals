import 'dotenv/config';
import { createClient } from '@libsql/client';
import { SOURCE_MAP } from '../types';

const db = createClient({
  url: process.env.TURSO_DATABASE_URL!,
  authToken: process.env.TURSO_AUTH_TOKEN!,
});

async function debug() {
  // Check Yahoo publish times
  const yahooResult = await db.execute(`
    SELECT a.published_at, a.title
    FROM articles a
    JOIN media_sources ms ON a.media_source_id = ms.id
    WHERE ms.code = 'yahoo'
    ORDER BY a.published_at DESC
    LIMIT 10
  `);

  console.log('Latest Yahoo articles:');
  for (const row of yahooResult.rows) {
    console.log(row.published_at, '-', String(row.title).substring(0, 50));
  }

  // Check overall distribution
  console.log('\n--- All sources latest article time ---');
  const latest = await db.execute(`
    SELECT ms.name_zh, MAX(a.published_at) as latest
    FROM articles a
    JOIN media_sources ms ON a.media_source_id = ms.id
    GROUP BY ms.id
  `);
  for (const row of latest.rows) {
    console.log(row.name_zh, ':', row.latest);
  }
}

debug().catch(console.error);
