/**
 * 清空所有新聞系列資料
 */
import 'dotenv/config';
import { createClient } from '@libsql/client';

const db = createClient({
  url: process.env.TURSO_DATABASE_URL!,
  authToken: process.env.TURSO_AUTH_TOKEN!,
});

async function clearSeries() {
  console.log('🗑️ Clearing all news series...\n');

  try {
    // 先將所有文章的 series_id 設為 NULL
    const updateResult = await db.execute(`
      UPDATE articles SET series_id = NULL WHERE series_id IS NOT NULL
    `);
    console.log(`✓ Updated ${updateResult.rowsAffected} articles`);

    // 刪除所有系列
    const deleteResult = await db.execute(`DELETE FROM news_series`);
    console.log(`✓ Deleted ${deleteResult.rowsAffected} series`);

    console.log('\n✅ All series cleared!');
  } catch (error) {
    console.error('❌ Failed:', error);
    throw error;
  }
}

clearSeries().catch(console.error);
