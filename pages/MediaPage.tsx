import React, { useState, useEffect } from 'react';
import { fetchNewsBySource, fetchStats } from '../lib/data';
import { NewsCard } from '../components/NewsCard';
import { Loader2 } from 'lucide-react';
import { NewsItem } from '../types';

export const MediaPage: React.FC = () => {
  const [news, setNews] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<{ name: string; count: number }[]>([]);

  // 目前只有 HK01
  const source = 'HK01';
  const sourceCode = 'hk01';

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        const [newsData, statsData] = await Promise.all([
          fetchNewsBySource(sourceCode, 30),
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
  }, []);

  const sourceStats = stats.find((s) => s.name === '香港01');
  const totalCount = sourceStats?.count ?? news.length;

  return (
    <div>
      <div className="bg-muted/30 py-12 md:py-20">
        <div className="container mx-auto px-4 text-center">
          <div className="inline-flex items-center justify-center p-4 bg-background rounded-full shadow-lg mb-6">
            <div className="w-16 h-16 bg-blue-600 rounded-full flex items-center justify-center text-white font-serif font-bold text-2xl">
              01
            </div>
          </div>
          <h1 className="text-4xl font-serif font-bold mb-4">{source}</h1>
          <div className="flex items-center justify-center gap-4 text-sm text-muted-foreground">
            <span className="bg-background px-3 py-1 rounded-full border shadow-sm">
              總計 {totalCount} 則新聞
            </span>
            <span className="bg-background px-3 py-1 rounded-full border shadow-sm">
              最新更新：{new Date().toLocaleTimeString('zh-HK', { hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8">
        <div className="flex border-b mb-8 overflow-x-auto">
          {['全部', '社會', '政治', '港聞', '財經'].map((tab, i) => (
            <button
              key={tab}
              className={`px-6 py-3 text-sm font-medium border-b-2 whitespace-nowrap ${
                i === 0
                  ? 'border-brand-blue text-brand-blue'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {news.map((item) => (
              <NewsCard key={item.id} news={item} />
            ))}
          </div>
        )}

        {!loading && news.length === 0 && (
          <div className="text-center py-12 text-muted-foreground">暫無新聞</div>
        )}
      </div>
    </div>
  );
};
