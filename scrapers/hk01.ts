/**
 * HK01 港聞爬蟲
 * API: https://web-data.api.hk01.com/v2/feed/zone/1
 */

import { db } from './db';
import {
  normalizeTitle,
  generateContentHash,
  checkDuplicate,
  generateClusterId,
  type ArticleForDedup,
  type DuplicateCheckResult,
} from '../lib/dedup';

// HK01 API 回應類型
interface HK01Article {
  articleId: number;
  title: string;
  description: string;
  publishUrl: string;
  canonicalUrl: string;
  publishTime: number;
  lastModifyTime: number;
  authors: Array<{ publishName: string }>;
  mainCategory: string;
  mainCategoryId: number;
  zone: {
    zoneId: number;
    name: string;
    publishName: string;
  };
  mainImage?: {
    cdnUrl: string;
    caption?: string;
    width?: number;
    height?: number;
  };
  tags?: Array<{ tagId: number; tagName: string }>;
  imageCount?: number;
  videoCount?: number;
  contentType?: string;
  isFeatured?: boolean;
  isSponsored?: boolean;
}

interface HK01ApiResponse {
  items: Array<{
    id: number;
    type: number;
    labels?: string[];
    data: HK01Article;
  }>;
  nextOffset?: number;
}

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
  // 去重欄位
  content_hash: string | null;
  title_normalized: string;
  cluster_id: string | null;
}

// 分類對應
const categoryMapping: Record<string, string> = {
  '港聞': 'local',
  '社會新聞': 'society',
  '政情': 'politics',
  '突發': 'society',
  '熱爆話題': 'society',
  '01觀點': 'opinion',
  '經濟': 'economy',
  '財經': 'economy',
  '中國': 'china',
  '國際': 'international',
  '娛樂': 'entertainment',
  '體育': 'sports',
};

async function getCategoryId(categoryName: string): Promise<number | null> {
  const code = categoryMapping[categoryName] || 'local';
  const result = await db.execute({
    sql: 'SELECT id FROM categories WHERE code = ?',
    args: [code],
  });
  return result.rows.length > 0 ? (result.rows[0].id as number) : null;
}

async function getMediaSourceId(): Promise<number> {
  const result = await db.execute({
    sql: "SELECT id FROM media_sources WHERE code = 'hk01'",
    args: [],
  });
  if (result.rows.length === 0) {
    throw new Error('HK01 media source not found');
  }
  return result.rows[0].id as number;
}

// 文章詳情 API 回應
interface HK01ArticleDetail {
  articleId: number;
  title: string;
  description: string;
  publishUrl: string;
  canonicalUrl: string;
  publishTime: number;
  lastModifyTime: number;
  authors: Array<{ publishName: string }>;
  mainCategory: string;
  mainImage?: { cdnUrl: string };
  tags?: Array<{ tagName: string }>;
  isFeatured?: boolean;
  isSponsored?: boolean;
  blocks?: Array<{
    type: string;
    elements?: Array<{
      type: string;
      text?: string;
    }>;
  }>;
}

interface HK01ArticleDetailResponse {
  article: HK01ArticleDetail;
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
  options: RequestInit = {},
  maxRetries: number = 3
): Promise<Response> {
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(url, {
        ...options,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          Accept: 'application/json',
          ...options.headers,
        },
      });

      if (response.ok) {
        return response;
      }

      // 429 Too Many Requests - 等待後重試
      if (response.status === 429) {
        console.log(`   ⏳ Rate limited, waiting ${attempt * 2}s...`);
        await delay(attempt * 2000);
        continue;
      }

      // 其他錯誤
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

export async function fetchHK01News(
  zoneId: number = 1, // 1 = 港聞
  limit: number = 20,
  offset: number = 0
): Promise<HK01ApiResponse> {
  const url = `https://web-data.api.hk01.com/v2/feed/zone/${zoneId}?offset=${offset}&limit=${limit}`;

  console.log(`📡 Fetching: ${url}`);

  const response = await fetchWithRetry(url);
  return response.json();
}

/**
 * 獲取文章全文（從網頁抓取）
 */
