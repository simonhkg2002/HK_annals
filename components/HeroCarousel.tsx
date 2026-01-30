import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { NewsItem } from '../types';
import { Button, Badge, Card } from './ui/primitives';
import { ChevronLeft, ChevronRight, Clock, ExternalLink } from 'lucide-react';
import { cn, timeAgo, sourceColors } from '../lib/utils';

interface HeroCarouselProps {
  news: NewsItem[];
}

export const HeroCarousel: React.FC<HeroCarouselProps> = ({ news }) => {
  const [current, setCurrent] = useState(0);
  const [isPaused, setIsPaused] = useState(false);

  // 主要輪播新聞（前 5 則）
  const mainNews = news.slice(0, 5);
  // 側邊新聞列表（第 6-10 則）
  const sideNews = news.slice(5, 10);

  useEffect(() => {
    if (isPaused || mainNews.length === 0) return;

    const timer = setInterval(() => {
      setCurrent((prev) => (prev + 1) % mainNews.length);
    }, 6000);
    return () => clearInterval(timer);
  }, [mainNews.length, isPaused]);

  const next = () => setCurrent((prev) => (prev + 1) % mainNews.length);
  const prev = () => setCurrent((prev) => (prev - 1 + mainNews.length) % mainNews.length);

  if (!news.length) return null;

  const currentNews = mainNews[current];

  return (
    <div className="bg-gradient-to-b from-muted/50 to-background">
      <div className="container mx-auto px-4 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* 主要輪播區 */}
          <div
            className="lg:col-span-2"
            onMouseEnter={() => setIsPaused(true)}
            onMouseLeave={() => setIsPaused(false)}
          >
            <Card className="overflow-hidden group relative">
              {/* 圖片區 */}
              <div className="relative aspect-[16/9] bg-muted overflow-hidden">
                {mainNews.map((item, index) => (
                  <Link
                    key={item.id}
                    to={`/news/${item.id}`}
                    className={cn(
                      "absolute inset-0 transition-opacity duration-700",
                      index === current ? "opacity-100 z-10" : "opacity-0 z-0"
                    )}
                  >
                    <img
                      src={item.thumbnail}
                      alt={item.title}
                      className="w-full h-full object-contain bg-black/5"
                    />
                  </Link>
                ))}

                {/* 控制按鈕 */}
                <button
                  onClick={prev}
                  className="absolute left-3 top-1/2 -translate-y-1/2 z-20 bg-black/40 hover:bg-black/60 text-white p-2 rounded-full backdrop-blur-sm transition-all opacity-0 group-hover:opacity-100"
                >
                  <ChevronLeft size={24} />
                </button>
                <button
                  onClick={next}
                  className="absolute right-3 top-1/2 -translate-y-1/2 z-20 bg-black/40 hover:bg-black/60 text-white p-2 rounded-full backdrop-blur-sm transition-all opacity-0 group-hover:opacity-100"
                >
                  <ChevronRight size={24} />
                </button>

                {/* 來源標籤 */}
                <div className="absolute top-3 left-3 z-20">
                  <Badge className={cn("shadow-md", sourceColors[currentNews?.source])}>
                    {currentNews?.source}
                  </Badge>
                </div>
              </div>

              {/* 內容區 */}
              <div className="p-5">
                <div className="flex items-center gap-3 mb-3 text-sm text-muted-foreground">
                  <Badge variant="outline">{currentNews?.category}</Badge>
                  <span className="flex items-center gap-1">
                    <Clock size={14} />
                    {timeAgo(currentNews?.publishedAt)}
                  </span>
                </div>

                <Link to={`/news/${currentNews?.id}`}>
                  <h2 className="text-xl md:text-2xl font-serif font-bold leading-tight mb-3 hover:text-brand-blue transition-colors line-clamp-2">
                    {currentNews?.title}
                  </h2>
                </Link>

                <p className="text-muted-foreground text-sm md:text-base line-clamp-2 mb-4">
                  {currentNews?.summary}
                </p>

                <div className="flex items-center justify-between">
                  <div className="flex gap-2">
                    <Link to={`/news/${currentNews?.id}`}>
                      <Button size="sm">
                        閱讀全文
                      </Button>
                    </Link>
                    <a
                      href={currentNews?.url}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <Button variant="outline" size="sm">
                        <ExternalLink size={14} className="mr-1" />
                        原文
                      </Button>
                    </a>
                  </div>

                  {/* 指示點 */}
                  <div className="flex gap-1.5">
                    {mainNews.map((_, idx) => (
                      <button
                        key={idx}
                        onClick={() => setCurrent(idx)}
                        className={cn(
                          "h-2 rounded-full transition-all duration-300",
                          idx === current
                            ? "w-6 bg-brand-blue"
                            : "w-2 bg-muted-foreground/30 hover:bg-muted-foreground/50"
                        )}
                      />
                    ))}
                  </div>
                </div>
              </div>
            </Card>
          </div>

          {/* 側邊新聞列表 */}
          <div className="hidden lg:block">
            <Card className="h-full">
              <div className="p-4 border-b">
                <h3 className="font-bold text-lg">最新報導</h3>
              </div>
              <div className="divide-y">
                {sideNews.map((item, idx) => (
                  <Link
                    key={item.id}
                    to={`/news/${item.id}`}
                    className="flex gap-3 p-4 hover:bg-muted/50 transition-colors group"
                  >
                    <div className="flex-shrink-0 w-20 h-14 rounded overflow-hidden bg-muted">
                      <img
                        src={item.thumbnail}
                        alt={item.title}
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="font-medium text-sm leading-tight line-clamp-2 group-hover:text-brand-blue transition-colors">
                        {item.title}
                      </h4>
                      <div className="flex items-center gap-2 mt-1.5 text-xs text-muted-foreground">
                        <Badge
                          variant="secondary"
                          className={cn("text-[10px] h-4 px-1.5", sourceColors[item.source])}
                        >
                          {item.source}
                        </Badge>
                        <span>{timeAgo(item.publishedAt)}</span>
                      </div>
                    </div>
                  </Link>
                ))}
                {sideNews.length === 0 && (
                  <div className="p-4 text-center text-sm text-muted-foreground">
                    暫無更多新聞
                  </div>
                )}
              </div>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
};
