/**
 * 新增 Yahoo 新聞香港為媒體來源
 */
import 'dotenv/config';
import { createClient } from '@libsql/client';

const db = createClient({
  url: process.env.TURSO_DATABASE_URL!,
  authToken: process.env.TURSO_AUTH_TOKEN!,
});

async function migrate() {
  console.log('🚀 Adding Yahoo News HK as media source...\n');

  try {
    // 新增 Yahoo 媒體來源
    await db.execute(`
      INSERT OR IGNORE INTO media_sources (code, name_zh, name_en, website_url, language)
      VALUES ('yahoo', 'Yahoo新聞', 'Yahoo News HK', 'https://hk.news.yahoo.com', 'zh')
    `);
    console.log('✅ Added Yahoo News HK');

    // 驗證
    const sources = await db.execute('SELECT code, name_zh FROM media_sources ORDER BY code');
    console.log('\n📊 Current media sources:');
    for (const row of sources.rows) {
      console.log(`   - ${row.code}: ${row.name_zh}`);
    }

    console.log('\n🎉 Migration complete!');
  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  }
}

migrate().catch(console.error);
