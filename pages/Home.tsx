import React, { useState } from 'react';
import { HeroCarousel } from '../components/HeroCarousel';
import { NewsCard } from '../components/NewsCard';
import { Button, Badge } from '../components/ui/primitives';
import { MOCK_NEWS } from '../lib/data';
import { NewsCategory } from '../types';
import { cn } from '../lib/utils';

export const Home: React.FC = () => {
  const [activeCategory, setActiveCategory] = useState<NewsCategory | '全部'>('全部');
  
  // Slice mock data for demo
  const heroNews = MOCK_NEWS.slice(0, 3);
  const gridNews = MOCK_NEWS.slice(3, 11); // 8 items
  const filteredNews = activeCategory === '全部' 
    ? gridNews 
    : MOCK_NEWS.filter(n => n.category === activeCategory).slice(0, 8);

  const categories: (NewsCategory | '全部')[] = ['全部', '港聞', '財經', '國際', '體育', '娛樂'];

  return (
    <div className="animate-in fade-in duration-500">
      <HeroCarousel news={heroNews} />
      
      <div className="container mx-auto px-4 py-8">
        {/* Stats Bar */}
        <div className="flex flex-col md:flex-row items-center justify-between py-4 border-b mb-8 text-sm text-muted-foreground bg-muted/20 px-4 rounded-md">
           <span className="font-medium text-foreground">今日：247 則新聞</span>
           <span className="hidden md:inline">|</span>
           <span>最後更新：下午 12:30</span>
           <span className="hidden md:inline">|</span>
           <span>來源：5 個媒體</span>
        </div>

        {/* Filter */}
        <div className="flex flex-wrap gap-2 mb-8 justify-center md:justify-start sticky top-20 z-40 bg-background/80 backdrop-blur-md p-2 rounded-lg border shadow-sm w-fit">
          {categories.map(cat => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={cn(
                "px-4 py-1.5 rounded-full text-sm font-medium transition-all",
                activeCategory === cat 
                  ? "bg-foreground text-background shadow-md" 
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {filteredNews.map((news) => (
            <NewsCard key={news.id} news={news} />
          ))}
        </div>

        <div className="mt-12 text-center">
            <Button variant="outline" size="lg" className="min-w-[200px]">
                載入更多
            </Button>
        </div>
      </div>
    </div>
  );
};
