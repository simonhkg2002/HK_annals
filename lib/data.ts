import { NewsItem, NewsSource, NewsCategory } from "../types";

const SOURCES: NewsSource[] = ['明報', '東方日報', 'HK01', '信報', 'SCMP'];
const CATEGORIES: NewsCategory[] = ['港聞', '財經', '國際', '體育', '娛樂'];

const TITLES = [
  "特首發表施政報告 重點關注房屋供應",
  "恒指大升500點 科技股領漲",
  "強颱風逼近 天文台考慮改發八號風球",
  "西九龍文化區新展覽開幕 吸引數千遊客",
  "啟德體育園即將竣工 迎接全運會",
  "財政預算案公佈 派發消費券細節",
  "地鐵新線通車 首日運作暢順",
  "美聯儲暗示減息 環球股市造好",
  "本地初創企業獲巨額融資",
  "國際電影節開幕 本地導演獲獎"
];

function randomDate(start: Date, end: Date) {
  return new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));
}

export const generateNews = (count: number): NewsItem[] => {
  return Array.from({ length: count }).map((_, i) => {
    const isHero = i < 3;
    const date = randomDate(new Date(Date.now() - 24 * 60 * 60 * 1000), new Date());
    
    return {
      id: `news-${i}`,
      title: TITLES[Math.floor(Math.random() * TITLES.length)] + (Math.random() > 0.5 ? "：專家分析後續影響" : "，市民表示歡迎"),
      url: "#",
      source: SOURCES[Math.floor(Math.random() * SOURCES.length)],
      category: CATEGORIES[Math.floor(Math.random() * CATEGORIES.length)],
      publishedAt: date.toISOString(),
      thumbnail: `https://picsum.photos/800/600?random=${i}`,
      summary: "這是一則關於香港最新發展的新聞摘要。報導詳細分析了事件的起因、經過以及對市民日常生活的潛在影響。專家呼籲各界保持關注。",
      views: Math.floor(Math.random() * 10000),
    };
  }).sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime());
};

export const MOCK_NEWS = generateNews(50);
