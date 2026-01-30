/**
 * 探索 HK01 API 的歷史資料範圍
 */

async function exploreAPI() {
  console.log('Exploring HK01 API for historical data...\n');

  // 測試不同的 API 端點
  const endpoints = [
    // Zone feed (港聞)
    { name: 'Zone 1 (港聞)', url: 'https://web-data.api.hk01.com/v2/feed/zone/1?offset=0&limit=50' },
    // Category feeds
    { name: 'Category 2 (社會新聞)', url: 'https://web-data.api.hk01.com/v2/feed/category/2?offset=0&limit=50' },
    { name: 'Category 1 (港聞)', url: 'https://web-data.api.hk01.com/v2/feed/category/1?offset=0&limit=50' },
    { name: 'Category 3 (政情)', url: 'https://web-data.api.hk01.com/v2/feed/category/3?offset=0&limit=50' },
    // Try latest articles
    { name: 'Latest', url: 'https://web-data.api.hk01.com/v2/feed/latest?offset=0&limit=50' },
    // Try hot articles
    { name: 'Hot', url: 'https://web-data.api.hk01.com/v2/feed/hot?offset=0&limit=50' },
  ];

  for (const endpoint of endpoints) {
    try {
      console.log(`Testing: ${endpoint.name}`);
      const res = await fetch(endpoint.url, {
        headers: { 'User-Agent': 'Mozilla/5.0' },
      });

      if (!res.ok) {
        console.log(`  ❌ HTTP ${res.status}\n`);
        continue;
      }

      const data = await res.json();
      const items = data.items || [];

      if (items.length === 0) {
        console.log(`  ⚠️ No items\n`);
        continue;
      }

      // 獲取日期範圍
      const dates = items.map((i: any) => new Date(i.data.publishTime * 1000));
      const newest = new Date(Math.max(...dates.map((d: Date) => d.getTime())));
      const oldest = new Date(Math.min(...dates.map((d: Date) => d.getTime())));

      console.log(`  ✅ ${items.length} items`);
      console.log(`  📅 ${oldest.toISOString().split('T')[0]} to ${newest.toISOString().split('T')[0]}`);
      console.log(`  🔗 nextOffset: ${data.nextOffset ?? 'none'}\n`);
    } catch (e) {
      console.log(`  ❌ Error: ${e}\n`);
    }
  }

  // 測試大 offset
  console.log('\n=== Testing large offsets on category API ===\n');

  for (const offset of [0, 100, 500, 1000, 2000, 5000]) {
    try {
      const url = `https://web-data.api.hk01.com/v2/feed/category/2?offset=${offset}&limit=10`;
      const res = await fetch(url, {
        headers: { 'User-Agent': 'Mozilla/5.0' },
      });

      if (!res.ok) {
        console.log(`Offset ${offset}: HTTP ${res.status}`);
        continue;
      }

      const data = await res.json();
      const items = data.items || [];

      if (items.length === 0) {
        console.log(`Offset ${offset}: No more items`);
        break;
      }

      const firstDate = new Date(items[0].data.publishTime * 1000);
      const lastDate = new Date(items[items.length - 1].data.publishTime * 1000);

      console.log(`Offset ${offset}: ${items.length} items, ${lastDate.toISOString().split('T')[0]} to ${firstDate.toISOString().split('T')[0]}`);
    } catch (e) {
      console.log(`Offset ${offset}: Error`);
    }
  }

  // 嘗試搜尋 API
  console.log('\n=== Testing search API ===\n');

  const searchUrls = [
    'https://web-data.api.hk01.com/v2/search?q=香港&limit=10',
    'https://api.hk01.com/v2/search?q=香港&limit=10',
    'https://web-data.api.hk01.com/v2/articles?q=香港&limit=10',
  ];

  for (const url of searchUrls) {
    try {
      const res = await fetch(url, {
        headers: { 'User-Agent': 'Mozilla/5.0' },
      });
      console.log(`${url.split('?')[0]}: HTTP ${res.status}`);
      if (res.ok) {
        const data = await res.json();
        console.log(`  Response keys: ${Object.keys(data).join(', ')}`);
      }
    } catch (e) {
      console.log(`${url}: Error`);
    }
  }

  // 嘗試直接獲取文章
  console.log('\n=== Testing direct article access ===\n');

  // 用一個已知的文章 ID 測試
  const articleId = 60317276;
  const articleUrl = `https://web-data.api.hk01.com/v2/articles/${articleId}`;

  try {
    const res = await fetch(articleUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
    });
    console.log(`Article API: HTTP ${res.status}`);
    if (res.ok) {
      const data = await res.json();
      console.log(`  Title: ${data.article?.title?.substring(0, 50)}...`);
    }
  } catch (e) {
    console.log(`Article API: Error`);
  }
}

exploreAPI();
