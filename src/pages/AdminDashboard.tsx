import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  fetchNewsForAdmin,
  fetchNewsCountForAdmin,
  fetchNewsForAdminBySeries,
  fetchNewsCountForAdminBySeries,
  fetchStatsBySeries,
  fetchDailyStatsBySeries,
  getBookmarkPagePosition,
  fetchStats,
  fetchDailyStats,
  fetchNewsSeries,
  disableNews,
  enableNews,
  setNewsSeriesId,
  createNewsSeries,
  updateNewsSeries,
  deleteNewsSeries,
  fetchPendingReviews,
  approveAutoClassified,
  rejectAutoClassified,
  AdminUser,
  NewsSeries,
  NewsItemWithSimilarity,
} from '../lib/data';
import { Button, Input, Card, Badge } from '../components/ui/primitives';
import { TagInput } from '../components/TagInput';
import {
  Trash2,
  RefreshCw,
  Search,
  Loader2,
  ExternalLink,
  Eye,
  EyeOff,
  Tag,
  Plus,
  LogOut,
  X,
  Bookmark,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Copy,
  Star,
  FileX,
  FileText,
  Pencil,
  Check,
} from 'lucide-react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { NewsItem } from '../types';
import { format } from 'date-fns';

interface AdminDashboardProps {
  user: AdminUser | null;
  onLogout: () => void;
}

type NewsItemWithAdmin = NewsItemWithSimilarity;

const PAGE_SIZE = 100;
const BOOKMARK_KEY = 'admin_bookmark_article_id';
const STARRED_KEY = 'admin_starred_article_ids';

