import type { VercelRequest, VercelResponse } from '@vercel/node';
import { db, ARTICLE_SELECT_BASE, dbToNewsItem, DBArticle } from '../_lib/db';

// 分類名稱到 code 的映射
const CATEGORY_TO_CODE: Record<string, string> = {
  '港聞': 'local',
  '社會': 'society',
  '政治': 'politics',
  '財經': 'economy',
  '國際': 'international',
  '中國': 'china',
  '體育': 'sports',
  '娛樂': 'entertainment',
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const newsId = req.query.newsId;
  const clusterId = req.query.clusterId;
  const category = req.query.category;

  if (!newsId || typeof newsId !== 'string') {
    return res.status(400).json({ error: 'Missing newsId parameter' });
  }

  const limit = Math.min(Number(req.query.limit) || 6, 20);

  try {
    // 先嘗試獲取同群組的新聞
    if (clusterId && typeof clusterId === 'string') {
      const clusterNews = await db.execute({
        sql: `
          ${ARTICLE_SELECT_BASE}
          WHERE a.cluster_id = ? AND a.id != ?
          ORDER BY a.published_at DESC
          LIMIT ?
        `,
        args: [clusterId, newsId, limit],
      });

      if (clusterNews.rows.length > 0) {
        const news = clusterNews.rows.map((row) => dbToNewsItem(row as unknown as DBArticle));
        return res.status(200).json(news);
      }
    }

    // 如果沒有同群組的，獲取同分類的新聞
    const categoryCode = (typeof category === 'string' ? CATEGORY_TO_CODE[category] : null) || 'local';

    const result = await db.execute({
      sql: `
        ${ARTICLE_SELECT_BASE}
        WHERE c.code = ? AND a.id != ?
        ORDER BY a.published_at DESC
        LIMIT ?
      `,
      args: [categoryCode, newsId, limit],
    });

    const news = result.rows.map((row) => dbToNewsItem(row as unknown as DBArticle));
    return res.status(200).json(news);
  } catch (error) {
    console.error('Error fetching related news:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
