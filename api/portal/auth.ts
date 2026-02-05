import type { VercelRequest, VercelResponse } from '@vercel/node';
import { db } from '../_lib/db';
import { createSession, hashPassword, deleteSession, getTokenFromRequest, validateSession } from '../_lib/auth';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'POST') {
    // 登入
    const { username, password } = req.body || {};

    if (!username || !password) {
      return res.status(400).json({ error: 'Missing username or password' });
    }

    try {
      const passwordHash = await hashPassword(password);

      const result = await db.execute({
        sql: `
          SELECT id, username, display_name, is_active, last_login_at
          FROM admin_users
          WHERE username = ? AND password_hash = ? AND is_active = 1
        `,
        args: [username, passwordHash],
      });

      if (result.rows.length === 0) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }

      const row = result.rows[0] as Record<string, unknown>;

      // 更新最後登入時間
      await db.execute({
        sql: `UPDATE admin_users SET last_login_at = datetime('now') WHERE id = ?`,
        args: [row.id as number],
      });

      // 創建 session
      const token = createSession(
        row.id as number,
        row.username as string,
        (row.display_name as string) || (row.username as string)
      );

      return res.status(200).json({
        token,
        user: {
          id: row.id as number,
          username: row.username as string,
          displayName: (row.display_name as string) || (row.username as string),
          isActive: row.is_active === 1,
          lastLoginAt: row.last_login_at as string | null,
        },
      });
    } catch (error) {
      console.error('Error during login:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  } else if (req.method === 'DELETE') {
    // 登出
    const token = getTokenFromRequest(req);
    if (token) {
      deleteSession(token);
    }
    return res.status(200).json({ success: true });
  } else if (req.method === 'GET') {
    // 驗證 session
    const token = getTokenFromRequest(req);
    const session = validateSession(token);

    if (!session) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    return res.status(200).json({
      user: {
        id: session.userId,
        username: session.username,
        displayName: session.displayName,
        isActive: true,
        lastLoginAt: null,
      },
    });
  } else {
    return res.status(405).json({ error: 'Method not allowed' });
  }
}
