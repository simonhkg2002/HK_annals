import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { NewsItem, NewsSource } from '../types';
import { Badge, Card } from './ui/primitives';
import { ChevronLeft, ChevronRight, Clock } from 'lucide-react';
import { cn, timeAgo, sourceColors } from '../lib/utils';

interface HeroCarouselProps {
  news: NewsItem[];
}

// 來源優先順序配置：HK01(3) > Yahoo(2) > 明報(2) > RTHK(2)
const SOURCE_CONFIG: { source: NewsSource; count: number }[] = [
  { source: 'HK01', count: 3 },
  { source: 'Yahoo新聞', count: 2 },
  { source: '明報', count: 2 },
  { source: 'RTHK', count: 2 },
];

export const HeroCarousel: React.FC<HeroCarouselProps> = ({ news }) => {
  const [current, setCurrent] = useState(0);
  const [isPaused, setIsPaused] = useState(false);

  // 按來源分組新聞
  const groupedNews: Record<string, NewsItem[]> = {};
  for (const item of news) {
    if (!groupedNews[item.source]) {
      groupedNews[item.source] = [];
    }
    groupedNews[item.source].push(item);
  }

  // 獲取各來源的新聞
  const hk01News = (groupedNews['HK01'] || []).slice(0, 3);
  const yahooNews = (groupedNews['Yahoo新聞'] || []).slice(0, 2);
  const mingpaoNews = (groupedNews['明報'] || []).slice(0, 2);
  const rthkNews = (groupedNews['RTHK'] || []).slice(0, 2);

  useEffect(() => {
    if (isPaused || hk01News.length === 0) return;

    const timer = setInterval(() => {
      setCurrent((prev) => (prev + 1) % hk01News.length);
    }, 5000);
    return () => clearInterval(timer);
  }, [hk01News.length, isPaused]);

  const next = () => setCurrent((prev) => (prev + 1) % hk01News.length);
  const prev = () => setCurrent((prev) => (prev - 1 + hk01News.length) % hk01News.length);

  if (!news.length) return null;

  const currentNews = hk01News[current];

  // 渲染來源欄位（右側的 2 篇新聞列表）
  const renderSourceColumn = (
    sourceNews: NewsItem[],
    sourceName: string,
    sourceColor: string
  ) => (
    <div className="flex flex-col h-full">
      <div className={cn('px-2 py-1.5 text-xs font-medium border-b', sourceColor)}>
        {sourceName}
      </div>
      <div className="flex-1 divide-y">
        {sourceNews.length > 0 ? (
          sourceNews.map((item) => (
            <Link
              key={item.id}
              to={`/news/${item.id}`}
              className="block p-2 hover:bg-muted/50 transition-colors group"
            >
              <h4 className="text-sm leading-tight line-clamp-2 group-hover:text-brand-blue transition-colors">
                {item.title}
              </h4>
              <div className="flex items-center gap-1 mt-1.5 text-[11px] text-muted-foreground">
                <Clock size={10} />
                <span>{timeAgo(item.publishedAt)}</span>
              </div>
            </Link>
          ))
        ) : (
          <div className="p-2 text-xs text-muted-foreground">暫無新聞</div>
        )}
      </div>
    </div>
  );

  return (
    <div className="bg-gradient-to-b from-muted/30 to-background">
      <div className="container mx-auto px-4 py-4">
        {/* 9 欄網格: HK01(3) + Yahoo(2) + 明報(2) + RTHK(2) */}
        <div className="grid grid-cols-1 lg:grid-cols-9 gap-3">
          {/* 左側 HK01 輪播區 - 3 欄 */}
          <div
            className="lg:col-span-3"
            onMouseEnter={() => setIsPaused(true)}
            onMouseLeave={() => setIsPaused(false)}
          >
            <Card className="overflow-hidden group relative h-full">
              {/* 圖片區 */}
              <div className="relative aspect-[4/3] bg-muted overflow-hidden">
                {hk01News.map((item, index) => (
                  <Link
                    key={item.id}
                    to={`/news/${item.id}`}
                    className={cn(
                      'absolute inset-0 transition-opacity duration-500',
                      index === current ? 'opacity-100 z-10' : 'opacity-0 z-0'
                    )}
                  >
                    <img
                      src={item.thumbnail || ''}
                      alt={item.title}
                      className="w-full h-full object-cover"
                    />
                    {/* 漸層覆蓋 */}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                  </Link>
                ))}

                {/* 控制按鈕 */}
                {hk01News.length > 1 && (
                  <>
                    <button
                      onClick={prev}
                      className="absolute left-2 top-1/2 -translate-y-1/2 z-20 bg-black/40 hover:bg-black/60 text-white p-1.5 rounded-full backdrop-blur-sm transition-all opacity-0 group-hover:opacity-100"
                    >
                      <ChevronLeft size={18} />
                    </button>
                    <button
                      onClick={next}
                      className="absolute right-2 top-1/2 -translate-y-1/2 z-20 bg-black/40 hover:bg-black/60 text-white p-1.5 rounded-full backdrop-blur-sm transition-all opacity-0 group-hover:opacity-100"
                    >
                      <ChevronRight size={18} />
                    </button>
                  </>
                )}

                {/* 來源標籤 */}
                <div className="absolute top-2 left-2 z-20">
                  <Badge className={cn('text-xs shadow-md', sourceColors['HK01'])}>
                    HK01
                  </Badge>
                </div>

                {/* 底部標題 */}
                <div className="absolute bottom-0 left-0 right-0 p-3 z-20">
                  <div className="flex items-center gap-2 mb-1 text-xs text-white/80">
                    <Badge
                      variant="outline"
                      className="text-[10px] h-4 border-white/30 text-white bg-white/10"
                    >
                      {currentNews?.category}
                    </Badge>
                    <span className="flex items-center gap-1">
                      <Clock size={10} />
                      {timeAgo(currentNews?.publishedAt)}
                    </span>
                  </div>
                  <Link to={`/news/${currentNews?.id}`}>
                    <h2 className="text-base font-serif font-bold text-white leading-tight line-clamp-2 hover:text-white/90 transition-colors">
                      {currentNews?.title}
                    </h2>
                  </Link>
                </div>

                {/* 指示點 */}
                {hk01News.length > 1 && (
                  <div className="absolute bottom-2 right-2 z-20 flex gap-1">
                    {hk01News.map((_, idx) => (
                      <button
                        key={idx}
                        onClick={() => setCurrent(idx)}
                        className={cn(
                          'h-1.5 rounded-full transition-all duration-300',
                          idx === current
                            ? 'w-3 bg-white'
                            : 'w-1.5 bg-white/40 hover:bg-white/60'
                        )}
                      />
                    ))}
                  </div>
                )}
              </div>
            </Card>
          </div>

          {/* Yahoo 新聞 - 2 欄 */}
          <div className="lg:col-span-2">
            <Card className="h-full overflow-hidden">
              {renderSourceColumn(
                yahooNews,
                'Yahoo新聞',
                'bg-violet-50 text-violet-700 dark:bg-violet-900/50 dark:text-violet-200'
              )}
            </Card>
          </div>

          {/* 明報 - 2 欄 */}
          <div className="lg:col-span-2">
            <Card className="h-full overflow-hidden">
              {renderSourceColumn(
                mingpaoNews,
                '明報',
                'bg-blue-50 text-blue-700 dark:bg-blue-900/50 dark:text-blue-200'
              )}
            </Card>
          </div>

          {/* RTHK - 2 欄 */}
          <div className="lg:col-span-2">
            <Card className="h-full overflow-hidden">
              {renderSourceColumn(
                rthkNews,
                'RTHK',
                'bg-red-50 text-red-700 dark:bg-red-900/50 dark:text-red-200'
              )}
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
};
