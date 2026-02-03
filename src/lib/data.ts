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

// 獲取每日統計（支援系列過濾）
export async function fetchDailyStatsBySeries(
  days: number = 7,
  seriesId: number | null
): Promise<{ date: string; count: number }[]> {
  const whereClause = seriesId !== null ? 'AND a.series_id = ?' : '';
  const args = seriesId !== null ? [`-${days} days`, seriesId] : [`-${days} days`];

  const result = await db.execute({
    sql: `
      SELECT
        date(a.published_at) as date,
        COUNT(*) as count
      FROM articles a
      WHERE a.published_at >= datetime('now', ?)
      ${whereClause}
      GROUP BY date(a.published_at)
      ORDER BY date DESC
    `,
    args,
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

// 獲取統計資料（支援系列過濾）
export async function fetchStatsBySeries(
  seriesId: number | null
): Promise<{
  totalArticles: number;
  todayArticles: number;
  sources: { name: string; count: number }[];
  categories: { name: string; count: number }[];
}> {
  const whereClause = seriesId !== null ? 'WHERE a.series_id = ?' : '';
  const args = seriesId !== null ? [seriesId] : [];

  const [total, today, sources, categories] = await Promise.all([
    db.execute({
      sql: `SELECT COUNT(*) as count FROM articles a ${whereClause}`,
      args,
    }),
    db.execute({
      sql: `
        SELECT COUNT(*) as count FROM articles a
        ${whereClause ? whereClause + ' AND' : 'WHERE'} date(a.published_at) = date('now')
      `,
      args,
    }),
    db.execute({
      sql: `
        SELECT ms.name_zh as name, COUNT(a.id) as count
        FROM articles a
        JOIN media_sources ms ON a.media_source_id = ms.id
        ${whereClause}
        GROUP BY ms.id
        ORDER BY count DESC
      `,
      args,
    }),
    db.execute({
      sql: `
        SELECT c.name_zh as name, COUNT(a.id) as count
        FROM articles a
        LEFT JOIN categories c ON a.category_id = c.id
        ${whereClause}
        GROUP BY c.id
        ORDER BY count DESC
      `,
      args,
    }),
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
 * 獲取首頁新聞（過濾 >40% 相似的新聞）
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

        if (similarity >= 0.40) {
          // >40% 相似，跳過（保留先出現的，即較新的）
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
 * 簡化的標題相似度計算（字符集合比較）
 */
function calculateSimpleSimilarity(title1: string, title2: string): number {
  if (title1 === title2) return 1;
  if (!title1 || !title2) return 0;

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
  keywords?: string[]; // 關鍵詞列表
  autoAddEnabled?: boolean; // 是否啟用自動加入
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
    SELECT id, name, description, color, is_active, created_at, keywords, auto_add_enabled
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
      keywords: r.keywords ? JSON.parse(r.keywords as string) : [],
      autoAddEnabled: r.auto_add_enabled === 1,
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
  color: string,
  keywords: string[] = [],
  autoAddEnabled: boolean = true
): Promise<number> {
  const keywordsJson = JSON.stringify(keywords);

  const result = await db.execute({
    sql: `
      INSERT INTO news_series (name, description, color, keywords, auto_add_enabled)
      VALUES (?, ?, ?, ?, ?)
    `,
    args: [name, description, color, keywordsJson, autoAddEnabled ? 1 : 0],
  });

  return Number(result.lastInsertRowid);
}

/**
 * 更新新聞系列
 */
export async function updateNewsSeries(
  seriesId: number,
  name: string,
  description: string | null,
  color: string,
  keywords: string[] = [],
  autoAddEnabled: boolean = true
): Promise<void> {
  const keywordsJson = JSON.stringify(keywords);

  await db.execute({
    sql: `
      UPDATE news_series
      SET name = ?, description = ?, color = ?, keywords = ?, auto_add_enabled = ?, updated_at = datetime('now')
      WHERE id = ?
    `,
    args: [name, description, color, keywordsJson, autoAddEnabled ? 1 : 0, seriesId],
  });
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

// 媒體優先順序（數字越小優先級越高）
const SOURCE_PRIORITY: Record<string, number> = {
  'HK01': 1,
  'Yahoo': 2,
  'RTHK': 3,
  '明報': 4,
};

/**
 * 獲取媒體優先級
 */
function getSourcePriority(source: string): number {
  return SOURCE_PRIORITY[source] ?? 99;
}

export interface NewsItemWithSimilarity extends NewsItem {
  isDisabled: boolean;
  seriesId: number | null;
  isSimilarDuplicate: boolean; // 是否為相似重複文章（低優先級）
  similarToId: string | null;  // 相似的原始文章 ID
  titleNormalized: string | null;
  hasThumbnail: boolean; // 是否有封面圖像
}

/**
 * 獲取管理員新聞列表（包含已停用的，支援分頁，含相似度檢測）
 */
export async function fetchNewsForAdmin(
  limit: number = 50,
  includeDisabled: boolean = true,
  offset: number = 0
): Promise<NewsItemWithSimilarity[]> {
  const whereClause = includeDisabled ? '' : 'WHERE COALESCE(a.is_disabled, 0) = 0';

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
    args: [limit, offset],
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

  // 檢測 ±6 小時內的相似文章
  const SIX_HOURS_MS = 6 * 60 * 60 * 1000;

  for (let i = 0; i < newsItems.length; i++) {
    const current = newsItems[i];
    if (current.isSimilarDuplicate) continue; // 已標記為重複，跳過

    // 查找 ±2 小時內的相似文章
    for (let j = 0; j < newsItems.length; j++) {
      if (i === j) continue;
      const other = newsItems[j];
      if (other.isSimilarDuplicate) continue;

      // 檢查時間差是否在 ±2 小時內
      const timeDiff = Math.abs(current.publishedAtTime - other.publishedAtTime);
      if (timeDiff > SIX_HOURS_MS) continue;

      // 檢查相似度（使用 cluster_id 或 title_normalized）
      let isSimilar = false;

      // 優先使用 cluster_id
      if (current.clusterId && other.clusterId && current.clusterId === other.clusterId) {
        isSimilar = true;
      }
      // 其次使用 title_normalized 相似度
      else if (current.titleNormalized && other.titleNormalized) {
        const similarity = calculateSimpleSimilarity(current.titleNormalized, other.titleNormalized);
        if (similarity >= 0.40) {
          isSimilar = true;
        }
      }

      if (isSimilar) {
        // 比較優先級，標記低優先級的為重複
        const currentPriority = getSourcePriority(current.source);
        const otherPriority = getSourcePriority(other.source);

        if (currentPriority > otherPriority) {
          // current 優先級較低，標記為重複
          current.isSimilarDuplicate = true;
          current.similarToId = other.id;
          break; // current 已標記，跳出內層循環
        } else if (otherPriority > currentPriority) {
          // other 優先級較低，標記為重複
          other.isSimilarDuplicate = true;
          other.similarToId = current.id;
        }
        // 優先級相同則都不標記
      }
    }
  }

  // 移除臨時屬性，返回結果
  return newsItems.map(({ publishedAtTime, clusterId, ...rest }) => rest);
}

/**
 * 獲取管理員新聞列表（支援系列過濾，包含已停用的，支援分頁，含相似度檢測）
 */
export async function fetchNewsForAdminBySeries(
  limit: number = 50,
  includeDisabled: boolean = true,
  offset: number = 0,
  seriesId: number | null
): Promise<NewsItemWithSimilarity[]> {
  const whereClauses: string[] = [];
  const args: any[] = [];

  if (!includeDisabled) {
    whereClauses.push('COALESCE(a.is_disabled, 0) = 0');
  }

  if (seriesId !== null) {
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

  // 檢測 ±6 小時內的相似文章
  const SIX_HOURS_MS = 6 * 60 * 60 * 1000;

  for (let i = 0; i < newsItems.length; i++) {
    const current = newsItems[i];
    if (current.isSimilarDuplicate) continue; // 已標記為重複，跳過

    // 查找 ±6 小時內的相似文章
    for (let j = 0; j < newsItems.length; j++) {
      if (i === j) continue;
      const other = newsItems[j];
      if (other.isSimilarDuplicate) continue;

      // 檢查時間差是否在 ±6 小時內
      const timeDiff = Math.abs(current.publishedAtTime - other.publishedAtTime);
      if (timeDiff > SIX_HOURS_MS) continue;

      // 檢查相似度（使用 cluster_id 或 title_normalized）
      let isSimilar = false;

      // 優先使用 cluster_id
      if (current.clusterId && other.clusterId && current.clusterId === other.clusterId) {
        isSimilar = true;
      }
      // 其次使用 title_normalized 相似度
      else if (current.titleNormalized && other.titleNormalized) {
        const similarity = calculateSimpleSimilarity(current.titleNormalized, other.titleNormalized);
        if (similarity >= 0.40) {
          isSimilar = true;
        }
      }

      if (isSimilar) {
        // 比較優先級，標記低優先級的為重複
        const currentPriority = getSourcePriority(current.source);
        const otherPriority = getSourcePriority(other.source);

        if (currentPriority > otherPriority) {
          // current 優先級較低，標記為重複
          current.isSimilarDuplicate = true;
          current.similarToId = other.id;
          break; // current 已標記，跳出內層循環
        } else if (otherPriority > currentPriority) {
          // other 優先級較低，標記為重複
          other.isSimilarDuplicate = true;
          other.similarToId = current.id;
        }
        // 優先級相同則都不標記
      }
    }
  }

  // 移除臨時屬性，返回結果
  return newsItems.map(({ publishedAtTime, clusterId, ...rest }) => rest);
}

/**
 * 獲取管理員新聞總數
 */
export async function fetchNewsCountForAdmin(includeDisabled: boolean = true): Promise<number> {
  const whereClause = includeDisabled ? '' : 'WHERE COALESCE(is_disabled, 0) = 0';

  const result = await db.execute({
    sql: `SELECT COUNT(*) as count FROM articles ${whereClause}`,
    args: [],
  });

  return result.rows[0].count as number;
}

/**
 * 獲取管理員新聞總數（支援系列過濾）
 */
export async function fetchNewsCountForAdminBySeries(
  includeDisabled: boolean = true,
  seriesId: number | null
): Promise<number> {
  const whereClauses: string[] = [];
  const args: any[] = [];

  if (!includeDisabled) {
    whereClauses.push('COALESCE(is_disabled, 0) = 0');
  }

  if (seriesId !== null) {
    whereClauses.push('series_id = ?');
    args.push(seriesId);
  }

  const whereClause = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

  const result = await db.execute({
    sql: `SELECT COUNT(*) as count FROM articles ${whereClause}`,
    args,
  });

  return result.rows[0].count as number;
}

/**
 * 獲取書籤文章的頁碼位置
 */
export async function getBookmarkPagePosition(
  articleId: string,
  pageSize: number = 100,
  includeDisabled: boolean = true
): Promise<number> {
  const whereClause = includeDisabled ? '' : 'WHERE COALESCE(a.is_disabled, 0) = 0';

  // 獲取書籤文章的發布時間
  const articleResult = await db.execute({
    sql: `SELECT published_at FROM articles WHERE id = ?`,
    args: [articleId],
  });

  if (articleResult.rows.length === 0) {
    return 1; // 文章不存在，返回第一頁
  }

  const publishedAt = articleResult.rows[0].published_at as string;

  // 計算有多少文章比書籤文章更新
  const countResult = await db.execute({
    sql: `
      SELECT COUNT(*) as count FROM articles a
      ${whereClause ? whereClause + ' AND' : 'WHERE'} a.published_at > ?
    `,
    args: [publishedAt],
  });

  const position = countResult.rows[0].count as number;
  return Math.floor(position / pageSize) + 1;
}

// ============ 自動分類與複核功能 ============

/**
 * 獲取待複核的新聞列表
 */
export async function fetchPendingReviews(
  limit: number = 100,
  offset: number = 0,
  seriesId: number | null = null,
  searchQuery: string = ''
): Promise<NewsItemWithSimilarity[]> {
  const whereClauses = ["a.review_status = 'pending'"];
  const args: any[] = [];

  if (seriesId !== null) {
    whereClauses.push('a.series_id = ?');
    args.push(seriesId);
  }

  if (searchQuery) {
    whereClauses.push('a.title LIKE ?');
    args.push(`%${searchQuery}%`);
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

  return result.rows.map((row) => {
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
    };
  });
}

/**
 * 獲取待複核新聞總數
 */
export async function fetchPendingReviewsCount(
  seriesId: number | null = null,
  searchQuery: string = ''
): Promise<number> {
  const whereClauses = ["review_status = 'pending'"];
  const args: any[] = [];

  if (seriesId !== null) {
    whereClauses.push('series_id = ?');
    args.push(seriesId);
  }

  if (searchQuery) {
    whereClauses.push('title LIKE ?');
    args.push(`%${searchQuery}%`);
  }

  const whereClause = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

  const result = await db.execute({
    sql: `SELECT COUNT(*) as count FROM articles ${whereClause}`,
    args,
  });

  return result.rows[0].count as number;
}

/**
 * 同意自動分類（從複核區移除，保留在系列）
 */
export async function approveAutoClassified(articleId: string): Promise<void> {
  await db.execute({
    sql: `
      UPDATE articles
      SET review_status = 'approved'
      WHERE id = ?
    `,
    args: [articleId],
  });
}

/**
 * 拒絕自動分類（從系列移除，從複核區移除）
 */
export async function rejectAutoClassified(articleId: string): Promise<void> {
  await db.execute({
    sql: `
      UPDATE articles
      SET series_id = NULL, review_status = 'rejected'
      WHERE id = ?
    `,
    args: [articleId],
  });
}
