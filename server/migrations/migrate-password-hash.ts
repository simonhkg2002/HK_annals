/**
 * 資料庫遷移：將管理員密碼從 Base64 更新為 SHA-256
 */
import 'dotenv/config';
import { createClient } from '@libsql/client';
import crypto from 'crypto';

const db = createClient({
  url: process.env.TURSO_DATABASE_URL!,
  authToken: process.env.TURSO_AUTH_TOKEN!,
});

async function migrate() {
  console.log('🔄 Migrating admin passwords to SHA-256...\n');

  try {
    // 獲取所有管理員帳戶
    const admins = await db.execute('SELECT id, username, password_hash FROM admin_users');

    console.log(`Found ${admins.rows.length} admin accounts`);

    for (const admin of admins.rows) {
      const oldHash = admin.password_hash as string;

      // 檢查是否是 Base64 編碼（長度較短且可解碼）
      // SHA-256 hex 是 64 字元
      if (oldHash && oldHash.length < 64) {
        try {
          // 嘗試解碼 Base64 得到原始密碼
          const originalPassword = Buffer.from(oldHash, 'base64').toString('utf8');

          // 使用 SHA-256 重新雜湊
          const newHash = crypto.createHash('sha256').update(originalPassword).digest('hex');

          // 更新資料庫
          await db.execute({
            sql: 'UPDATE admin_users SET password_hash = ? WHERE id = ?',
            args: [newHash, admin.id as number],
          });

          console.log(`  ✓ Updated password hash for: ${admin.username}`);
        } catch (e) {
          console.log(`  ⚠️ Skipped ${admin.username} (already migrated or invalid)`);
        }
      } else {
        console.log(`  - ${admin.username} already using SHA-256`);
      }
    }

    console.log('\n✅ Password migration complete!');
    console.log('\n⚠️  請立即登入後台更改預設密碼！');

  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  }
}

migrate().catch(console.error);
