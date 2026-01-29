export type NewsSource = '明報' | '東方日報' | 'HK01' | '信報' | 'SCMP';
export type NewsCategory = '港聞' | '財經' | '國際' | '體育' | '娛樂';

export interface NewsItem {
  id: string;
  title: string;
  url: string;
  source: NewsSource;
  category: NewsCategory;
  publishedAt: string; // ISO string
  thumbnail: string;
  summary: string;
  views: number;
}

export interface DailyStats {
  date: string;
  count: number;
}

export interface AdminStats {
  totalArticles: number;
  lastCrawled: string;
  nextCrawl: string;
  activeSources: NewsSource[];
}
