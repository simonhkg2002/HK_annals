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

  const { seriesId, name, description, color, keywords, autoAddEnabled } = req.body || {};

  if (!seriesId) {
    return res.status(400).json({ error: 'Missing seriesId' });
  }

  if (!name) {
    return res.status(400).json({ error: 'Missing name' });
  }

  try {
    const keywordsJson = JSON.stringify(keywords || []);

    await db.execute({
      sql: `
        UPDATE news_series
        SET name = ?, description = ?, color = ?, keywords = ?, auto_add_enabled = ?, updated_at = datetime('now')
        WHERE id = ?
      `,
      args: [name, description || null, color || '#3b82f6', keywordsJson, autoAddEnabled !== false ? 1 : 0, seriesId],
    });

    return res.status(200).json({ success: true });
  } catch (error) {
    console.error('Error updating series:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
