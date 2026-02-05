import type { VercelRequest, VercelResponse } from '@vercel/node';
import { db } from '../../_lib/db';
import { requireAuth } from '../../_lib/auth';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // 驗證管理員身份
  const session = requireAuth(req, res);
  if (!session) return;

  const articleId = req.query.articleId;
  const pageSize = Number(req.query.pageSize) || 100;
  const includeDisabled = req.query.includeDisabled !== 'false';

  if (!articleId || typeof articleId !== 'string') {
    return res.status(400).json({ error: 'Missing articleId' });
  }

  try {
    // 獲取書籤文章的發布時間
    const articleResult = await db.execute({
      sql: `SELECT published_at FROM articles WHERE id = ?`,
      args: [articleId],
    });

    if (articleResult.rows.length === 0) {
      return res.status(200).json({ page: 1 });
    }

    const publishedAt = articleResult.rows[0].published_at as string;

    // 計算有多少文章比書籤文章更新
    const whereClause = includeDisabled ? '' : 'COALESCE(a.is_disabled, 0) = 0 AND';

    const countResult = await db.execute({
      sql: `
        SELECT COUNT(*) as count FROM articles a
        WHERE ${whereClause} a.published_at > ?
      `,
      args: [publishedAt],
    });

    const position = countResult.rows[0].count as number;
    const page = Math.floor(position / pageSize) + 1;

    return res.status(200).json({ page });
  } catch (error) {
    console.error('Error getting bookmark position:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
