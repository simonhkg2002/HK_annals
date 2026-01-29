/**
 * HK01 港聞爬蟲
 * API: https://web-data.api.hk01.com/v2/feed/zone/1
 */

import { db } from './db';

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

export async function fetchHK01News(
  zoneId: number = 1, // 1 = 港聞
  limit: number = 20,
  offset: number = 0
): Promise<HK01ApiResponse> {
  const url = `https://web-data.api.hk01.com/v2/feed/zone/${zoneId}?offset=${offset}&limit=${limit}`;

  console.log(`📡 Fetching: ${url}`);

  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      Accept: 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }

  return response.json();
}

export async function scrapeHK01(options: {
  limit?: number;
  saveToDb?: boolean;
} = {}): Promise<ArticleInsert[]> {
  const { limit = 20, saveToDb = false } = options;

  console.log('🚀 Starting HK01 scraper...');
  console.log(`   Zone: 港聞 (1)`);
  console.log(`   Limit: ${limit}`);
  console.log(`   Save to DB: ${saveToDb}`);
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

    const article: ArticleInsert = {
      media_source_id: mediaSourceId || 1,
      original_id: String(data.articleId),
      original_url: data.canonicalUrl || data.publishUrl,
      title: data.title,
      content: null, // 需要額外抓取文章內容
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
    };

    articles.push(article);

    console.log(`   ✓ ${data.title.substring(0, 50)}...`);
  }

  console.log('');
  console.log(`📊 Found ${articles.length} articles`);

  if (saveToDb && articles.length > 0) {
    console.log('\n💾 Saving to database...');
    let inserted = 0;
    let skipped = 0;

    for (const article of articles) {
      try {
        await db.execute({
          sql: `
            INSERT OR IGNORE INTO articles (
              media_source_id, original_id, original_url, title, content, summary,
              published_at, updated_at, category_id, tags, thumbnail_url, author,
              language, is_headline, importance_score
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
          ],
        });
        inserted++;
      } catch (error) {
        skipped++;
        console.log(`   ⚠️  Skipped duplicate: ${article.original_id}`);
      }
    }

    console.log(`   ✅ Inserted: ${inserted}`);
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
  scrapeHK01({ limit: 20, saveToDb: true }).catch(console.error);
} else {
  testFetch().catch(console.error);
}
