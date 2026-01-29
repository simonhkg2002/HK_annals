import 'dotenv/config';
import { createClient } from '@libsql/client';

const db = createClient({
  url: process.env.TURSO_DATABASE_URL!,
  authToken: process.env.TURSO_AUTH_TOKEN!,
});

async function check() {
  // 檢查群組
  const clusters = await db.execute('SELECT * FROM news_clusters ORDER BY first_seen_at DESC LIMIT 5');
  console.log('📊 Recent Clusters:');
  console.log('='.repeat(60));
  for (const c of clusters.rows) {
    console.log('Cluster:', c.id);
    console.log('Title:', c.title);
    console.log('Article Count:', c.article_count);
    console.log('');

    // 顯示此群組的文章
    const articles = await db.execute({
      sql: 'SELECT id, title, original_url FROM articles WHERE cluster_id = ?',
      args: [c.id]
    });
    for (const a of articles.rows) {
      const url = String(a.original_url);
      let source = 'Unknown';
      if (url.includes('hk01')) source = 'HK01';
      else if (url.includes('rthk')) source = 'RTHK';
      else if (url.includes('mingpao')) source = '明報';
      console.log('  [' + source + '] ' + String(a.title).substring(0, 50) + '...');
    }
    console.log('-'.repeat(60));
  }

  // 統計
  const stats = await db.execute(`
    SELECT
      (SELECT COUNT(*) FROM articles) as total,
      (SELECT COUNT(*) FROM articles WHERE original_url LIKE '%hk01%') as hk01,
      (SELECT COUNT(*) FROM articles WHERE original_url LIKE '%rthk%') as rthk,
      (SELECT COUNT(*) FROM articles WHERE original_url LIKE '%mingpao%') as mingpao,
      (SELECT COUNT(*) FROM news_clusters) as clusters
  `);
  console.log('\n📈 Statistics:');
  console.log('Total articles:', stats.rows[0].total);
  console.log('HK01 articles:', stats.rows[0].hk01);
  console.log('RTHK articles:', stats.rows[0].rthk);
  console.log('Ming Pao articles:', stats.rows[0].mingpao);
  console.log('News clusters:', stats.rows[0].clusters);
}
check();
