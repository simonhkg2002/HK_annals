import type { VercelRequest, VercelResponse } from '@vercel/node';
import { db, ARTICLE_SELECT_BASE, dbToNewsItem, DBArticle, calculateSimpleSimilarity } from '../_lib/db';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const limit = Math.min(Number(req.query.limit) || 50, 200);
    const filtered = req.query.filtered === 'true';

    if (filtered) {
      // 過濾 >40% 相似的新聞（首頁用）
      const result = await db.execute({
        sql: `
          ${ARTICLE_SELECT_BASE.replace('a.*', 'a.*, a.cluster_id, a.title_normalized')}
          WHERE COALESCE(a.is_disabled, 0) = 0
          ORDER BY a.published_at DESC
          LIMIT ?
        `,
        args: [limit * 3],
      });

      interface NewsItemWithCluster {
        id: string;
        title: string;
        url: string;
        source: string;
        category: string;
        publishedAt: string;
        thumbnail: string | null;
        summary: string;
        author?: string;
        tags?: string[];
        clusterId?: string;
        titleNormalized?: string;
      }

      const allNews = result.rows.map((row) => {
        const r = row as Record<string, unknown>;
        return {
          ...dbToNewsItem(r as unknown as DBArticle),
          clusterId: r.cluster_id as string | undefined,
          titleNormalized: r.title_normalized as string | undefined,
        } as NewsItemWithCluster;
      });

      const displayedNews: NewsItemWithCluster[] = [];
      const displayedClusters = new Set<string>();
      const displayedTitles = new Map<string, string>();

      for (const news of allNews) {
        if (news.clusterId && displayedClusters.has(news.clusterId)) {
          continue;
        }

        if (news.titleNormalized) {
          let shouldSkip = false;
          for (const existingTitle of displayedTitles.keys()) {
            const similarity = calculateSimpleSimilarity(news.titleNormalized, existingTitle);
            if (similarity >= 0.40) {
              shouldSkip = true;
              break;
            }
          }
          if (shouldSkip) continue;
        }

        displayedNews.push(news);

        if (news.clusterId) displayedClusters.add(news.clusterId);
        if (news.titleNormalized) displayedTitles.set(news.titleNormalized, news.publishedAt);

        if (displayedNews.length >= limit) break;
      }

      // 移除臨時屬性
      const finalNews = displayedNews.map(({ clusterId, titleNormalized, ...rest }) => rest);
      return res.status(200).json(finalNews);
    } else {
      // 不過濾的列表
      const result = await db.execute({
        sql: `
          ${ARTICLE_SELECT_BASE}
          ORDER BY a.published_at DESC
          LIMIT ?
        `,
        args: [limit],
      });

      const news = result.rows.map((row) => dbToNewsItem(row as unknown as DBArticle));
      return res.status(200).json(news);
    }
  } catch (error) {
    console.error('Error fetching news list:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
