import React, { useState, useEffect } from 'react';
import { fetchNewsByDate } from '../lib/data';
import { NewsCard } from '../components/NewsCard';
import { Button, Input, Card } from '../components/ui/primitives';
import { Calendar as CalendarIcon, Filter, Search, Loader2, ChevronLeft, ChevronRight } from 'lucide-react';
import { format, parseISO, addDays, subDays } from 'date-fns';
import { zhHK } from 'date-fns/locale';
import { NewsItem } from '../types';

// 資料庫最早日期（2026年開始）
const MIN_DATE = '2026-01-01';

export const DailyArchive: React.FC = () => {
  const today = new Date().toISOString().split('T')[0];
  const [selectedDate, setSelectedDate] = useState<string>(today);
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
      const hour = date.getHours();
      const timeLabel = format(date, 'aa h:00', { locale: zhHK });
      if (!acc[timeLabel]) acc[timeLabel] = { items: [], hour };
      acc[timeLabel].items.push(item);
      return acc;
    },
    {} as Record<string, { items: NewsItem[]; hour: number }>
  );

  // 解析日期顯示
  const dateObj = parseISO(selectedDate);
  const year = format(dateObj, 'yyyy');
  const month = format(dateObj, 'M');
  const day = format(dateObj, 'd');
  const weekday = format(dateObj, 'EEEE', { locale: zhHK });

  // 獲取唯一的媒體來源
  const sources = [...new Set(news.map((n) => n.source))];

  // 前一天/後一天
  const goToPrevDay = () => {
    const prevDay = subDays(dateObj, 1);
    const prevDayStr = format(prevDay, 'yyyy-MM-dd');
    if (prevDayStr >= MIN_DATE) {
      setSelectedDate(prevDayStr);
    }
  };

  const goToNextDay = () => {
    const nextDay = addDays(dateObj, 1);
    const nextDayStr = format(nextDay, 'yyyy-MM-dd');
    if (nextDayStr <= today) {
      setSelectedDate(nextDayStr);
    }
  };

  const canGoPrev = selectedDate > MIN_DATE;
  const canGoNext = selectedDate < today;

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
          {/* 前一天 */}
          <Button
            variant="outline"
            size="sm"
            onClick={goToPrevDay}
            disabled={!canGoPrev}
            className="px-2"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>

          {/* 日期選擇器 */}
          <div className="relative">
            <CalendarIcon className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              type="date"
              value={selectedDate}
              min={MIN_DATE}
              max={today}
              onChange={(e) => {
                const val = e.target.value;
                if (val >= MIN_DATE && val <= today) {
                  setSelectedDate(val);
                }
              }}
              className="pl-9 w-[180px]"
            />
          </div>

          {/* 後一天 */}
          <Button
            variant="outline"
            size="sm"
            onClick={goToNextDay}
            disabled={!canGoNext}
            className="px-2"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
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
              <p>此日期暫無新聞記錄</p>
              <p className="text-sm mt-2">資料從 2026 年 1 月開始收集</p>
            </div>
          ) : (
            (Object.entries(groupedNews) as [string, { items: NewsItem[]; hour: number }][])
              .sort(([, a], [, b]) => b.hour - a.hour)
              .map(([time, { items }]) => (
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

            {/* 日期範圍提示 */}
            <div className="mt-4 pt-4 border-t text-xs text-muted-foreground">
              <p>資料範圍：2026-01-01 至今</p>
              <p>每小時自動更新</p>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
};
