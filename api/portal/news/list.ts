import type { VercelRequest, VercelResponse } from '@vercel/node';
import { db, ARTICLE_SELECT_BASE, dbToNewsItem, DBArticle, calculateSimpleSimilarity, SOURCE_PRIORITY } from '../../_lib/db';
import { requireAuth } from '../../_lib/auth';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // 驗證管理員身份
  const session = requireAuth(req, res);
  if (!session) return;

  const limit = Math.min(Number(req.query.limit) || 50, 200);
  const offset = Number(req.query.offset) || 0;
  const includeDisabled = req.query.includeDisabled !== 'false';
  const seriesId = req.query.seriesId;

  try {
    const whereClauses: string[] = [];
    const args: (string | number)[] = [];

    if (!includeDisabled) {
      whereClauses.push('COALESCE(a.is_disabled, 0) = 0');
    }

    if (seriesId && typeof seriesId === 'string') {
      whereClauses.push('a.series_id = ?');
      args.push(seriesId);
    }

    const whereClause = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';
    args.push(limit, offset);

    const result = await db.execute({
      sql: `
        SELECT
          a.*,
          a.is_disabled,
          a.series_id,
          a.title_normalized,
          a.cluster_id,
          ms.code as source_code,
          ms.name_zh as source_name,
          c.code as category_code,
          c.name_zh as category_name
        FROM articles a
        LEFT JOIN media_sources ms ON a.media_source_id = ms.id
        LEFT JOIN categories c ON a.category_id = c.id
        ${whereClause}
        ORDER BY a.published_at DESC
        LIMIT ? OFFSET ?
      `,
      args,
    });

    interface NewsItemWithExtras {
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
      isDisabled: boolean;
      seriesId: number | null;
      isSimilarDuplicate: boolean;
      similarToId: string | null;
      titleNormalized: string | null;
      hasThumbnail: boolean;
      clusterId?: string | null;
      publishedAtTime?: number;
    }

    const newsItems: NewsItemWithExtras[] = result.rows.map((row) => {
      const r = row as Record<string, unknown>;
      const thumbnail = r.thumbnail_url as string | null;
      return {
        ...dbToNewsItem(r as unknown as DBArticle),
        isDisabled: r.is_disabled === 1,
        seriesId: r.series_id as number | null,
        isSimilarDuplicate: false,
        similarToId: null as string | null,
        titleNormalized: r.title_normalized as string | null,
        hasThumbnail: thumbnail !== null && thumbnail.trim().length > 0,
        clusterId: r.cluster_id as string | null,
        publishedAtTime: new Date(r.published_at as string).getTime(),
      };
    });

    // 檢測 ±6 小時內的相似文章
    const SIX_HOURS_MS = 6 * 60 * 60 * 1000;

    for (let i = 0; i < newsItems.length; i++) {
      const current = newsItems[i];
      if (current.isSimilarDuplicate) continue;

      for (let j = 0; j < newsItems.length; j++) {
        if (i === j) continue;
        const other = newsItems[j];
        if (other.isSimilarDuplicate) continue;

        const timeDiff = Math.abs((current.publishedAtTime || 0) - (other.publishedAtTime || 0));
        if (timeDiff > SIX_HOURS_MS) continue;

        let isSimilar = false;

        if (current.clusterId && other.clusterId && current.clusterId === other.clusterId) {
          isSimilar = true;
        } else if (current.titleNormalized && other.titleNormalized) {
          const similarity = calculateSimpleSimilarity(current.titleNormalized, other.titleNormalized);
          if (similarity >= 0.40) {
            isSimilar = true;
          }
        }

        if (isSimilar) {
          const currentPriority = SOURCE_PRIORITY[current.source] ?? 99;
          const otherPriority = SOURCE_PRIORITY[other.source] ?? 99;

          if (currentPriority > otherPriority) {
            current.isSimilarDuplicate = true;
            current.similarToId = other.id;
            break;
          } else if (otherPriority > currentPriority) {
            other.isSimilarDuplicate = true;
            other.similarToId = current.id;
          }
        }
      }
    }

    // 移除臨時屬性
    const finalNews = newsItems.map(({ publishedAtTime, clusterId, ...rest }) => rest);
    return res.status(200).json(finalNews);
  } catch (error) {
    console.error('Error fetching admin news list:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
