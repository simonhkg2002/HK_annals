import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@libsql/client';

const db = createClient({
  url: process.env.TURSO_DATABASE_URL || '',
  authToken: process.env.TURSO_AUTH_TOKEN || '',
});

const SOURCE_MAP: Record<string, string> = { hk01: 'HK01', rthk: 'RTHK', mingpao: '明報', yahoo: 'Yahoo' };
const CATEGORY_MAP: Record<string, string> = { local: '港聞', society: '社會', politics: '政治', economy: '財經', international: '國際', china: '中國', sports: '體育', entertainment: '娛樂' };
const SOURCE_PRIORITY: Record<string, number> = { HK01: 1, Yahoo: 2, RTHK: 3, '明報': 4 };

// JWT Secret - 使用環境變數或 Turso auth token 的 hash 作為密鑰
const JWT_SECRET = process.env.JWT_SECRET || process.env.TURSO_AUTH_TOKEN || 'fallback-secret-key';

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

// Simple JWT implementation (stateless - works with serverless)
function base64UrlEncode(str: string): string {
  // Use Buffer for Node.js compatibility with non-ASCII characters
  const base64 = Buffer.from(str, 'utf-8').toString('base64');
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64UrlDecode(str: string): string {
  str = str.replace(/-/g, '+').replace(/_/g, '/');
  while (str.length % 4) str += '=';
  return Buffer.from(str, 'base64').toString('utf-8');
}

async function createHmacSignature(data: string, secret: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(data));
  return base64UrlEncode(String.fromCharCode(...new Uint8Array(signature)));
}

async function createJWT(payload: { userId: number; username: string; displayName: string }): Promise<string> {
  const header = base64UrlEncode(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const now = Math.floor(Date.now() / 1000);
  const claims = base64UrlEncode(JSON.stringify({ ...payload, iat: now, exp: now + 86400 })); // 24 hours
  const signature = await createHmacSignature(`${header}.${claims}`, JWT_SECRET);
  return `${header}.${claims}.${signature}`;
}

async function verifyJWT(token: string): Promise<{ userId: number; username: string; displayName: string } | null> {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const [header, claims, signature] = parts;
    const expectedSig = await createHmacSignature(`${header}.${claims}`, JWT_SECRET);
    if (signature !== expectedSig) return null;
    const payload = JSON.parse(base64UrlDecode(claims));
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) return null;
    return { userId: payload.userId, username: payload.username, displayName: payload.displayName };
  } catch { return null; }
}

function getToken(req: VercelRequest): string | null {
  const auth = req.headers.authorization;
  if (auth?.startsWith('Bearer ')) return auth.slice(7);
  return typeof req.query.token === 'string' ? req.query.token : null;
}

