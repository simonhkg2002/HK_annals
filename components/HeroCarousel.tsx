import React, { useState, useEffect } from 'react';
import { NewsItem } from '../types';
import { Button, Badge } from './ui/primitives';
import { ChevronLeft, ChevronRight, Clock } from 'lucide-react';
import { cn, timeAgo, sourceColors } from '../lib/utils';

interface HeroCarouselProps {
  news: NewsItem[];
}

export const HeroCarousel: React.FC<HeroCarouselProps> = ({ news }) => {
  const [current, setCurrent] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrent((prev) => (prev + 1) % news.length);
    }, 5000);
    return () => clearInterval(timer);
  }, [news.length]);

  const next = () => setCurrent((prev) => (prev + 1) % news.length);
  const prev = () => setCurrent((prev) => (prev - 1 + news.length) % news.length);

  if (!news.length) return null;

  return (
    <div className="relative w-full h-[60vh] md:h-[70vh] overflow-hidden bg-black group">
      {news.map((item, index) => (
        <div
          key={item.id}
          className={cn(
            "absolute inset-0 transition-opacity duration-1000 ease-in-out",
            index === current ? "opacity-100 z-10" : "opacity-0 z-0"
          )}
        >
          <img src={item.thumbnail} alt={item.title} className="w-full h-full object-cover opacity-60" />
          <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent opacity-90" />
          
          <div className="absolute bottom-0 left-0 right-0 p-6 md:p-12 lg:p-24 flex flex-col items-start justify-end h-full">
            <div className="animate-fade-in-up space-y-4 max-w-4xl">
              <div className="flex items-center gap-3">
                 <Badge className={cn("text-base px-3 py-1", sourceColors[item.source])}>
                    {item.source}
                 </Badge>
                 <span className="text-white/80 text-sm md:text-base flex items-center gap-1">
                    <Clock size={16} /> {timeAgo(item.publishedAt)}
                 </span>
              </div>
              
              <h1 className="text-3xl md:text-5xl lg:text-7xl font-serif font-black text-white leading-tight drop-shadow-lg">
                {item.title}
              </h1>
              
              <div className="pt-4">
                 <Button size="lg" className="bg-brand-blue hover:bg-brand-blue/90 text-white border-none rounded-full px-8">
                    閱讀全文
                 </Button>
              </div>
            </div>
          </div>
        </div>
      ))}

      {/* Controls */}
      <button 
        onClick={prev}
        className="absolute left-4 top-1/2 -translate-y-1/2 z-20 bg-black/30 hover:bg-black/50 text-white p-2 rounded-full backdrop-blur-sm transition-all opacity-0 group-hover:opacity-100"
      >
        <ChevronLeft size={32} />
      </button>
      <button 
        onClick={next}
        className="absolute right-4 top-1/2 -translate-y-1/2 z-20 bg-black/30 hover:bg-black/50 text-white p-2 rounded-full backdrop-blur-sm transition-all opacity-0 group-hover:opacity-100"
      >
        <ChevronRight size={32} />
      </button>

      {/* Indicators */}
      <div className="absolute bottom-6 right-6 md:right-12 z-20 flex gap-2">
        {news.map((_, idx) => (
          <button
            key={idx}
            onClick={() => setCurrent(idx)}
            className={cn(
              "h-1.5 rounded-full transition-all duration-300",
              idx === current ? "w-8 bg-brand-gold" : "w-2 bg-white/50 hover:bg-white"
            )}
          />
        ))}
      </div>
    </div>
  );
};
