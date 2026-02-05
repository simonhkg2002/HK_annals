import type { VercelRequest, VercelResponse } from '@vercel/node';
import { db, ARTICLE_SELECT_BASE, dbToNewsItem, DBArticle } from '../_lib/db';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const date = req.query.date;
  if (!date || typeof date !== 'string') {
    return res.status(400).json({ error: 'Missing date parameter' });
  }

  try {
    const result = await db.execute({
      sql: `
        ${ARTICLE_SELECT_BASE}
        WHERE date(a.published_at) = date(?)
        ORDER BY a.published_at DESC
      `,
      args: [date],
    });

    const news = result.rows.map((row) => dbToNewsItem(row as unknown as DBArticle));
    return res.status(200).json(news);
  } catch (error) {
    console.error('Error fetching news by date:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
