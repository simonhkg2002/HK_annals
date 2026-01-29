import React, { useState, useEffect } from 'react';
import { fetchNewsByDate } from '../lib/data';
import { NewsCard } from '../components/NewsCard';
import { Button, Input, Card } from '../components/ui/primitives';
import { Calendar as CalendarIcon, Filter, Search, Loader2 } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { zhHK } from 'date-fns/locale';
import { NewsItem } from '../types';

export const DailyArchive: React.FC = () => {
  const [selectedDate, setSelectedDate] = useState<string>(
    new Date().toISOString().split('T')[0]
  );
  const [news, setNews] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(true);

  // 載入指定日期的新聞
  useEffect(() => {
    const loadNews = async () => {
      setLoading(true);
      try {
        const data = await fetchNewsByDate(selectedDate);
        setNews(data);
      } catch (error) {
        console.error('Failed to fetch news:', error);
      } finally {
        setLoading(false);
      }
    };
    loadNews();
  }, [selectedDate]);

  // 按小時分組新聞
  const groupedNews = news.reduce(
    (acc, item) => {
      const date = new Date(item.publishedAt);
      const timeLabel = format(date, 'aa h:00', { locale: zhHK });
      if (!acc[timeLabel]) acc[timeLabel] = [];
      acc[timeLabel].push(item);
      return acc;
    },
    {} as Record<string, NewsItem[]>
  );

  // 解析日期顯示
  const dateObj = parseISO(selectedDate);
  const year = format(dateObj, 'yyyy');
  const month = format(dateObj, 'M');
  const day = format(dateObj, 'd');
  const weekday = format(dateObj, 'EEEE', { locale: zhHK });

  // 獲取唯一的媒體來源
  const sources = [...new Set(news.map((n) => n.source))];

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
        <div>
          <div className="flex items-center text-sm text-muted-foreground mb-2">
            <span>{year}年</span>
            <span className="mx-2">/</span>
            <span>{month}月</span>
          </div>
          <h1 className="font-serif text-4xl font-bold flex items-center gap-3">
            {day}日{' '}
            <span className="text-muted-foreground text-2xl font-normal">{weekday}</span>
          </h1>
          <p className="text-sm text-muted-foreground mt-2">共 {news.length} 則新聞</p>
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
          {loading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
            </div>
          ) : Object.keys(groupedNews).length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              此日期暫無新聞記錄
            </div>
          ) : (
            Object.entries(groupedNews)
              .sort(([a], [b]) => {
                // 按時間倒序排列
                const timeA = a.includes('下午') ? 12 : 0;
                const timeB = b.includes('下午') ? 12 : 0;
                return timeB - timeA;
              })
              .map(([time, items]) => (
                <div key={time} className="relative pl-8 border-l border-border/50">
                  <div className="absolute -left-3 top-0 bg-background border rounded-full px-2 py-1 text-xs font-bold text-muted-foreground">
                    {time}
                  </div>
                  <div className="mb-4 text-sm text-muted-foreground pl-2">
                    {items.length} 則新聞
                  </div>
                  <div className="space-y-6">
                    {items.map((item) => (
                      <NewsCard key={item.id} news={item} layout="horizontal" />
                    ))}
                  </div>
                </div>
              ))
          )}
          {!loading && news.length > 0 && (
            <div className="pt-8 text-center">
              <Button>載入更多歷史記錄</Button>
            </div>
          )}
        </div>

        {/* Filters (Right) */}
        <div className="lg:w-[30%] space-y-6">
          <Card className="p-6 sticky top-24">
            <h3 className="font-bold mb-4 flex items-center gap-2">
              <Filter size={18} /> 篩選媒體
            </h3>
            <div className="space-y-3">
              {sources.length > 0 ? (
                sources.map((source) => (
                  <label
                    key={source}
                    className="flex items-center gap-2 cursor-pointer hover:bg-muted/50 p-2 rounded transition-colors"
                  >
                    <input
                      type="checkbox"
                      className="rounded border-gray-300 text-brand-blue focus:ring-brand-blue"
                      defaultChecked
                    />
                    <span className="text-sm">{source}</span>
                  </label>
                ))
              ) : (
                <p className="text-sm text-muted-foreground">暫無資料</p>
              )}
            </div>
            <div className="mt-6 pt-6 border-t">
              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input placeholder="搜尋當日新聞..." className="pl-8" />
              </div>
              <Button className="w-full mt-4 bg-brand-blue hover:bg-brand-blue/90">
                套用篩選
              </Button>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
};
