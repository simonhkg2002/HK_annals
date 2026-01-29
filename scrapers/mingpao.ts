/**
 * 明報港聞爬蟲
 * RSS: https://news.mingpao.com/rss/ins/s00001.xml
 */

import { db } from './db';
import {
  normalizeTitle,
  generateContentHash,
  checkDuplicate,
  generateClusterId,
  type ArticleForDedup,
} from '../lib/dedup';

// 明報 RSS 分類
const MINGPAO_RSS = {
  local: 'https://news.mingpao.com/rss/ins/s00001.xml',      // 港聞
  china: 'https://news.mingpao.com/rss/ins/s00002.xml',      // 兩岸
  international: 'https://news.mingpao.com/rss/ins/s00003.xml', // 國際
  economy: 'https://news.mingpao.com/rss/ins/s00004.xml',    // 經濟
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
  description: string;
  publishedAt: string;
  imageUrl: string | null;
  category: string | null;
}

/**
 * 解析 RSS XML
 */
function parseRSS(xml: string): ParsedArticle[] {
  const articles: ParsedArticle[] = [];

  // 匹配每個 item
  const itemPattern = /<item>([\s\S]*?)<\/item>/g;
  let match;

  while ((match = itemPattern.exec(xml)) !== null) {
    const itemXml = match[1];

    // 提取標題
    const titleMatch = itemXml.match(/<title><!\[CDATA\[(.*?)\]\]><\/title>/);
    const title = titleMatch ? titleMatch[1].trim() : '';

    // 提取描述
    const descMatch = itemXml.match(/<description><!\[CDATA\[(.*?)\]\]><\/description>/);
    const description = descMatch ? descMatch[1].trim() : '';

    // 提取連結
    const linkMatch = itemXml.match(/<link><!\[CDATA\[(.*?)\]\]><\/link>/);
    const url = linkMatch ? linkMatch[1].trim() : '';

    // 提取 GUID 作為 ID
    const guidMatch = itemXml.match(/<guid[^>]*><!\[CDATA\[(.*?)\]\]><\/guid>/);
    const guid = guidMatch ? guidMatch[1] : url;

    // 從 URL 提取文章 ID（時間戳 - 13位數字）
    // URL 格式: /article/20260129/s00001/1769693389407/...
    const idMatch = url.match(/\/(\d{13})\//);
    const id = idMatch ? idMatch[1] : String(Date.now());

    // 提取發布日期
    const pubDateMatch = itemXml.match(/<pubDate>(.*?)<\/pubDate>/);
    let publishedAt = new Date().toISOString();
    if (pubDateMatch) {
      const date = new Date(pubDateMatch[1]);
      if (!isNaN(date.getTime())) {
        publishedAt = date.toISOString();
      }
    }

    // 提取分類
    const categoryMatch = itemXml.match(/<category><!\[CDATA\[(.*?)\]\]><\/category>/);
    const category = categoryMatch ? categoryMatch[1] : null;

    // 提取圖片
    const imageMatch = itemXml.match(/url="([^"]+\.(jpg|jpeg|png|gif|webp))"/i);
    const imageUrl = imageMatch ? imageMatch[1] : null;

    if (title && url) {
      articles.push({
        id,
        url,
        title,
        description,
        publishedAt,
        imageUrl,
        category,
      });
    }
  }

  return articles;
}

async function getCategoryId(): Promise<number | null> {
  const result = await db.execute({
    sql: 'SELECT id FROM categories WHERE code = ?',
    args: ['local'],
  });
  return result.rows.length > 0 ? (result.rows[0].id as number) : null;
}

async function getMediaSourceId(): Promise<number> {
  const result = await db.execute({
    sql: "SELECT id FROM media_sources WHERE code = 'mingpao'",
    args: [],
  });
  if (result.rows.length === 0) {
    throw new Error('Ming Pao media source not found');
  }
  return result.rows[0].id as number;
}

/**
 * 抓取明報 RSS
 */
export async function fetchMingPaoRSS(
  category: keyof typeof MINGPAO_RSS = 'local'
): Promise<string> {
  const url = MINGPAO_RSS[category];

  console.log(`📡 Fetching: ${url}`);

  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    },
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }

  return response.text();
}

export async function scrapeMingPao(options: {
  limit?: number;
  saveToDb?: boolean;
} = {}): Promise<ArticleInsert[]> {
  const { limit = 30, saveToDb = false } = options;

  console.log('🚀 Starting Ming Pao scraper...');
  console.log(`   Category: 港聞 (local)`);
  console.log(`   Limit: ${limit}`);
  console.log(`   Save to DB: ${saveToDb}`);
  console.log('');

  const xml = await fetchMingPaoRSS('local');
  const parsedArticles = parseRSS(xml).slice(0, limit);

  console.log(`📊 Parsed ${parsedArticles.length} articles from RSS`);

  const articles: ArticleInsert[] = [];
  let mediaSourceId: number | null = null;
  let categoryId: number | null = null;

  if (saveToDb) {
    mediaSourceId = await getMediaSourceId();
    categoryId = await getCategoryId();
  }

  for (const parsed of parsedArticles) {
    // 生成去重用的 hash 和正規化標題
    const contentForHash = parsed.title + parsed.description;
    const contentHash = generateContentHash(contentForHash);
    const titleNormalized = normalizeTitle(parsed.title);

    const article: ArticleInsert = {
      media_source_id: mediaSourceId || 5, // Ming Pao 的 ID
      original_id: parsed.id,
      original_url: parsed.url,
      title: parsed.title,
      content: null,
      summary: parsed.description,
      published_at: parsed.publishedAt,
      updated_at: null,
      category_id: categoryId,
      tags: JSON.stringify(parsed.category ? [parsed.category] : []),
      thumbnail_url: parsed.imageUrl,
      author: '明報',
      language: 'zh',
      is_headline: parsed.category === '編輯推介' ? 1 : 0,
      importance_score: parsed.category === '編輯推介' ? 70 : 50,
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
      titleSimilarity: 0.6,
      contentSimilarity: 0.5,
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

      // 如果標題相似度 >= 60%，歸入同一群組
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
  console.log('🧪 Test mode - Fetching Ming Pao RSS...\n');

  const xml = await fetchMingPaoRSS('local');
  const articles = parseRSS(xml).slice(0, 10);

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
  scrapeMingPao({ limit: 30, saveToDb: true }).catch(console.error);
} else {
  testFetch().catch(console.error);
}
