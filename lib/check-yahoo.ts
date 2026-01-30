import 'dotenv/config';
import { createClient } from '@libsql/client';

const db = createClient({
  url: process.env.TURSO_DATABASE_URL!,
  authToken: process.env.TURSO_AUTH_TOKEN!,
});

async function check() {
  // 刪除 2026-01-29 之前的文章
  const delResult = await db.execute(`
    DELETE FROM articles WHERE date(published_at) < '2026-01-29'
  `);
  console.log('Deleted', delResult.rowsAffected, 'old articles');

  // 檢查 Yahoo 新聞
  const yahoo = await db.execute(`
    SELECT a.id, a.title, a.thumbnail_url, ms.name_zh
    FROM articles a
    JOIN media_sources ms ON a.media_source_id = ms.id
    WHERE ms.code = 'yahoo'
    ORDER BY a.published_at DESC
    LIMIT 5
  `);

  console.log('\n📰 Yahoo latest 5 articles:');
  for (const row of yahoo.rows) {
    console.log('ID:', row.id);
    console.log('Title:', String(row.title).substring(0, 60));
    console.log('Has image:', row.thumbnail_url ? 'Yes ✓' : 'No ✗');
    if (row.thumbnail_url) {
      console.log('Image URL:', String(row.thumbnail_url).substring(0, 80));
    }
    console.log('---');
  }

  // 統計各來源有無圖片的情況
  const imageStats = await db.execute(`
    SELECT
      ms.name_zh as source,
      COUNT(*) as total,
      SUM(CASE WHEN a.thumbnail_url IS NOT NULL AND a.thumbnail_url != '' THEN 1 ELSE 0 END) as with_image
    FROM articles a
    JOIN media_sources ms ON a.media_source_id = ms.id
    GROUP BY ms.id
  `);

  console.log('\n📊 Image statistics by source:');
  for (const row of imageStats.rows) {
    const total = Number(row.total);
    const withImage = Number(row.with_image);
    const pct = total > 0 ? Math.round((withImage / total) * 100) : 0;
    console.log(`${row.source}: ${withImage}/${total} (${pct}%) have images`);
  }
}

check().catch(console.error);
