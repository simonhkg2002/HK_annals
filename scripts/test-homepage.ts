import 'dotenv/config';
import { fetchLatestNewsFiltered } from './data';

async function test() {
  const news = await fetchLatestNewsFiltered(50);
  const sources: Record<string, number> = {};
  for (const n of news) {
    sources[n.source] = (sources[n.source] || 0) + 1;
  }
  console.log('News by source on homepage:');
  console.log(sources);

  // Check if Yahoo exists
  const yahooNews = news.filter(n => n.source === 'Yahoo新聞');
  console.log('\nYahoo news count:', yahooNews.length);
  if (yahooNews.length > 0) {
    console.log('First Yahoo:', yahooNews[0].title.substring(0, 50));
  }
}
test().catch(console.error);
