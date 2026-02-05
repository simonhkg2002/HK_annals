/**
 * 前端 API 客戶端
 * 封裝所有後端 API 調用
 */

const API_BASE = '/api';
const SESSION_STORAGE_KEY = 'hk_portal_session';

function getSessionToken(): string | null {
  return localStorage.getItem(SESSION_STORAGE_KEY);
}

export function setSessionToken(token: string): void {
  localStorage.setItem(SESSION_STORAGE_KEY, token);
}

export function clearSessionToken(): void {
  localStorage.removeItem(SESSION_STORAGE_KEY);
}

async function apiFetch<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...options.headers },
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(error.error || `HTTP ${response.status}`);
  }
  return response.json();
}

async function authFetch<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = getSessionToken();
  return apiFetch<T>(endpoint, {
    ...options,
    headers: { ...options.headers, ...(token ? { Authorization: `Bearer ${token}` } : {}) },
  });
}

// ============ Types ============

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

export interface AdminUser {
  id: number;
  username: string;
  displayName: string;
  isActive: boolean;
  lastLoginAt: string | null;
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

// ============ Public API ============

export async function fetchLatestNews(limit: number = 50): Promise<NewsItem[]> {
  return apiFetch<NewsItem[]>(`/news?action=list&limit=${limit}`);
}

export async function fetchLatestNewsFiltered(limit: number = 50): Promise<NewsItem[]> {
  return apiFetch<NewsItem[]>(`/news?action=list&limit=${limit}&filtered=true`);
}

export async function fetchNewsByCategory(category: string, limit: number = 20): Promise<NewsItem[]> {
  return apiFetch<NewsItem[]>(`/news?action=by-category&category=${encodeURIComponent(category)}&limit=${limit}`);
}

export async function fetchNewsByDate(date: string): Promise<NewsItem[]> {
  return apiFetch<NewsItem[]>(`/news?action=by-date&date=${encodeURIComponent(date)}`);
}

export async function fetchNewsBySource(sourceCode: string, limit: number = 20): Promise<NewsItem[]> {
  return apiFetch<NewsItem[]>(`/news?action=by-source&source=${encodeURIComponent(sourceCode)}&limit=${limit}`);
}

export async function fetchNewsBySeries(seriesId: number, limit: number = 50): Promise<NewsItem[]> {
  return apiFetch<NewsItem[]>(`/news?action=by-series&seriesId=${seriesId}&limit=${limit}`);
}

export async function fetchNewsById(id: string): Promise<NewsDetail | null> {
  try {
    return await apiFetch<NewsDetail>(`/news?action=detail&id=${id}`);
  } catch {
    return null;
  }
}

export async function fetchRelatedNews(newsId: string, clusterId: string | null, category: string, limit: number = 6): Promise<NewsItem[]> {
  const params = new URLSearchParams({ action: 'related', newsId, limit: String(limit) });
  if (clusterId) params.set('clusterId', clusterId);
  if (category) params.set('category', category);
  return apiFetch<NewsItem[]>(`/news?${params}`);
}

export async function searchNews(query: string, limit: number = 20): Promise<NewsItem[]> {
  return apiFetch<NewsItem[]>(`/news?action=search&q=${encodeURIComponent(query)}&limit=${limit}`);
}

export async function fetchAllDates(): Promise<string[]> {
  return apiFetch<string[]>('/news?action=dates');
}

export async function fetchStats(): Promise<Stats> {
  return apiFetch<Stats>('/stats');
}

export async function fetchStatsBySeries(seriesId: number | null): Promise<Stats> {
  return apiFetch<Stats>(seriesId !== null ? `/stats?seriesId=${seriesId}` : '/stats');
}

export async function fetchDailyStats(days: number = 7): Promise<DailyStat[]> {
  return apiFetch<DailyStat[]>(`/stats?action=daily&days=${days}`);
}

export async function fetchDailyStatsBySeries(days: number = 7, seriesId: number | null): Promise<DailyStat[]> {
  const params = new URLSearchParams({ action: 'daily', days: String(days) });
  if (seriesId !== null) params.set('seriesId', String(seriesId));
  return apiFetch<DailyStat[]>(`/stats?${params}`);
}

export async function fetchNewsSeries(): Promise<NewsSeries[]> {
  return apiFetch<NewsSeries[]>('/series');
}

// ============ Admin API ============

export async function verifyAdminLogin(username: string, password: string): Promise<AdminUser | null> {
  try {
    const response = await apiFetch<{ token: string; user: AdminUser }>('/portal?action=login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    });
    setSessionToken(response.token);
    return response.user;
  } catch {
    return null;
  }
}

export async function adminLogout(): Promise<void> {
  try {
    await authFetch('/portal?action=logout', { method: 'POST' });
  } finally {
    clearSessionToken();
  }
}

export async function validateAdminSession(): Promise<AdminUser | null> {
  try {
    const response = await authFetch<{ user: AdminUser }>('/portal?action=verify');
    return response.user;
  } catch {
    clearSessionToken();
    return null;
  }
}

export async function fetchNewsForAdmin(limit: number = 50, includeDisabled: boolean = true, offset: number = 0): Promise<NewsItemWithSimilarity[]> {
  return authFetch<NewsItemWithSimilarity[]>(`/portal?action=news-list&limit=${limit}&offset=${offset}&includeDisabled=${includeDisabled}`);
}

export async function fetchNewsForAdminBySeries(limit: number = 50, includeDisabled: boolean = true, offset: number = 0, seriesId: number | null): Promise<NewsItemWithSimilarity[]> {
  const params = new URLSearchParams({ action: 'news-list', limit: String(limit), offset: String(offset), includeDisabled: String(includeDisabled) });
  if (seriesId !== null) params.set('seriesId', String(seriesId));
  return authFetch<NewsItemWithSimilarity[]>(`/portal?${params}`);
}

export async function fetchNewsCountForAdmin(includeDisabled: boolean = true): Promise<number> {
  const response = await authFetch<{ count: number }>(`/portal?action=news-count&includeDisabled=${includeDisabled}`);
  return response.count;
}

export async function fetchNewsCountForAdminBySeries(includeDisabled: boolean = true, seriesId: number | null): Promise<number> {
  const params = new URLSearchParams({ action: 'news-count', includeDisabled: String(includeDisabled) });
  if (seriesId !== null) params.set('seriesId', String(seriesId));
  const response = await authFetch<{ count: number }>(`/portal?${params}`);
  return response.count;
}

export async function disableNews(articleId: string): Promise<void> {
  await authFetch('/portal?action=news-disable', { method: 'POST', body: JSON.stringify({ articleId }) });
}

export async function enableNews(articleId: string): Promise<void> {
  await authFetch('/portal?action=news-enable', { method: 'POST', body: JSON.stringify({ articleId }) });
}

export async function setNewsSeriesId(articleId: string, seriesId: number | null): Promise<void> {
  await authFetch('/portal?action=news-set-series', { method: 'POST', body: JSON.stringify({ articleId, seriesId }) });
}

export async function getBookmarkPagePosition(articleId: string, pageSize: number = 100, includeDisabled: boolean = true): Promise<number> {
  const response = await authFetch<{ page: number }>(`/portal?action=news-bookmark-position&articleId=${articleId}&pageSize=${pageSize}&includeDisabled=${includeDisabled}`);
  return response.page;
}

export async function createNewsSeries(name: string, description: string | null, color: string, keywords: string[] = [], autoAddEnabled: boolean = true): Promise<number> {
  const response = await authFetch<{ success: boolean; id: number }>('/portal?action=series-create', {
    method: 'POST',
    body: JSON.stringify({ name, description, color, keywords, autoAddEnabled }),
  });
  return response.id;
}

export async function updateNewsSeries(seriesId: number, name: string, description: string | null, color: string, keywords: string[] = [], autoAddEnabled: boolean = true): Promise<void> {
  await authFetch('/portal?action=series-update', {
    method: 'POST',
    body: JSON.stringify({ seriesId, name, description, color, keywords, autoAddEnabled }),
  });
}

export async function deleteNewsSeries(seriesId: number): Promise<void> {
  await authFetch('/portal?action=series-delete', { method: 'POST', body: JSON.stringify({ seriesId }) });
}

export async function fetchPendingReviews(limit: number = 100, offset: number = 0, seriesId: number | null = null, searchQuery: string = ''): Promise<NewsItemWithSimilarity[]> {
  const params = new URLSearchParams({ action: 'review-list', limit: String(limit), offset: String(offset) });
  if (seriesId !== null) params.set('seriesId', String(seriesId));
  if (searchQuery) params.set('q', searchQuery);
  return authFetch<NewsItemWithSimilarity[]>(`/portal?${params}`);
}

export async function fetchPendingReviewsCount(seriesId: number | null = null, searchQuery: string = ''): Promise<number> {
  const params = new URLSearchParams({ action: 'review-count' });
  if (seriesId !== null) params.set('seriesId', String(seriesId));
  if (searchQuery) params.set('q', searchQuery);
  const response = await authFetch<{ count: number }>(`/portal?${params}`);
  return response.count;
}

export async function approveAutoClassified(articleId: string): Promise<void> {
  await authFetch('/portal?action=review-approve', { method: 'POST', body: JSON.stringify({ articleId }) });
}

export async function rejectAutoClassified(articleId: string): Promise<void> {
  await authFetch('/portal?action=review-reject', { method: 'POST', body: JSON.stringify({ articleId }) });
}
