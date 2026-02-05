import type { VercelRequest, VercelResponse } from '@vercel/node';
import { db, ARTICLE_SELECT_BASE, dbToNewsItem, DBArticle } from '../_lib/db';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const category = req.query.category;
  if (!category || typeof category !== 'string') {
    return res.status(400).json({ error: 'Missing category parameter' });
  }

  const limit = Math.min(Number(req.query.limit) || 20, 100);

  try {
    const result = await db.execute({
      sql: `
        ${ARTICLE_SELECT_BASE}
        WHERE c.code = ?
        ORDER BY a.published_at DESC
        LIMIT ?
      `,
      args: [category, limit],
    });

    const news = result.rows.map((row) => dbToNewsItem(row as unknown as DBArticle));
    return res.status(200).json(news);
  } catch (error) {
    console.error('Error fetching news by category:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
