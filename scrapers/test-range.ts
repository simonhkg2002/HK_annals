/**
 * 測試 HK01 API 可以抓取多遠的新聞
 */

async function testRange() {
  console.log('Testing HK01 API range...\n');

  const offsets = [0, 50, 100, 200, 500, 1000, 2000, 3000, 5000];

  for (const offset of offsets) {
    try {
      const res = await fetch(
        `https://web-data.api.hk01.com/v2/feed/zone/1?offset=${offset}&limit=1`,
        {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          },
        }
      );

      const data = await res.json();

      if (data.items && data.items.length > 0) {
        const article = data.items[0].data;
        const date = new Date(article.publishTime * 1000);
        const dateStr = date.toISOString().split('T')[0];
        const daysAgo = Math.floor((Date.now() - date.getTime()) / (1000 * 60 * 60 * 24));

        console.log(`Offset ${offset.toString().padStart(4)}: ${dateStr} (${daysAgo} days ago) - ${article.title.substring(0, 30)}...`);
      } else {
        console.log(`Offset ${offset}: ❌ No more articles`);
        break;
      }
    } catch (e) {
      console.log(`Offset ${offset}: ❌ Error - ${e}`);
    }
  }
}

testRange();
