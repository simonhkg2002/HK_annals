import type { VercelRequest, VercelResponse } from '@vercel/node';
import { db, ARTICLE_SELECT_BASE, dbToNewsItem, DBArticle } from '../_lib/db';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const query = req.query.q;
  if (!query || typeof query !== 'string') {
    return res.status(400).json({ error: 'Missing search query' });
  }

  const limit = Math.min(Number(req.query.limit) || 20, 100);

  try {
    const result = await db.execute({
      sql: `
        ${ARTICLE_SELECT_BASE}
        WHERE a.title LIKE ? OR a.summary LIKE ?
        ORDER BY a.published_at DESC
        LIMIT ?
      `,
      args: [`%${query}%`, `%${query}%`, limit],
    });

    const news = result.rows.map((row) => dbToNewsItem(row as unknown as DBArticle));
    return res.status(200).json(news);
  } catch (error) {
    console.error('Error searching news:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
