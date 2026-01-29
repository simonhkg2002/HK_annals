/**
 * HK01 歷史資料回填爬蟲
 * 使用多個分類 API 獲取過去 6 個月的新聞
 */

import { db } from './db';

interface ArticleData {
  articleId: number;
  title: string;
  description: string;
  canonicalUrl: string;
  publishUrl: string;
  publishTime: number;
  lastModifyTime?: number;
  authors?: Array<{ publishName: string }>;
  mainCategory: string;
  mainCategoryId: number;
  mainImage?: { cdnUrl: string };
  tags?: Array<{ tagName: string }>;
  zone?: { zoneId: number };
  isSponsored?: number;
}

// HK01 分類列表 (港聞相關)
const CATEGORIES = [
  { id: 2, name: '社會新聞', categoryCode: 'society' },
  { id: 4, name: '政情', categoryCode: 'politics' },
  { id: 7, name: '突發', categoryCode: 'society' },
  { id: 8, name: '熱爆話題', categoryCode: 'society' },
  { id: 10, name: '01觀點', categoryCode: 'opinion' },
];

// 6 個月前的時間戳
const SIX_MONTHS_AGO = Date.now() - 6 * 30 * 24 * 60 * 60 * 1000;

async function getMediaSourceId(): Promise<number> {
  const result = await db.execute("SELECT id FROM media_sources WHERE code = 'hk01'");
  return result.rows[0].id as number;
}

async function getCategoryId(code: string): Promise<number | null> {
  const result = await db.execute({
    sql: 'SELECT id FROM categories WHERE code = ?',
    args: [code],
  });
  return result.rows.length > 0 ? (result.rows[0].id as number) : null;
}

