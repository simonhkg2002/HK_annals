// 媒體來源（可動態擴展）
export type NewsSource = 'HK01' | 'HKFP' | 'RTHK' | 'SCMP' | '明報' | '東方日報' | '信報' | '獨立媒體';

// 新聞分類
export type NewsCategory = '港聞' | '社會' | '政治' | '財經' | '國際' | '中國' | '體育' | '娛樂' | '生活' | '觀點';

// 分類代碼對應
export const CATEGORY_MAP: Record<string, NewsCategory> = {
  local: '港聞',
  society: '社會',
  politics: '政治',
  economy: '財經',
  international: '國際',
  china: '中國',
  sports: '體育',
  entertainment: '娛樂',
  lifestyle: '生活',
  opinion: '觀點',
};

// 媒體代碼對應
export const SOURCE_MAP: Record<string, NewsSource> = {
  hk01: 'HK01',
  hkfp: 'HKFP',
  rthk: 'RTHK',
  scmp: 'SCMP',
  mingpao: '明報',
  inmediahk: '獨立媒體',
};

export interface NewsItem {
  id: string;
  title: string;
  url: string;
  source: NewsSource;
  category: NewsCategory;
  publishedAt: string; // ISO string
  thumbnail: string | null;
  summary: string;
  author?: string;
  tags?: string[];
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

// 資料庫文章類型
export interface DBArticle {
  id: number;
  media_source_id: number;
  original_id: string;
  original_url: string;
  title: string;
  content: string | null;
  summary: string | null;
  published_at: string;
  category_id: number | null;
  tags: string | null;
  thumbnail_url: string | null;
  author: string | null;
  is_headline: number;
  importance_score: number;
  // 關聯欄位
  source_code?: string;
  source_name?: string;
  category_code?: string;
  category_name?: string;
}
