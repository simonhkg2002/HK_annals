import { db } from './db';
import { NewsItem, NewsCategory, NewsSource, CATEGORY_MAP, SOURCE_MAP, DBArticle } from '../types';

// 將資料庫記錄轉換為 NewsItem
function dbToNewsItem(row: DBArticle): NewsItem {
  const sourceCode = row.source_code || 'hk01';
  const categoryCode = row.category_code || 'local';

  return {
    id: String(row.id),
    title: row.title,
    url: row.original_url,
    source: (SOURCE_MAP[sourceCode] || 'HK01') as NewsSource,
    category: (CATEGORY_MAP[categoryCode] || '港聞') as NewsCategory,
    publishedAt: row.published_at,
    thumbnail: row.thumbnail_url,
    summary: row.summary || '',
    author: row.author || undefined,
    tags: row.tags ? JSON.parse(row.tags) : undefined,
  };
}

// 獲取最新新聞
export async function fetchLatestNews(limit: number = 50): Promise<NewsItem[]> {
  const result = await db.execute({
    sql: `
      SELECT
        a.*,
        ms.code as source_code,
        ms.name_zh as source_name,
        c.code as category_code,
        c.name_zh as category_name
      FROM articles a
      LEFT JOIN media_sources ms ON a.media_source_id = ms.id
      LEFT JOIN categories c ON a.category_id = c.id
      ORDER BY a.published_at DESC
      LIMIT ?
    `,
    args: [limit],
  });

  return result.rows.map((row) => dbToNewsItem(row as unknown as DBArticle));
}

// 按分類獲取新聞
export async function fetchNewsByCategory(
  category: string,
  limit: number = 20
): Promise<NewsItem[]> {
  const result = await db.execute({
    sql: `
      SELECT
        a.*,
        ms.code as source_code,
        ms.name_zh as source_name,
        c.code as category_code,
        c.name_zh as category_name
      FROM articles a
      LEFT JOIN media_sources ms ON a.media_source_id = ms.id
      LEFT JOIN categories c ON a.category_id = c.id
      WHERE c.code = ?
      ORDER BY a.published_at DESC
      LIMIT ?
    `,
    args: [category, limit],
  });

  return result.rows.map((row) => dbToNewsItem(row as unknown as DBArticle));
}

// 按日期獲取新聞
export async function fetchNewsByDate(date: string): Promise<NewsItem[]> {
  const result = await db.execute({
    sql: `
      SELECT
        a.*,
        ms.code as source_code,
        ms.name_zh as source_name,
        c.code as category_code,
        c.name_zh as category_name
      FROM articles a
      LEFT JOIN media_sources ms ON a.media_source_id = ms.id
      LEFT JOIN categories c ON a.category_id = c.id
      WHERE date(a.published_at) = date(?)
      ORDER BY a.published_at DESC
    `,
    args: [date],
  });

  return result.rows.map((row) => dbToNewsItem(row as unknown as DBArticle));
}

// 獲取每日統計
export async function fetchDailyStats(days: number = 7): Promise<{ date: string; count: number }[]> {
  const result = await db.execute({
    sql: `
      SELECT
        date(published_at) as date,
        COUNT(*) as count
      FROM articles
      WHERE published_at >= datetime('now', ?)
      GROUP BY date(published_at)
      ORDER BY date DESC
    `,
    args: [`-${days} days`],
  });

  return result.rows.map((row) => ({
    date: row.date as string,
    count: row.count as number,
  }));
}

// 獲取統計資料
export async function fetchStats(): Promise<{
  totalArticles: number;
  todayArticles: number;
  sources: { name: string; count: number }[];
  categories: { name: string; count: number }[];
}> {
  const [total, today, sources, categories] = await Promise.all([
    db.execute('SELECT COUNT(*) as count FROM articles'),
    db.execute(`
      SELECT COUNT(*) as count FROM articles
      WHERE date(published_at) = date('now')
    `),
    db.execute(`
      SELECT ms.name_zh as name, COUNT(a.id) as count
      FROM articles a
      JOIN media_sources ms ON a.media_source_id = ms.id
      GROUP BY ms.id
      ORDER BY count DESC
    `),
    db.execute(`
      SELECT c.name_zh as name, COUNT(a.id) as count
      FROM articles a
      LEFT JOIN categories c ON a.category_id = c.id
      GROUP BY c.id
      ORDER BY count DESC
    `),
  ]);

  return {
    totalArticles: total.rows[0].count as number,
    todayArticles: today.rows[0].count as number,
    sources: sources.rows.map((r) => ({ name: r.name as string, count: r.count as number })),
    categories: categories.rows.map((r) => ({
      name: (r.name as string) || '未分類',
      count: r.count as number,
    })),
  };
}

