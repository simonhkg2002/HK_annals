/**
 * 資料庫遷移：新增自動分類功能
 * - news_series 表新增 keywords 和 auto_add_enabled 欄位
 * - articles 表新增自動分類相關欄位
 */
import 'dotenv/config';
import { createClient } from '@libsql/client';

const db = createClient({
  url: process.env.TURSO_DATABASE_URL!,
  authToken: process.env.TURSO_AUTH_TOKEN!,
});

async function migrate() {
  console.log('🔄 Running auto-classify migration...\n');

  try {
    // 1. 新增 news_series 欄位
    console.log('📝 Adding columns to news_series table...');
    const seriesTableInfo = await db.execute('PRAGMA table_info(news_series)');
    const seriesColumns = new Set(seriesTableInfo.rows.map(r => r.name));

    if (!seriesColumns.has('keywords')) {
      await db.execute('ALTER TABLE news_series ADD COLUMN keywords TEXT');
      console.log('  ✓ Added keywords (JSON array)');
    } else {
      console.log('  - keywords already exists');
    }

    if (!seriesColumns.has('auto_add_enabled')) {
      await db.execute('ALTER TABLE news_series ADD COLUMN auto_add_enabled INTEGER DEFAULT 1');
      console.log('  ✓ Added auto_add_enabled');
    } else {
      console.log('  - auto_add_enabled already exists');
    }

    // 2. 新增 articles 欄位
    console.log('\n📝 Adding columns to articles table...');
    const articlesTableInfo = await db.execute('PRAGMA table_info(articles)');
    const articlesColumns = new Set(articlesTableInfo.rows.map(r => r.name));

    if (!articlesColumns.has('auto_classified')) {
      await db.execute('ALTER TABLE articles ADD COLUMN auto_classified INTEGER DEFAULT 0');
      console.log('  ✓ Added auto_classified');
    } else {
      console.log('  - auto_classified already exists');
    }

    if (!articlesColumns.has('review_status')) {
      await db.execute('ALTER TABLE articles ADD COLUMN review_status TEXT');
      console.log('  ✓ Added review_status (pending/approved/rejected)');
    } else {
      console.log('  - review_status already exists');
    }

    if (!articlesColumns.has('auto_classified_at')) {
      await db.execute('ALTER TABLE articles ADD COLUMN auto_classified_at TEXT');
      console.log('  ✓ Added auto_classified_at');
    } else {
      console.log('  - auto_classified_at already exists');
    }

    if (!articlesColumns.has('matched_keyword')) {
      await db.execute('ALTER TABLE articles ADD COLUMN matched_keyword TEXT');
      console.log('  ✓ Added matched_keyword');
    } else {
      console.log('  - matched_keyword already exists');
    }

    // 3. 創建索引
    console.log('\n📑 Creating indexes...');
    await db.execute('CREATE INDEX IF NOT EXISTS idx_articles_auto_classified ON articles(auto_classified)');
    await db.execute('CREATE INDEX IF NOT EXISTS idx_articles_review_status ON articles(review_status)');
    console.log('  ✓ All indexes created');

    console.log('\n✅ Auto-classify migration complete!');
    console.log('\n📋 Summary:');
    console.log('  - news_series: keywords, auto_add_enabled');
    console.log('  - articles: auto_classified, review_status, auto_classified_at, matched_keyword');

  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  }
}

migrate().catch(console.error);