async function saveArticle(article: ArticleData, mediaSourceId: number): Promise<boolean> {
  // 跳過贊助內容
  if (article.isSponsored) return false;

  // 只抓取港聞相關 (zone 1)
  if (article.zone?.zoneId !== 1) return false;

  const categoryId = await getCategoryId(
    CATEGORIES.find((c) => c.id === article.mainCategoryId)?.categoryCode || 'local'
  );

  try {
    await db.execute({
      sql: `
        INSERT OR IGNORE INTO articles (
          media_source_id, original_id, original_url, title, summary,
          published_at, updated_at, category_id, tags, thumbnail_url,
          author, language, importance_score
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      args: [
        mediaSourceId,
        String(article.articleId),
        article.canonicalUrl || article.publishUrl,
        article.title,
        article.description || '',
        new Date(article.publishTime * 1000).toISOString(),
        article.lastModifyTime ? new Date(article.lastModifyTime * 1000).toISOString() : null,
        categoryId,
        JSON.stringify(article.tags?.map((t) => t.tagName) || []),
        article.mainImage?.cdnUrl || null,
        article.authors?.[0]?.publishName || null,
        'zh',
        50,
      ],
    });
    return true;
  } catch (e) {
    return false;
  }
}

async function fetchCategory(
  categoryId: number,
  categoryName: string,
  mediaSourceId: number
): Promise<{ total: number; saved: number; oldestDate: Date }> {
  console.log(`\n📂 Fetching category: ${categoryName} (ID: ${categoryId})`);

  let offset: number | string = 0;
  let total = 0;
  let saved = 0;
  let oldestDate = new Date();
  let pageCount = 0;
  const maxPages = 500; // 最多抓取頁數

  while (pageCount < maxPages) {
    const url = `https://web-data.api.hk01.com/v2/feed/category/${categoryId}?offset=${offset}&limit=50`;

    try {
      const res = await fetch(url, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
      });

      if (!res.ok) {
        console.log(`   ❌ HTTP ${res.status}`);
        break;
      }

      const data = await res.json();
      const items = data.items || [];

      if (items.length === 0) break;

      for (const item of items) {
        const article = item.data as ArticleData;
        const publishDate = new Date(article.publishTime * 1000);

        // 檢查是否超過 6 個月
        if (publishDate.getTime() < SIX_MONTHS_AGO) {
          console.log(`   ⏹️ Reached 6 months ago at page ${pageCount + 1}`);
          return { total, saved, oldestDate };
        }

        total++;
        if (await saveArticle(article, mediaSourceId)) {
          saved++;
        }

        if (publishDate < oldestDate) {
          oldestDate = publishDate;
        }
      }

      // 每 10 頁顯示進度
      if ((pageCount + 1) % 10 === 0) {
        console.log(
          `   📄 Page ${pageCount + 1}: ${total} articles, oldest: ${oldestDate.toISOString().split('T')[0]}`
        );
      }

      // 檢查下一頁
      if (!data.nextOffset || data.nextOffset === 99999999995) {
        console.log(`   ✅ Reached end at page ${pageCount + 1}`);
        break;
      }

      offset = data.nextOffset;
      pageCount++;

      // 延遲避免過度請求
      await new Promise((r) => setTimeout(r, 100));
    } catch (e) {
      console.log(`   ❌ Error at page ${pageCount}: ${e}`);
      break;
    }
  }

  return { total, saved, oldestDate };
}

async function backfillFromZone(mediaSourceId: number): Promise<{ total: number; saved: number }> {
  console.log('\n📂 Fetching from Zone 1 (港聞)');

  let offset: number | string = 0;
  let total = 0;
  let saved = 0;
  let pageCount = 0;

  while (true) {
    const url = `https://web-data.api.hk01.com/v2/feed/zone/1?offset=${offset}&limit=50`;

    try {
      const res = await fetch(url, {
        headers: { 'User-Agent': 'Mozilla/5.0' },
      });

      if (!res.ok) break;

      const data = await res.json();
      const items = data.items || [];

      if (items.length === 0) break;

      for (const item of items) {
        const article = item.data as ArticleData;
        const publishDate = new Date(article.publishTime * 1000);

        if (publishDate.getTime() < SIX_MONTHS_AGO) {
          return { total, saved };
        }

        total++;
        if (await saveArticle(article, mediaSourceId)) {
          saved++;
        }
      }

      if ((pageCount + 1) % 5 === 0) {
        console.log(`   📄 Page ${pageCount + 1}: ${total} articles, saved: ${saved}`);
      }

      if (!data.nextOffset || data.nextOffset === 99999999995) break;

      offset = data.nextOffset;
      pageCount++;
      await new Promise((r) => setTimeout(r, 100));
    } catch (e) {
      break;
    }
  }

  return { total, saved };
}

async function main() {
  console.log('🚀 HK01 Historical Backfill');
  console.log(`📅 Target: Past 6 months (since ${new Date(SIX_MONTHS_AGO).toISOString().split('T')[0]})`);
  console.log('');

  const mediaSourceId = await getMediaSourceId();
  let grandTotal = 0;
  let grandSaved = 0;

  // 先從 Zone feed 抓取
  const zoneResult = await backfillFromZone(mediaSourceId);
  grandTotal += zoneResult.total;
  grandSaved += zoneResult.saved;
  console.log(`   Zone 1: ${zoneResult.total} found, ${zoneResult.saved} saved`);

  // 再從各分類抓取
  for (const cat of CATEGORIES) {
    const result = await fetchCategory(cat.id, cat.name, mediaSourceId);
    grandTotal += result.total;
    grandSaved += result.saved;
    console.log(
      `   ${cat.name}: ${result.total} found, ${result.saved} saved, oldest: ${result.oldestDate.toISOString().split('T')[0]}`
    );
  }

  console.log('\n' + '='.repeat(50));
  console.log('📊 BACKFILL SUMMARY');
  console.log('='.repeat(50));
  console.log(`Total articles found: ${grandTotal}`);
  console.log(`Total articles saved: ${grandSaved}`);
  console.log(`Duplicates skipped: ${grandTotal - grandSaved}`);

  // 查詢資料庫統計
  const dbStats = await db.execute('SELECT COUNT(*) as count FROM articles');
  console.log(`\nDatabase total: ${dbStats.rows[0].count}`);
}

main().catch(console.error);
