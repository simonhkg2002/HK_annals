/**
 * 資料層 - 重新導出 API 客戶端函數
 *
 * 此檔案現在作為 API 客戶端的薄封裝層，
 * 所有實際的資料操作都通過後端 API 進行。
 */

// 從 API 客戶端重新導出所有類型
export type {
  NewsItem,
  NewsDetail,
  NewsSeries,
  Stats,
  DailyStat,
  AdminUser,
  NewsItemWithSimilarity,
} from './api';

// 從 API 客戶端重新導出所有函數
export {
  // 公開 API
  fetchLatestNews,
  fetchLatestNewsFiltered,
  fetchNewsByCategory,
  fetchNewsByDate,
  fetchNewsBySource,
  fetchNewsBySeries,
  fetchNewsById,
  fetchRelatedNews,
  searchNews,
  fetchAllDates,
  fetchStats,
  fetchStatsBySeries,
  fetchDailyStats,
  fetchDailyStatsBySeries,
  fetchNewsSeries,

  // 管理員 API
  verifyAdminLogin,
  adminLogout,
  validateAdminSession,
  fetchNewsForAdmin,
  fetchNewsForAdminBySeries,
  fetchNewsCountForAdmin,
  fetchNewsCountForAdminBySeries,
  disableNews,
  enableNews,
  setNewsSeriesId,
  getBookmarkPagePosition,
  createNewsSeries,
  updateNewsSeries,
  deleteNewsSeries,
  fetchPendingReviews,
  fetchPendingReviewsCount,
  approveAutoClassified,
  rejectAutoClassified,

  // Session 管理
  setSessionToken,
  clearSessionToken,
} from './api';
