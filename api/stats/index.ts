import type { VercelRequest, VercelResponse } from '@vercel/node';
import { db } from '../_lib/db';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const seriesId = req.query.seriesId;

  try {
    if (seriesId && typeof seriesId === 'string') {
      // 支援系列過濾的統計
      const [total, today, sources, categories] = await Promise.all([
        db.execute({
          sql: `SELECT COUNT(*) as count FROM articles a WHERE a.series_id = ?`,
          args: [seriesId],
        }),
        db.execute({
          sql: `
            SELECT COUNT(*) as count FROM articles a
            WHERE a.series_id = ? AND date(a.published_at) = date('now')
          `,
          args: [seriesId],
        }),
        db.execute({
          sql: `
            SELECT ms.name_zh as name, COUNT(a.id) as count
            FROM articles a
            JOIN media_sources ms ON a.media_source_id = ms.id
            WHERE a.series_id = ?
            GROUP BY ms.id
            ORDER BY count DESC
          `,
          args: [seriesId],
        }),
        db.execute({
          sql: `
            SELECT c.name_zh as name, COUNT(a.id) as count
            FROM articles a
            LEFT JOIN categories c ON a.category_id = c.id
            WHERE a.series_id = ?
            GROUP BY c.id
            ORDER BY count DESC
          `,
          args: [seriesId],
        }),
      ]);

      return res.status(200).json({
        totalArticles: total.rows[0].count as number,
        todayArticles: today.rows[0].count as number,
        sources: sources.rows.map((r) => ({ name: r.name as string, count: r.count as number })),
        categories: categories.rows.map((r) => ({
          name: (r.name as string) || '未分類',
          count: r.count as number,
        })),
      });
    } else {
      // 全域統計
      const [total, today, sources, categories] = await Promise.all([
        db.execute('SELECT COUNT(*) as count FROM articles'),
        db.execute(`
          SELECT COUNT(*) as count FROM articles
          WHERE date(published_at) = date('now')
        `),
        db.execute(`
          SELECT ms.name_zh as name, COUNT(a.id) as count
          FROM articles a
          JOIN media_sources ms ON a.media_source_id = ms.id
          GROUP BY ms.id
          ORDER BY count DESC
        `),
        db.execute(`
          SELECT c.name_zh as name, COUNT(a.id) as count
          FROM articles a
          LEFT JOIN categories c ON a.category_id = c.id
          GROUP BY c.id
          ORDER BY count DESC
        `),
      ]);

      return res.status(200).json({
        totalArticles: total.rows[0].count as number,
        todayArticles: today.rows[0].count as number,
        sources: sources.rows.map((r) => ({ name: r.name as string, count: r.count as number })),
        categories: categories.rows.map((r) => ({
          name: (r.name as string) || '未分類',
          count: r.count as number,
        })),
      });
    }
  } catch (error) {
    console.error('Error fetching stats:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
