/**
 * 密碼更新遷移腳本
 *
 * 將 admin 帳號的密碼更新為 P@ssw0rd1 的 SHA-256 雜湊
 *
 * 執行方式：
 * npx tsx server/migrations/migrate-password-update.ts
 *
 * 環境變數需求：
 * - TURSO_DATABASE_URL
 * - TURSO_AUTH_TOKEN
 */

import { createClient } from '@libsql/client';
import { createHash } from 'crypto';

// 使用 Node.js crypto 模組計算 SHA-256
function hashPassword(password: string): string {
  return createHash('sha256').update(password).digest('hex');
}

async function main() {
  const url = process.env.TURSO_DATABASE_URL;
  const authToken = process.env.TURSO_AUTH_TOKEN;

  if (!url || !authToken) {
    console.error('Missing TURSO_DATABASE_URL or TURSO_AUTH_TOKEN environment variables');
    process.exit(1);
  }

  const db = createClient({ url, authToken });

  const newPassword = 'P@ssw0rd1';
  const newPasswordHash = hashPassword(newPassword);

  console.log('Updating admin password...');
  console.log(`New password hash: ${newPasswordHash}`);

  try {
    // 更新 admin 用戶的密碼
    const result = await db.execute({
      sql: `
        UPDATE admin_users
        SET password_hash = ?, updated_at = datetime('now')
        WHERE username = ?
      `,
      args: [newPasswordHash, 'admin'],
    });

    if (result.rowsAffected === 0) {
      console.warn('Warning: No admin user found to update. The user might not exist.');

      // 檢查是否存在 admin 用戶
      const checkResult = await db.execute({
        sql: `SELECT id, username FROM admin_users WHERE username = ?`,
        args: ['admin'],
      });

      if (checkResult.rows.length === 0) {
        console.log('Creating admin user...');

        // 創建 admin 用戶
        await db.execute({
          sql: `
            INSERT INTO admin_users (username, password_hash, display_name, is_active)
            VALUES (?, ?, ?, 1)
          `,
          args: ['admin', newPasswordHash, '管理員'],
        });

        console.log('Admin user created successfully!');
      }
    } else {
      console.log(`Successfully updated ${result.rowsAffected} user(s).`);
    }

    // 驗證更新
    const verifyResult = await db.execute({
      sql: `SELECT username, password_hash FROM admin_users WHERE username = ?`,
      args: ['admin'],
    });

    if (verifyResult.rows.length > 0) {
      const row = verifyResult.rows[0] as Record<string, unknown>;
      console.log('\nVerification:');
      console.log(`  Username: ${row.username}`);
      console.log(`  Password hash: ${row.password_hash}`);
      console.log(`  Expected hash: ${newPasswordHash}`);
      console.log(`  Match: ${row.password_hash === newPasswordHash ? 'YES' : 'NO'}`);
    }

    console.log('\nMigration completed successfully!');
    console.log(`\nNew login credentials:`);
    console.log(`  Username: admin`);
    console.log(`  Password: ${newPassword}`);
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
}

main();
