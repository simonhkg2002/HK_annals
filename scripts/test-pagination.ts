/**
 * 測試 HK01 分頁能獲取多久的歷史
 */

async function testPagination() {
  console.log('Testing HK01 Zone pagination depth...\n');

  let offset: number | string = 0;
  let totalArticles = 0;
  let oldestDate = new Date();
  let pageCount = 0;
  const maxPages = 50; // 限制測試頁數

  while (pageCount < maxPages) {
    const url = `https://web-data.api.hk01.com/v2/feed/zone/1?offset=${offset}&limit=50`;

    try {
      const res = await fetch(url, {
        headers: { 'User-Agent': 'Mozilla/5.0' },
      });

      if (!res.ok) {
        console.log(`HTTP ${res.status} at page ${pageCount}`);
        break;
      }

      const data = await res.json();
      const items = data.items || [];

      if (items.length === 0) {
        console.log('No more items');
        break;
      }

      totalArticles += items.length;

      // 獲取這批的最舊日期
      for (const item of items) {
        const date = new Date(item.data.publishTime * 1000);
        if (date < oldestDate) {
          oldestDate = date;
        }
      }

      const lastItem = items[items.length - 1];
      const lastDate = new Date(lastItem.data.publishTime * 1000);

      console.log(
        `Page ${pageCount + 1}: ${items.length} articles, oldest: ${lastDate.toISOString().split('T')[0]}`
      );

      // 檢查下一頁
      if (!data.nextOffset || data.nextOffset === 99999999995) {
        console.log('Reached end of feed');
        break;
      }

      offset = data.nextOffset;
      pageCount++;

      // 小延遲避免過度請求
      await new Promise((r) => setTimeout(r, 200));
    } catch (e) {
      console.log(`Error at page ${pageCount}:`, e);
      break;
    }
  }

  console.log('\n=== Summary ===');
  console.log(`Total pages: ${pageCount + 1}`);
  console.log(`Total articles: ${totalArticles}`);
  console.log(`Oldest date: ${oldestDate.toISOString().split('T')[0]}`);

  const daysBack = Math.floor((Date.now() - oldestDate.getTime()) / (1000 * 60 * 60 * 24));
  console.log(`Days of history: ${daysBack}`);
}

testPagination();
