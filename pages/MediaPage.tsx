import React from 'react';
import { MOCK_NEWS } from '../lib/data';
import { NewsCard } from '../components/NewsCard';
import { Badge } from '../components/ui/primitives';
import { sourceColors } from '../lib/utils';

export const MediaPage: React.FC = () => {
  // Mock active source for demo
  const source = '明報';
  const sourceNews = MOCK_NEWS.filter(n => Math.random() > 0.3); // Simulate filtering

  return (
    <div>
       <div className="bg-muted/30 py-12 md:py-20">
          <div className="container mx-auto px-4 text-center">
             <div className="inline-flex items-center justify-center p-4 bg-background rounded-full shadow-lg mb-6">
                {/* Placeholder logo */}
                <div className="w-16 h-16 bg-blue-900 rounded-full flex items-center justify-center text-white font-serif font-bold text-2xl">
                    明
                </div>
             </div>
             <h1 className="text-4xl font-serif font-bold mb-4">{source}</h1>
             <div className="flex items-center justify-center gap-4 text-sm text-muted-foreground">
                <span className="bg-background px-3 py-1 rounded-full border shadow-sm">總計 1,234 則新聞</span>
                <span className="bg-background px-3 py-1 rounded-full border shadow-sm">最新更新：2 小時前</span>
             </div>
          </div>
       </div>

       <div className="container mx-auto px-4 py-8">
           <div className="flex border-b mb-8 overflow-x-auto">
              {['全部', '港聞', '財經', '國際', '體育'].map((tab, i) => (
                  <button 
                    key={tab}
                    className={`px-6 py-3 text-sm font-medium border-b-2 whitespace-nowrap ${i === 0 ? 'border-brand-blue text-brand-blue' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
                  >
                    {tab}
                  </button>
              ))}
           </div>

           <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
               {sourceNews.map(news => (
                   <NewsCard key={news.id} news={{...news, source: source as any}} />
               ))}
           </div>
       </div>
    </div>
  );
};
