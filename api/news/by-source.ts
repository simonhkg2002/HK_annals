import type { VercelRequest, VercelResponse } from '@vercel/node';
import { db, ARTICLE_SELECT_BASE, dbToNewsItem, DBArticle } from '../_lib/db';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const source = req.query.source;
  if (!source || typeof source !== 'string') {
    return res.status(400).json({ error: 'Missing source parameter' });
  }

  const limit = Math.min(Number(req.query.limit) || 20, 100);

  try {
    const result = await db.execute({
      sql: `
        ${ARTICLE_SELECT_BASE}
        WHERE ms.code = ?
        ORDER BY a.published_at DESC
        LIMIT ?
      `,
      args: [source, limit],
    });

    const news = result.rows.map((row) => dbToNewsItem(row as unknown as DBArticle));
    return res.status(200).json(news);
  } catch (error) {
    console.error('Error fetching news by source:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
