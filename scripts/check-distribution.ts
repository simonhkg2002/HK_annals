import 'dotenv/config';
import { createClient } from '@libsql/client';

const db = createClient({
  url: process.env.TURSO_DATABASE_URL!,
  authToken: process.env.TURSO_AUTH_TOKEN!,
});

async function check() {
  // Check earliest and latest articles per source
  const result = await db.execute(`
    SELECT
      ms.name_zh as source,
      COUNT(*) as count,
      MIN(date(a.published_at)) as earliest,
      MAX(date(a.published_at)) as latest
    FROM articles a
    JOIN media_sources ms ON a.media_source_id = ms.id
    GROUP BY ms.id
    ORDER BY count DESC
  `);

  console.log('📊 News distribution by source:');
  console.log('Source\t\tCount\tEarliest\tLatest');
  console.log('-'.repeat(60));
  for (const row of result.rows) {
    const source = String(row.source).padEnd(10);
    console.log(`${source}\t${row.count}\t${row.earliest}\t${row.latest}`);
  }

  // Check daily distribution for each source
  const daily = await db.execute(`
    SELECT
      date(a.published_at) as date,
      SUM(CASE WHEN ms.code = 'hk01' THEN 1 ELSE 0 END) as hk01,
      SUM(CASE WHEN ms.code = 'yahoo' THEN 1 ELSE 0 END) as yahoo,
      SUM(CASE WHEN ms.code = 'mingpao' THEN 1 ELSE 0 END) as mingpao,
      SUM(CASE WHEN ms.code = 'rthk' THEN 1 ELSE 0 END) as rthk
    FROM articles a
    JOIN media_sources ms ON a.media_source_id = ms.id
    WHERE a.published_at >= '2026-01-01'
    GROUP BY date(a.published_at)
    ORDER BY date DESC
  `);

  console.log('\n📅 Daily distribution (2026):');
  console.log('Date\t\tHK01\tYahoo\t明報\tRTHK');
  console.log('-'.repeat(50));
  for (const row of daily.rows) {
    console.log(`${row.date}\t${row.hk01}\t${row.yahoo}\t${row.mingpao}\t${row.rthk}`);
  }
}

check().catch(console.error);
