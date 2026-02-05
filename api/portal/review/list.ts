import type { VercelRequest, VercelResponse } from '@vercel/node';
import { db, dbToNewsItem, DBArticle } from '../../_lib/db';
import { requireAuth } from '../../_lib/auth';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // 驗證管理員身份
  const session = requireAuth(req, res);
  if (!session) return;

  const limit = Math.min(Number(req.query.limit) || 100, 200);
  const offset = Number(req.query.offset) || 0;
  const seriesId = req.query.seriesId;
  const searchQuery = req.query.q;

  try {
    const whereClauses: string[] = ["a.review_status = 'pending'"];
    const args: (string | number)[] = [];

    if (seriesId && typeof seriesId === 'string') {
      whereClauses.push('a.series_id = ?');
      args.push(seriesId);
    }

    if (searchQuery && typeof searchQuery === 'string') {
      whereClauses.push('a.title LIKE ?');
      args.push(`%${searchQuery}%`);
    }

    const whereClause = `WHERE ${whereClauses.join(' AND ')}`;
    args.push(limit, offset);

    const result = await db.execute({
      sql: `
        SELECT
          a.*,
          a.is_disabled,
          a.series_id,
          a.title_normalized,
          a.cluster_id,
          a.auto_classified,
          a.review_status,
          a.matched_keyword,
          ms.code as source_code,
          ms.name_zh as source_name,
          c.code as category_code,
          c.name_zh as category_name
        FROM articles a
        LEFT JOIN media_sources ms ON a.media_source_id = ms.id
        LEFT JOIN categories c ON a.category_id = c.id
        ${whereClause}
        ORDER BY a.auto_classified_at DESC
        LIMIT ? OFFSET ?
      `,
      args,
    });

    const reviews = result.rows.map((row) => {
      const r = row as Record<string, unknown>;
      const thumbnail = r.thumbnail_url as string | null;
      return {
        ...dbToNewsItem(r as unknown as DBArticle),
        isDisabled: r.is_disabled === 1,
        seriesId: r.series_id as number | null,
        isSimilarDuplicate: false,
        similarToId: null,
        titleNormalized: r.title_normalized as string | null,
        hasThumbnail: thumbnail !== null && thumbnail.trim().length > 0,
        matchedKeyword: r.matched_keyword as string | null,
      };
    });

    return res.status(200).json(reviews);
  } catch (error) {
    console.error('Error fetching pending reviews:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
