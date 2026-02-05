import type { VercelRequest, VercelResponse } from '@vercel/node';
import { db, ARTICLE_SELECT_BASE, dbToNewsItem, DBArticle, calculateSimpleSimilarity } from './_lib/db';

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

  const action = req.query.action as string;

  try {
    switch (action) {
      case 'list':
        return handleList(req, res);
      case 'detail':
        return handleDetail(req, res);
      case 'search':
        return handleSearch(req, res);
      case 'by-date':
        return handleByDate(req, res);
      case 'by-category':
        return handleByCategory(req, res);
      case 'by-source':
        return handleBySource(req, res);
      case 'by-series':
        return handleBySeries(req, res);
      case 'related':
        return handleRelated(req, res);
      case 'dates':
        return handleDates(req, res);
      default:
        return handleList(req, res);
    }
  } catch (error) {
    console.error('API Error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

async function handleList(req: VercelRequest, res: VercelResponse) {
  const limit = Math.min(Number(req.query.limit) || 50, 200);
  const filtered = req.query.filtered === 'true';

  if (filtered) {
    const result = await db.execute({
      sql: `
        SELECT a.*, a.cluster_id, a.title_normalized,
          ms.code as source_code, ms.name_zh as source_name,
          c.code as category_code, c.name_zh as category_name
        FROM articles a
        LEFT JOIN media_sources ms ON a.media_source_id = ms.id
        LEFT JOIN categories c ON a.category_id = c.id
        WHERE COALESCE(a.is_disabled, 0) = 0
        ORDER BY a.published_at DESC
        LIMIT ?
      `,
      args: [limit * 3],
    });

    const allNews = result.rows.map((row) => {
      const r = row as Record<string, unknown>;
      return {
        ...dbToNewsItem(r as unknown as DBArticle),
        clusterId: r.cluster_id as string | undefined,
        titleNormalized: r.title_normalized as string | undefined,
      };
    });

    const displayedNews: typeof allNews = [];
    const displayedClusters = new Set<string>();
    const displayedTitles = new Map<string, string>();

    for (const news of allNews) {
      if (news.clusterId && displayedClusters.has(news.clusterId)) continue;

      if (news.titleNormalized) {
        let shouldSkip = false;
        for (const existingTitle of displayedTitles.keys()) {
          if (calculateSimpleSimilarity(news.titleNormalized, existingTitle) >= 0.40) {
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

    const finalNews = displayedNews.map(({ clusterId, titleNormalized, ...rest }) => rest);
    return res.status(200).json(finalNews);
  } else {
    const result = await db.execute({
      sql: `${ARTICLE_SELECT_BASE} ORDER BY a.published_at DESC LIMIT ?`,
      args: [limit],
    });
    return res.status(200).json(result.rows.map((row) => dbToNewsItem(row as unknown as DBArticle)));
  }
}

async function handleDetail(req: VercelRequest, res: VercelResponse) {
  const id = req.query.id as string;
  if (!id) return res.status(400).json({ error: 'Missing id' });

  const result = await db.execute({
    sql: `
      SELECT a.*, a.content, a.cluster_id,
        ms.code as source_code, ms.name_zh as source_name,
        c.code as category_code, c.name_zh as category_name
      FROM articles a
      LEFT JOIN media_sources ms ON a.media_source_id = ms.id
      LEFT JOIN categories c ON a.category_id = c.id
      WHERE a.id = ?
    `,
    args: [id],
  });

  if (result.rows.length === 0) return res.status(404).json({ error: 'Not found' });

  const row = result.rows[0] as Record<string, unknown>;
  return res.status(200).json({
    ...dbToNewsItem(row as unknown as DBArticle),
    content: row.content as string | null,
    clusterId: row.cluster_id as string | null,
  });
}

async function handleSearch(req: VercelRequest, res: VercelResponse) {
  const q = req.query.q as string;
  if (!q) return res.status(400).json({ error: 'Missing query' });

  const limit = Math.min(Number(req.query.limit) || 20, 100);
  const result = await db.execute({
    sql: `${ARTICLE_SELECT_BASE} WHERE a.title LIKE ? OR a.summary LIKE ? ORDER BY a.published_at DESC LIMIT ?`,
    args: [`%${q}%`, `%${q}%`, limit],
  });
  return res.status(200).json(result.rows.map((row) => dbToNewsItem(row as unknown as DBArticle)));
}

async function handleByDate(req: VercelRequest, res: VercelResponse) {
  const date = req.query.date as string;
  if (!date) return res.status(400).json({ error: 'Missing date' });

  const result = await db.execute({
    sql: `${ARTICLE_SELECT_BASE} WHERE date(a.published_at) = date(?) ORDER BY a.published_at DESC`,
    args: [date],
  });
  return res.status(200).json(result.rows.map((row) => dbToNewsItem(row as unknown as DBArticle)));
}

async function handleByCategory(req: VercelRequest, res: VercelResponse) {
  const category = req.query.category as string;
  if (!category) return res.status(400).json({ error: 'Missing category' });

  const limit = Math.min(Number(req.query.limit) || 20, 100);
  const result = await db.execute({
    sql: `${ARTICLE_SELECT_BASE} WHERE c.code = ? ORDER BY a.published_at DESC LIMIT ?`,
    args: [category, limit],
  });
  return res.status(200).json(result.rows.map((row) => dbToNewsItem(row as unknown as DBArticle)));
}

async function handleBySource(req: VercelRequest, res: VercelResponse) {
  const source = req.query.source as string;
  if (!source) return res.status(400).json({ error: 'Missing source' });

  const limit = Math.min(Number(req.query.limit) || 20, 100);
  const result = await db.execute({
    sql: `${ARTICLE_SELECT_BASE} WHERE ms.code = ? ORDER BY a.published_at DESC LIMIT ?`,
    args: [source, limit],
  });
  return res.status(200).json(result.rows.map((row) => dbToNewsItem(row as unknown as DBArticle)));
}

async function handleBySeries(req: VercelRequest, res: VercelResponse) {
  const seriesId = req.query.seriesId as string;
  if (!seriesId) return res.status(400).json({ error: 'Missing seriesId' });

  const limit = Math.min(Number(req.query.limit) || 50, 200);
  const result = await db.execute({
    sql: `${ARTICLE_SELECT_BASE} WHERE a.series_id = ? AND COALESCE(a.is_disabled, 0) = 0 ORDER BY a.published_at ASC LIMIT ?`,
    args: [seriesId, limit],
  });
  return res.status(200).json(result.rows.map((row) => dbToNewsItem(row as unknown as DBArticle)));
}

async function handleRelated(req: VercelRequest, res: VercelResponse) {
  const newsId = req.query.newsId as string;
  const clusterId = req.query.clusterId as string;
  const category = req.query.category as string;
  if (!newsId) return res.status(400).json({ error: 'Missing newsId' });

  const limit = Math.min(Number(req.query.limit) || 6, 20);

  if (clusterId) {
    const clusterNews = await db.execute({
      sql: `${ARTICLE_SELECT_BASE} WHERE a.cluster_id = ? AND a.id != ? ORDER BY a.published_at DESC LIMIT ?`,
      args: [clusterId, newsId, limit],
    });
    if (clusterNews.rows.length > 0) {
      return res.status(200).json(clusterNews.rows.map((row) => dbToNewsItem(row as unknown as DBArticle)));
    }
  }

  const categoryCode = (category ? CATEGORY_TO_CODE[category] : null) || 'local';
  const result = await db.execute({
    sql: `${ARTICLE_SELECT_BASE} WHERE c.code = ? AND a.id != ? ORDER BY a.published_at DESC LIMIT ?`,
    args: [categoryCode, newsId, limit],
  });
  return res.status(200).json(result.rows.map((row) => dbToNewsItem(row as unknown as DBArticle)));
}

async function handleDates(req: VercelRequest, res: VercelResponse) {
  const result = await db.execute(`SELECT DISTINCT date(published_at) as date FROM articles ORDER BY date DESC`);
  return res.status(200).json(result.rows.map((row) => row.date as string));
}