// 搜尋新聞
export async function searchNews(query: string, limit: number = 20): Promise<NewsItem[]> {
  const result = await db.execute({
    sql: `
      SELECT
        a.*,
        ms.code as source_code,
        ms.name_zh as source_name,
        c.code as category_code,
        c.name_zh as category_name
      FROM articles a
      LEFT JOIN media_sources ms ON a.media_source_id = ms.id
      LEFT JOIN categories c ON a.category_id = c.id
      WHERE a.title LIKE ? OR a.summary LIKE ?
      ORDER BY a.published_at DESC
      LIMIT ?
    `,
    args: [`%${query}%`, `%${query}%`, limit],
  });

  return result.rows.map((row) => dbToNewsItem(row as unknown as DBArticle));
}

// 獲取所有日期（用於歸檔頁面）
export async function fetchAllDates(): Promise<string[]> {
  const result = await db.execute(`
    SELECT DISTINCT date(published_at) as date
    FROM articles
    ORDER BY date DESC
  `);

  return result.rows.map((row) => row.date as string);
}

// 按媒體來源獲取新聞
export async function fetchNewsBySource(
  sourceCode: string,
  limit: number = 20
): Promise<NewsItem[]> {
  const result = await db.execute({
    sql: `
      SELECT
        a.*,
        ms.code as source_code,
        ms.name_zh as source_name,
        c.code as category_code,
        c.name_zh as category_name
      FROM articles a
      LEFT JOIN media_sources ms ON a.media_source_id = ms.id
      LEFT JOIN categories c ON a.category_id = c.id
      WHERE ms.code = ?
      ORDER BY a.published_at DESC
      LIMIT ?
    `,
    args: [sourceCode, limit],
  });

  return result.rows.map((row) => dbToNewsItem(row as unknown as DBArticle));
}

// 獲取單條新聞詳情
export interface NewsDetail extends NewsItem {
  content: string | null;
  clusterId: string | null;
}

export async function fetchNewsById(id: string): Promise<NewsDetail | null> {
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
    return null;
  }

  const row = result.rows[0] as Record<string, unknown>;
  return {
    ...dbToNewsItem(row as unknown as DBArticle),
    content: row.content as string | null,
    clusterId: row.cluster_id as string | null,
  };
}

// 獲取相關新聞（同群組或同分類）
export async function fetchRelatedNews(
  newsId: string,
  clusterId: string | null,
  category: string,
  limit: number = 6
): Promise<NewsItem[]> {
  // 先嘗試獲取同群組的新聞
  if (clusterId) {
    const clusterNews = await db.execute({
      sql: `
        SELECT
          a.*,
          ms.code as source_code,
          ms.name_zh as source_name,
          c.code as category_code,
          c.name_zh as category_name
        FROM articles a
        LEFT JOIN media_sources ms ON a.media_source_id = ms.id
        LEFT JOIN categories c ON a.category_id = c.id
        WHERE a.cluster_id = ? AND a.id != ?
        ORDER BY a.published_at DESC
        LIMIT ?
      `,
      args: [clusterId, newsId, limit],
    });

    if (clusterNews.rows.length > 0) {
      return clusterNews.rows.map((row) => dbToNewsItem(row as unknown as DBArticle));
    }
  }

  // 如果沒有同群組的，獲取同分類的新聞
  const categoryCode = Object.entries({
    '港聞': 'local',
    '社會': 'society',
    '政治': 'politics',
    '財經': 'economy',
    '國際': 'international',
    '中國': 'china',
    '體育': 'sports',
    '娛樂': 'entertainment',
  }).find(([name]) => name === category)?.[1] || 'local';

  const result = await db.execute({
    sql: `
      SELECT
        a.*,
        ms.code as source_code,
        ms.name_zh as source_name,
        c.code as category_code,
        c.name_zh as category_name
      FROM articles a
      LEFT JOIN media_sources ms ON a.media_source_id = ms.id
      LEFT JOIN categories c ON a.category_id = c.id
      WHERE c.code = ? AND a.id != ?
      ORDER BY a.published_at DESC
      LIMIT ?
    `,
    args: [categoryCode, newsId, limit],
  });

  return result.rows.map((row) => dbToNewsItem(row as unknown as DBArticle));
}

// ============ 相似度過濾（首頁用） ============