export const AdminDashboard: React.FC<AdminDashboardProps> = ({ user, onLogout }) => {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');
  const [news, setNews] = useState<NewsItemWithAdmin[]>([]);
  const [series, setSeries] = useState<NewsSeries[]>([]);
  const [selectedSeriesId, setSelectedSeriesId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<{
    totalArticles: number;
    todayArticles: number;
    sources: { name: string; count: number }[];
    categories: { name: string; count: number }[];
  } | null>(null);
  const [dailyStats, setDailyStats] = useState<{ date: string; count: number }[]>([]);
  const [showSeriesModal, setShowSeriesModal] = useState(false);
  const [selectedArticle, setSelectedArticle] = useState<NewsItemWithAdmin | null>(null);
  const [editingSeriesId, setEditingSeriesId] = useState<number | null>(null); // 編輯中的系列 ID
  const [newSeriesName, setNewSeriesName] = useState('');
  const [newSeriesDesc, setNewSeriesDesc] = useState('');
  const [newSeriesColor, setNewSeriesColor] = useState('#3B82F6');
  const [newSeriesKeywords, setNewSeriesKeywords] = useState<string[]>([]); // 關鍵詞列表
  const [newSeriesAutoAdd, setNewSeriesAutoAdd] = useState(true); // 是否啟用自動加入

  // 待複核新聞
  const [pendingReviews, setPendingReviews] = useState<NewsItemWithAdmin[]>([]);

  // 分頁狀態
  const [currentPage, setCurrentPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  // 書籤狀態
  const [bookmarkedArticleId, setBookmarkedArticleId] = useState<string | null>(() => {
    return localStorage.getItem(BOOKMARK_KEY);
  });

  // 星標狀態（可多選）
  const [starredArticleIds, setStarredArticleIds] = useState<Set<string>>(() => {
    const stored = localStorage.getItem(STARRED_KEY);
    return stored ? new Set(JSON.parse(stored)) : new Set();
  });

  // 是否顯示星標收藏
  const [showStarredOnly, setShowStarredOnly] = useState(false);

  // 頁碼輸入狀態
  const [pageInputValue, setPageInputValue] = useState('');

  // 標記是否需要在頁面載入後滾動到書籤
  const [pendingScrollToBookmark, setPendingScrollToBookmark] = useState(false);

  // 如果沒有登入，導向登入頁
  useEffect(() => {
    if (!user) {
      navigate('/admin/login');
    }
  }, [user, navigate]);

  // 載入資料
  useEffect(() => {
    const loadData = async () => {
      if (!user) return;

      setLoading(true);
      try {
        const offset = (currentPage - 1) * PAGE_SIZE;
        const [newsData, countData, statsData, dailyData, seriesData, pendingData] = await Promise.all([
          fetchNewsForAdminBySeries(PAGE_SIZE, true, offset, selectedSeriesId),
          fetchNewsCountForAdminBySeries(true, selectedSeriesId),
          fetchStatsBySeries(selectedSeriesId),
          fetchDailyStatsBySeries(7, selectedSeriesId),
          fetchNewsSeries(),
          fetchPendingReviews(20, 0, null, ''), // 載入前 20 筆待複核
        ]);
        setNews(newsData);
        setTotalCount(countData);
        setStats(statsData);
        setDailyStats(dailyData);
        setSeries(seriesData);
        setPendingReviews(pendingData);
      } catch (error) {
        console.error('Failed to fetch data:', error);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, [user, currentPage, selectedSeriesId]);

  // 計算總頁數
  const totalPages = Math.ceil(totalCount / PAGE_SIZE);

  // 當資料載入完成且需要滾動到書籤時執行滾動
  useEffect(() => {
    if (pendingScrollToBookmark && !loading && bookmarkedArticleId) {
      const scrollToBookmark = () => {
        const bookmarkedRow = document.getElementById(`article-row-${bookmarkedArticleId}`);
        if (bookmarkedRow) {
          bookmarkedRow.scrollIntoView({ behavior: 'smooth', block: 'center' });
          // 添加高亮動畫效果
          bookmarkedRow.classList.add('bookmark-highlight');
          setTimeout(() => {
            bookmarkedRow.classList.remove('bookmark-highlight');
          }, 2000);
        }
      };
      // 延遲執行確保 DOM 已渲染
      setTimeout(scrollToBookmark, 150);
      setPendingScrollToBookmark(false);
    }
  }, [pendingScrollToBookmark, loading, bookmarkedArticleId]);

  // 分頁操作
  const goToPage = (page: number) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  // 設定書籤
  const handleSetBookmark = (articleId: string) => {
    if (bookmarkedArticleId === articleId) {
      // 如果點擊的是當前書籤，則移除
      localStorage.removeItem(BOOKMARK_KEY);
      setBookmarkedArticleId(null);
    } else {
      // 設定新書籤
      localStorage.setItem(BOOKMARK_KEY, articleId);
      setBookmarkedArticleId(articleId);
    }
  };

  // 滾動到書籤記錄
  const scrollToBookmarkedRow = () => {
    if (!bookmarkedArticleId) return;

    // 使用 setTimeout 確保 DOM 已更新
    setTimeout(() => {
      const bookmarkedRow = document.getElementById(`article-row-${bookmarkedArticleId}`);
      if (bookmarkedRow) {
        bookmarkedRow.scrollIntoView({ behavior: 'smooth', block: 'center' });
        // 添加高亮動畫效果
        bookmarkedRow.classList.add('bookmark-highlight');
        setTimeout(() => {
          bookmarkedRow.classList.remove('bookmark-highlight');
        }, 2000);
      }
    }, 100);
  };

  // 跳轉到書籤位置並滾動到該記錄（直接跳轉）
  const handleJumpToBookmark = async () => {
    if (!bookmarkedArticleId) return;

    try {
      const page = await getBookmarkPagePosition(bookmarkedArticleId, PAGE_SIZE, true);

      if (page === currentPage) {
        // 如果已經在同一頁，直接滾動到該記錄
        scrollToBookmarkedRow();
      } else {
        // 設定頁面，讓 useEffect 處理滾動
        setCurrentPage(page);
        // 標記需要滾動到書籤
        setPendingScrollToBookmark(true);
      }
    } catch (error) {
      console.error('Failed to jump to bookmark:', error);
    }
  };


  // 處理頁碼輸入
  const handlePageInputSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const page = parseInt(pageInputValue, 10);
    if (!isNaN(page) && page >= 1 && page <= totalPages) {
      goToPage(page);
      setPageInputValue('');
    }
  };

  // 切換星標
  const handleToggleStar = (articleId: string) => {
    setStarredArticleIds((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(articleId)) {
        newSet.delete(articleId);
      } else {
        newSet.add(articleId);
      }
      localStorage.setItem(STARRED_KEY, JSON.stringify([...newSet]));
      return newSet;
    });
  };

  // 切換系列過濾
  const handleSeriesChange = (seriesId: number | null) => {
    setSelectedSeriesId(seriesId);
    setCurrentPage(1); // 重置到第一頁
  };

  // 過濾搜尋
  // 過濾搜尋和星標
  const filteredNews = news.filter((n) => {
    // 如果只顯示星標，過濾非星標文章
    if (showStarredOnly && !starredArticleIds.has(n.id)) {
      return false;
    }
    // 搜尋過濾
    if (searchTerm && !n.title.toLowerCase().includes(searchTerm.toLowerCase())) {
      return false;
    }
    return true;
  });

  // 圖表資料
  const chartData = dailyStats
    .map((d) => ({
      name: format(new Date(d.date), 'MM/dd'),
      count: d.count,
    }))
    .reverse();

  const lastUpdate = new Date().toLocaleTimeString('zh-HK', {
    hour: '2-digit',
    minute: '2-digit',
  });

  // 停用/恢復新聞
  const handleToggleDisable = async (item: NewsItemWithAdmin) => {
    if (!user) return;

    try {
      if (item.isDisabled) {
        await enableNews(item.id);
      } else {
        await disableNews(item.id, user.username);
      }
      // 更新本地狀態
      setNews((prev) =>
        prev.map((n) =>
          n.id === item.id ? { ...n, isDisabled: !n.isDisabled } : n
        )
      );
    } catch (error) {
      console.error('Failed to toggle disable:', error);
    }
  };

  // 設定系列
  const handleSetSeries = async (articleId: string, seriesId: number | null) => {
    try {
      await setNewsSeriesId(articleId, seriesId);
      setNews((prev) =>
        prev.map((n) =>
          n.id === articleId ? { ...n, seriesId } : n
        )
      );
      setSelectedArticle(null);
    } catch (error) {
      console.error('Failed to set series:', error);
    }
  };

  // 創建新系列（新建的放在最前面）
  const handleCreateSeries = async () => {
    if (!newSeriesName.trim()) return;

    try {
      const id = await createNewsSeries(
        newSeriesName,
        newSeriesDesc || null,
        newSeriesColor,
        newSeriesKeywords,
        newSeriesAutoAdd
      );
      setSeries((prev) => [
        {
          id,
          name: newSeriesName,
          description: newSeriesDesc || null,
          color: newSeriesColor,
          isActive: true,
          createdAt: new Date().toISOString(),
          keywords: newSeriesKeywords,
          autoAddEnabled: newSeriesAutoAdd,
        },
        ...prev,
      ]);
      setNewSeriesName('');
      setNewSeriesDesc('');
      setNewSeriesColor('#3B82F6');
      setNewSeriesKeywords([]);
      setNewSeriesAutoAdd(true);
      setShowSeriesModal(false);
    } catch (error) {
      console.error('Failed to create series:', error);
    }
  };

  // 更新系列
  const handleUpdateSeries = async () => {
    if (!editingSeriesId || !newSeriesName.trim()) return;

    try {
      await updateNewsSeries(
        editingSeriesId,
        newSeriesName,
        newSeriesDesc || null,
        newSeriesColor,
        newSeriesKeywords,
        newSeriesAutoAdd
      );
      setSeries((prev) =>
        prev.map((s) =>
          s.id === editingSeriesId
            ? {
                ...s,
                name: newSeriesName,
                description: newSeriesDesc || null,
                color: newSeriesColor,
                keywords: newSeriesKeywords,
                autoAddEnabled: newSeriesAutoAdd,
              }
            : s
        )
      );
      setNewSeriesName('');
      setNewSeriesDesc('');
      setNewSeriesColor('#3B82F6');
      setNewSeriesKeywords([]);
      setNewSeriesAutoAdd(true);
      setEditingSeriesId(null);
      setShowSeriesModal(false);
    } catch (error) {
      console.error('Failed to update series:', error);
    }
  };

  // 開啟編輯系列對話框
  const handleEditSeries = (s: NewsSeries) => {
    setEditingSeriesId(s.id);
    setNewSeriesName(s.name);
    setNewSeriesDesc(s.description || '');
    setNewSeriesColor(s.color);
    setNewSeriesKeywords(s.keywords || []);
    setNewSeriesAutoAdd(s.autoAddEnabled !== false);
    setShowSeriesModal(true);
  };

  // 切換系列自動加入狀態
  const handleToggleAutoAdd = async (s: NewsSeries) => {
    try {
      const newAutoAddEnabled = !s.autoAddEnabled;
      await updateNewsSeries(
        s.id,
        s.name,
        s.description,
        s.color,
        s.keywords || [],
        newAutoAddEnabled
      );
      setSeries((prev) =>
        prev.map((series) =>
          series.id === s.id ? { ...series, autoAddEnabled: newAutoAddEnabled } : series
        )
      );
    } catch (error) {
      console.error('Failed to toggle auto add:', error);
    }
  };

  // 刪除系列
  const handleDeleteSeries = async (seriesId: number) => {
    if (!confirm('確定要刪除此系列嗎？使用此系列的新聞將會變為無系列。')) return;

    try {
      await deleteNewsSeries(seriesId);
      setSeries((prev) => prev.filter((s) => s.id !== seriesId));
      // 更新新聞列表中使用此系列的項目
      setNews((prev) =>
        prev.map((n) => (n.seriesId === seriesId ? { ...n, seriesId: null } : n))
      );
    } catch (error) {
      console.error('Failed to delete series:', error);
    }
  };

  // 同意自動分類
  const handleApproveReview = async (articleId: string) => {
    try {
      await approveAutoClassified(articleId);
      setPendingReviews((prev) => prev.filter((n) => n.id !== articleId));
    } catch (error) {
      console.error('Failed to approve:', error);
    }
  };

  // 拒絕自動分類
  const handleRejectReview = async (articleId: string) => {
    try {
      await rejectAutoClassified(articleId);
      setPendingReviews((prev) => prev.filter((n) => n.id !== articleId));
      // 同時從新聞列表中移除系列
      setNews((prev) =>
        prev.map((n) => (n.id === articleId ? { ...n, seriesId: null } : n))
      );
    } catch (error) {
      console.error('Failed to reject:', error);
    }
  };

  if (!user) {
    return null;
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold font-serif">管理後台</h1>
          <p className="text-muted-foreground mt-1">
            歡迎，{user.displayName}
          </p>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sm text-muted-foreground bg-muted px-3 py-1 rounded">
            上次更新: {lastUpdate}
          </span>
          {starredArticleIds.size > 0 && (
            <Button
              variant={showStarredOnly ? 'default' : 'outline'}
              size="sm"
              onClick={() => setShowStarredOnly(!showStarredOnly)}
            >
              <Star className={`mr-2 h-4 w-4 ${showStarredOnly ? 'fill-white' : 'fill-yellow-400 text-yellow-400'}`} />
              星標收藏 ({starredArticleIds.size})
            </Button>
          )}
          {bookmarkedArticleId && (
            <Button variant="outline" size="sm" onClick={handleJumpToBookmark}>
              <Bookmark className="mr-2 h-4 w-4 fill-amber-500 text-amber-500" /> 跳至書籤
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={() => window.location.reload()}>
            <RefreshCw className="mr-2 h-4 w-4" /> 重新載入
          </Button>
          <Button variant="ghost" size="sm" onClick={onLogout}>
            <LogOut className="mr-2 h-4 w-4" /> 登出
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <>
          {/* 統計卡片 */}
          <div className="grid grid-cols-1 md:grid-cols-5 gap-6 mb-8">
            <Card className="p-6">
              <h3 className="text-sm font-medium text-muted-foreground mb-2">總新聞數</h3>
              <div className="text-3xl font-bold">{stats?.totalArticles ?? 0}</div>
            </Card>
            <Card className="p-6">
              <h3 className="text-sm font-medium text-muted-foreground mb-2">今日新增</h3>
              <div className="text-3xl font-bold text-green-600">
                +{stats?.todayArticles ?? 0}
              </div>
            </Card>
            <Card className="p-6">
              <h3 className="text-sm font-medium text-muted-foreground mb-2">新聞系列</h3>
              <div className="text-3xl font-bold">{series.length}</div>
            </Card>
            <Card className="p-6">
              <h3 className="text-sm font-medium text-muted-foreground mb-2">本頁相似文章</h3>
              <div className="text-3xl font-bold text-rose-500">
                {news.filter(n => n.isSimilarDuplicate).length}
              </div>
              <p className="text-xs text-muted-foreground mt-1">±6小時內相似</p>
            </Card>
            <Card className="p-6">
              <h3 className="text-sm font-medium text-muted-foreground mb-2">系統狀態</h3>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-green-500 animate-pulse"></div>
                <span className="font-bold">正常運作</span>
              </div>
            </Card>
          </div>

          {/* 圖表和系列管理 */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-8">
            <Card className="col-span-2 p-6">
              <h3 className="font-bold mb-4">
                過去 7 天爬取趨勢
                {selectedSeriesId && (
                  <span className="text-sm font-normal text-muted-foreground ml-2">
                    - {series.find(s => s.id === selectedSeriesId)?.name}
                  </span>
                )}
              </h3>
              <div className="h-[200px] w-full">
                {chartData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                      <XAxis dataKey="name" tick={{ fontSize: 12 }} stroke="#888888" />
                      <YAxis tick={{ fontSize: 12 }} stroke="#888888" />
                      <Tooltip
                        contentStyle={{
                          borderRadius: '8px',
                          border: 'none',
                          boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                        }}
                      />
                      <Line
                        type="monotone"
                        dataKey="count"
                        stroke="#1E40AF"
                        strokeWidth={2}
                        activeDot={{ r: 8 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex items-center justify-center h-full text-muted-foreground">
                    暫無資料
                  </div>
                )}
              </div>
            </Card>
            <Card className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold">新聞系列</h3>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowSeriesModal(true)}
                >
                  <Plus className="w-4 h-4 mr-1" /> 新增
                </Button>
              </div>
              <div className="space-y-3">
                {series.map((s) => (
                  <div
                    key={s.id}
                    className="flex items-start gap-2 p-2 rounded-lg hover:bg-muted/50 group"
                  >
                    <div
                      className="w-3 h-3 rounded-full mt-1"
                      style={{ backgroundColor: s.color }}
                    ></div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{s.name}</span>
                      </div>
                      {s.description && (
                        <p className="text-xs text-muted-foreground truncate">
                          {s.description}
                        </p>
                      )}
                      {s.keywords && s.keywords.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1">
                          {s.keywords.map((kw, i) => (
                            <span key={i} className="text-xs bg-muted px-1.5 py-0.5 rounded">
                              {kw}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                    {/* 自動加入開關 */}
                    <div className="flex items-center gap-1" title="自動加入">
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={s.autoAddEnabled !== false}
                          onChange={() => handleToggleAutoAdd(s)}
                          className="sr-only peer"
                        />
                        <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600"></div>
                      </label>
                    </div>
                    <button
                      onClick={() => handleEditSeries(s)}
                      className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-blue-100 text-muted-foreground hover:text-blue-600 transition-all"
                      title="編輯系列"
                    >
                      <Pencil size={14} />
                    </button>
                    <button
                      onClick={() => handleDeleteSeries(s.id)}
                      className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-red-100 text-muted-foreground hover:text-red-600 transition-all"
                      title="刪除系列"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
                {series.length === 0 && (
                  <p className="text-sm text-muted-foreground">暫無系列</p>
                )}
              </div>
            </Card>

            {/* 待複核區域 */}
            <Card className="p-6 border-amber-200 bg-amber-50/50">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-amber-900">待複核新聞</h3>
                  <Badge className="bg-amber-500">{pendingReviews.length}</Badge>
                </div>
                <p className="text-sm text-amber-700">自動分類的新聞需要人工確認</p>
              </div>

              {pendingReviews.length === 0 ? (
                <div className="text-center py-8 text-amber-700">
                  <p className="text-sm">目前沒有待複核的新聞</p>
                  <p className="text-xs text-amber-600 mt-1">自動分類的新聞會顯示在這裡</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {pendingReviews.map((item) => {
                    const seriesInfo = series.find((s) => s.id === item.seriesId);
                    return (
                      <div
                        key={item.id}
                        className="flex items-start gap-4 p-4 bg-white rounded-lg border border-amber-200"
                      >
                        <div className="flex-1 min-w-0">
                          <h4 className="font-medium mb-2 line-clamp-2">{item.title}</h4>
                          <div className="flex flex-wrap items-center gap-2 text-sm">
                            <Badge
                              variant="outline"
                              style={{ borderColor: sourceColors[item.source] || '#6B7280' }}
                            >
                              {item.source}
                            </Badge>
                            {seriesInfo && (
                              <Badge style={{ backgroundColor: seriesInfo.color, color: 'white' }}>
                                → {seriesInfo.name}
                              </Badge>
                            )}
                            <span className="text-muted-foreground">
                              {new Date(item.publishedAt).toLocaleString('zh-HK', {
                                month: 'short',
                                day: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </span>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            onClick={() => handleApproveReview(item.id)}
                            className="bg-green-600 hover:bg-green-700 whitespace-nowrap"
                          >
                            <Check className="w-4 h-4 mr-1" /> 同意
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleRejectReview(item.id)}
                            className="border-red-600 text-red-600 hover:bg-red-50 whitespace-nowrap"
                          >
                            <X className="w-4 h-4 mr-1" /> 拒絕
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </Card>
          </div>

          {/* 新聞列表 */}
          <Card className="overflow-hidden">
            <div className="p-4 border-b flex flex-col gap-4 bg-muted/20">
              {/* 搜尋和基本資訊 */}
              <div className="flex flex-col md:flex-row justify-between items-center gap-4">
                <div className="flex items-center gap-3 w-full md:w-auto">
                  {/* 系列選擇器 */}
                  <select
                    value={selectedSeriesId ?? ''}
                    onChange={(e) => handleSeriesChange(e.target.value ? Number(e.target.value) : null)}
                    className="px-3 py-2 border rounded-md bg-background text-sm min-w-[140px]"
                  >
                    <option value="">全部新聞</option>
                    {series.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>

                  {/* 搜尋框 */}
                  <div className="relative w-full md:w-auto">
                    <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="搜尋標題..."
                      className="pl-8 w-full md:w-[300px]"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                    />
                  </div>
                </div>
                <div className="text-sm text-muted-foreground flex items-center gap-4">
                  <span>顯示 {filteredNews.length} 筆</span>
                  {selectedSeriesId && (
                    <span className="flex items-center gap-1 text-brand-blue font-medium">
                      系列：{series.find(s => s.id === selectedSeriesId)?.name}
                    </span>
                  )}
                  {bookmarkedArticleId && (
                    <span className="flex items-center gap-1 text-amber-600">
                      <Bookmark size={14} className="fill-amber-500" />
                      已設書籤
                    </span>
                  )}
                </div>
              </div>
              {/* 頂部分頁控件 */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-2 border-t border-muted">
                <div className="text-sm text-muted-foreground">
                  第 {currentPage} 頁，共 {totalPages} 頁（{totalCount} 筆）
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => goToPage(1)}
                    disabled={currentPage === 1}
                  >
                    <ChevronsLeft className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => goToPage(currentPage - 1)}
                    disabled={currentPage === 1}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <form onSubmit={handlePageInputSubmit} className="flex items-center gap-1">
                    <Input
                      type="number"
                      min={1}
                      max={totalPages}
                      value={pageInputValue}
                      onChange={(e) => setPageInputValue(e.target.value)}
                      placeholder={String(currentPage)}
                      className="w-16 h-8 text-center text-sm"
                    />
                    <span className="text-sm text-muted-foreground">/ {totalPages}</span>
                    <Button type="submit" variant="outline" size="sm" className="ml-1">
                      跳轉
                    </Button>
                  </form>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => goToPage(currentPage + 1)}
                    disabled={currentPage === totalPages}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => goToPage(totalPages)}
                    disabled={currentPage === totalPages}
                  >
                    <ChevronsRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="text-xs text-muted-foreground uppercase bg-muted/50">
                  <tr>
                    <th className="px-4 py-3">狀態</th>
                    <th className="px-4 py-3 text-center">封面</th>
                    <th className="px-4 py-3">標題</th>
                    <th className="px-4 py-3">來源</th>
                    <th className="px-4 py-3">系列</th>
                    <th className="px-4 py-3">發布時間</th>
                    <th className="px-4 py-3 text-right">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredNews.map((item) => (
                    <tr
                      key={item.id}
                      id={`article-row-${item.id}`}
                      className={`border-b hover:bg-muted/30 transition-colors ${
                        item.isDisabled
                          ? 'bg-red-50/50 opacity-60'
                          : item.isSimilarDuplicate
                          ? 'bg-rose-50/70 border-l-4 border-l-rose-300'
                          : bookmarkedArticleId === item.id
                          ? 'bg-amber-50/50 border-l-4 border-l-amber-500'
                          : 'bg-background'
                      }`}
                      title={item.isSimilarDuplicate ? `與其他文章相似（優先顯示高優先級來源）` : undefined}
                    >
                      <td className="px-4 py-4">
                        <div className="flex flex-col gap-1">
                          {item.isDisabled ? (
                            <Badge variant="destructive" className="text-xs">
                              已停用
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-xs text-green-600 border-green-600">
                              顯示中
                            </Badge>
                          )}
                          {item.isSimilarDuplicate && (
                            <Badge className="text-xs bg-rose-100 text-rose-700 border-rose-300">
                              相似
                            </Badge>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-4 text-center">
                        {item.hasThumbnail ? (
                          <FileText size={18} className="mx-auto text-green-500" title="有封面圖像" />
                        ) : (
                          <FileX size={18} className="mx-auto text-red-500" title="無封面圖像" />
                        )}
                      </td>
                      <td
                        className="px-4 py-4 font-medium max-w-[300px] truncate"
                        title={item.title}
                      >
                        {item.title}
                      </td>
                      <td className="px-4 py-4">
                        <Badge variant="outline">{item.source}</Badge>
                      </td>
                      <td className="px-4 py-4">
                        {item.seriesId ? (
                          <Badge
                            style={{
                              backgroundColor:
                                series.find((s) => s.id === item.seriesId)?.color || '#888',
                              color: 'white',
                            }}
                          >
                            {series.find((s) => s.id === item.seriesId)?.name || '未知'}
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground text-xs">-</span>
                        )}
                      </td>
                      <td className="px-4 py-4 text-muted-foreground">
                        {format(new Date(item.publishedAt), 'yyyy-MM-dd HH:mm')}
                      </td>
                      <td className="px-4 py-4 text-right">
                        <div className="flex justify-end gap-2">
                          <button
                            className={`p-1.5 rounded hover:bg-muted ${
                              starredArticleIds.has(item.id)
                                ? 'text-yellow-500'
                                : 'text-muted-foreground hover:text-yellow-500'
                            }`}
                            title={starredArticleIds.has(item.id) ? '取消星標' : '加入星標收藏'}
                            onClick={() => handleToggleStar(item.id)}
                          >
                            <Star
                              size={16}
                              className={starredArticleIds.has(item.id) ? 'fill-yellow-400' : ''}
                            />
                          </button>
                          <button
                            className={`p-1.5 rounded hover:bg-muted ${
                              bookmarkedArticleId === item.id
                                ? 'text-amber-500'
                                : 'text-muted-foreground hover:text-amber-500'
                            }`}
                            title={bookmarkedArticleId === item.id ? '移除書籤' : '設為書籤（標記閱讀位置）'}
                            onClick={() => handleSetBookmark(item.id)}
                          >
                            <Bookmark
                              size={16}
                              className={bookmarkedArticleId === item.id ? 'fill-amber-500' : ''}
                            />
                          </button>
                          <a
                            href={item.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-brand-blue"
                            title="開啟原文"
                          >
                            <ExternalLink size={16} />
                          </a>
                          <button
                            className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-brand-gold"
                            title="設定系列"
                            onClick={() => setSelectedArticle(item)}
                          >
                            <Tag size={16} />
                          </button>
                          <button
                            className={`p-1.5 rounded hover:bg-muted ${
                              item.isDisabled
                                ? 'text-green-600 hover:text-green-700'
                                : 'text-muted-foreground hover:text-red-600'
                            }`}
                            title={item.isDisabled ? '恢復顯示' : '停用新聞'}
                            onClick={() => handleToggleDisable(item)}
                          >
                            {item.isDisabled ? <Eye size={16} /> : <EyeOff size={16} />}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="p-4 border-t flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="text-sm text-muted-foreground">
                第 {currentPage} 頁，共 {totalPages} 頁（{totalCount} 筆）
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => goToPage(1)}
                  disabled={currentPage === 1}
                >
                  <ChevronsLeft className="h-4 w-4 mr-1" />
                  首頁
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => goToPage(currentPage - 1)}
                  disabled={currentPage === 1}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <form onSubmit={handlePageInputSubmit} className="flex items-center gap-1">
                  <Input
                    type="number"
                    min={1}
                    max={totalPages}
                    value={pageInputValue}
                    onChange={(e) => setPageInputValue(e.target.value)}
                    placeholder={String(currentPage)}
                    className="w-16 h-8 text-center text-sm"
                  />
                  <span className="text-sm text-muted-foreground">/ {totalPages}</span>
                  <Button type="submit" variant="outline" size="sm" className="ml-1">
                    跳轉
                  </Button>
                </form>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => goToPage(currentPage + 1)}
                  disabled={currentPage === totalPages}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => goToPage(totalPages)}
                  disabled={currentPage === totalPages}
                >
                  末頁
                  <ChevronsRight className="h-4 w-4 ml-1" />
                </Button>
              </div>
            </div>
          </Card>
        </>
      )}

      {/* 系列選擇 Modal */}
      {selectedArticle && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <Card className="w-full max-w-md p-6 m-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold">設定新聞系列</h3>
              <button
                onClick={() => setSelectedArticle(null)}
                className="text-muted-foreground hover:text-foreground"
              >
                <X size={20} />
              </button>
            </div>
            <p className="text-sm text-muted-foreground mb-4 truncate">
              {selectedArticle.title}
            </p>
            <div className="space-y-2">
              <button
                className="w-full p-3 text-left rounded-lg border hover:bg-muted/50 flex items-center gap-2"
                onClick={() => handleSetSeries(selectedArticle.id, null)}
              >
                <div className="w-3 h-3 rounded-full bg-gray-300"></div>
                <span>無系列</span>
              </button>
              {series.map((s) => (
                <button
                  key={s.id}
                  className={`w-full p-3 text-left rounded-lg border hover:bg-muted/50 flex items-center gap-2 ${
                    selectedArticle.seriesId === s.id ? 'border-brand-blue bg-brand-blue/5' : ''
                  }`}
                  onClick={() => handleSetSeries(selectedArticle.id, s.id)}
                >
                  <div
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: s.color }}
                  ></div>
                  <span>{s.name}</span>
                  {s.description && (
                    <span className="text-xs text-muted-foreground ml-auto">
                      {s.description}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </Card>
        </div>
      )}

      {/* 新增/編輯系列 Modal */}
      {showSeriesModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <Card className="w-full max-w-md p-6 m-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold">{editingSeriesId ? '編輯' : '新增'}新聞系列</h3>
              <button
                onClick={() => {
                  setShowSeriesModal(false);
                  setEditingSeriesId(null);
                  setNewSeriesName('');
                  setNewSeriesDesc('');
                  setNewSeriesColor('#3B82F6');
                  setNewSeriesKeywords([]);
                  setNewSeriesAutoAdd(true);
                }}
                className="text-muted-foreground hover:text-foreground"
              >
                <X size={20} />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium">系列名稱</label>
                <Input
                  placeholder="例如：北部都會區"
                  value={newSeriesName}
                  onChange={(e) => setNewSeriesName(e.target.value)}
                  className="mt-1"
                />
              </div>
              <div>
                <label className="text-sm font-medium">描述（選填）</label>
                <Input
                  placeholder="簡短描述此系列"
                  value={newSeriesDesc}
                  onChange={(e) => setNewSeriesDesc(e.target.value)}
                  className="mt-1"
                />
              </div>
              <div>
                <label className="text-sm font-medium">顏色</label>
                {/* 預設顏色選項 */}
                <div className="flex flex-wrap gap-2 mt-2 mb-3">
                  {[
                    '#3B82F6', // 藍色
                    '#EF4444', // 紅色
                    '#10B981', // 綠色
                    '#F59E0B', // 橙色
                    '#8B5CF6', // 紫色
                    '#EC4899', // 粉紅
                    '#06B6D4', // 青色
                    '#6366F1', // 靛藍
                  ].map((color) => (
                    <button
                      key={color}
                      type="button"
                      onClick={() => setNewSeriesColor(color)}
                      className={`w-8 h-8 rounded-full border-2 transition-all hover:scale-110 ${
                        newSeriesColor === color
                          ? 'border-foreground ring-2 ring-offset-2 ring-foreground/30'
                          : 'border-transparent'
                      }`}
                      style={{ backgroundColor: color }}
                      title={color}
                    />
                  ))}
                </div>
                {/* 自訂顏色 */}
                <div className="flex items-center gap-2">
                  <div className="relative">
                    <input
                      type="color"
                      value={newSeriesColor}
                      onChange={(e) => setNewSeriesColor(e.target.value)}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    />
                    <div
                      className="w-10 h-10 rounded-lg border-2 border-muted cursor-pointer"
                      style={{ backgroundColor: newSeriesColor }}
                    />
                  </div>
                  <Input
                    value={newSeriesColor}
                    onChange={(e) => setNewSeriesColor(e.target.value)}
                    placeholder="#000000"
                    className="flex-1 font-mono"
                  />
                </div>
              </div>

              {/* 關鍵詞輸入 */}
              <div>
                <label className="text-sm font-medium">關鍵詞（自動分類用）</label>
                <p className="text-xs text-muted-foreground mb-2">
                  輸入關鍵詞後按 Enter 新增。標題包含任一關鍵詞的新聞將自動加入此系列。
                </p>
                <TagInput
                  tags={newSeriesKeywords}
                  onChange={setNewSeriesKeywords}
                  placeholder="例如：大火、示威、北都..."
                />
              </div>

              <div className="flex gap-2 pt-2">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => {
                    setShowSeriesModal(false);
                    setEditingSeriesId(null);
                    setNewSeriesName('');
                    setNewSeriesDesc('');
                    setNewSeriesColor('#3B82F6');
                    setNewSeriesKeywords([]);
                    setNewSeriesAutoAdd(true);
                  }}
                >
                  取消
                </Button>
                <Button
                  className="flex-1"
                  onClick={editingSeriesId ? handleUpdateSeries : handleCreateSeries}
                  disabled={!newSeriesName.trim()}
                >
                  {editingSeriesId ? '更新' : '新增'}
                </Button>
              </div>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
};

// 保留舊版供向後兼容
export const AdminDashboardLegacy = AdminDashboard;
