/**
 * Yahoo 新聞香港爬蟲
 * 使用 RSS Feed: https://hk.news.yahoo.com/rss/hong-kong
 * 只爬取本地新聞，排除娛樂和健康類別
 */

import { db } from './db';
import {
  normalizeTitle,
  generateContentHash,
  checkDuplicate,
  generateClusterId,
  type ArticleForDedup,
} from '../lib/dedup';

// 排除的類別關鍵字
const EXCLUDED_CATEGORIES = [
  '娛樂',
  '健康',
  '美妝',
  '時尚',
  '旅遊',
  '食譜',
  '星座',
  '寵物',
  '親子',
  '美食',
];

// 排除的標題關鍵字
const EXCLUDED_TITLE_KEYWORDS = [
  '星座運程',
  '減肥',
  '護膚',
  '美容',
  '瘦身',
  '食譜',
  '明星',
  '演唱會',
  '電影',
  '劇集',
  '視后',
  '視帝',
  '男神',
  '女神',
];

interface RSSItem {
  title: string;
  link: string;
  pubDate: string;
  description: string;
  contentEncoded?: string;
  guid: string;
}

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

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchWithRetry(url: string, maxRetries = 3): Promise<Response> {
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          Accept: 'application/rss+xml, application/xml, text/xml',
        },
      });

      if (response.ok) {
        return response;
      }

      if (response.status === 429) {
        console.log(`   ⏳ Rate limited, waiting ${attempt * 2}s...`);
        await delay(attempt * 2000);
        continue;
      }

      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    } catch (error) {
      lastError = error as Error;
      if (attempt < maxRetries) {
        console.log(`   ⚠️ Attempt ${attempt} failed, retrying in ${attempt}s...`);
        await delay(attempt * 1000);
      }
    }
  }

  throw lastError || new Error('Max retries exceeded');
}

/**
 * 解析 RSS XML
 */
function parseRSS(xml: string): RSSItem[] {
  const items: RSSItem[] = [];

  // 簡易 XML 解析
  const itemMatches = xml.match(/<item>([\s\S]*?)<\/item>/g);
  if (!itemMatches) return items;

  for (const itemXml of itemMatches) {
    const title = extractTag(itemXml, 'title');
    const link = extractTag(itemXml, 'link');
    const pubDate = extractTag(itemXml, 'pubDate');
    const description = extractTag(itemXml, 'description');
    const guid = extractTag(itemXml, 'guid');
    const contentEncoded = extractTag(itemXml, 'content:encoded');

    if (title && link) {
      items.push({
        title: decodeHtmlEntities(title),
        link,
        pubDate: pubDate || new Date().toISOString(),
        description: decodeHtmlEntities(description || ''),
        contentEncoded,
        guid: guid || link,
      });
    }
  }

  return items;
}

function extractTag(xml: string, tagName: string): string {
  // 處理 CDATA
  const cdataPattern = new RegExp(`<${tagName}[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]><\\/${tagName}>`, 'i');
  const cdataMatch = xml.match(cdataPattern);
  if (cdataMatch) return cdataMatch[1].trim();

  // 普通標籤
  const pattern = new RegExp(`<${tagName}[^>]*>([\\s\\S]*?)<\\/${tagName}>`, 'i');
  const match = xml.match(pattern);
  return match ? match[1].trim() : '';
}

function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ');
}

/**
 * 從 content:encoded 提取圖片 URL
 */