interface NewsItemWithCluster extends NewsItem {
  clusterId?: string;
  titleNormalized?: string;
}

/**
 * 獲取首頁新聞（過濾 >65% 相似的新聞）
 * 邏輯：按發布時間排序，過濾掉相似的重複報導
 */
export async function fetchLatestNewsFiltered(limit: number = 50): Promise<NewsItem[]> {
  // 獲取最近的新聞，包含 cluster_id 和 title_normalized
  const result = await db.execute({
    sql: `
      SELECT
        a.*,
        a.cluster_id,
        a.title_normalized,
        ms.code as source_code,
        ms.name_zh as source_name,
        c.code as category_code,
        c.name_zh as category_name
      FROM articles a
      LEFT JOIN media_sources ms ON a.media_source_id = ms.id
      LEFT JOIN categories c ON a.category_id = c.id
      WHERE COALESCE(a.is_disabled, 0) = 0
      ORDER BY a.published_at DESC
      LIMIT ?
    `,
    args: [limit * 3], // 取更多資料用於過濾
  });

  const allNews = result.rows.map((row) => {
    const r = row as Record<string, unknown>;
    return {
      ...dbToNewsItem(r as unknown as DBArticle),
      clusterId: r.cluster_id as string | undefined,
      titleNormalized: r.title_normalized as string | undefined,
    } as NewsItemWithCluster;
  });

  // 過濾相似新聞
  const displayedNews: NewsItemWithCluster[] = [];
  const displayedClusters = new Set<string>();
  const displayedTitles = new Map<string, string>();

  for (const news of allNews) {
    // 檢查是否在同一群組（跳過重複群組）
    if (news.clusterId && displayedClusters.has(news.clusterId)) {
      continue;
    }

    // 檢查標題相似度（簡化版：使用正規化標題比對）
    if (news.titleNormalized) {
      let shouldSkip = false;

      for (const existingTitle of displayedTitles.keys()) {
        const similarity = calculateSimpleSimilarity(news.titleNormalized, existingTitle);

        if (similarity >= 0.65) {
          // >65% 相似，跳過（保留先出現的，即較新的）
          shouldSkip = true;
          break;
        }
      }

      if (shouldSkip) {
        continue;
      }
    }

    // 加入顯示列表
    displayedNews.push(news);

    if (news.clusterId) {
      displayedClusters.add(news.clusterId);
    }

    if (news.titleNormalized) {
      displayedTitles.set(news.titleNormalized, news.publishedAt);
    }

    if (displayedNews.length >= limit) {
      break;
    }
  }

  return displayedNews;
}

/**
 * 簡化的標題相似度計算（用於快速過濾）
 */
function calculateSimpleSimilarity(title1: string, title2: string): number {
  if (title1 === title2) return 1;

  const len1 = title1.length;
  const len2 = title2.length;
  const maxLen = Math.max(len1, len2);

  if (maxLen === 0) return 0;

  // 計算共同字元數
  const chars1 = new Set(title1);
  const chars2 = new Set(title2);
  let common = 0;
  for (const char of chars1) {
    if (chars2.has(char)) common++;
  }

  return common / Math.max(chars1.size, chars2.size);
}

// ============ 管理員功能 ============

export interface AdminUser {
  id: number;
  username: string;
  displayName: string;
  isActive: boolean;
  lastLoginAt: string | null;
}

export interface NewsSeries {
  id: number;
  name: string;
  description: string | null;
  color: string;
  isActive: boolean;
  createdAt?: string | null;
}

/**
 * 使用 SHA-256 雜湊密碼（瀏覽器兼容）
 */
async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * 驗證管理員登入
 */
export async function verifyAdminLogin(
  username: string,
  password: string
): Promise<AdminUser | null> {
  // 使用 SHA-256 雜湊密碼
  const passwordHash = await hashPassword(password);

  const result = await db.execute({
    sql: `
      SELECT id, username, display_name, is_active, last_login_at
      FROM admin_users
      WHERE username = ? AND password_hash = ? AND is_active = 1
    `,
    args: [username, passwordHash],
  });

  if (result.rows.length === 0) {
    return null;
  }

  const row = result.rows[0] as Record<string, unknown>;

  // 更新最後登入時間
  await db.execute({
    sql: `UPDATE admin_users SET last_login_at = datetime('now') WHERE id = ?`,
    args: [row.id as number],
  });

  return {
    id: row.id as number,
    username: row.username as string,
    displayName: (row.display_name as string) || (row.username as string),
    isActive: row.is_active === 1,
    lastLoginAt: row.last_login_at as string | null,
  };
}

