/**
 * 爬蟲主入口
 * 用於 GitHub Actions 或命令行批次執行
 */

import { scrapeHK01 } from './hk01';
import { scrapeYahoo } from './yahoo';
// import { scrapeHKFP } from './hkfp';

interface ScraperResult {
  source: string;
  success: boolean;
  articlesFound: number;
  articlesInserted: number;
  error?: string;
  duration: number;
}

async function runScraper(
  name: string,
  scraperFn: () => Promise<unknown[]>
): Promise<ScraperResult> {
  const startTime = Date.now();

  try {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`Starting ${name} scraper...`);
    console.log('='.repeat(60));

    const articles = await scraperFn();

    return {
      source: name,
      success: true,
      articlesFound: articles.length,
      articlesInserted: articles.length,
      duration: Date.now() - startTime,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`\n❌ ${name} scraper failed:`, errorMessage);

    return {
      source: name,
      success: false,
      articlesFound: 0,
      articlesInserted: 0,
      error: errorMessage,
      duration: Date.now() - startTime,
    };
  }
}

async function main() {
  const args = process.argv.slice(2);
  const source = args[0] || 'all';

  console.log('🚀 HK Daily Chronicle - News Scraper');
  console.log(`📅 ${new Date().toISOString()}`);
  console.log(`🎯 Source: ${source}`);

  const results: ScraperResult[] = [];

  // HK01
  if (source === 'all' || source === 'hk01') {
    const result = await runScraper('HK01', () =>
      scrapeHK01({ limit: 30, saveToDb: true, fetchContent: true })
    );
    results.push(result);
  }

  // Yahoo
  if (source === 'all' || source === 'yahoo') {
    const result = await runScraper('Yahoo', () =>
      scrapeYahoo({ limit: 30, saveToDb: true, fetchContent: true })
    );
    results.push(result);
  }

  // HKFP (待實作)
  // if (source === 'all' || source === 'hkfp') {
  //   const result = await runScraper('HKFP', () =>
  //     scrapeHKFP({ limit: 30, saveToDb: true })
  //   );
  //   results.push(result);
  // }

  // 輸出總結
  console.log('\n' + '='.repeat(60));
  console.log('📊 SCRAPING SUMMARY');
  console.log('='.repeat(60));

  let totalFound = 0;
  let totalInserted = 0;
  let allSuccess = true;

  for (const result of results) {
    const status = result.success ? '✅' : '❌';
    console.log(
      `${status} ${result.source}: ${result.articlesInserted} articles (${result.duration}ms)`
    );
    if (result.error) {
      console.log(`   Error: ${result.error}`);
    }
    totalFound += result.articlesFound;
    totalInserted += result.articlesInserted;
    if (!result.success) allSuccess = false;
  }

  console.log('');
  console.log(`📰 Total articles found: ${totalFound}`);
  console.log(`💾 Total articles inserted: ${totalInserted}`);
  console.log(`⏱️  Completed at: ${new Date().toISOString()}`);

  // 如果有任何爬蟲失敗，退出碼為 1
  if (!allSuccess) {
    process.exit(1);
  }
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
