import 'dotenv/config';
import { createClient } from '@libsql/client';

const db = createClient({
  url: process.env.TURSO_DATABASE_URL!,
  authToken: process.env.TURSO_AUTH_TOKEN!,
});

async function check() {
  const result = await db.execute(`
    SELECT ms.name_zh as source, COUNT(*) as count
    FROM articles a
    JOIN media_sources ms ON a.media_source_id = ms.id
    GROUP BY ms.id
    ORDER BY count DESC
  `);

  console.log('📊 News by source:');
  for (const row of result.rows) {
    console.log(`   ${row.source}: ${row.count}`);
  }

  // Recent news
  const recent = await db.execute(`
    SELECT ms.name_zh as source, a.title
    FROM articles a
    JOIN media_sources ms ON a.media_source_id = ms.id
    ORDER BY a.published_at DESC
    LIMIT 10
  `);

  console.log('\n📰 Recent 10 news:');
  for (const row of recent.rows) {
    console.log(`   [${row.source}] ${String(row.title).substring(0, 40)}...`);
  }
}

check().catch(console.error);
