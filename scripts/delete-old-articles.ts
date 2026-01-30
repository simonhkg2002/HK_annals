import 'dotenv/config';
import { createClient } from '@libsql/client';

const db = createClient({
  url: process.env.TURSO_DATABASE_URL!,
  authToken: process.env.TURSO_AUTH_TOKEN!,
});

async function deleteOldArticles() {
  // Check count before deletion
  const before = await db.execute(`
    SELECT COUNT(*) as count FROM articles
    WHERE published_at < '2026-01-29'
  `);
  console.log('📊 Articles before 2026-01-29:', before.rows[0].count);

  // Delete old articles
  const result = await db.execute(`
    DELETE FROM articles
    WHERE published_at < '2026-01-29'
  `);
  console.log('✅ Deleted', result.rowsAffected, 'articles');

  // Check remaining
  const after = await db.execute(`
    SELECT ms.name_zh as source, COUNT(*) as count
    FROM articles a
    JOIN media_sources ms ON a.media_source_id = ms.id
    GROUP BY ms.id
    ORDER BY count DESC
  `);

  console.log('\n📊 Remaining articles by source:');
  for (const row of after.rows) {
    console.log(`   ${row.source}: ${row.count}`);
  }

  // Verify date range
  const dates = await db.execute(`
    SELECT
      MIN(date(published_at)) as earliest,
      MAX(date(published_at)) as latest
    FROM articles
  `);
  console.log('\n📅 Date range:', dates.rows[0].earliest, 'to', dates.rows[0].latest);
}

deleteOldArticles().catch(console.error);
