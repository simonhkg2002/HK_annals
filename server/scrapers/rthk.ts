/**
 * RTHK 港聞爬蟲
 * API: https://news.rthk.hk/rthk/webpageCache/services/loadModNewsShowSp2List.php
 */

import { db } from '../db/client';
import {
  normalizeTitle,
  generateContentHash,
  checkDuplicate,
  generateClusterId,
  type ArticleForDedup,
} from '../lib/dedup';

// RTHK 分類代碼
const RTHK_CATEGORIES = {
  local: 3,      // 港聞
  greaterChina: 2,  // 大中華
  international: 4, // 國際
  finance: 5,    // 財經
};

// 轉換為資料庫格式
interface ArticleInsert {
  media_source_id: number;
  original_id: string;
  original_url: string;
  title: string;
  content: string | null;
  summary: string;
  published_at: string;
  updated_at: string | null;
  category_id: number | null;
  tags: string;
  thumbnail_url: string | null;
  author: string | null;
  language: string;
  is_headline: number;
  importance_score: number;
  content_hash: string | null;
  title_normalized: string;
  cluster_id: string | null;
}

interface ParsedArticle {
  id: string;
  url: string;
  title: string;
  publishedAt: string;
  hasVideo: boolean;
}

/**
 * 從 HTML 列表中解析文章
 */
function parseArticleList(html: string): ParsedArticle[] {
  const articles: ParsedArticle[] = [];

  // 匹配每個文章區塊
  const articlePattern = /<h4 class='ns2-title'><a href='([^']+)'>([^<]+)<\/a><\/h4>[\s\S]*?<div class='ns2-created'>([^<]+)<\/div>/g;

  let match;
  while ((match = articlePattern.exec(html)) !== null) {
    const url = match[1];
    const title = match[2].trim();
    const dateStr = match[3].trim(); // Format: "2026-01-29 HKT 20:52"

    // 從 URL 提取 ID: https://news.rthk.hk/rthk/ch/component/k2/1841940-20260129.htm
    const idMatch = url.match(/\/k2\/(\d+)-(\d+)\.htm/);
    if (!idMatch) continue;

    const id = idMatch[1];

    // 解析日期時間
    const dateMatch = dateStr.match(/(\d{4}-\d{2}-\d{2}) HKT (\d{2}:\d{2})/);
    if (!dateMatch) continue;

    const publishedAt = `${dateMatch[1]}T${dateMatch[2]}:00+08:00`;

    // 檢查是否有影片
    const hasVideo = html.includes(`video_icon.png`) &&
                     html.substring(match.index!, match.index! + 500).includes('video_icon.png');

    articles.push({
      id,
      url,
      title,
      publishedAt,
      hasVideo,
    });
  }

  return articles;
}

/**
 * 延遲函數
 */
function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * 帶重試的 fetch
 */
async function fetchWithRetry(
  url: string,
  maxRetries: number = 3
): Promise<Response | null> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        },
      });

      if (response.ok) {
        return response;
      }

      // 429 Too Many Requests
      if (response.status === 429) {
        console.log(`   ⏳ Rate limited, waiting ${attempt * 2}s...`);
        await delay(attempt * 2000);
        continue;
      }

      return null;
    } catch (error) {
      if (attempt < maxRetries) {
        await delay(attempt * 1000);
      }
    }
  }
  return null;
}

/**
 * 獲取文章詳情（描述、圖片、全文）
 */
async function fetchArticleDetails(url: string): Promise<{
  description: string;
  image: string | null;
  content: string | null;
}> {
  try {
    const response = await fetchWithRetry(url, 2);

    if (!response) {
      return { description: '', image: null, content: null };
    }

    const html = await response.text();

    // 提取 og:description
    const descMatch = html.match(/og:description" content="([^"]+)"/);
    const description = descMatch ? descMatch[1] : '';

    // 提取圖片
    const imageMatch = html.match(/og:image" content="([^"]+)"/) ||
                       html.match(/itemImage[^>]*src="([^"]+)"/);
    const image = imageMatch ? imageMatch[1] : null;

    // 提取全文內容
    let content: string | null = null;
    const contentMatch = html.match(/<div class="itemFullText"[^>]*>([\s\S]*?)<\/div>/);
    if (contentMatch) {
      // 移除 HTML 標籤，保留文字
      content = contentMatch[1]
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<p[^>]*>/gi, '\n')
        .replace(/<\/p>/gi, '\n')
        .replace(/<[^>]+>/g, '')
        .replace(/&nbsp;/g, ' ')
        .replace(/&quot;/g, '"')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/\n{3,}/g, '\n\n')
        .trim();
    }

    return { description, image, content };
  } catch (error) {
    console.log(`   ⚠️ Failed to fetch details for ${url}`);
    return { description: '', image: null, content: null };
  }
}

async function getCategoryId(categoryCode: string): Promise<number | null> {
  const mapping: Record<string, string> = {
    local: 'local',
    greaterChina: 'china',
    international: 'international',
    finance: 'economy',
  };

  const code = mapping[categoryCode] || 'local';
  const result = await db.execute({
    sql: 'SELECT id FROM categories WHERE code = ?',
    args: [code],
  });
  return result.rows.length > 0 ? (result.rows[0].id as number) : null;
}

async function getMediaSourceId(): Promise<number> {
  const result = await db.execute({
    sql: "SELECT id FROM media_sources WHERE code = 'rthk'",
    args: [],
  });
  if (result.rows.length === 0) {
    throw new Error('RTHK media source not found');
  }
  return result.rows[0].id as number;
}

/**
 * 抓取 RTHK 新聞列表
 */
export async function fetchRTHKNews(
  category: keyof typeof RTHK_CATEGORIES = 'local',
  limit: number = 30
): Promise<string> {
  const catId = RTHK_CATEGORIES[category];
  const url = `https://news.rthk.hk/rthk/webpageCache/services/loadModNewsShowSp2List.php?lang=zh-TW&cat=${catId}&newsCount=${limit}&dayShiftMode=1&archive_date=`;

  console.log(`📡 Fetching: ${url}`);

  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      'Referer': 'https://news.rthk.hk/rthk/ch/latest-news/local.htm',
      'X-Requested-With': 'XMLHttpRequest',
    },
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }

  return response.text();
}

