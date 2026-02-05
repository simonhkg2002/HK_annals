/**
 * 人工複核隊列頁面
 * 用於審核自動分類到系列的新聞
 */

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  fetchPendingReviews,
  fetchPendingReviewsCount,
  fetchNewsSeries,
  approveAutoClassified,
  rejectAutoClassified,
  AdminUser,
  NewsSeries,
  NewsItemWithSimilarity,
} from '../lib/data';
import { Button, Input, Card, Badge } from '../components/ui/primitives';
import {
  Search,
  Loader2,
  Check,
  X,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  ExternalLink,
  LogOut,
} from 'lucide-react';
import { sourceColors } from '../lib/utils';

const PAGE_SIZE = 50;

export const ReviewQueue: React.FC = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState<AdminUser | null>(() => {
    const stored = localStorage.getItem('hk_portal_session');
    return stored ? JSON.parse(stored) : null;
  });

  const [news, setNews] = useState<NewsItemWithSimilarity[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [selectedSeriesId, setSelectedSeriesId] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [series, setSeries] = useState<NewsSeries[]>([]);

  // 如果沒有登入，導向登入頁
  useEffect(() => {
    if (!user) {
      navigate('/portal_9f3k2m');
    }
  }, [user, navigate]);

  // 載入資料
  useEffect(() => {
    const loadData = async () => {
      if (!user) return;

      setLoading(true);
      try {
        const offset = (currentPage - 1) * PAGE_SIZE;
        const [newsData, countData, seriesData] = await Promise.all([
          fetchPendingReviews(PAGE_SIZE, offset, selectedSeriesId, searchQuery),
          fetchPendingReviewsCount(selectedSeriesId, searchQuery),
          fetchNewsSeries(),
        ]);

        setNews(newsData);
        setTotalCount(countData);
        setSeries(seriesData);
      } catch (error) {
        console.error('Failed to load data:', error);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [user, currentPage, selectedSeriesId, searchQuery]);

  // 處理登出
  const handleLogout = () => {
    localStorage.removeItem('hk_portal_session');
    setUser(null);
    navigate('/portal_9f3k2m');
  };

  // 同意自動分類
  const handleApprove = async (articleId: string) => {
    try {
      await approveAutoClassified(articleId);
      setNews((prev) => prev.filter((n) => n.id !== articleId));
      setTotalCount((prev) => prev - 1);
    } catch (error) {
      console.error('Failed to approve:', error);
    }
  };

  // 拒絕自動分類
  const handleReject = async (articleId: string) => {
    try {
      await rejectAutoClassified(articleId);
      setNews((prev) => prev.filter((n) => n.id !== articleId));
      setTotalCount((prev) => prev - 1);
    } catch (error) {
      console.error('Failed to reject:', error);
    }
  };

  // 分頁控制
  const totalPages = Math.ceil(totalCount / PAGE_SIZE);
  const canGoPrev = currentPage > 1;
  const canGoNext = currentPage < totalPages;

  if (!user) {
    return null; // 等待導向
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <h1 className="text-xl font-bold">人工複核隊列</h1>
            <Badge variant="secondary">{totalCount} 則待審核</Badge>
          </div>
          <div className="flex items-center gap-4">
            <Button variant="outline" size="sm" onClick={() => navigate('/portal_9f3k2m/console')}>
              返回管理頁
            </Button>
            <Button variant="outline" size="sm" onClick={handleLogout}>
              <LogOut className="w-4 h-4 mr-1" /> 登出
            </Button>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8">
        {/* 篩選器 */}
        <Card className="p-4 mb-6">
          <div className="flex flex-col md:flex-row gap-4">
            {/* 搜尋 */}
            <div className="relative flex-1">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="搜尋新聞標題..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setCurrentPage(1);
                }}
                className="pl-9"
              />
            </div>

            {/* 系列篩選 */}
            <select
              value={selectedSeriesId || ''}
              onChange={(e) => {
                setSelectedSeriesId(e.target.value ? Number(e.target.value) : null);
                setCurrentPage(1);
              }}
              className="px-3 py-2 border rounded-md"
            >
              <option value="">所有系列</option>
              {series.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
        </Card>

        {/* 新聞列表 */}
        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
          </div>
        ) : news.length === 0 ? (
          <Card className="p-12 text-center text-muted-foreground">
            <p>沒有待審核的新聞</p>
            <p className="text-sm mt-2">所有自動分類的新聞都已處理完畢</p>
          </Card>
        ) : (
          <div className="space-y-4">
            {news.map((item) => {
              const seriesInfo = series.find((s) => s.id === item.seriesId);
              return (
                <Card key={item.id} className="p-6">
                  <div className="flex gap-4">
                    {/* 內容 */}
                    <div className="flex-1">
                      <div className="flex items-start gap-2 mb-2">
                        <h3 className="text-lg font-medium flex-1">{item.title}</h3>
                        <a
                          href={item.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-muted-foreground hover:text-foreground"
                        >
                          <ExternalLink size={16} />
                        </a>
                      </div>

                      <div className="flex flex-wrap items-center gap-2 mb-3">
                        <Badge
                          variant="outline"
                          style={{ borderColor: sourceColors[item.source] || '#6B7280' }}
                        >
                          {item.source}
                        </Badge>
                        <Badge variant="outline">{item.category}</Badge>
                        {seriesInfo && (
                          <Badge style={{ backgroundColor: seriesInfo.color, color: 'white' }}>
                            {seriesInfo.name}
                          </Badge>
                        )}
                        <span className="text-sm text-muted-foreground">
                          {new Date(item.publishedAt).toLocaleString('zh-HK')}
                        </span>
                      </div>

                      {item.summary && (
                        <p className="text-sm text-muted-foreground line-clamp-2">{item.summary}</p>
                      )}
                    </div>

                    {/* 操作按鈕 */}
                    <div className="flex flex-col gap-2">
                      <Button
                        size="sm"
                        onClick={() => handleApprove(item.id)}
                        className="bg-green-600 hover:bg-green-700"
                      >
                        <Check className="w-4 h-4 mr-1" /> 同意
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleReject(item.id)}
                        className="border-red-600 text-red-600 hover:bg-red-50"
                      >
                        <X className="w-4 h-4 mr-1" /> 拒絕
                      </Button>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        )}

        {/* 分頁控制 */}
        {totalPages > 1 && (
          <div className="mt-8 flex items-center justify-between">
            <div className="text-sm text-muted-foreground">
              顯示第 {(currentPage - 1) * PAGE_SIZE + 1}-
              {Math.min(currentPage * PAGE_SIZE, totalCount)} 則，共 {totalCount} 則
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(1)}
                disabled={!canGoPrev}
              >
                <ChevronsLeft className="w-4 h-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage((p) => p - 1)}
                disabled={!canGoPrev}
              >
                <ChevronLeft className="w-4 h-4" />
              </Button>

              <span className="text-sm px-4">
                第 {currentPage} / {totalPages} 頁
              </span>

              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage((p) => p + 1)}
                disabled={!canGoNext}
              >
                <ChevronRight className="w-4 h-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(totalPages)}
                disabled={!canGoNext}
              >
                <ChevronsRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
