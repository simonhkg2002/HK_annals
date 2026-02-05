/**
 * 前端 API 客戶端
 * 封裝所有後端 API 調用
 */

// API 基礎路徑
const API_BASE = '/api';

// Session token 存儲 key
const SESSION_STORAGE_KEY = 'hk_portal_session';

// 獲取 session token
function getSessionToken(): string | null {
  return localStorage.getItem(SESSION_STORAGE_KEY);
}

// 設置 session token
export function setSessionToken(token: string): void {
  localStorage.setItem(SESSION_STORAGE_KEY, token);
}

// 清除 session token
export function clearSessionToken(): void {
  localStorage.removeItem(SESSION_STORAGE_KEY);
}

// 通用 fetch 封裝
async function apiFetch<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const url = `${API_BASE}${endpoint}`;

  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(error.error || `HTTP ${response.status}`);
  }

  return response.json();
}

// 帶認證的 fetch 封裝（用於管理員 API）
async function authFetch<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const token = getSessionToken();

  return apiFetch<T>(endpoint, {
    ...options,
    headers: {
      ...options.headers,
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
}

// ============ 公開 API ============

export interface NewsItem {
  id: string;
  title: string;
  url: string;
  source: string;
  category: string;
  publishedAt: string;
  thumbnail: string | null;
  summary: string;
  author?: string;
  tags?: string[];
}

export interface NewsDetail extends NewsItem {
  content: string | null;
  clusterId: string | null;
}

export interface NewsSeries {
  id: number;
  name: string;
  description: string | null;
  color: string;
  isActive: boolean;
  createdAt?: string | null;
  keywords?: string[];
  autoAddEnabled?: boolean;
}

export interface Stats {
  totalArticles: number;
  todayArticles: number;
  sources: { name: string; count: number }[];
  categories: { name: string; count: number }[];
}

export interface DailyStat {
  date: string;
  count: number;
}

// 獲取最新新聞
export async function fetchLatestNews(limit: number = 50): Promise<NewsItem[]> {
  return apiFetch<NewsItem[]>(`/news/list?limit=${limit}`);
}

// 獲取首頁新聞（過濾相似）
export async function fetchLatestNewsFiltered(limit: number = 50): Promise<NewsItem[]> {
  return apiFetch<NewsItem[]>(`/news/list?limit=${limit}&filtered=true`);
}

// 按分類獲取新聞
export async function fetchNewsByCategory(category: string, limit: number = 20): Promise<NewsItem[]> {
  return apiFetch<NewsItem[]>(`/news/by-category?category=${encodeURIComponent(category)}&limit=${limit}`);
}

// 按日期獲取新聞
export async function fetchNewsByDate(date: string): Promise<NewsItem[]> {
  return apiFetch<NewsItem[]>(`/news/by-date?date=${encodeURIComponent(date)}`);
}

// 按媒體來源獲取新聞
export async function fetchNewsBySource(sourceCode: string, limit: number = 20): Promise<NewsItem[]> {
  return apiFetch<NewsItem[]>(`/news/by-source?source=${encodeURIComponent(sourceCode)}&limit=${limit}`);
}

// 按系列獲取新聞
export async function fetchNewsBySeries(seriesId: number, limit: number = 50): Promise<NewsItem[]> {
  return apiFetch<NewsItem[]>(`/news/by-series?seriesId=${seriesId}&limit=${limit}`);
}

// 獲取單篇新聞詳情
export async function fetchNewsById(id: string): Promise<NewsDetail | null> {
  try {
    return await apiFetch<NewsDetail>(`/news/${id}`);
  } catch {
    return null;
  }
}

// 獲取相關新聞
export async function fetchRelatedNews(
  newsId: string,
  clusterId: string | null,
  category: string,
  limit: number = 6
): Promise<NewsItem[]> {
  const params = new URLSearchParams({
    newsId,
    limit: String(limit),
  });
  if (clusterId) params.set('clusterId', clusterId);
  if (category) params.set('category', category);

  return apiFetch<NewsItem[]>(`/news/related?${params}`);
}

// 搜尋新聞
export async function searchNews(query: string, limit: number = 20): Promise<NewsItem[]> {
  return apiFetch<NewsItem[]>(`/news/search?q=${encodeURIComponent(query)}&limit=${limit}`);
}

// 獲取所有日期
export async function fetchAllDates(): Promise<string[]> {
  return apiFetch<string[]>('/news/dates');
}

// 獲取統計資料
export async function fetchStats(): Promise<Stats> {
  return apiFetch<Stats>('/stats');
}

// 獲取統計資料（支援系列過濾）
export async function fetchStatsBySeries(seriesId: number | null): Promise<Stats> {
  const params = seriesId !== null ? `?seriesId=${seriesId}` : '';
  return apiFetch<Stats>(`/stats${params}`);
}

// 獲取每日統計
export async function fetchDailyStats(days: number = 7): Promise<DailyStat[]> {
  return apiFetch<DailyStat[]>(`/stats/daily?days=${days}`);
}

// 獲取每日統計（支援系列過濾）
export async function fetchDailyStatsBySeries(days: number = 7, seriesId: number | null): Promise<DailyStat[]> {
  const params = new URLSearchParams({ days: String(days) });
  if (seriesId !== null) params.set('seriesId', String(seriesId));
  return apiFetch<DailyStat[]>(`/stats/daily?${params}`);
}

// 獲取新聞系列（公開）
export async function fetchNewsSeries(): Promise<NewsSeries[]> {
  return apiFetch<NewsSeries[]>('/series/list');
}

// ============ 管理員 API ============

export interface AdminUser {
  id: number;
  username: string;
  displayName: string;
  isActive: boolean;
  lastLoginAt: string | null;
}

export interface LoginResponse {
  token: string;
  user: AdminUser;
}

export interface NewsItemWithSimilarity extends NewsItem {
  isDisabled: boolean;
  seriesId: number | null;
  isSimilarDuplicate: boolean;
  similarToId: string | null;
  titleNormalized: string | null;
  hasThumbnail: boolean;
  matchedKeyword?: string | null;
}

// 登入
export async function verifyAdminLogin(username: string, password: string): Promise<AdminUser | null> {
  try {
    const response = await apiFetch<LoginResponse>('/portal/auth', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    });

    // 存儲 token
    setSessionToken(response.token);

    return response.user;
  } catch {
    return null;
  }
}

// 登出
export async function adminLogout(): Promise<void> {
  try {
    await authFetch('/portal/auth', { method: 'DELETE' });
  } finally {
    clearSessionToken();
  }
}

// 驗證 session
export async function validateAdminSession(): Promise<AdminUser | null> {
  try {
    const response = await authFetch<{ user: AdminUser }>('/portal/auth');
    return response.user;
  } catch {
    clearSessionToken();
    return null;
  }
}

// 獲取管理員新聞列表
export async function fetchNewsForAdmin(
  limit: number = 50,
  includeDisabled: boolean = true,
  offset: number = 0
): Promise<NewsItemWithSimilarity[]> {
  const params = new URLSearchParams({
    limit: String(limit),
    offset: String(offset),
    includeDisabled: String(includeDisabled),
  });
  return authFetch<NewsItemWithSimilarity[]>(`/portal/news/list?${params}`);
}

// 獲取管理員新聞列表（支援系列過濾）
export async function fetchNewsForAdminBySeries(
  limit: number = 50,
  includeDisabled: boolean = true,
  offset: number = 0,
  seriesId: number | null
): Promise<NewsItemWithSimilarity[]> {
  const params = new URLSearchParams({
    limit: String(limit),
    offset: String(offset),
    includeDisabled: String(includeDisabled),
  });
  if (seriesId !== null) params.set('seriesId', String(seriesId));
  return authFetch<NewsItemWithSimilarity[]>(`/portal/news/list?${params}`);
}

// 獲取新聞總數
export async function fetchNewsCountForAdmin(includeDisabled: boolean = true): Promise<number> {
  const response = await authFetch<{ count: number }>(
    `/portal/news/count?includeDisabled=${includeDisabled}`
  );
  return response.count;
}

// 獲取新聞總數（支援系列過濾）
export async function fetchNewsCountForAdminBySeries(
  includeDisabled: boolean = true,
  seriesId: number | null
): Promise<number> {
  const params = new URLSearchParams({ includeDisabled: String(includeDisabled) });
  if (seriesId !== null) params.set('seriesId', String(seriesId));
  const response = await authFetch<{ count: number }>(`/portal/news/count?${params}`);
  return response.count;
}

// 停用新聞
export async function disableNews(articleId: string): Promise<void> {
  await authFetch('/portal/news/disable', {
    method: 'POST',
    body: JSON.stringify({ articleId }),
  });
}

// 恢復新聞
export async function enableNews(articleId: string): Promise<void> {
  await authFetch('/portal/news/enable', {
    method: 'POST',
    body: JSON.stringify({ articleId }),
  });
}

// 設定新聞系列
export async function setNewsSeriesId(articleId: string, seriesId: number | null): Promise<void> {
  await authFetch('/portal/news/set-series', {
    method: 'POST',
    body: JSON.stringify({ articleId, seriesId }),
  });
}

// 獲取書籤頁碼位置
export async function getBookmarkPagePosition(
  articleId: string,
  pageSize: number = 100,
  includeDisabled: boolean = true
): Promise<number> {
  const params = new URLSearchParams({
    articleId,
    pageSize: String(pageSize),
    includeDisabled: String(includeDisabled),
  });
  const response = await authFetch<{ page: number }>(`/portal/news/bookmark-position?${params}`);
  return response.page;
}

// 創建新聞系列
export async function createNewsSeries(
  name: string,
  description: string | null,
  color: string,
  keywords: string[] = [],
  autoAddEnabled: boolean = true
): Promise<number> {
  const response = await authFetch<{ success: boolean; id: number }>('/portal/series/create', {
    method: 'POST',
    body: JSON.stringify({ name, description, color, keywords, autoAddEnabled }),
  });
  return response.id;
}

// 更新新聞系列
export async function updateNewsSeries(
  seriesId: number,
  name: string,
  description: string | null,
  color: string,
  keywords: string[] = [],
  autoAddEnabled: boolean = true
): Promise<void> {
  await authFetch('/portal/series/update', {
    method: 'POST',
    body: JSON.stringify({ seriesId, name, description, color, keywords, autoAddEnabled }),
  });
}

// 刪除新聞系列
export async function deleteNewsSeries(seriesId: number): Promise<void> {
  await authFetch('/portal/series/delete', {
    method: 'POST',
    body: JSON.stringify({ seriesId }),
  });
}

// 獲取待複核列表
export async function fetchPendingReviews(
  limit: number = 100,
  offset: number = 0,
  seriesId: number | null = null,
  searchQuery: string = ''
): Promise<NewsItemWithSimilarity[]> {
  const params = new URLSearchParams({
    limit: String(limit),
    offset: String(offset),
  });
  if (seriesId !== null) params.set('seriesId', String(seriesId));
  if (searchQuery) params.set('q', searchQuery);
  return authFetch<NewsItemWithSimilarity[]>(`/portal/review/list?${params}`);
}

// 獲取待複核數量
export async function fetchPendingReviewsCount(
  seriesId: number | null = null,
  searchQuery: string = ''
): Promise<number> {
  const params = new URLSearchParams();
  if (seriesId !== null) params.set('seriesId', String(seriesId));
  if (searchQuery) params.set('q', searchQuery);
  const response = await authFetch<{ count: number }>(`/portal/review/count?${params}`);
  return response.count;
}

// 同意自動分類
export async function approveAutoClassified(articleId: string): Promise<void> {
  await authFetch('/portal/review/approve', {
    method: 'POST',
    body: JSON.stringify({ articleId }),
  });
}

// 拒絕自動分類
export async function rejectAutoClassified(articleId: string): Promise<void> {
  await authFetch('/portal/review/reject', {
    method: 'POST',
    body: JSON.stringify({ articleId }),
  });
}
