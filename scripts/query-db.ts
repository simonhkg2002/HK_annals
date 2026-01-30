/**
 * 資料庫查詢工具
 */

import 'dotenv/config';
import { createClient } from '@libsql/client';

const url = process.env.TURSO_DATABASE_URL || process.env.VITE_TURSO_DATABASE_URL;
const authToken = process.env.TURSO_AUTH_TOKEN || process.env.VITE_TURSO_AUTH_TOKEN;

if (!url || !authToken) {
  throw new Error('Missing Turso database credentials');
}

const db = createClient({ url, authToken });

async function queryStats() {
  console.log('📊 Database Statistics\n');

  // 文章統計
  const articleCount = await db.execute('SELECT COUNT(*) as count FROM articles');
  console.log(`📰 Total articles: ${articleCount.rows[0].count}`);

  // 按媒體來源統計
  const bySource = await db.execute(`
    SELECT ms.name_zh, COUNT(a.id) as count
    FROM articles a
    JOIN media_sources ms ON a.media_source_id = ms.id
    GROUP BY ms.id
    ORDER BY count DESC
  `);
  console.log('\n📡 By media source:');
  for (const row of bySource.rows) {
    console.log(`   ${row.name_zh}: ${row.count}`);
  }

  // 按分類統計
  const byCategory = await db.execute(`
    SELECT c.name_zh, COUNT(a.id) as count
    FROM articles a
    LEFT JOIN categories c ON a.category_id = c.id
    GROUP BY c.id
    ORDER BY count DESC
  `);
  console.log('\n🏷️  By category:');
  for (const row of byCategory.rows) {
    console.log(`   ${row.name_zh || '未分類'}: ${row.count}`);
  }

  // 最新 5 篇文章
  const latestArticles = await db.execute(`
    SELECT title, author, published_at, original_url
    FROM articles
    ORDER BY published_at DESC
    LIMIT 5
  `);
  console.log('\n📝 Latest 5 articles:');
  for (const row of latestArticles.rows) {
    const time = new Date(row.published_at as string).toLocaleString('zh-HK');
    console.log(`   [${time}] ${(row.title as string).substring(0, 40)}...`);
    console.log(`      By: ${row.author || 'Unknown'}`);
  }

  // 今日文章數
  const today = new Date().toISOString().split('T')[0];
  const todayCount = await db.execute({
    sql: `SELECT COUNT(*) as count FROM articles WHERE date(published_at) = date(?)`,
    args: [today],
  });
  console.log(`\n📅 Articles published today: ${todayCount.rows[0].count}`);
}

queryStats().catch(console.error);
