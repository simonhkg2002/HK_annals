/**
 * 回補 Yahoo 新聞的圖片
 */
import 'dotenv/config';
import { createClient } from '@libsql/client';

const db = createClient({
  url: process.env.TURSO_DATABASE_URL!,
  authToken: process.env.TURSO_AUTH_TOKEN!,
});

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchWithRetry(url: string, maxRetries = 3): Promise<Response | null> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          Accept: 'application/rss+xml, application/xml, text/xml',
        },
      });
      if (response.ok) return response;
      if (response.status === 429) {
        await delay(attempt * 2000);
        continue;
      }
      return null;
    } catch {
      if (attempt < maxRetries) await delay(attempt * 1000);
    }
  }
  return null;
}

interface RSSItem {
  link: string;
  contentEncoded?: string;
}

function parseRSS(xml: string): RSSItem[] {
  const items: RSSItem[] = [];
  const itemMatches = xml.match(/<item>([\s\S]*?)<\/item>/g);
  if (!itemMatches) return items;

  for (const itemXml of itemMatches) {
    const linkMatch = itemXml.match(/<link>([^<]+)<\/link>/i);
    const link = linkMatch ? linkMatch[1].trim() : '';

    // Extract content:encoded
    let contentEncoded = '';
    const cdataPattern = /<content:encoded[^>]*><!\[CDATA\[([\s\S]*?)\]\]><\/content:encoded>/i;
    const cdataMatch = itemXml.match(cdataPattern);
    if (cdataMatch) {
      contentEncoded = cdataMatch[1].trim();
    } else {
      const simplePattern = /<content:encoded[^>]*>([\s\S]*?)<\/content:encoded>/i;
      const simpleMatch = itemXml.match(simplePattern);
      if (simpleMatch) contentEncoded = simpleMatch[1].trim();
    }

    if (link) {
      items.push({ link, contentEncoded });
    }
  }

  return items;
}

function extractImageUrl(contentEncoded: string | undefined): string | null {
  if (!contentEncoded) return null;

  // Yahoo RSS 圖片格式
  const yimgMatch = contentEncoded.match(/https:\/\/s\.yimg\.com\/[^\s<>"]+/);
  if (yimgMatch) return yimgMatch[0];

  return null;
}

async function backfillImages() {
  console.log('🔄 Backfilling Yahoo news images...\n');

  // 獲取 RSS feed
  const rssUrl = 'https://hk.news.yahoo.com/rss/hong-kong';
  console.log('📡 Fetching RSS feed...');
  const response = await fetchWithRetry(rssUrl);
  if (!response) {
    console.error('Failed to fetch RSS');
    return;
  }

  const xml = await response.text();
  const rssItems = parseRSS(xml);
  console.log(`Found ${rssItems.length} items in RSS\n`);

  // 建立 URL -> Image 映射
  const urlToImage = new Map<string, string>();
  for (const item of rssItems) {
    const imageUrl = extractImageUrl(item.contentEncoded);
    if (imageUrl) {
      urlToImage.set(item.link, imageUrl);
    }
  }
  console.log(`Found ${urlToImage.size} items with images\n`);

  // 獲取沒有圖片的 Yahoo 新聞
  const articles = await db.execute(`
    SELECT a.id, a.original_url, a.title
    FROM articles a
    JOIN media_sources ms ON a.media_source_id = ms.id
    WHERE ms.code = 'yahoo'
    AND (a.thumbnail_url IS NULL OR a.thumbnail_url = '')
  `);

  console.log(`📊 Found ${articles.rows.length} Yahoo articles without images\n`);

  let updated = 0;
  for (const row of articles.rows) {
    const url = row.original_url as string;
    const imageUrl = urlToImage.get(url);

    if (imageUrl) {
      await db.execute({
        sql: 'UPDATE articles SET thumbnail_url = ? WHERE id = ?',
        args: [imageUrl, row.id],
      });
      console.log(`✅ Updated: ${String(row.title).substring(0, 40)}...`);
      updated++;
    }
  }

  console.log(`\n🎉 Updated ${updated} articles with images`);

  // 最終統計
  const stats = await db.execute(`
    SELECT
      COUNT(*) as total,
      SUM(CASE WHEN thumbnail_url IS NOT NULL AND thumbnail_url != '' THEN 1 ELSE 0 END) as with_image
    FROM articles a
    JOIN media_sources ms ON a.media_source_id = ms.id
    WHERE ms.code = 'yahoo'
  `);

  const total = Number(stats.rows[0].total);
  const withImage = Number(stats.rows[0].with_image);
  console.log(`\n📊 Yahoo images: ${withImage}/${total} (${Math.round((withImage / total) * 100)}%)`);
}

backfillImages().catch(console.error);
