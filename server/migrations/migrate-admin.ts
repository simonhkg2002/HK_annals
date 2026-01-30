/**
 * 資料庫遷移：新增管理員系統和新聞管理欄位
 */
import 'dotenv/config';
import { createClient } from '@libsql/client';

const db = createClient({
  url: process.env.TURSO_DATABASE_URL!,
  authToken: process.env.TURSO_AUTH_TOKEN!,
});

async function migrate() {
  console.log('🔄 Running admin system migration...\n');

  try {
    // 1. 創建管理員表
    console.log('📝 Creating admin_users table...');
    await db.execute(`
      CREATE TABLE IF NOT EXISTS admin_users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        display_name TEXT,
        is_active INTEGER DEFAULT 1,
        created_at TEXT DEFAULT (datetime('now')),
        last_login_at TEXT
      )
    `);
    console.log('  ✓ admin_users');

    // 2. 創建系列表
    console.log('📝 Creating news_series table...');
    await db.execute(`
      CREATE TABLE IF NOT EXISTS news_series (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        description TEXT,
        color TEXT DEFAULT '#3B82F6',
        is_active INTEGER DEFAULT 1,
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now'))
      )
    `);
    console.log('  ✓ news_series');

    // 3. 新增 articles 欄位
    console.log('\n📝 Adding new columns to articles table...');
    const tableInfo = await db.execute('PRAGMA table_info(articles)');
    const existingColumns = new Set(tableInfo.rows.map(r => r.name));

    if (!existingColumns.has('is_disabled')) {
      await db.execute('ALTER TABLE articles ADD COLUMN is_disabled INTEGER DEFAULT 0');
      console.log('  ✓ Added is_disabled');
    } else {
      console.log('  - is_disabled already exists');
    }

    if (!existingColumns.has('series_id')) {
      await db.execute('ALTER TABLE articles ADD COLUMN series_id INTEGER REFERENCES news_series(id)');
      console.log('  ✓ Added series_id');
    } else {
      console.log('  - series_id already exists');
    }

    if (!existingColumns.has('disabled_at')) {
      await db.execute('ALTER TABLE articles ADD COLUMN disabled_at TEXT');
      console.log('  ✓ Added disabled_at');
    } else {
      console.log('  - disabled_at already exists');
    }

    if (!existingColumns.has('disabled_by')) {
      await db.execute('ALTER TABLE articles ADD COLUMN disabled_by TEXT');
      console.log('  ✓ Added disabled_by');
    } else {
      console.log('  - disabled_by already exists');
    }

    // 4. 創建索引
    console.log('\n📑 Creating indexes...');
    await db.execute('CREATE INDEX IF NOT EXISTS idx_articles_disabled ON articles(is_disabled)');
    await db.execute('CREATE INDEX IF NOT EXISTS idx_articles_series ON articles(series_id)');
    console.log('  ✓ All indexes created');

    // 5. 插入預設管理員帳號 (admin/admin)
    // 使用 SHA-256 雜湊密碼
    console.log('\n🔐 Creating default admin user...');
    const crypto = await import('crypto');
    const passwordHash = crypto.createHash('sha256').update('admin').digest('hex');
    await db.execute({
      sql: `INSERT OR IGNORE INTO admin_users (username, password_hash, display_name)
            VALUES (?, ?, ?)`,
      args: ['admin', passwordHash, '系統管理員']
    });
    console.log('  ✓ Default admin created (admin/admin)');

    // 6. 新聞系列表已建立，由管理員自行新增
    console.log('\n📚 News series table ready (empty, to be added by admin)');

    console.log('\n✅ Migration complete!');

  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  }
}

migrate().catch(console.error);
