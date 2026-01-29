import React from 'react';
import { NewsItem } from '../types';
import { Card, CardContent, Badge } from './ui/primitives';
import { timeAgo, sourceColors, cn } from '../lib/utils';
import { ExternalLink, Clock } from 'lucide-react';

interface NewsCardProps {
  news: NewsItem;
  layout?: 'grid' | 'horizontal';
}

export const NewsCard: React.FC<NewsCardProps> = ({ news, layout = 'grid' }) => {
  if (layout === 'horizontal') {
    return (
      <Card className="overflow-hidden hover:shadow-md transition-shadow duration-300 group">
        <div className="flex flex-col sm:flex-row h-full">
          <div className="sm:w-1/3 md:w-1/4 h-48 sm:h-auto relative overflow-hidden">
             <img 
              src={news.thumbnail} 
              alt={news.title}
              className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
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
            <div className="mt-4 flex justify-end">
              <a href={news.url} className="text-sm font-medium text-brand-blue flex items-center hover:underline">
                閱讀全文 <ExternalLink size={14} className="ml-1" />
              </a>
            </div>
          </div>
        </div>
      </Card>
    );
  }

  // Grid layout (Default)
  return (
    <Card className="overflow-hidden hover:shadow-lg transition-all duration-300 group h-full flex flex-col">
      <div className="aspect-[4/3] relative overflow-hidden">
        <img 
          src={news.thumbnail} 
          alt={news.title}
          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
        />
        <div className="absolute top-2 left-2">
          <Badge variant="secondary" className={cn("rounded-sm shadow-sm opacity-90 backdrop-blur-sm", sourceColors[news.source])}>
            {news.source}
          </Badge>
        </div>
      </div>
      <CardContent className="p-4 flex flex-col flex-grow">
        <div className="flex items-center justify-between mb-2">
           <Badge variant="outline" className="text-[10px] h-5">{news.category}</Badge>
           <span className="text-xs text-muted-foreground">{timeAgo(news.publishedAt)}</span>
        </div>
        <h3 className="font-serif font-bold text-lg leading-tight mb-2 group-hover:text-brand-blue transition-colors">
          {news.title}
        </h3>
        <p className="text-muted-foreground text-xs line-clamp-2 mt-auto">
          {news.summary}
        </p>
      </CardContent>
    </Card>
  );
};
