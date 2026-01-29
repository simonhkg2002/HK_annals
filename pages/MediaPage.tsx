import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { fetchNewsBySource, fetchStats } from '../lib/data';
import { NewsCard } from '../components/NewsCard';
import { Loader2 } from 'lucide-react';
import { NewsItem } from '../types';
import { cn } from '../lib/utils';

// 媒體來源配置
const MEDIA_SOURCES = [
  {
    code: 'hk01',
    name: '香港01',
    shortName: 'HK01',
    color: 'bg-blue-600',
    logo: '01',
    description: '香港數碼媒體',
    website: 'https://www.hk01.com',
  },
  {
    code: 'rthk',
    name: '香港電台',
    shortName: 'RTHK',
    color: 'bg-red-600',
    logo: 'RTHK',
    description: '香港公共廣播機構',
    website: 'https://news.rthk.hk',
  },
  {
    code: 'mingpao',
    name: '明報',
    shortName: '明報',
    color: 'bg-sky-600',
    logo: '明',
    description: '香港傳統報章媒體',
    website: 'https://news.mingpao.com',
  },
];

export const MediaPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [news, setNews] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<{ name: string; count: number }[]>([]);

  // 從 URL 獲取當前選擇的媒體
  const currentCode = searchParams.get('source') || 'hk01';
  const currentSource = MEDIA_SOURCES.find((s) => s.code === currentCode) || MEDIA_SOURCES[0];

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        const [newsData, statsData] = await Promise.all([
          fetchNewsBySource(currentCode, 30),
          fetchStats(),
        ]);
        setNews(newsData);
        setStats(statsData.sources);
      } catch (error) {
        console.error('Failed to fetch news:', error);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, [currentCode]);

  const handleSourceChange = (code: string) => {
    setSearchParams({ source: code });
  };

  const sourceStats = stats.find((s) =>
    s.name === currentSource.name ||
    s.name.includes(currentSource.shortName)
  );
  const totalCount = sourceStats?.count ?? news.length;

  return (
    <div>
      {/* 媒體選擇器 */}
      <div className="bg-muted/30 border-b">
        <div className="container mx-auto px-4">
          <div className="flex gap-1 overflow-x-auto py-4">
            {MEDIA_SOURCES.map((source) => (
              <button
                key={source.code}
                onClick={() => handleSourceChange(source.code)}
                className={cn(
                  'flex items-center gap-3 px-6 py-3 rounded-lg transition-all whitespace-nowrap',
                  currentCode === source.code
                    ? 'bg-background shadow-md border-2 border-foreground/20'
                    : 'hover:bg-background/50'
                )}
              >
                <div
                  className={cn(
                    'w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm',
                    source.color
                  )}
                >
                  {source.logo}
                </div>
                <div className="text-left">
                  <div className="font-medium">{source.name}</div>
                  <div className="text-xs text-muted-foreground">{source.shortName}</div>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* 媒體頭部 */}
      <div className="bg-muted/30 py-12 md:py-16">
        <div className="container mx-auto px-4 text-center">
          <div
            className={cn(
              'inline-flex items-center justify-center w-20 h-20 rounded-full text-white font-serif font-bold text-2xl mb-6 shadow-lg',
              currentSource.color
            )}
          >
            {currentSource.logo}
          </div>
          <h1 className="text-4xl font-serif font-bold mb-2">{currentSource.name}</h1>
          <p className="text-muted-foreground mb-4">{currentSource.description}</p>
          <div className="flex items-center justify-center gap-4 text-sm text-muted-foreground">
            <span className="bg-background px-3 py-1 rounded-full border shadow-sm">
              總計 {totalCount} 則新聞
            </span>
            <span className="bg-background px-3 py-1 rounded-full border shadow-sm">
              資料起始：2026-01-01
            </span>
            <a
              href={currentSource.website}
              target="_blank"
              rel="noopener noreferrer"
              className="bg-background px-3 py-1 rounded-full border shadow-sm hover:bg-muted transition-colors"
            >
              官方網站 ↗
            </a>
          </div>
        </div>
      </div>

      {/* 新聞列表 */}
      <div className="container mx-auto px-4 py-8">
        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
          </div>
        ) : news.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {news.map((item) => (
              <NewsCard key={item.id} news={item} />
            ))}
          </div>
        ) : (
          <div className="text-center py-12">
            <p className="text-muted-foreground mb-2">暫無此媒體的新聞</p>
            <p className="text-sm text-muted-foreground">
              {currentSource.shortName} 的資料將從 2026-01-01 開始收集
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