async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const action = req.query.action as string;

  try {
    // Auth
    if (action === 'login' && req.method === 'POST') {
      const { username, password } = req.body || {};
      if (!username || !password) return res.status(400).json({ error: 'Missing credentials' });
      const hash = await hashPassword(password);
      const result = await db.execute({ sql: `SELECT id, username, display_name, is_active FROM admin_users WHERE username = ? AND password_hash = ? AND is_active = 1`, args: [username, hash] });
      if (result.rows.length === 0) return res.status(401).json({ error: 'Invalid credentials' });
      const row = result.rows[0] as Record<string, unknown>;
      await db.execute({ sql: `UPDATE admin_users SET last_login_at = datetime('now') WHERE id = ?`, args: [row.id as number] });
      const token = await createJWT({ userId: row.id as number, username: row.username as string, displayName: (row.display_name as string) || (row.username as string) });
      return res.status(200).json({ token, user: { id: row.id, username: row.username, displayName: row.display_name || row.username, isActive: true } });
    }

    if (action === 'logout' && req.method === 'POST') {
      // JWT is stateless, just return success (client will delete the token)
      return res.status(200).json({ success: true });
    }

    if (action === 'verify') {
      const session = await verifyJWT(getToken(req) || '');
      if (!session) return res.status(401).json({ error: 'Unauthorized' });
      return res.status(200).json({ user: { id: session.userId, username: session.username, displayName: session.displayName, isActive: true } });
    }

    // All other actions require auth
    const session = await verifyJWT(getToken(req) || '');
    if (!session) return res.status(401).json({ error: 'Unauthorized' });

    // News management
    if (action === 'news-list') {
      const limit = Math.min(Number(req.query.limit) || 50, 200);
      const offset = Number(req.query.offset) || 0;
      const includeDisabled = req.query.includeDisabled !== 'false';
      const seriesId = req.query.seriesId as string;
      const where: string[] = [];
      const args: (string | number)[] = [];
      if (!includeDisabled) where.push('COALESCE(a.is_disabled, 0) = 0');
      if (seriesId) { where.push('a.series_id = ?'); args.push(seriesId); }
      args.push(limit, offset);
      const result = await db.execute({ sql: `SELECT a.*, a.is_disabled, a.series_id, a.title_normalized, a.cluster_id, ms.code as source_code, c.code as category_code FROM articles a LEFT JOIN media_sources ms ON a.media_source_id = ms.id LEFT JOIN categories c ON a.category_id = c.id ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY a.published_at DESC LIMIT ? OFFSET ?`, args });
      const items = result.rows.map(r => {
        const row = r as Record<string, unknown>;
        const thumb = row.thumbnail_url as string | null;
        return { ...dbToNewsItem(row), isDisabled: row.is_disabled === 1, seriesId: row.series_id as number | null, isSimilarDuplicate: false, similarToId: null as string | null, titleNormalized: row.title_normalized as string | null, hasThumbnail: thumb !== null && thumb.trim().length > 0, clusterId: row.cluster_id as string | null, publishedAtTime: new Date(row.published_at as string).getTime() };
      });
      // Similarity detection
      const SIX_HOURS = 6 * 60 * 60 * 1000;
      for (let i = 0; i < items.length; i++) {
        if (items[i].isSimilarDuplicate) continue;
        for (let j = 0; j < items.length; j++) {
          if (i === j || items[j].isSimilarDuplicate) continue;
          if (Math.abs((items[i].publishedAtTime || 0) - (items[j].publishedAtTime || 0)) > SIX_HOURS) continue;
          let similar = false;
          if (items[i].clusterId && items[j].clusterId && items[i].clusterId === items[j].clusterId) similar = true;
          else if (items[i].titleNormalized && items[j].titleNormalized && calculateSimpleSimilarity(items[i].titleNormalized, items[j].titleNormalized) >= 0.4) similar = true;
          if (similar) {
            const pi = SOURCE_PRIORITY[items[i].source] ?? 99, pj = SOURCE_PRIORITY[items[j].source] ?? 99;
            if (pi > pj) { items[i].isSimilarDuplicate = true; items[i].similarToId = items[j].id; break; }
            else if (pj > pi) { items[j].isSimilarDuplicate = true; items[j].similarToId = items[i].id; }
          }
        }
      }
      return res.status(200).json(items.map(({ publishedAtTime, clusterId, ...rest }) => rest));
    }

    if (action === 'news-count') {
      const includeDisabled = req.query.includeDisabled !== 'false';
      const seriesId = req.query.seriesId as string;
      const where: string[] = [];
      const args: (string | number)[] = [];
      if (!includeDisabled) where.push('COALESCE(is_disabled, 0) = 0');
      if (seriesId) { where.push('series_id = ?'); args.push(seriesId); }
      const result = await db.execute({ sql: `SELECT COUNT(*) as count FROM articles ${where.length ? 'WHERE ' + where.join(' AND ') : ''}`, args });
      return res.status(200).json({ count: (result.rows[0] as Record<string, unknown>).count as number });
    }

    if (action === 'news-disable' && req.method === 'POST') {
      const { articleId } = req.body || {};
      if (!articleId) return res.status(400).json({ error: 'Missing articleId' });
      await db.execute({ sql: `UPDATE articles SET is_disabled = 1, disabled_at = datetime('now'), disabled_by = ? WHERE id = ?`, args: [session.username, articleId] });
      return res.status(200).json({ success: true });
    }

    if (action === 'news-enable' && req.method === 'POST') {
      const { articleId } = req.body || {};
      if (!articleId) return res.status(400).json({ error: 'Missing articleId' });
      await db.execute({ sql: `UPDATE articles SET is_disabled = 0, disabled_at = NULL, disabled_by = NULL WHERE id = ?`, args: [articleId] });
      return res.status(200).json({ success: true });
    }

    if (action === 'news-set-series' && req.method === 'POST') {
      const { articleId, seriesId } = req.body || {};
      if (!articleId) return res.status(400).json({ error: 'Missing articleId' });
      await db.execute({ sql: `UPDATE articles SET series_id = ? WHERE id = ?`, args: [seriesId ?? null, articleId] });
      return res.status(200).json({ success: true });
    }

    if (action === 'news-bookmark-position') {
      const articleId = req.query.articleId as string;
      const pageSize = Number(req.query.pageSize) || 100;
      if (!articleId) return res.status(400).json({ error: 'Missing articleId' });
      const artResult = await db.execute({ sql: `SELECT published_at FROM articles WHERE id = ?`, args: [articleId] });
      if (artResult.rows.length === 0) return res.status(200).json({ page: 1 });
      const pubAt = (artResult.rows[0] as Record<string, unknown>).published_at as string;
      const countResult = await db.execute({ sql: `SELECT COUNT(*) as count FROM articles WHERE published_at > ?`, args: [pubAt] });
      const pos = (countResult.rows[0] as Record<string, unknown>).count as number;
      return res.status(200).json({ page: Math.floor(pos / pageSize) + 1 });
    }

    // Series management
    if (action === 'series-list') {
      const result = await db.execute(`SELECT id, name, description, color, is_active, created_at, keywords, auto_add_enabled FROM news_series WHERE is_active = 1 ORDER BY created_at DESC`);
      return res.status(200).json(result.rows.map(r => {
        const row = r as Record<string, unknown>;
        return { id: row.id, name: row.name, description: row.description, color: row.color, isActive: row.is_active === 1, createdAt: row.created_at, keywords: row.keywords ? JSON.parse(row.keywords as string) : [], autoAddEnabled: row.auto_add_enabled === 1 };
      }));
    }

    if (action === 'series-create' && req.method === 'POST') {
      const { name, description, color, keywords, autoAddEnabled } = req.body || {};
      if (!name) return res.status(400).json({ error: 'Missing name' });
      const result = await db.execute({ sql: `INSERT INTO news_series (name, description, color, keywords, auto_add_enabled) VALUES (?, ?, ?, ?, ?)`, args: [name, description || null, color || '#3b82f6', JSON.stringify(keywords || []), autoAddEnabled !== false ? 1 : 0] });
      return res.status(200).json({ success: true, id: Number(result.lastInsertRowid) });
    }

    if (action === 'series-update' && req.method === 'POST') {
      const { seriesId, name, description, color, keywords, autoAddEnabled } = req.body || {};
      if (!seriesId || !name) return res.status(400).json({ error: 'Missing fields' });
      await db.execute({ sql: `UPDATE news_series SET name = ?, description = ?, color = ?, keywords = ?, auto_add_enabled = ?, updated_at = datetime('now') WHERE id = ?`, args: [name, description || null, color || '#3b82f6', JSON.stringify(keywords || []), autoAddEnabled !== false ? 1 : 0, seriesId] });
      return res.status(200).json({ success: true });
    }

    if (action === 'series-delete' && req.method === 'POST') {
      const { seriesId } = req.body || {};
      if (!seriesId) return res.status(400).json({ error: 'Missing seriesId' });
      await db.execute({ sql: `UPDATE articles SET series_id = NULL WHERE series_id = ?`, args: [seriesId] });
      await db.execute({ sql: `DELETE FROM news_series WHERE id = ?`, args: [seriesId] });
      return res.status(200).json({ success: true });
    }

    // Review management
    if (action === 'review-list') {
      const limit = Math.min(Number(req.query.limit) || 100, 200);
      const offset = Number(req.query.offset) || 0;
      const seriesId = req.query.seriesId as string;
      const q = req.query.q as string;
      const where: string[] = ["a.review_status = 'pending'"];
      const args: (string | number)[] = [];
      if (seriesId) { where.push('a.series_id = ?'); args.push(seriesId); }
      if (q) { where.push('a.title LIKE ?'); args.push(`%${q}%`); }
      args.push(limit, offset);
      const result = await db.execute({ sql: `SELECT a.*, a.is_disabled, a.series_id, a.title_normalized, a.matched_keyword, ms.code as source_code, c.code as category_code FROM articles a LEFT JOIN media_sources ms ON a.media_source_id = ms.id LEFT JOIN categories c ON a.category_id = c.id WHERE ${where.join(' AND ')} ORDER BY a.auto_classified_at DESC LIMIT ? OFFSET ?`, args });
      return res.status(200).json(result.rows.map(r => {
        const row = r as Record<string, unknown>;
        const thumb = row.thumbnail_url as string | null;
        return { ...dbToNewsItem(row), isDisabled: row.is_disabled === 1, seriesId: row.series_id as number | null, isSimilarDuplicate: false, similarToId: null, titleNormalized: row.title_normalized, hasThumbnail: thumb !== null && thumb.trim().length > 0, matchedKeyword: row.matched_keyword };
      }));
    }

    if (action === 'review-count') {
      const seriesId = req.query.seriesId as string;
      const q = req.query.q as string;
      const where: string[] = ["review_status = 'pending'"];
      const args: (string | number)[] = [];
      if (seriesId) { where.push('series_id = ?'); args.push(seriesId); }
      if (q) { where.push('title LIKE ?'); args.push(`%${q}%`); }
      const result = await db.execute({ sql: `SELECT COUNT(*) as count FROM articles WHERE ${where.join(' AND ')}`, args });
      return res.status(200).json({ count: (result.rows[0] as Record<string, unknown>).count as number });
    }

    if (action === 'review-approve' && req.method === 'POST') {
      const { articleId } = req.body || {};
      if (!articleId) return res.status(400).json({ error: 'Missing articleId' });
      await db.execute({ sql: `UPDATE articles SET review_status = 'approved' WHERE id = ?`, args: [articleId] });
      return res.status(200).json({ success: true });
    }

    if (action === 'review-reject' && req.method === 'POST') {
      const { articleId } = req.body || {};
      if (!articleId) return res.status(400).json({ error: 'Missing articleId' });
      await db.execute({ sql: `UPDATE articles SET series_id = NULL, review_status = 'rejected' WHERE id = ?`, args: [articleId] });
      return res.status(200).json({ success: true });
    }

    return res.status(400).json({ error: 'Invalid action' });
  } catch (error) {
    console.error('Portal API Error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
