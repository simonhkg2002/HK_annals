import 'dotenv/config';
import { createClient } from '@libsql/client';

const db = createClient({
  url: process.env.TURSO_DATABASE_URL!,
  authToken: process.env.TURSO_AUTH_TOKEN!,
});

async function check() {
  // 最舊的文章
  const oldest = await db.execute('SELECT title, published_at FROM articles ORDER BY published_at ASC LIMIT 3');
  console.log('Oldest articles:');
  oldest.rows.forEach(r => console.log(`  ${r.published_at} - ${String(r.title).substring(0, 40)}`));

  // 按月統計
  const monthly = await db.execute(`
    SELECT strftime('%Y-%m', published_at) as month, COUNT(*) as count
    FROM articles
    GROUP BY month
    ORDER BY month DESC
  `);
  console.log('\nArticles by month:');
  monthly.rows.forEach(r => console.log(`  ${r.month}: ${r.count}`));

  // 日期範圍
  const range = await db.execute('SELECT MIN(published_at) as oldest, MAX(published_at) as newest FROM articles');
  console.log('\nDate range:');
  console.log(`  Oldest: ${range.rows[0].oldest}`);
  console.log(`  Newest: ${range.rows[0].newest}`);
}
check();
