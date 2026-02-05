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

  const includeDisabled = req.query.includeDisabled !== 'false';
  const seriesId = req.query.seriesId;

  try {
    const whereClauses: string[] = [];
    const args: (string | number)[] = [];

    if (!includeDisabled) {
      whereClauses.push('COALESCE(is_disabled, 0) = 0');
    }

    if (seriesId && typeof seriesId === 'string') {
      whereClauses.push('series_id = ?');
      args.push(seriesId);
    }

    const whereClause = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

    const result = await db.execute({
      sql: `SELECT COUNT(*) as count FROM articles ${whereClause}`,
      args,
    });

    return res.status(200).json({ count: result.rows[0].count as number });
  } catch (error) {
    console.error('Error fetching news count:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
