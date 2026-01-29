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
