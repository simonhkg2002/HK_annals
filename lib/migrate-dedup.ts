/**
 * 資料庫遷移：新增去重相關欄位和表格
 */
import 'dotenv/config';
import { createClient } from '@libsql/client';

const db = createClient({
  url: process.env.TURSO_DATABASE_URL!,
  authToken: process.env.TURSO_AUTH_TOKEN!,
});

async function migrate() {
  console.log('🔄 Running dedup migration...\n');

  try {
    // 1. 檢查並新增 articles 表的新欄位
    console.log('📝 Adding new columns to articles table...');

    // 檢查欄位是否存在
    const tableInfo = await db.execute('PRAGMA table_info(articles)');
    const existingColumns = new Set(tableInfo.rows.map(r => r.name));

    if (!existingColumns.has('title_normalized')) {
      await db.execute('ALTER TABLE articles ADD COLUMN title_normalized TEXT');
      console.log('  ✓ Added title_normalized');
    } else {
      console.log('  - title_normalized already exists');
    }

    if (!existingColumns.has('cluster_id')) {
      await db.execute('ALTER TABLE articles ADD COLUMN cluster_id TEXT');
      console.log('  ✓ Added cluster_id');
    } else {
      console.log('  - cluster_id already exists');
    }

    // 2. 創建新表格
    console.log('\n📝 Creating new tables...');

    await db.execute(`
      CREATE TABLE IF NOT EXISTS news_clusters (
        id TEXT PRIMARY KEY,
        main_article_id INTEGER,
        title TEXT NOT NULL,
        article_count INTEGER DEFAULT 1,
        first_seen_at TEXT NOT NULL,
        last_updated_at TEXT DEFAULT (datetime('now'))
      )
    `);
    console.log('  ✓ news_clusters');

    await db.execute(`
      CREATE TABLE IF NOT EXISTS article_similarities (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        article_id_1 INTEGER NOT NULL,
        article_id_2 INTEGER NOT NULL,
        similarity_score REAL NOT NULL,
        match_type TEXT NOT NULL,
        created_at TEXT DEFAULT (datetime('now'))
      )
    `);
    console.log('  ✓ article_similarities');

    // 3. 創建索引
    console.log('\n📑 Creating indexes...');

    const indexes = [
      'CREATE INDEX IF NOT EXISTS idx_articles_title_normalized ON articles(title_normalized)',
      'CREATE INDEX IF NOT EXISTS idx_articles_cluster ON articles(cluster_id)',
      'CREATE INDEX IF NOT EXISTS idx_news_clusters_main ON news_clusters(main_article_id)',
      'CREATE INDEX IF NOT EXISTS idx_article_similarities_1 ON article_similarities(article_id_1)',
      'CREATE INDEX IF NOT EXISTS idx_article_similarities_2 ON article_similarities(article_id_2)',
    ];

    for (const idx of indexes) {
      await db.execute(idx);
    }
    console.log('  ✓ All indexes created');

    // 4. 為現有文章生成 title_normalized
    console.log('\n🔄 Generating title_normalized for existing articles...');

    const articles = await db.execute('SELECT id, title FROM articles WHERE title_normalized IS NULL');
    console.log(`  Found ${articles.rows.length} articles to update`);

    let updated = 0;
    for (const row of articles.rows) {
      const normalized = normalizeTitle(String(row.title));
      await db.execute({
        sql: 'UPDATE articles SET title_normalized = ? WHERE id = ?',
        args: [normalized, row.id]
      });
      updated++;
      if (updated % 100 === 0) {
        console.log(`  Processed ${updated}/${articles.rows.length}`);
      }
    }
    console.log(`  ✓ Updated ${updated} articles`);

    console.log('\n✅ Migration complete!');

  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  }
}

/**
 * 簡化版標題正規化（與 dedup.ts 保持一致）
 */
function normalizeTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/\s+/g, '')
    .replace(/[「」『』【】〈〉《》（）()[\]]/g, '')
    .replace(/[，。、；：！？,.;:!?]/g, '')
    .replace(/[""'']/g, '')
    .trim();
}

migrate().catch(console.error);