/**
 * 獲取所有新聞系列（按建立時間倒序，最新的在前）
 */
export async function fetchNewsSeries(): Promise<NewsSeries[]> {
  const result = await db.execute(`
    SELECT id, name, description, color, is_active, created_at
    FROM news_series
    WHERE is_active = 1
    ORDER BY created_at DESC
  `);

  return result.rows.map((row) => {
    const r = row as Record<string, unknown>;
    return {
      id: r.id as number,
      name: r.name as string,
      description: r.description as string | null,
      color: r.color as string,
      isActive: r.is_active === 1,
      createdAt: r.created_at as string | null,
    };
  });
}

/**
 * 獲取指定系列的新聞
 */
export async function fetchNewsBySeries(
  seriesId: number,
  limit: number = 50
): Promise<NewsItem[]> {
  const result = await db.execute({
    sql: `
      SELECT
        a.*,
        ms.code as source_code,
        ms.name_zh as source_name,
        c.code as category_code,
        c.name_zh as category_name
      FROM articles a
      LEFT JOIN media_sources ms ON a.media_source_id = ms.id
      LEFT JOIN categories c ON a.category_id = c.id
      WHERE a.series_id = ? AND COALESCE(a.is_disabled, 0) = 0
      ORDER BY a.published_at ASC
      LIMIT ?
    `,
    args: [seriesId, limit],
  });

  return result.rows.map((row) => dbToNewsItem(row as unknown as DBArticle));
}

/**
 * 創建新聞系列
 */
export async function createNewsSeries(
  name: string,
  description: string | null,
  color: string
): Promise<number> {
  const result = await db.execute({
    sql: `
      INSERT INTO news_series (name, description, color)
      VALUES (?, ?, ?)
    `,
    args: [name, description, color],
  });

  return Number(result.lastInsertRowid);
}

/**
 * 刪除新聞系列
 */
export async function deleteNewsSeries(seriesId: number): Promise<void> {
  // 先將使用此系列的文章設為無系列
  await db.execute({
    sql: `UPDATE articles SET series_id = NULL WHERE series_id = ?`,
    args: [seriesId],
  });

  // 刪除系列
  await db.execute({
    sql: `DELETE FROM news_series WHERE id = ?`,
    args: [seriesId],
  });
}

/**
 * 停用新聞（軟刪除）
 */
export async function disableNews(
  articleId: string,
  adminUsername: string
): Promise<void> {
  await db.execute({
    sql: `
      UPDATE articles
      SET is_disabled = 1, disabled_at = datetime('now'), disabled_by = ?
      WHERE id = ?
    `,
    args: [adminUsername, articleId],
  });
}

/**
 * 恢復新聞
 */
export async function enableNews(articleId: string): Promise<void> {
  await db.execute({
    sql: `
      UPDATE articles
      SET is_disabled = 0, disabled_at = NULL, disabled_by = NULL
      WHERE id = ?
    `,
    args: [articleId],
  });
}

/**
 * 設定新聞系列
 */
export async function setNewsSeriesId(
  articleId: string,
  seriesId: number | null
): Promise<void> {
  await db.execute({
    sql: `UPDATE articles SET series_id = ? WHERE id = ?`,
    args: [seriesId, articleId],
  });
}

/**
 * 獲取管理員新聞列表（包含已停用的）
 */
export async function fetchNewsForAdmin(
  limit: number = 50,
  includeDisabled: boolean = true
): Promise<(NewsItem & { isDisabled: boolean; seriesId: number | null })[]> {
  const whereClause = includeDisabled ? '' : 'WHERE COALESCE(a.is_disabled, 0) = 0';

  const result = await db.execute({
    sql: `
      SELECT
        a.*,
        a.is_disabled,
        a.series_id,
        ms.code as source_code,
        ms.name_zh as source_name,
        c.code as category_code,
        c.name_zh as category_name
      FROM articles a
      LEFT JOIN media_sources ms ON a.media_source_id = ms.id
      LEFT JOIN categories c ON a.category_id = c.id
      ${whereClause}
      ORDER BY a.published_at DESC
      LIMIT ?
    `,
    args: [limit],
  });

  return result.rows.map((row) => {
    const r = row as Record<string, unknown>;
    return {
      ...dbToNewsItem(r as unknown as DBArticle),
      isDisabled: r.is_disabled === 1,
      seriesId: r.series_id as number | null,
    };
  });
}
