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

  const { seriesId } = req.body || {};

  if (!seriesId) {
    return res.status(400).json({ error: 'Missing seriesId' });
  }

  try {
    // 先將使用此系列的文章設為無系列
    await db.execute({
      sql: `UPDATE articles SET series_id = NULL WHERE series_id = ?`,
      args: [seriesId],
    });

    // 刪除系列
    await db.execute({
      sql: `DELETE FROM news_series WHERE id = ?`,
      args: [seriesId],
    });

    return res.status(200).json({ success: true });
  } catch (error) {
    console.error('Error deleting series:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
