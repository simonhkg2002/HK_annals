/**
 * 回補現有文章的全文內容
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
        },
      });
      if (response.ok) return response;
      if (response.status === 429) {
        console.log(`   ⏳ Rate limited, waiting ${attempt * 2}s...`);
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

async function fetchHK01Content(url: string): Promise<string | null> {
  try {
    const response = await fetchWithRetry(url);
    if (!response) return null;

    const html = await response.text();
    const nextDataMatch = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);

    if (nextDataMatch) {
      const nextData = JSON.parse(nextDataMatch[1]);
      const article =
        nextData?.props?.initialProps?.pageProps?.article ||
        nextData?.props?.pageProps?.article;

      if (article?.blocks) {
        const contentParts: string[] = [];

        for (const block of article.blocks) {
          if (block.blockType === 'summary' && block.summary) {
            contentParts.push(...block.summary);
          } else if (block.blockType === 'text' && block.htmlTokens) {
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
        }

        if (contentParts.length > 0) {
          return contentParts.join('\n\n');
        }
      }

      if (article?.description) {
        return article.description;
      }
    }

    // Fallback: og:description
    const descMatch = html.match(/og:description" content="([^"]+)"/);
    if (descMatch) return descMatch[1];

    return null;
  } catch {
    return null;
  }
}

async function fetchRTHKContent(url: string): Promise<string | null> {
  try {
    const response = await fetchWithRetry(url);
    if (!response) return null;

    const html = await response.text();

    const contentMatch = html.match(/<div class="itemFullText"[^>]*>([\s\S]*?)<\/div>/);
    if (contentMatch) {
      return contentMatch[1]
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<p[^>]*>/gi, '\n')
        .replace(/<\/p>/gi, '\n')
        .replace(/<[^>]+>/g, '')
        .replace(/&nbsp;/g, ' ')
        .replace(/&quot;/g, '"')
        .replace(/&amp;/g, '&')
        .replace(/\n{3,}/g, '\n\n')
        .trim();
    }

    // Fallback: og:description
    const descMatch = html.match(/og:description" content="([^"]+)"/);
    if (descMatch) return descMatch[1];

    return null;
  } catch {
    return null;
  }
}

async function fetchMingPaoContent(url: string): Promise<string | null> {
  try {
    const response = await fetchWithRetry(url);
    if (!response) return null;

    const html = await response.text();

    const contentMatch = html.match(/<div class="article_content"[^>]*>([\s\S]*?)<\/div>/);
    if (contentMatch) {
      return contentMatch[1]
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<p[^>]*>/gi, '\n')
        .replace(/<\/p>/gi, '\n')
        .replace(/<[^>]+>/g, '')
        .replace(/&nbsp;/g, ' ')
        .replace(/&quot;/g, '"')
        .replace(/&amp;/g, '&')
        .replace(/\n{3,}/g, '\n\n')
        .trim();
    }

    // Fallback: og:description
    const descMatch = html.match(/og:description" content="([^"]+)"/);
    if (descMatch) return descMatch[1];

    return null;
  } catch {
    return null;
  }
}

async function backfill(limit = 50) {
  console.log('🔄 Backfilling content for existing articles...\n');

  // 獲取沒有 content 的文章
  const articles = await db.execute({
    sql: `
      SELECT a.id, a.original_url, a.title, ms.code as source_code
      FROM articles a
      LEFT JOIN media_sources ms ON a.media_source_id = ms.id
      WHERE a.content IS NULL OR a.content = ''
      ORDER BY a.published_at DESC
      LIMIT ?
    `,
    args: [limit],
  });

  console.log(`📊 Found ${articles.rows.length} articles without content\n`);

  let updated = 0;
  let failed = 0;

  for (const row of articles.rows) {
    const id = row.id as number;
    const url = row.original_url as string;
    const title = (row.title as string).substring(0, 40);
    const source = row.source_code as string;

    console.log(`📄 [${source}] ${title}...`);

    let content: string | null = null;

    if (source === 'hk01') {
      content = await fetchHK01Content(url);
    } else if (source === 'rthk') {
      content = await fetchRTHKContent(url);
    } else if (source === 'mingpao') {
      content = await fetchMingPaoContent(url);
    }

    if (content) {
      await db.execute({
        sql: 'UPDATE articles SET content = ? WHERE id = ?',
        args: [content, id],
      });
      console.log(`   ✅ Updated (${content.length} chars)`);
      updated++;
    } else {
      console.log(`   ⚠️ Failed to fetch content`);
      failed++;
    }

    // 避免請求過快
    await delay(500);
  }

  console.log('\n' + '='.repeat(50));
  console.log(`✅ Updated: ${updated}`);
  console.log(`⚠️ Failed: ${failed}`);
}

const limit = parseInt(process.argv[2] || '50');
backfill(limit).catch(console.error);
