import React, { useState } from 'react';
import { MOCK_NEWS } from '../lib/data';
import { NewsCard } from '../components/NewsCard';
import { Button, Input, Card } from '../components/ui/primitives';
import { Calendar as CalendarIcon, Filter, Search } from 'lucide-react';
import { format } from 'date-fns';
import { zhHK } from 'date-fns/locale';

export const DailyArchive: React.FC = () => {
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);
  
  // Group news by hour for the timeline
  const groupedNews = MOCK_NEWS.reduce((acc, news) => {
    const date = new Date(news.publishedAt);
    const hour = date.getHours();
    const timeLabel = format(date, 'aa h:00', { locale: zhHK });
    if (!acc[timeLabel]) acc[timeLabel] = [];
    acc[timeLabel].push(news);
    return acc;
  }, {} as Record<string, typeof MOCK_NEWS>);

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
        <div>
           <div className="flex items-center text-sm text-muted-foreground mb-2">
              <span>2026年</span> 
              <span className="mx-2">/</span>
              <span>1月</span>
           </div>
           <h1 className="font-serif text-4xl font-bold flex items-center gap-3">
              29日 <span className="text-muted-foreground text-2xl font-normal">週四</span>
           </h1>
        </div>
        
        <div className="flex items-center gap-2">
            <div className="relative">
                <CalendarIcon className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input 
                    type="date" 
                    value={selectedDate}
                    onChange={(e) => setSelectedDate(e.target.value)}
                    className="pl-9 w-[180px]" 
                />
            </div>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-8">
        {/* Timeline (Left) */}
        <div className="lg:w-[70%] space-y-12">
           {Object.entries(groupedNews).map(([time, items]) => (
             <div key={time} className="relative pl-8 border-l border-border/50">
                <div className="absolute -left-3 top-0 bg-background border rounded-full px-2 py-1 text-xs font-bold text-muted-foreground">
                    {time}
                </div>
                <div className="mb-4 text-sm text-muted-foreground pl-2">{items.length} 則新聞</div>
                <div className="space-y-6">
                    {items.map(news => (
                        <NewsCard key={news.id} news={news} layout="horizontal" />
                    ))}
                </div>
             </div>
           ))}
           <div className="pt-8 text-center">
               <Button>載入更多歷史記錄</Button>
           </div>
        </div>

        {/* Filters (Right) */}
        <div className="lg:w-[30%] space-y-6">
           <Card className="p-6 sticky top-24">
              <h3 className="font-bold mb-4 flex items-center gap-2">
                <Filter size={18} /> 篩選媒體
              </h3>
              <div className="space-y-3">
                 {['明報', '東方日報', 'HK01', '信報', 'SCMP'].map(media => (
                     <label key={media} className="flex items-center gap-2 cursor-pointer hover:bg-muted/50 p-2 rounded transition-colors">
                        <input type="checkbox" className="rounded border-gray-300 text-brand-blue focus:ring-brand-blue" defaultChecked />
                        <span className="text-sm">{media}</span>
                     </label>
                 ))}
              </div>
              <div className="mt-6 pt-6 border-t">
                 <div className="relative">
                    <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input placeholder="搜尋當日新聞..." className="pl-8" />
                 </div>
                 <Button className="w-full mt-4 bg-brand-blue hover:bg-brand-blue/90">套用篩選</Button>
              </div>
           </Card>
        </div>
      </div>
    </div>
  );
};
