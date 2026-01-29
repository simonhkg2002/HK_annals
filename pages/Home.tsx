import React, { useState, useEffect } from 'react';
import { HeroCarousel } from '../components/HeroCarousel';
import { NewsCard } from '../components/NewsCard';
import { Button } from '../components/ui/primitives';
import { fetchLatestNews, fetchNewsByCategory, fetchStats } from '../lib/data';
import { NewsItem, NewsCategory } from '../types';
import { cn } from '../lib/utils';
import { Loader2 } from 'lucide-react';

const ITEMS_PER_PAGE = 12;

export const Home: React.FC = () => {
  const [activeCategory, setActiveCategory] = useState<NewsCategory | '全部'>('全部');
  const [news, setNews] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [displayCount, setDisplayCount] = useState(ITEMS_PER_PAGE);
  const [stats, setStats] = useState<{
    totalArticles: number;
    todayArticles: number;
    sources: { name: string; count: number }[];
  } | null>(null);

  const categories: (NewsCategory | '全部')[] = ['全部', '港聞', '社會', '政治', '財經', '國際'];

  const categoryCodeMap: Record<string, string> = {
    '港聞': 'local',
    '社會': 'society',
    '政治': 'politics',
    '財經': 'economy',
    '國際': 'international',
    '中國': 'china',
    '體育': 'sports',
    '娛樂': 'entertainment',
  };

  // 載入資料
  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      setDisplayCount(ITEMS_PER_PAGE);
      try {
        if (activeCategory === '全部') {
          const data = await fetchLatestNews(100);
          setNews(data);
        } else {
          const code = categoryCodeMap[activeCategory] || 'local';
          const data = await fetchNewsByCategory(code, 100);
          setNews(data);
        }
      } catch (error) {
        console.error('Failed to fetch news:', error);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [activeCategory]);

  // 載入統計
  useEffect(() => {
    const loadStats = async () => {
      try {
        const data = await fetchStats();
        setStats(data);
      } catch (error) {
        console.error('Failed to fetch stats:', error);
      }
    };
    loadStats();
  }, []);

  // 載入更多
  const handleLoadMore = () => {
    setLoadingMore(true);
    setTimeout(() => {
      setDisplayCount((prev) => prev + ITEMS_PER_PAGE);
      setLoadingMore(false);
    }, 300);
  };

  const heroNews = news.slice(0, 3);
  const gridNews = news.slice(3, displayCount + 3);
  const hasMore = news.length > displayCount + 3;

  const lastUpdate = new Date().toLocaleTimeString('zh-HK', {
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <div className="animate-in fade-in duration-500">
      {loading && news.length === 0 ? (
        <div className="flex items-center justify-center min-h-[400px]">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <>
          <HeroCarousel news={heroNews} />

          <div className="container mx-auto px-4 py-8">
            {/* Stats Bar */}
            <div className="flex flex-col md:flex-row items-center justify-between py-4 border-b mb-8 text-sm text-muted-foreground bg-muted/20 px-4 rounded-md gap-2">
              <span className="font-medium text-foreground">
                今日：{stats?.todayArticles ?? 0} 則新聞
              </span>
              <span className="hidden md:inline">|</span>
              <span>總計：{stats?.totalArticles ?? 0} 則</span>
              <span className="hidden md:inline">|</span>
              <span>最後更新：{lastUpdate}</span>
              <span className="hidden md:inline">|</span>
              <span>來源：{stats?.sources.length ?? 0} 個媒體</span>
            </div>

            {/* Filter */}
            <div className="flex flex-wrap gap-2 mb-8 justify-center md:justify-start sticky top-20 z-40 bg-background/80 backdrop-blur-md p-2 rounded-lg border shadow-sm w-fit">
              {categories.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setActiveCategory(cat)}
                  className={cn(
                    'px-4 py-1.5 rounded-full text-sm font-medium transition-all',
                    activeCategory === cat
                      ? 'bg-foreground text-background shadow-md'
                      : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                  )}
                >
                  {cat}
                </button>
              ))}
            </div>

            {/* Loading indicator */}
            {loading && (
              <div className="flex justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            )}

            {/* Grid */}
            {!loading && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                {gridNews.map((item) => (
                  <NewsCard key={item.id} news={item} />
                ))}
              </div>
            )}

            {/* Empty state */}
            {!loading && gridNews.length === 0 && (
              <div className="text-center py-12 text-muted-foreground">
                暫無此分類的新聞
              </div>
            )}

            {/* Load more */}
            {!loading && hasMore && (
              <div className="mt-12 text-center">
                <Button
                  variant="outline"
                  size="lg"
                  className="min-w-[200px]"
                  onClick={handleLoadMore}
                  disabled={loadingMore}
                >
                  {loadingMore ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      載入中...
                    </>
                  ) : (
                    '載入更多'
                  )}
                </Button>
              </div>
            )}

            {/* No more */}
            {!loading && !hasMore && gridNews.length > 0 && (
              <div className="mt-12 text-center text-sm text-muted-foreground">
                已顯示全部 {news.length} 則新聞
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};
