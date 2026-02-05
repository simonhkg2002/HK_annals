import type { VercelRequest, VercelResponse } from '@vercel/node';
import { db } from '../_lib/db';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const days = Math.min(Number(req.query.days) || 7, 90);
  const seriesId = req.query.seriesId;

  try {
    if (seriesId && typeof seriesId === 'string') {
      // 支援系列過濾
      const result = await db.execute({
        sql: `
          SELECT
            date(a.published_at) as date,
            COUNT(*) as count
          FROM articles a
          WHERE a.published_at >= datetime('now', ?)
            AND a.series_id = ?
          GROUP BY date(a.published_at)
          ORDER BY date DESC
        `,
        args: [`-${days} days`, seriesId],
      });

      const stats = result.rows.map((row) => ({
        date: row.date as string,
        count: row.count as number,
      }));

      return res.status(200).json(stats);
    } else {
      // 全域每日統計
      const result = await db.execute({
        sql: `
          SELECT
            date(published_at) as date,
            COUNT(*) as count
          FROM articles
          WHERE published_at >= datetime('now', ?)
          GROUP BY date(published_at)
          ORDER BY date DESC
        `,
        args: [`-${days} days`],
      });

      const stats = result.rows.map((row) => ({
        date: row.date as string,
        count: row.count as number,
      }));

      return res.status(200).json(stats);
    }
  } catch (error) {
    console.error('Error fetching daily stats:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
