import type { VercelRequest, VercelResponse } from '@vercel/node';
import { db } from '../../_lib/db';
import { requireAuth } from '../../_lib/auth';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // 驗證管理員身份
  const session = requireAuth(req, res);
  if (!session) return;

  const { name, description, color, keywords, autoAddEnabled } = req.body || {};

  if (!name) {
    return res.status(400).json({ error: 'Missing name' });
  }

  try {
    const keywordsJson = JSON.stringify(keywords || []);

    const result = await db.execute({
      sql: `
        INSERT INTO news_series (name, description, color, keywords, auto_add_enabled)
        VALUES (?, ?, ?, ?, ?)
      `,
      args: [name, description || null, color || '#3b82f6', keywordsJson, autoAddEnabled !== false ? 1 : 0],
    });

    return res.status(200).json({
      success: true,
      id: Number(result.lastInsertRowid)
    });
  } catch (error) {
    console.error('Error creating series:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
