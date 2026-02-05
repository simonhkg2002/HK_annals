import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@libsql/client';

// Database setup
const db = createClient({
  url: process.env.TURSO_DATABASE_URL || '',
  authToken: process.env.TURSO_AUTH_TOKEN || '',
});

const SOURCE_MAP: Record<string, string> = { hk01: 'HK01', rthk: 'RTHK', mingpao: '明報', yahoo: 'Yahoo' };
const CATEGORY_MAP: Record<string, string> = { local: '港聞', society: '社會', politics: '政治', economy: '財經', international: '國際', china: '中國', sports: '體育', entertainment: '娛樂' };
const CATEGORY_TO_CODE: Record<string, string> = { '港聞': 'local', '社會': 'society', '政治': 'politics', '財經': 'economy', '國際': 'international', '中國': 'china', '體育': 'sports', '娛樂': 'entertainment' };

function dbToNewsItem(row: Record<string, unknown>) {
  return {
    id: String(row.id),
    title: row.title as string,
    url: row.original_url as string,
    source: SOURCE_MAP[row.source_code as string] || 'HK01',
    category: CATEGORY_MAP[row.category_code as string] || '港聞',
    publishedAt: row.published_at as string,
    thumbnail: row.thumbnail_url as string | null,
    summary: (row.summary as string) || '',
    author: row.author as string | undefined,
    tags: row.tags ? JSON.parse(row.tags as string) : undefined,
  };
}

function calculateSimpleSimilarity(t1: string, t2: string): number {
  if (t1 === t2) return 1;
  if (!t1 || !t2) return 0;
  const c1 = new Set(t1), c2 = new Set(t2);
  let common = 0;
  for (const c of c1) if (c2.has(c)) common++;
  return common / Math.max(c1.size, c2.size);
}