export async function fetchArticleContent(articleUrl: string): Promise<string | null> {
  try {
    const response = await fetchWithRetry(articleUrl, {}, 2);
    const html = await response.text();

    // 方法 1: 從 __NEXT_DATA__ 提取 (Next.js)
    const nextDataMatch = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
    if (nextDataMatch) {
      try {
        const nextData = JSON.parse(nextDataMatch[1]);

        // HK01 結構: props.initialProps.pageProps.article
        const article =
          nextData?.props?.initialProps?.pageProps?.article ||
          nextData?.props?.pageProps?.article;

        if (article?.blocks) {
          const contentParts: string[] = [];

          for (const block of article.blocks) {
            // 結構 1: blockType + summary 陣列
            if (block.blockType === 'summary' && block.summary) {
              contentParts.push(...block.summary);
            }
            // 結構 2: blockType + text + htmlTokens
            else if (block.blockType === 'text' && block.htmlTokens) {
              for (const tokenGroup of block.htmlTokens) {
                if (Array.isArray(tokenGroup)) {
                  for (const token of tokenGroup) {
                    if (token.type === 'text' && token.content) {
                      contentParts.push(token.content);
                    }
                  }
                }
              }
            }
            // 結構 3: blockType + paragraphs 陣列
            else if (block.blockType === 'paragraph' && block.paragraphs) {
              for (const p of block.paragraphs) {
                if (p.text) contentParts.push(p.text);
              }
            }
            // 結構 4: type + elements
            else if (block.type === 'paragraph' && block.elements) {
              const text = block.elements
                .filter((el: any) => el.type === 'text' && el.text)
                .map((el: any) => el.text)
                .join('');
              if (text.trim()) {
                contentParts.push(text.trim());
              }
            }
          }

          if (contentParts.length > 0) {
            return contentParts.join('\n\n');
          }
        }

        // 嘗試 description
        if (article?.description) {
          return article.description;
        }
      } catch {
        // 繼續嘗試其他方法
      }
    }

    // 方法 2: 從 JSON-LD 結構化資料提取
    const jsonLdMatch = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/);
    if (jsonLdMatch) {
      try {
        const jsonLd = JSON.parse(jsonLdMatch[1]);
        if (jsonLd.articleBody) {
          return jsonLd.articleBody;
        }
      } catch {
        // 繼續
      }
    }

    // 方法 3: 從 meta description 提取
    const descMatch = html.match(/og:description" content="([^"]+)"/);
    if (descMatch) {
      return descMatch[1];
    }

    return null;
  } catch (error) {
    console.log(`   ⚠️ Failed to fetch content from ${articleUrl}`);
    return null;
  }
}

export async function scrapeHK01(options: {
  limit?: number;
  saveToDb?: boolean;
  fetchContent?: boolean;
} = {}): Promise<ArticleInsert[]> {
  const { limit = 20, saveToDb = false, fetchContent = false } = options;

  console.log('🚀 Starting HK01 scraper...');
  console.log(`   Zone: 港聞 (1)`);
  console.log(`   Limit: ${limit}`);
  console.log(`   Save to DB: ${saveToDb}`);
  console.log(`   Fetch content: ${fetchContent}`);
  console.log('');

  const response = await fetchHK01News(1, limit, 0);
  const articles: ArticleInsert[] = [];

  let mediaSourceId: number | null = null;
  if (saveToDb) {
    mediaSourceId = await getMediaSourceId();
  }

  for (const item of response.items) {
    const data = item.data;

    // 過濾贊助內容
    if (data.isSponsored) {
      console.log(`   ⏭️  Skipping sponsored: ${data.title.substring(0, 30)}...`);
      continue;
    }

    const categoryId = saveToDb ? await getCategoryId(data.mainCategory) : null;

    // 可選：抓取全文
    let content: string | null = null;
    if (fetchContent) {
      const articleUrl = data.canonicalUrl || data.publishUrl;
      console.log(`   📄 Fetching content for: ${data.title.substring(0, 30)}...`);
      content = await fetchArticleContent(articleUrl);
      // 避免請求過快
      await delay(500);
    }

    // 生成去重用的 hash 和正規化標題
    const contentForHash = data.title + (content || data.description || '');
    const contentHash = generateContentHash(contentForHash);
    const titleNormalized = normalizeTitle(data.title);

    const article: ArticleInsert = {
      media_source_id: mediaSourceId || 1,
      original_id: String(data.articleId),
      original_url: data.canonicalUrl || data.publishUrl,
      title: data.title,
      content,
      summary: data.description || '',
      published_at: new Date(data.publishTime * 1000).toISOString(),
      updated_at: data.lastModifyTime
        ? new Date(data.lastModifyTime * 1000).toISOString()
        : null,
      category_id: categoryId,
      tags: JSON.stringify(data.tags?.map((t) => t.tagName) || []),
      thumbnail_url: data.mainImage?.cdnUrl || null,
      author: data.authors?.[0]?.publishName || null,
      language: 'zh',
      is_headline: data.isFeatured ? 1 : 0,
      importance_score: data.isFeatured ? 80 : 50,
      // 去重欄位
      content_hash: contentHash,
      title_normalized: titleNormalized,
      cluster_id: null, // 稍後根據相似度判斷
    };

    articles.push(article);

    console.log(`   ✓ ${data.title.substring(0, 50)}...`);
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

    for (const article of articles) {
      // 使用 60% 相似度閾值
      const SIMILARITY_THRESHOLD = {
        titleSimilarity: 0.6,    // 標題相似度 >= 60% 視為相似
        contentSimilarity: 0.5,  // 內容相似度 >= 50% 視為相似
      };

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
  console.log('🧪 Test mode - Fetching HK01 news...\n');

  const response = await fetchHK01News(1, 10, 0);

  console.log('='.repeat(60));
  console.log('RAW API RESPONSE STRUCTURE:');
  console.log('='.repeat(60));

  // 顯示第一篇的完整結構
  if (response.items.length > 0) {
    const firstItem = response.items[0];
    console.log('\n📰 First article (full structure):');
    console.log(JSON.stringify(firstItem, null, 2));
  }

  console.log('\n' + '='.repeat(60));
  console.log('PROCESSED ARTICLES:');
  console.log('='.repeat(60));

  const articles = response.items
    .filter((item) => !item.data.isSponsored)
    .map((item) => ({
      id: item.data.articleId,
      title: item.data.title,
      category: item.data.mainCategory,
      author: item.data.authors?.[0]?.publishName,
      publishTime: new Date(item.data.publishTime * 1000).toISOString(),
      url: item.data.canonicalUrl,
      thumbnail: item.data.mainImage?.cdnUrl,
      tags: item.data.tags?.map((t) => t.tagName),
      description: item.data.description?.substring(0, 100) + '...',
    }));

  console.log(JSON.stringify(articles, null, 2));

  console.log('\n' + '='.repeat(60));
  console.log(`Total: ${articles.length} articles`);
  console.log('='.repeat(60));
}

// 直接執行
const args = process.argv.slice(2);
if (args.includes('--save')) {
  const fetchContent = args.includes('--content');
  scrapeHK01({ limit: 20, saveToDb: true, fetchContent }).catch(console.error);
} else {
  testFetch().catch(console.error);
}
