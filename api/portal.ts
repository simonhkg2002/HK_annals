import type { VercelRequest, VercelResponse } from '@vercel/node';
import { db, dbToNewsItem, DBArticle, calculateSimpleSimilarity, SOURCE_PRIORITY } from './lib/db';
import { createSession, hashPassword, deleteSession, getTokenFromRequest, validateSession, requireAuth } from './lib/auth';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const action = req.query.action as string;

  try {
    // Auth actions (no auth required)
    if (action === 'login' && req.method === 'POST') return handleLogin(req, res);
    if (action === 'logout' && req.method === 'POST') return handleLogout(req, res);
    if (action === 'verify' && req.method === 'GET') return handleVerify(req, res);

    // All other actions require auth
    const session = requireAuth(req, res);
    if (!session) return;

    // News actions
    if (action === 'news-list') return handleNewsList(req, res);
    if (action === 'news-count') return handleNewsCount(req, res);
    if (action === 'news-disable' && req.method === 'POST') return handleNewsDisable(req, res, session.username);
    if (action === 'news-enable' && req.method === 'POST') return handleNewsEnable(req, res);
    if (action === 'news-set-series' && req.method === 'POST') return handleNewsSetSeries(req, res);
    if (action === 'news-bookmark-position') return handleBookmarkPosition(req, res);

    // Series actions
    if (action === 'series-list') return handleSeriesList(req, res);
    if (action === 'series-create' && req.method === 'POST') return handleSeriesCreate(req, res);
    if (action === 'series-update' && req.method === 'POST') return handleSeriesUpdate(req, res);
    if (action === 'series-delete' && req.method === 'POST') return handleSeriesDelete(req, res);

    // Review actions
    if (action === 'review-list') return handleReviewList(req, res);
    if (action === 'review-count') return handleReviewCount(req, res);
    if (action === 'review-approve' && req.method === 'POST') return handleReviewApprove(req, res);
    if (action === 'review-reject' && req.method === 'POST') return handleReviewReject(req, res);

    return res.status(400).json({ error: 'Invalid action' });
  } catch (error) {
    console.error('Portal API Error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

// ============ Auth Handlers ============

async function handleLogin(req: VercelRequest, res: VercelResponse) {
  const { username, password } = req.body || {};
  if (!username || !password) return res.status(400).json({ error: 'Missing credentials' });

  const passwordHash = await hashPassword(password);
  const result = await db.execute({
    sql: `SELECT id, username, display_name, is_active, last_login_at FROM admin_users WHERE username = ? AND password_hash = ? AND is_active = 1`,
    args: [username, passwordHash],
  });

  if (result.rows.length === 0) return res.status(401).json({ error: 'Invalid credentials' });

  const row = result.rows[0] as Record<string, unknown>;
  await db.execute({ sql: `UPDATE admin_users SET last_login_at = datetime('now') WHERE id = ?`, args: [row.id as number] });

  const token = createSession(row.id as number, row.username as string, (row.display_name as string) || (row.username as string));

  return res.status(200).json({
    token,
    user: {
      id: row.id as number,
      username: row.username as string,
      displayName: (row.display_name as string) || (row.username as string),
      isActive: row.is_active === 1,
      lastLoginAt: row.last_login_at as string | null,
    },
  });
}

async function handleLogout(req: VercelRequest, res: VercelResponse) {
  const token = getTokenFromRequest(req);
  if (token) deleteSession(token);
  return res.status(200).json({ success: true });
}

async function handleVerify(req: VercelRequest, res: VercelResponse) {
  const token = getTokenFromRequest(req);
  const session = validateSession(token);
  if (!session) return res.status(401).json({ error: 'Unauthorized' });

  return res.status(200).json({
    user: { id: session.userId, username: session.username, displayName: session.displayName, isActive: true, lastLoginAt: null },
  });
}

// ============ News Handlers ============

async function handleNewsList(req: VercelRequest, res: VercelResponse) {
  const limit = Math.min(Number(req.query.limit) || 50, 200);
  const offset = Number(req.query.offset) || 0;
  const includeDisabled = req.query.includeDisabled !== 'false';
  const seriesId = req.query.seriesId as string;

  const whereClauses: string[] = [];
  const args: (string | number)[] = [];

  if (!includeDisabled) whereClauses.push('COALESCE(a.is_disabled, 0) = 0');
  if (seriesId) { whereClauses.push('a.series_id = ?'); args.push(seriesId); }

  const whereClause = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';
  args.push(limit, offset);

  const result = await db.execute({
    sql: `SELECT a.*, a.is_disabled, a.series_id, a.title_normalized, a.cluster_id, ms.code as source_code, ms.name_zh as source_name, c.code as category_code, c.name_zh as category_name FROM articles a LEFT JOIN media_sources ms ON a.media_source_id = ms.id LEFT JOIN categories c ON a.category_id = c.id ${whereClause} ORDER BY a.published_at DESC LIMIT ? OFFSET ?`,
    args,
  });

  const newsItems = result.rows.map((row) => {
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

  // Similarity detection
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
      if (current.clusterId && other.clusterId && current.clusterId === other.clusterId) isSimilar = true;
      else if (current.titleNormalized && other.titleNormalized && calculateSimpleSimilarity(current.titleNormalized, other.titleNormalized) >= 0.40) isSimilar = true;
      if (isSimilar) {
        const currentPriority = SOURCE_PRIORITY[current.source] ?? 99;
        const otherPriority = SOURCE_PRIORITY[other.source] ?? 99;
        if (currentPriority > otherPriority) { current.isSimilarDuplicate = true; current.similarToId = other.id; break; }
        else if (otherPriority > currentPriority) { other.isSimilarDuplicate = true; other.similarToId = current.id; }
      }
    }
  }

  return res.status(200).json(newsItems.map(({ publishedAtTime, clusterId, ...rest }) => rest));
}

async function handleNewsCount(req: VercelRequest, res: VercelResponse) {
  const includeDisabled = req.query.includeDisabled !== 'false';
  const seriesId = req.query.seriesId as string;

  const whereClauses: string[] = [];
  const args: (string | number)[] = [];

  if (!includeDisabled) whereClauses.push('COALESCE(is_disabled, 0) = 0');
  if (seriesId) { whereClauses.push('series_id = ?'); args.push(seriesId); }

  const whereClause = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';
  const result = await db.execute({ sql: `SELECT COUNT(*) as count FROM articles ${whereClause}`, args });
  return res.status(200).json({ count: result.rows[0].count as number });
}

async function handleNewsDisable(req: VercelRequest, res: VercelResponse, username: string) {
  const { articleId } = req.body || {};
  if (!articleId) return res.status(400).json({ error: 'Missing articleId' });
  await db.execute({ sql: `UPDATE articles SET is_disabled = 1, disabled_at = datetime('now'), disabled_by = ? WHERE id = ?`, args: [username, articleId] });
  return res.status(200).json({ success: true });
}

async function handleNewsEnable(req: VercelRequest, res: VercelResponse) {
  const { articleId } = req.body || {};
  if (!articleId) return res.status(400).json({ error: 'Missing articleId' });
  await db.execute({ sql: `UPDATE articles SET is_disabled = 0, disabled_at = NULL, disabled_by = NULL WHERE id = ?`, args: [articleId] });
  return res.status(200).json({ success: true });
}

async function handleNewsSetSeries(req: VercelRequest, res: VercelResponse) {
  const { articleId, seriesId } = req.body || {};
  if (!articleId) return res.status(400).json({ error: 'Missing articleId' });
  await db.execute({ sql: `UPDATE articles SET series_id = ? WHERE id = ?`, args: [seriesId ?? null, articleId] });
  return res.status(200).json({ success: true });
}

async function handleBookmarkPosition(req: VercelRequest, res: VercelResponse) {
  const articleId = req.query.articleId as string;
  const pageSize = Number(req.query.pageSize) || 100;
  const includeDisabled = req.query.includeDisabled !== 'false';
  if (!articleId) return res.status(400).json({ error: 'Missing articleId' });

  const articleResult = await db.execute({ sql: `SELECT published_at FROM articles WHERE id = ?`, args: [articleId] });
  if (articleResult.rows.length === 0) return res.status(200).json({ page: 1 });

  const publishedAt = articleResult.rows[0].published_at as string;
  const whereClause = includeDisabled ? '' : 'COALESCE(a.is_disabled, 0) = 0 AND';
  const countResult = await db.execute({ sql: `SELECT COUNT(*) as count FROM articles a WHERE ${whereClause} a.published_at > ?`, args: [publishedAt] });
  const position = countResult.rows[0].count as number;
  return res.status(200).json({ page: Math.floor(position / pageSize) + 1 });
}

// ============ Series Handlers ============

async function handleSeriesList(req: VercelRequest, res: VercelResponse) {
  const result = await db.execute(`SELECT id, name, description, color, is_active, created_at, keywords, auto_add_enabled FROM news_series WHERE is_active = 1 ORDER BY created_at DESC`);
  const series = result.rows.map((row) => {
    const r = row as Record<string, unknown>;
    return { id: r.id as number, name: r.name as string, description: r.description as string | null, color: r.color as string, isActive: r.is_active === 1, createdAt: r.created_at as string | null, keywords: r.keywords ? JSON.parse(r.keywords as string) : [], autoAddEnabled: r.auto_add_enabled === 1 };
  });
  return res.status(200).json(series);
}

async function handleSeriesCreate(req: VercelRequest, res: VercelResponse) {
  const { name, description, color, keywords, autoAddEnabled } = req.body || {};
  if (!name) return res.status(400).json({ error: 'Missing name' });
  const result = await db.execute({ sql: `INSERT INTO news_series (name, description, color, keywords, auto_add_enabled) VALUES (?, ?, ?, ?, ?)`, args: [name, description || null, color || '#3b82f6', JSON.stringify(keywords || []), autoAddEnabled !== false ? 1 : 0] });
  return res.status(200).json({ success: true, id: Number(result.lastInsertRowid) });
}

async function handleSeriesUpdate(req: VercelRequest, res: VercelResponse) {
  const { seriesId, name, description, color, keywords, autoAddEnabled } = req.body || {};
  if (!seriesId || !name) return res.status(400).json({ error: 'Missing required fields' });
  await db.execute({ sql: `UPDATE news_series SET name = ?, description = ?, color = ?, keywords = ?, auto_add_enabled = ?, updated_at = datetime('now') WHERE id = ?`, args: [name, description || null, color || '#3b82f6', JSON.stringify(keywords || []), autoAddEnabled !== false ? 1 : 0, seriesId] });
  return res.status(200).json({ success: true });
}

async function handleSeriesDelete(req: VercelRequest, res: VercelResponse) {
  const { seriesId } = req.body || {};
  if (!seriesId) return res.status(400).json({ error: 'Missing seriesId' });
  await db.execute({ sql: `UPDATE articles SET series_id = NULL WHERE series_id = ?`, args: [seriesId] });
  await db.execute({ sql: `DELETE FROM news_series WHERE id = ?`, args: [seriesId] });
  return res.status(200).json({ success: true });
}

// ============ Review Handlers ============

async function handleReviewList(req: VercelRequest, res: VercelResponse) {
  const limit = Math.min(Number(req.query.limit) || 100, 200);
  const offset = Number(req.query.offset) || 0;
  const seriesId = req.query.seriesId as string;
  const searchQuery = req.query.q as string;

  const whereClauses: string[] = ["a.review_status = 'pending'"];
  const args: (string | number)[] = [];

  if (seriesId) { whereClauses.push('a.series_id = ?'); args.push(seriesId); }
  if (searchQuery) { whereClauses.push('a.title LIKE ?'); args.push(`%${searchQuery}%`); }

  args.push(limit, offset);
  const result = await db.execute({
    sql: `SELECT a.*, a.is_disabled, a.series_id, a.title_normalized, a.matched_keyword, ms.code as source_code, ms.name_zh as source_name, c.code as category_code, c.name_zh as category_name FROM articles a LEFT JOIN media_sources ms ON a.media_source_id = ms.id LEFT JOIN categories c ON a.category_id = c.id WHERE ${whereClauses.join(' AND ')} ORDER BY a.auto_classified_at DESC LIMIT ? OFFSET ?`,
    args,
  });

  return res.status(200).json(result.rows.map((row) => {
    const r = row as Record<string, unknown>;
    const thumbnail = r.thumbnail_url as string | null;
    return { ...dbToNewsItem(r as unknown as DBArticle), isDisabled: r.is_disabled === 1, seriesId: r.series_id as number | null, isSimilarDuplicate: false, similarToId: null, titleNormalized: r.title_normalized as string | null, hasThumbnail: thumbnail !== null && thumbnail.trim().length > 0, matchedKeyword: r.matched_keyword as string | null };
  }));
}

async function handleReviewCount(req: VercelRequest, res: VercelResponse) {
  const seriesId = req.query.seriesId as string;
  const searchQuery = req.query.q as string;

  const whereClauses: string[] = ["review_status = 'pending'"];
  const args: (string | number)[] = [];

  if (seriesId) { whereClauses.push('series_id = ?'); args.push(seriesId); }
  if (searchQuery) { whereClauses.push('title LIKE ?'); args.push(`%${searchQuery}%`); }

  const result = await db.execute({ sql: `SELECT COUNT(*) as count FROM articles WHERE ${whereClauses.join(' AND ')}`, args });
  return res.status(200).json({ count: result.rows[0].count as number });
}

async function handleReviewApprove(req: VercelRequest, res: VercelResponse) {
  const { articleId } = req.body || {};
  if (!articleId) return res.status(400).json({ error: 'Missing articleId' });
  await db.execute({ sql: `UPDATE articles SET review_status = 'approved' WHERE id = ?`, args: [articleId] });
  return res.status(200).json({ success: true });
}

async function handleReviewReject(req: VercelRequest, res: VercelResponse) {
  const { articleId } = req.body || {};
  if (!articleId) return res.status(400).json({ error: 'Missing articleId' });
  await db.execute({ sql: `UPDATE articles SET series_id = NULL, review_status = 'rejected' WHERE id = ?`, args: [articleId] });
  return res.status(200).json({ success: true });
}