const BASE_SELECT = `SELECT a.*, ms.code as source_code, ms.name_zh as source_name, c.code as category_code, c.name_zh as category_name FROM articles a LEFT JOIN media_sources ms ON a.media_source_id = ms.id LEFT JOIN categories c ON a.category_id = c.id`;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const action = req.query.action as string;

  try {
    if (action === 'detail') {
      const id = req.query.id as string;
      if (!id) return res.status(400).json({ error: 'Missing id' });
      const result = await db.execute({ sql: `SELECT a.*, a.content, a.cluster_id, ms.code as source_code, c.code as category_code FROM articles a LEFT JOIN media_sources ms ON a.media_source_id = ms.id LEFT JOIN categories c ON a.category_id = c.id WHERE a.id = ?`, args: [id] });
      if (result.rows.length === 0) return res.status(404).json({ error: 'Not found' });
      const row = result.rows[0] as Record<string, unknown>;
      return res.status(200).json({ ...dbToNewsItem(row), content: row.content, clusterId: row.cluster_id });
    }

    if (action === 'search') {
      const q = req.query.q as string;
      if (!q) return res.status(400).json({ error: 'Missing query' });
      const limit = Math.min(Number(req.query.limit) || 20, 100);
      const result = await db.execute({ sql: `${BASE_SELECT} WHERE a.title LIKE ? OR a.summary LIKE ? ORDER BY a.published_at DESC LIMIT ?`, args: [`%${q}%`, `%${q}%`, limit] });
      return res.status(200).json(result.rows.map(r => dbToNewsItem(r as Record<string, unknown>)));
    }

    if (action === 'by-date') {
      const date = req.query.date as string;
      if (!date) return res.status(400).json({ error: 'Missing date' });
      const result = await db.execute({ sql: `${BASE_SELECT} WHERE date(a.published_at) = date(?) ORDER BY a.published_at DESC`, args: [date] });
      return res.status(200).json(result.rows.map(r => dbToNewsItem(r as Record<string, unknown>)));
    }

    if (action === 'by-category') {
      const category = req.query.category as string;
      if (!category) return res.status(400).json({ error: 'Missing category' });
      const limit = Math.min(Number(req.query.limit) || 20, 100);
      const result = await db.execute({ sql: `${BASE_SELECT} WHERE c.code = ? ORDER BY a.published_at DESC LIMIT ?`, args: [category, limit] });
      return res.status(200).json(result.rows.map(r => dbToNewsItem(r as Record<string, unknown>)));
    }

    if (action === 'by-source') {
      const source = req.query.source as string;
      if (!source) return res.status(400).json({ error: 'Missing source' });
      const limit = Math.min(Number(req.query.limit) || 20, 100);
      const result = await db.execute({ sql: `${BASE_SELECT} WHERE ms.code = ? ORDER BY a.published_at DESC LIMIT ?`, args: [source, limit] });
      return res.status(200).json(result.rows.map(r => dbToNewsItem(r as Record<string, unknown>)));
    }

    if (action === 'by-series') {
      const seriesId = req.query.seriesId as string;
      if (!seriesId) return res.status(400).json({ error: 'Missing seriesId' });
      const limit = Math.min(Number(req.query.limit) || 50, 200);
      const result = await db.execute({ sql: `${BASE_SELECT} WHERE a.series_id = ? AND COALESCE(a.is_disabled, 0) = 0 ORDER BY a.published_at ASC LIMIT ?`, args: [seriesId, limit] });
      return res.status(200).json(result.rows.map(r => dbToNewsItem(r as Record<string, unknown>)));
    }

    if (action === 'related') {
      const newsId = req.query.newsId as string;
      const clusterId = req.query.clusterId as string;
      const category = req.query.category as string;
      if (!newsId) return res.status(400).json({ error: 'Missing newsId' });
      const limit = Math.min(Number(req.query.limit) || 6, 20);
      if (clusterId) {
        const r = await db.execute({ sql: `${BASE_SELECT} WHERE a.cluster_id = ? AND a.id != ? ORDER BY a.published_at DESC LIMIT ?`, args: [clusterId, newsId, limit] });
        if (r.rows.length > 0) return res.status(200).json(r.rows.map(row => dbToNewsItem(row as Record<string, unknown>)));
      }
      const code = (category ? CATEGORY_TO_CODE[category] : null) || 'local';
      const result = await db.execute({ sql: `${BASE_SELECT} WHERE c.code = ? AND a.id != ? ORDER BY a.published_at DESC LIMIT ?`, args: [code, newsId, limit] });
      return res.status(200).json(result.rows.map(r => dbToNewsItem(r as Record<string, unknown>)));
    }

    if (action === 'dates') {
      const result = await db.execute(`SELECT DISTINCT date(published_at) as date FROM articles ORDER BY date DESC`);
      return res.status(200).json(result.rows.map(r => (r as Record<string, unknown>).date as string));
    }

    // Default: list
    const limit = Math.min(Number(req.query.limit) || 50, 200);
    const filtered = req.query.filtered === 'true';

    if (filtered) {
      const result = await db.execute({ sql: `SELECT a.*, a.cluster_id, a.title_normalized, ms.code as source_code, c.code as category_code FROM articles a LEFT JOIN media_sources ms ON a.media_source_id = ms.id LEFT JOIN categories c ON a.category_id = c.id WHERE COALESCE(a.is_disabled, 0) = 0 ORDER BY a.published_at DESC LIMIT ?`, args: [limit * 3] });
      const allNews = result.rows.map(r => {
        const row = r as Record<string, unknown>;
        return { ...dbToNewsItem(row), clusterId: row.cluster_id as string | undefined, titleNormalized: row.title_normalized as string | undefined };
      });
      const displayed: typeof allNews = [];
      const clusters = new Set<string>();
      const titles = new Map<string, string>();
      for (const news of allNews) {
        if (news.clusterId && clusters.has(news.clusterId)) continue;
        if (news.titleNormalized) {
          let skip = false;
          for (const t of titles.keys()) if (calculateSimpleSimilarity(news.titleNormalized, t) >= 0.4) { skip = true; break; }
          if (skip) continue;
        }
        displayed.push(news);
        if (news.clusterId) clusters.add(news.clusterId);
        if (news.titleNormalized) titles.set(news.titleNormalized, news.publishedAt);
        if (displayed.length >= limit) break;
      }
      return res.status(200).json(displayed.map(({ clusterId, titleNormalized, ...rest }) => rest));
    }

    const result = await db.execute({ sql: `${BASE_SELECT} ORDER BY a.published_at DESC LIMIT ?`, args: [limit] });
    return res.status(200).json(result.rows.map(r => dbToNewsItem(r as Record<string, unknown>)));
  } catch (error) {
    console.error('API Error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