function extractImageUrl(contentEncoded: string | undefined): string | null {
  if (!contentEncoded) return null;

  // 嘗試提取 img src
  const imgMatch = contentEncoded.match(/src=["']([^"']+)["']/);
  if (imgMatch) return imgMatch[1];

  // 嘗試提取直接 URL
  const urlMatch = contentEncoded.match(/https?:\/\/[^\s<>"]+\.(jpg|jpeg|png|webp)/i);
  if (urlMatch) return urlMatch[0];

  return null;
}

/**
 * 從 Yahoo URL 提取文章 ID
 */
function extractArticleId(url: string): string {
  // URL 格式: https://hk.news.yahoo.com/xxx-xxx-123456789.html
  const match = url.match(/([a-z0-9-]+)-(\d+)\.html$/i);
  if (match) return match[2];

  // 備用：使用完整 slug
  const slugMatch = url.match(/\/([^\/]+)\.html$/);
  if (slugMatch) return slugMatch[1];

  // 最後：用 hash
  return generateContentHash(url).substring(0, 16);
}

/**
 * 檢查是否應該排除該文章
 */
function shouldExclude(title: string, description: string): boolean {
  const text = (title + ' ' + description).toLowerCase();

  // 檢查排除關鍵字
  for (const keyword of EXCLUDED_TITLE_KEYWORDS) {
    if (text.includes(keyword.toLowerCase())) {
      return true;
    }
  }

  return false;
}

async function getMediaSourceId(): Promise<number> {
  const result = await db.execute({
    sql: "SELECT id FROM media_sources WHERE code = 'yahoo'",
    args: [],
  });
  if (result.rows.length === 0) {
    throw new Error('Yahoo media source not found. Please run migration first.');
  }
  return result.rows[0].id as number;
}

async function getCategoryId(categoryCode: string = 'local'): Promise<number | null> {
  const result = await db.execute({
    sql: 'SELECT id FROM categories WHERE code = ?',
    args: [categoryCode],
  });
  return result.rows.length > 0 ? (result.rows[0].id as number) : null;
}

/**
 * 抓取 Yahoo 文章全文
 */
export async function fetchYahooContent(url: string): Promise<string | null> {
  try {
    const response = await fetchWithRetry(url);
    const html = await response.text();

    // 方法 1: 從 caas-body 提取內容
    const bodyMatch = html.match(/<div class="caas-body"[^>]*>([\s\S]*?)<\/div>\s*<div class="caas-/);
    if (bodyMatch) {
      return bodyMatch[1]
        .replace(/<p[^>]*>/gi, '\n')
        .replace(/<\/p>/gi, '\n')
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<[^>]+>/g, '')
        .replace(/\n{3,}/g, '\n\n')
        .trim();
    }

    // 方法 2: 從文章段落提取
    const paragraphs: string[] = [];
    const pMatches = html.matchAll(/<p class="[^"]*"[^>]*>([^<]+)<\/p>/g);
    for (const match of pMatches) {
      const text = match[1].trim();
      if (text.length > 20) {
        paragraphs.push(text);
      }
    }
    if (paragraphs.length > 0) {
      return paragraphs.join('\n\n');
    }

    // 方法 3: og:description
    const descMatch = html.match(/og:description" content="([^"]+)"/);
    if (descMatch) return decodeHtmlEntities(descMatch[1]);

    return null;
  } catch {
    return null;
  }
}

export async function scrapeYahoo(options: {
  limit?: number;
  saveToDb?: boolean;
  fetchContent?: boolean;
} = {}): Promise<ArticleInsert[]> {
  const { limit = 30, saveToDb = false, fetchContent = false } = options;

  console.log('🚀 Starting Yahoo News HK scraper...');
  console.log(`   Feed: 港聞`);
  console.log(`   Limit: ${limit}`);
  console.log(`   Save to DB: ${saveToDb}`);
  console.log(`   Fetch content: ${fetchContent}`);
  console.log('');

  // 抓取 RSS
  const rssUrl = 'https://hk.news.yahoo.com/rss/hong-kong';
  console.log(`📡 Fetching RSS: ${rssUrl}`);

  const response = await fetchWithRetry(rssUrl);
  const xml = await response.text();
  const rssItems = parseRSS(xml);

  console.log(`   Found ${rssItems.length} items in RSS feed`);

  const articles: ArticleInsert[] = [];

  let mediaSourceId: number | null = null;
  if (saveToDb) {
    mediaSourceId = await getMediaSourceId();
  }

  const categoryId = saveToDb ? await getCategoryId('local') : null;

  let skippedByCategory = 0;

  for (const item of rssItems) {
    if (articles.length >= limit) break;

    // 檢查是否應該排除
    if (shouldExclude(item.title, item.description)) {
      console.log(`   ⏭️  Skipping (excluded category): ${item.title.substring(0, 30)}...`);
      skippedByCategory++;
      continue;
    }

    // 提取縮圖
    const thumbnail = extractImageUrl(item.contentEncoded);

    // 解析發布時間
    let publishedAt: string;
    try {
      publishedAt = new Date(item.pubDate).toISOString();
    } catch {
      publishedAt = new Date().toISOString();
    }

    // 可選：抓取全文
    let content: string | null = null;
    if (fetchContent) {
      console.log(`   📄 Fetching content for: ${item.title.substring(0, 30)}...`);
      content = await fetchYahooContent(item.link);
      await delay(300);
    }

    // 生成去重資料
    const contentForHash = item.title + (content || item.description);
    const contentHash = generateContentHash(contentForHash);
    const titleNormalized = normalizeTitle(item.title);

    const article: ArticleInsert = {
      media_source_id: mediaSourceId || 1,
      original_id: extractArticleId(item.link),
      original_url: item.link,
      title: item.title,
      content,
      summary: item.description,
      published_at: publishedAt,
      updated_at: null,
      category_id: categoryId,
      tags: JSON.stringify([]),
      thumbnail_url: thumbnail,
      author: null,
      language: 'zh',
      is_headline: 0,
      importance_score: 45,
      content_hash: contentHash,
      title_normalized: titleNormalized,
      cluster_id: null,
    };

    articles.push(article);
    console.log(`   ✓ ${item.title.substring(0, 50)}...`);
  }

  console.log('');
  console.log(`📊 Found ${articles.length} articles (skipped ${skippedByCategory} by category)`);

  if (saveToDb && articles.length > 0) {
    console.log('\n💾 Saving to database...');

    // 獲取過去 48 小時的文章用於去重
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

    for (const article of articles) {
      const SIMILARITY_THRESHOLD = {
        titleSimilarity: 0.6,
        contentSimilarity: 0.5,
      };

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

      if (dupCheck.matchType === 'similar_title' || dupCheck.matchType === 'similar_content') {
        if (dupCheck.clusterId) {
          article.cluster_id = dupCheck.clusterId;
          clustered++;
          console.log(`   🔗 Linked to cluster (${(dupCheck.similarityScore * 100).toFixed(0)}% similar): ${article.title.substring(0, 40)}...`);
        } else if (dupCheck.matchedArticleId) {
          const newClusterId = generateClusterId();
          article.cluster_id = newClusterId;

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

        if (article.cluster_id) {
          await db.execute({
            sql: 'UPDATE news_clusters SET article_count = article_count + 1, last_updated_at = datetime("now") WHERE id = ?',
            args: [article.cluster_id],
          });
        }

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

// 測試用
export async function testFetch(): Promise<void> {
  console.log('🧪 Test mode - Fetching Yahoo News HK...\n');

  const rssUrl = 'https://hk.news.yahoo.com/rss/hong-kong';
  const response = await fetchWithRetry(rssUrl);
  const xml = await response.text();
  const items = parseRSS(xml);

  console.log('='.repeat(60));
  console.log('PARSED RSS ITEMS:');
  console.log('='.repeat(60));

  const filtered = items.filter((item) => !shouldExclude(item.title, item.description));

  console.log(`\nTotal items: ${items.length}`);
  console.log(`After filtering: ${filtered.length}\n`);

  for (const item of filtered.slice(0, 10)) {
    console.log(`📰 ${item.title}`);
    console.log(`   🔗 ${item.link}`);
    console.log(`   📅 ${item.pubDate}`);
    console.log(`   🖼️  ${extractImageUrl(item.contentEncoded) || 'No image'}`);
    console.log('');
  }
}

// 直接執行
const args = process.argv.slice(2);
if (args.includes('--save')) {
  const fetchContent = args.includes('--content');
  scrapeYahoo({ limit: 30, saveToDb: true, fetchContent }).catch(console.error);
} else {
  testFetch().catch(console.error);
}