export async function scrapeRTHK(options: {
  limit?: number;
  saveToDb?: boolean;
  fetchDetails?: boolean;
} = {}): Promise<ArticleInsert[]> {
  const { limit = 30, saveToDb = false, fetchDetails = false } = options;

  console.log('🚀 Starting RTHK scraper...');
  console.log(`   Category: 港聞 (local)`);
  console.log(`   Limit: ${limit}`);
  console.log(`   Save to DB: ${saveToDb}`);
  console.log(`   Fetch details: ${fetchDetails}`);
  console.log('');

  const html = await fetchRTHKNews('local', limit);
  const parsedArticles = parseArticleList(html);

  console.log(`📊 Parsed ${parsedArticles.length} articles from list`);

  const articles: ArticleInsert[] = [];
  let mediaSourceId: number | null = null;
  let categoryId: number | null = null;

  if (saveToDb) {
    mediaSourceId = await getMediaSourceId();
    categoryId = await getCategoryId('local');
  }

  for (const parsed of parsedArticles) {
    let summary = '';
    let thumbnail: string | null = null;
    let content: string | null = null;

    // 可選：獲取文章詳情
    if (fetchDetails) {
      console.log(`   📄 Fetching details for: ${parsed.title.substring(0, 30)}...`);
      const details = await fetchArticleDetails(parsed.url);
      summary = details.description;
      thumbnail = details.image;
      content = details.content;
      // 避免請求過快
      await delay(300);
    }

    // 生成去重用的 hash 和正規化標題
    const contentForHash = parsed.title + (content || summary);
    const contentHash = generateContentHash(contentForHash);
    const titleNormalized = normalizeTitle(parsed.title);

    const article: ArticleInsert = {
      media_source_id: mediaSourceId || 3, // RTHK 的 ID
      original_id: parsed.id,
      original_url: parsed.url,
      title: parsed.title,
      content,
      summary,
      published_at: new Date(parsed.publishedAt).toISOString(),
      updated_at: null,
      category_id: categoryId,
      tags: JSON.stringify([]),
      thumbnail_url: thumbnail,
      author: 'RTHK',
      language: 'zh',
      is_headline: 0,
      importance_score: 50,
      content_hash: contentHash,
      title_normalized: titleNormalized,
      cluster_id: null,
    };

    articles.push(article);
    console.log(`   ✓ ${parsed.title.substring(0, 50)}...`);
  }

  console.log('');
  console.log(`📊 Found ${articles.length} articles`);

  if (saveToDb && articles.length > 0) {
    console.log('\n💾 Saving to database...');

    // 獲取過去 48 小時的文章用於去重比對
    console.log('   🔍 Loading recent articles for dedup check...');
    const recentArticles = await db.execute(`
      SELECT id, title, content, original_url as source_url, content_hash, title_normalized, cluster_id
      FROM articles
      WHERE published_at >= datetime('now', '-48 hours')
    `);

    const existingArticles: ArticleForDedup[] = recentArticles.rows.map((row) => ({
      id: String(row.id),
      title: String(row.title),
      content: String(row.content || ''),
      source_url: String(row.source_url),
      content_hash: row.content_hash ? String(row.content_hash) : undefined,
      title_normalized: row.title_normalized ? String(row.title_normalized) : undefined,
      cluster_id: row.cluster_id ? String(row.cluster_id) : undefined,
    }));

    console.log(`   📊 Found ${existingArticles.length} recent articles for comparison`);

    let inserted = 0;
    let skipped = 0;
    let clustered = 0;

    // 使用 60% 相似度閾值
    const SIMILARITY_THRESHOLD = {
      titleSimilarity: 0.6,    // 標題相似度 >= 60% 視為相似
      contentSimilarity: 0.5,  // 內容相似度 >= 50% 視為相似
    };

    for (const article of articles) {
      // 檢查是否重複
      const dupCheck = checkDuplicate(
        {
          title: article.title,
          content: article.summary || '',
          sourceUrl: article.original_url,
        },
        existingArticles,
        SIMILARITY_THRESHOLD
      );

      if (dupCheck.isDuplicate && dupCheck.matchType === 'exact_url') {
        skipped++;
        console.log(`   ⏭️  Exact URL duplicate: ${article.title.substring(0, 40)}...`);
        continue;
      }

      if (dupCheck.isDuplicate && dupCheck.matchType === 'exact_content') {
        skipped++;
        console.log(`   ⏭️  Exact content duplicate: ${article.title.substring(0, 40)}...`);
        continue;
      }

      // 如果標題相似度 >= 60%，歸入同一群組但仍儲存
      if (dupCheck.matchType === 'similar_title' || dupCheck.matchType === 'similar_content') {
        if (dupCheck.clusterId) {
          article.cluster_id = dupCheck.clusterId;
          clustered++;
          console.log(`   🔗 Linked to cluster (${(dupCheck.similarityScore * 100).toFixed(0)}% similar): ${article.title.substring(0, 40)}...`);
        } else if (dupCheck.matchedArticleId) {
          // 為相似文章創建新群組
          const newClusterId = generateClusterId();
          article.cluster_id = newClusterId;

          // 創建群組並更新原文章
          await db.execute({
            sql: `INSERT INTO news_clusters (id, main_article_id, title, article_count, first_seen_at)
                  VALUES (?, ?, ?, 2, datetime('now'))`,
            args: [newClusterId, dupCheck.matchedArticleId, article.title],
          });

          await db.execute({
            sql: 'UPDATE articles SET cluster_id = ? WHERE id = ?',
            args: [newClusterId, dupCheck.matchedArticleId],
          });

          clustered++;
          console.log(`   🆕 Created new cluster (${(dupCheck.similarityScore * 100).toFixed(0)}% similar): ${article.title.substring(0, 40)}...`);
        }
      }

      try {
        await db.execute({
          sql: `
            INSERT OR IGNORE INTO articles (
              media_source_id, original_id, original_url, title, content, summary,
              published_at, updated_at, category_id, tags, thumbnail_url, author,
              language, is_headline, importance_score, content_hash, title_normalized, cluster_id
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `,
          args: [
            article.media_source_id,
            article.original_id,
            article.original_url,
            article.title,
            article.content,
            article.summary,
            article.published_at,
            article.updated_at,
            article.category_id,
            article.tags,
            article.thumbnail_url,
            article.author,
            article.language,
            article.is_headline,
            article.importance_score,
            article.content_hash,
            article.title_normalized,
            article.cluster_id,
          ],
        });
        inserted++;

        // 更新群組計數
        if (article.cluster_id) {
          await db.execute({
            sql: 'UPDATE news_clusters SET article_count = article_count + 1, last_updated_at = datetime("now") WHERE id = ?',
            args: [article.cluster_id],
          });
        }

        // 添加到現有文章列表（供後續文章比對）
        existingArticles.push({
          id: article.original_id,
          title: article.title,
          content: article.summary || '',
          source_url: article.original_url,
          content_hash: article.content_hash || undefined,
          title_normalized: article.title_normalized,
          cluster_id: article.cluster_id || undefined,
        });

      } catch (error) {
        skipped++;
        console.log(`   ⚠️  Failed to insert: ${article.original_id}`);
      }
    }

    console.log('');
    console.log(`   ✅ Inserted: ${inserted}`);
    console.log(`   🔗 Clustered: ${clustered}`);
    console.log(`   ⏭️  Skipped: ${skipped}`);
  }

  return articles;
}

// 測試用：只輸出 JSON
export async function testFetch(): Promise<void> {
  console.log('🧪 Test mode - Fetching RTHK news...\n');

  const html = await fetchRTHKNews('local', 10);
  const articles = parseArticleList(html);

  console.log('='.repeat(60));
  console.log('PARSED ARTICLES:');
  console.log('='.repeat(60));
  console.log(JSON.stringify(articles, null, 2));
  console.log('\n' + '='.repeat(60));
  console.log(`Total: ${articles.length} articles`);
  console.log('='.repeat(60));
}

// 直接執行
const args = process.argv.slice(2);
if (args.includes('--save')) {
  scrapeRTHK({ limit: 30, saveToDb: true, fetchDetails: true }).catch(console.error);
} else {
  testFetch().catch(console.error);
}
