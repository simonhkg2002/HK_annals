// =============================================
// HK Daily Chronicle Database Types
// 香港新聞編年史資料庫類型定義
// =============================================

// 媒體來源
export interface MediaSource {
  id: number;
  code: string;
  name_zh: string;
  name_en?: string;
  website_url?: string;
  logo_url?: string;
  language: 'zh' | 'en' | 'both';
  political_stance?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// 分類
export interface Category {
  id: number;
  code: string;
  name_zh: string;
  name_en?: string;
  color?: string;
  icon?: string;
  sort_order: number;
  created_at: string;
}

// 文章（核心）
export interface Article {
  id: number;

  // 來源識別
  media_source_id: number;
  original_id?: string;
  original_url: string;

  // 基本內容
  title: string;
  subtitle?: string;
  content?: string;
  summary?: string;

  // 時間資訊
  published_at: string;
  updated_at?: string;
  scraped_at: string;

  // 分類與標籤
  category_id?: number;
  tags?: string[]; // JSON parsed

  // 媒體附件
  thumbnail_url?: string;
  images?: string[]; // JSON parsed
  video_url?: string;

  // 作者資訊
  author?: string;
  author_title?: string;

  // 元數據
  word_count?: number;
  reading_time?: number;
  language: string;

  // 編年史功能
  is_headline: boolean;
  is_breaking: boolean;
  importance_score: number;

  // 管理欄位
  is_archived: boolean;
  archive_content?: string;
  content_hash?: string;

  created_at: string;
}

// 文章（包含關聯資料）
export interface ArticleWithRelations extends Article {
  media_source?: MediaSource;
  category?: Category;
  events?: Event[];
}

// 重大事件
export interface Event {
  id: number;

  // 基本資訊
  title_zh: string;
  title_en?: string;
  slug?: string;

  // 描述
  description?: string;
  summary?: string;

  // 時間範圍
  started_at: string;
  ended_at?: string;
  is_ongoing: boolean;

  // 分類
  category_id?: number;
  event_type?: EventType;

  // 地點
  location?: string;
  location_lat?: number;
  location_lng?: number;
  district?: string;

  // 影響
  casualties?: number;
  affected_count?: number;
  impact_level?: 'low' | 'medium' | 'high' | 'critical';

  // 媒體
  cover_image_url?: string;

  // 管理欄位
  is_featured: boolean;
  is_published: boolean;
  view_count: number;

  // 時間線功能
  is_milestone: boolean;
  timeline_order?: number;

  created_by?: string;
  created_at: string;
  updated_at: string;
}

// 事件類型
export type EventType =
  | 'disaster'      // 災難
  | 'protest'       // 示威
  | 'policy'        // 政策
  | 'crime'         // 罪案
  | 'election'      // 選舉
  | 'legal'         // 法律
  | 'economy'       // 經濟
  | 'health'        // 衛生
  | 'infrastructure'// 基建
  | 'international' // 國際
  | 'other';        // 其他

// 事件（包含關聯資料）
export interface EventWithRelations extends Event {
  category?: Category;
  articles?: Article[];
  updates?: EventUpdate[];
  article_count?: number;
}

// 文章-事件關聯
export interface ArticleEvent {
  id: number;
  article_id: number;
  event_id: number;
  relevance_score: number;
  is_primary: boolean;
  relation_type?: 'coverage' | 'followup' | 'analysis' | 'opinion';
  created_at: string;
}

// 時間線項目
export interface TimelineItem {
  id: number;
  title: string;
  description?: string;
  occurred_at: string;
  event_id?: number;
  article_id?: number;
  item_type: string;
  icon?: string;
  color?: string;
  image_url?: string;
  is_major: boolean;
  is_published: boolean;
  sort_order: number;
  created_by?: string;
  created_at: string;
  updated_at: string;
}

// 事件更新
export interface EventUpdate {
  id: number;
  event_id: number;
  title: string;
  content?: string;
  occurred_at: string;
  update_type?: 'development' | 'statement' | 'result';
  source_url?: string;
  created_at: string;
}

// 爬蟲日誌
export interface ScraperLog {
  id: number;
  media_source_id: number;
  started_at: string;
  ended_at?: string;
  status: 'running' | 'success' | 'failed' | 'partial';
  articles_found: number;
  articles_new: number;
  articles_updated: number;
  articles_failed: number;
  error_message?: string;
}

// =============================================
// API 請求/響應類型
// =============================================

// 分頁參數
export interface PaginationParams {
  page?: number;
  limit?: number;
}

// 文章查詢參數
export interface ArticleQueryParams extends PaginationParams {
  media_source?: string;
  category?: string;
  from_date?: string;
  to_date?: string;
  search?: string;
  event_id?: number;
  is_headline?: boolean;
  sort_by?: 'published_at' | 'importance_score' | 'created_at';
  sort_order?: 'asc' | 'desc';
}

// 事件查詢參數
export interface EventQueryParams extends PaginationParams {
  event_type?: EventType;
  district?: string;
  from_date?: string;
  to_date?: string;
  search?: string;
  is_featured?: boolean;
  is_ongoing?: boolean;
}

// 分頁響應
export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  total_pages: number;
}

// 新增文章請求
export interface CreateArticleRequest {
  media_source_id: number;
  original_id?: string;
  original_url: string;
  title: string;
  subtitle?: string;
  content?: string;
  summary?: string;
  published_at: string;
  category_id?: number;
  tags?: string[];
  thumbnail_url?: string;
  images?: string[];
  author?: string;
  importance_score?: number;
}

// 新增事件請求
export interface CreateEventRequest {
  title_zh: string;
  title_en?: string;
  slug?: string;
  description?: string;
  summary?: string;
  started_at: string;
  ended_at?: string;
  is_ongoing?: boolean;
  category_id?: number;
  event_type?: EventType;
  location?: string;
  district?: string;
  impact_level?: 'low' | 'medium' | 'high' | 'critical';
  cover_image_url?: string;
  is_featured?: boolean;
  is_milestone?: boolean;
}
