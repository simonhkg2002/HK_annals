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

  const seriesId = req.query.seriesId;
  const searchQuery = req.query.q;

  try {
    const whereClauses: string[] = ["review_status = 'pending'"];
    const args: (string | number)[] = [];

    if (seriesId && typeof seriesId === 'string') {
      whereClauses.push('series_id = ?');
      args.push(seriesId);
    }

    if (searchQuery && typeof searchQuery === 'string') {
      whereClauses.push('title LIKE ?');
      args.push(`%${searchQuery}%`);
    }

    const whereClause = `WHERE ${whereClauses.join(' AND ')}`;

    const result = await db.execute({
      sql: `SELECT COUNT(*) as count FROM articles ${whereClause}`,
      args,
    });

    return res.status(200).json({ count: result.rows[0].count as number });
  } catch (error) {
    console.error('Error fetching review count:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
