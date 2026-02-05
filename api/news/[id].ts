import type { VercelRequest, VercelResponse } from '@vercel/node';
import { db, dbToNewsItem, DBArticle } from '../_lib/db';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { id } = req.query;

  if (!id || typeof id !== 'string') {
    return res.status(400).json({ error: 'Missing news id' });
  }

  try {
    const result = await db.execute({
      sql: `
        SELECT
          a.*,
          a.content,
          a.cluster_id,
          ms.code as source_code,
          ms.name_zh as source_name,
          c.code as category_code,
          c.name_zh as category_name
        FROM articles a
        LEFT JOIN media_sources ms ON a.media_source_id = ms.id
        LEFT JOIN categories c ON a.category_id = c.id
        WHERE a.id = ?
      `,
      args: [id],
    });

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'News not found' });
    }

    const row = result.rows[0] as Record<string, unknown>;
    const newsDetail = {
      ...dbToNewsItem(row as unknown as DBArticle),
      content: row.content as string | null,
      clusterId: row.cluster_id as string | null,
    };

    return res.status(200).json(newsDetail);
  } catch (error) {
    console.error('Error fetching news detail:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
