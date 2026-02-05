import type { VercelRequest, VercelResponse } from '@vercel/node';
import { db, ARTICLE_SELECT_BASE, dbToNewsItem, DBArticle } from '../_lib/db';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const seriesId = req.query.seriesId;
  if (!seriesId || typeof seriesId !== 'string') {
    return res.status(400).json({ error: 'Missing seriesId parameter' });
  }

  const limit = Math.min(Number(req.query.limit) || 50, 200);

  try {
    const result = await db.execute({
      sql: `
        ${ARTICLE_SELECT_BASE}
        WHERE a.series_id = ? AND COALESCE(a.is_disabled, 0) = 0
        ORDER BY a.published_at ASC
        LIMIT ?
      `,
      args: [seriesId, limit],
    });

    const news = result.rows.map((row) => dbToNewsItem(row as unknown as DBArticle));
    return res.status(200).json(news);
  } catch (error) {
    console.error('Error fetching news by series:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
