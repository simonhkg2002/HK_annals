/**
 * 探索更多 HK01 API 端點
 */

async function explore() {
  console.log('Exploring more HK01 API endpoints...\n');

  // 嘗試按日期範圍的 API
  const dateApis = [
    'https://web-data.api.hk01.com/v2/feed/zone/1?from=2025-07-01&to=2025-07-31',
    'https://web-data.api.hk01.com/v2/feed/zone/1?startDate=2025-07-01&endDate=2025-07-31',
    'https://web-data.api.hk01.com/v2/feed/zone/1?date=2025-07-15',
    'https://web-data.api.hk01.com/v2/articles?zone=1&from=2025-07-01',
    'https://web-data.api.hk01.com/v2/zone/1/articles?offset=0&limit=10',
  ];

  console.log('=== Testing date-based APIs ===\n');
  for (const url of dateApis) {
    try {
      const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
      console.log(`${url.split('hk01.com')[1]}: HTTP ${res.status}`);
      if (res.ok) {
        const data = await res.json();
        const items = data.items || [];
        if (items.length > 0) {
          console.log(`  Found ${items.length} items!`);
        }
      }
    } catch (e) {
      console.log(`Error: ${e}`);
    }
  }

  // 嘗試不同分類的深度
  console.log('\n=== Testing category pagination ===\n');

  const categories = [
    { id: 2, name: '社會新聞' },
    { id: 4, name: '政治' },
    { id: 5, name: '經濟' },
  ];

  for (const cat of categories) {
    let offset: number | string = 0;
    let totalArticles = 0;
    let oldestDate = new Date();
    let pageCount = 0;

    while (pageCount < 100) {
      const url = `https://web-data.api.hk01.com/v2/feed/category/${cat.id}?offset=${offset}&limit=50`;
      try {
        const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
        if (!res.ok) break;

        const data = await res.json();
        const items = data.items || [];
        if (items.length === 0) break;

        totalArticles += items.length;
        for (const item of items) {
          const date = new Date(item.data.publishTime * 1000);
          if (date < oldestDate) oldestDate = date;
        }

        if (!data.nextOffset || data.nextOffset === 99999999995) break;
        offset = data.nextOffset;
        pageCount++;
        await new Promise((r) => setTimeout(r, 100));
      } catch (e) {
        break;
      }
    }

    const daysBack = Math.floor((Date.now() - oldestDate.getTime()) / (1000 * 60 * 60 * 24));
    console.log(`Category ${cat.id} (${cat.name}): ${totalArticles} articles, ${daysBack} days back`);
  }

  // 嘗試 sitemap
  console.log('\n=== Checking sitemap ===\n');

  const sitemapUrls = [
    'https://www.hk01.com/sitemap.xml',
    'https://www.hk01.com/sitemap_index.xml',
    'https://www.hk01.com/robots.txt',
  ];

  for (const url of sitemapUrls) {
    try {
      const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
      console.log(`${url.split('.com')[1]}: HTTP ${res.status}`);
      if (res.ok && url.includes('robots')) {
        const text = await res.text();
        const sitemapLines = text.split('\n').filter((l) => l.includes('Sitemap'));
        console.log(`  Sitemaps found: ${sitemapLines.length}`);
        sitemapLines.slice(0, 3).forEach((l) => console.log(`    ${l}`));
      }
    } catch (e) {
      console.log(`Error`);
    }
  }

  // 嘗試直接構建舊文章 URL
  console.log('\n=== Testing direct article ID access ===\n');

  // 假設文章 ID 是遞增的，當前 ID 約 60317000
  // 6 個月前的 ID 可能在 50000000 左右
  const testIds = [60317276, 60000000, 55000000, 50000000, 45000000, 40000000];

  for (const id of testIds) {
    try {
      const url = `https://web-data.api.hk01.com/v2/articles/${id}`;
      const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });

      if (res.ok) {
        const data = await res.json();
        const publishTime = data.article?.publishTime;
        if (publishTime) {
          const date = new Date(publishTime * 1000);
          console.log(`ID ${id}: ${date.toISOString().split('T')[0]} - ${data.article?.title?.substring(0, 30)}...`);
        } else {
          console.log(`ID ${id}: No data`);
        }
      } else {
        console.log(`ID ${id}: HTTP ${res.status}`);
      }
    } catch (e) {
      console.log(`ID ${id}: Error`);
    }
  }
}

explore();
