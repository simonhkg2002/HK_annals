import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { NewsItem } from '../types';
import { Badge, Card } from './ui/primitives';
import { ChevronLeft, ChevronRight, Clock } from 'lucide-react';
import { cn, timeAgo, sourceColors } from '../lib/utils';

interface HeroCarouselProps {
  news: NewsItem[];
}

// 檢查是否在指定小時內
function isWithinHours(publishedAt: string, hours: number): boolean {
  const publishTime = new Date(publishedAt).getTime();
  const now = Date.now();
  const hoursInMs = hours * 60 * 60 * 1000;
  return now - publishTime <= hoursInMs;
}

export const HeroCarousel: React.FC<HeroCarouselProps> = ({ news }) => {
  const [current, setCurrent] = useState(0);
  const [isPaused, setIsPaused] = useState(false);

  // 按報章分組新聞
  const groupedNews: Record<string, NewsItem[]> = {};
  for (const item of news) {
    if (!groupedNews[item.source]) {
      groupedNews[item.source] = [];
    }
    groupedNews[item.source].push(item);
  }

  // HK01: 最新 4 則（不限時間）
  const hk01News = (groupedNews['HK01'] || [])
    .sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime())
    .slice(0, 4);

  // 其他來源: 只顯示最近 2 小時內的新聞
  const filterRecent = (items: NewsItem[]) =>
    items
      .filter((item) => isWithinHours(item.publishedAt, 2))
      .sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime())
      .slice(0, 2);

  const yahooNews = filterRecent(groupedNews['Yahoo新聞'] || []);
  const mingpaoNews = filterRecent(groupedNews['明報'] || []);
  const rthkNews = filterRecent(groupedNews['RTHK'] || []);

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

  // 渲染報章欄位（最近 2 小時新聞）
  const renderSourceColumn = (
    sourceNews: NewsItem[],
    sourceName: string,
    headerColor: string
  ) => (
    <div className="flex flex-col h-full">
      <div className={cn('px-2 py-1.5 text-xs font-medium border-b flex items-center justify-between', headerColor)}>
        <span>{sourceName}</span>
        <span className="text-[10px] opacity-70">近 2 小時</span>
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
          <div className="flex-1 flex items-center justify-center p-4">
            <p className="text-xs text-muted-foreground text-center">暫無新聞</p>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div className="bg-gradient-to-b from-muted/30 to-background">
      <div className="container mx-auto px-4 py-4">
        {/* 9 欄網格: HK01(3) + Yahoo(2) + 明報(2) + RTHK(2) */}
        <div className="grid grid-cols-1 lg:grid-cols-9 gap-3">
          {/* HK01 輪播區 - 3 欄，顯示最新 4 則 */}
          <div
            className="lg:col-span-3"
            onMouseEnter={() => setIsPaused(true)}
            onMouseLeave={() => setIsPaused(false)}
          >
            <Card className="overflow-hidden group relative h-full">
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
                  <div className="flex items-center gap-1 mb-1 text-xs text-white/80">
                    <Clock size={10} />
                    <span>{timeAgo(currentNews?.publishedAt)}</span>
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

          {/* Yahoo 新聞 - 2 欄（最近 2 小時） */}
          <div className="lg:col-span-2">
            <Card className="h-full overflow-hidden">
              {renderSourceColumn(
                yahooNews,
                'Yahoo新聞',
                'bg-violet-50 text-violet-700 dark:bg-violet-900/50 dark:text-violet-200'
              )}
            </Card>
          </div>

          {/* 明報 - 2 欄（最近 2 小時） */}
          <div className="lg:col-span-2">
            <Card className="h-full overflow-hidden">
              {renderSourceColumn(
                mingpaoNews,
                '明報',
                'bg-blue-50 text-blue-700 dark:bg-blue-900/50 dark:text-blue-200'
              )}
            </Card>
          </div>

          {/* RTHK - 2 欄（最近 2 小時） */}
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
