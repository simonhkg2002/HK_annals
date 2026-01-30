import React from 'react';
import { Link } from 'react-router-dom';
import { NewsItem } from '../types';
import { Card, CardContent, Badge } from './ui/primitives';
import { timeAgo, sourceColors, cn } from '../lib/utils';
import { ExternalLink, Clock } from 'lucide-react';

interface NewsCardProps {
  news: NewsItem;
  layout?: 'grid' | 'horizontal';
  linkToDetail?: boolean; // 是否連結到詳情頁，預設為 true
}

export const NewsCard: React.FC<NewsCardProps> = ({
  news,
  layout = 'grid',
  linkToDetail = true,
}) => {
  const detailUrl = `/news/${news.id}`;

  if (layout === 'horizontal') {
    const content = (
      <Card className="overflow-hidden hover:shadow-md transition-shadow duration-300 group">
        <div className="flex flex-col sm:flex-row h-full">
          <div className="sm:w-1/3 md:w-1/4 h-48 sm:h-auto relative overflow-hidden bg-muted">
             <img
              src={news.thumbnail || '/placeholder.jpg'}
              alt={news.title}
              className="w-full h-full object-contain transition-transform duration-500 group-hover:scale-105"
              onError={(e) => {
                (e.target as HTMLImageElement).src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300"><rect fill="%23f3f4f6" width="400" height="300"/><text x="50%" y="50%" text-anchor="middle" fill="%239ca3af" font-size="16">No Image</text></svg>';
              }}
            />
          </div>
          <div className="flex-1 p-4 flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Badge variant="secondary" className={cn("rounded-sm font-normal", sourceColors[news.source])}>
                  {news.source}
                </Badge>
                <span className="text-xs text-muted-foreground flex items-center gap-1">
                  <Clock size={12} />
                  {timeAgo(news.publishedAt)}
                </span>
              </div>
              <h3 className="font-serif font-bold text-xl mb-2 line-clamp-2 group-hover:text-brand-blue transition-colors">
                {news.title}
              </h3>
              <p className="text-muted-foreground text-sm line-clamp-2">
                {news.summary}
              </p>
            </div>
            <div className="mt-4 flex items-center justify-between">
              <span className="text-sm text-brand-blue">
                查看詳情
              </span>
              <a
                href={news.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm font-medium text-muted-foreground flex items-center hover:text-brand-blue"
                onClick={(e) => e.stopPropagation()}
              >
                原文 <ExternalLink size={14} className="ml-1" />
              </a>
            </div>
          </div>
        </div>
      </Card>
    );

    return linkToDetail ? (
      <Link to={detailUrl} className="block">
        {content}
      </Link>
    ) : content;
  }

  // Grid layout (Default)
  const gridContent = (
    <Card className="overflow-hidden hover:shadow-lg transition-all duration-300 group h-full flex flex-col cursor-pointer">
      <div className="aspect-[4/3] relative overflow-hidden bg-gradient-to-br from-muted to-muted/50">
        {news.thumbnail ? (
          <img
            src={news.thumbnail}
            alt={news.title}
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = 'none';
              (e.target as HTMLImageElement).nextElementSibling?.classList.remove('hidden');
            }}
          />
        ) : null}
        {/* 無圖片時的美觀佔位 */}
        <div className={cn(
          "absolute inset-0 flex flex-col items-center justify-center p-4",
          news.thumbnail ? "hidden" : ""
        )}>
          <div className="w-12 h-12 rounded-full bg-muted-foreground/10 flex items-center justify-center mb-2">
            <svg className="w-6 h-6 text-muted-foreground/40" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z" />
            </svg>
          </div>
          <span className="text-xs text-muted-foreground/60 text-center line-clamp-2">{news.source}</span>
        </div>
        <div className="absolute top-2 left-2 z-10">
          <Badge variant="secondary" className={cn("rounded-sm shadow-sm opacity-90 backdrop-blur-sm", sourceColors[news.source])}>
            {news.source}
          </Badge>
        </div>
      </div>
      <CardContent className="p-4 flex flex-col flex-grow">
        <div className="flex items-center justify-end mb-2">
           <span className="text-xs text-muted-foreground">{timeAgo(news.publishedAt)}</span>
        </div>
        <h3 className="font-serif font-bold text-lg leading-tight mb-2 group-hover:text-brand-blue transition-colors line-clamp-2">
          {news.title}
        </h3>
        <p className="text-muted-foreground text-xs line-clamp-2 mt-auto">
          {news.summary}
        </p>
      </CardContent>
    </Card>
  );

  return linkToDetail ? (
    <Link to={detailUrl} className="block h-full">
      {gridContent}
    </Link>
  ) : gridContent;
};
