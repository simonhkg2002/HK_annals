import React, { useState, useEffect } from 'react';
import { fetchLatestNews, fetchStats, fetchDailyStats } from '../lib/data';
import { Button, Input, Card, Badge } from '../components/ui/primitives';
import { Trash2, Edit, RefreshCw, Eye, Search, Loader2, ExternalLink } from 'lucide-react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { NewsItem } from '../types';
import { format } from 'date-fns';

export const AdminDashboard: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [news, setNews] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<{
    totalArticles: number;
    todayArticles: number;
    sources: { name: string; count: number }[];
    categories: { name: string; count: number }[];
  } | null>(null);
  const [dailyStats, setDailyStats] = useState<{ date: string; count: number }[]>([]);

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        const [newsData, statsData, dailyData] = await Promise.all([
          fetchLatestNews(20),
          fetchStats(),
          fetchDailyStats(7),
        ]);
        setNews(newsData);
        setStats(statsData);
        setDailyStats(dailyData);
      } catch (error) {
        console.error('Failed to fetch data:', error);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, []);

  // 過濾搜尋
  const filteredNews = searchTerm
    ? news.filter((n) => n.title.toLowerCase().includes(searchTerm.toLowerCase()))
    : news;

  // 圖表資料
  const chartData = dailyStats
    .map((d) => ({
      name: format(new Date(d.date), 'MM/dd'),
      count: d.count,
    }))
    .reverse();

  const lastUpdate = new Date().toLocaleTimeString('zh-HK', {
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold font-serif">管理後台</h1>
        <div className="flex items-center gap-4">
          <span className="text-sm text-muted-foreground bg-muted px-3 py-1 rounded">
            上次更新: {lastUpdate}
          </span>
          <Button variant="outline" size="sm" onClick={() => window.location.reload()}>
            <RefreshCw className="mr-2 h-4 w-4" /> 重新載入
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <Card className="p-6">
              <h3 className="text-sm font-medium text-muted-foreground mb-2">總新聞數</h3>
              <div className="text-3xl font-bold">{stats?.totalArticles ?? 0}</div>
            </Card>
            <Card className="p-6">
              <h3 className="text-sm font-medium text-muted-foreground mb-2">今日新增</h3>
              <div className="text-3xl font-bold text-green-600">
                +{stats?.todayArticles ?? 0}
              </div>
            </Card>
            <Card className="p-6">
              <h3 className="text-sm font-medium text-muted-foreground mb-2">系統狀態</h3>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-green-500 animate-pulse"></div>
                <span className="font-bold">正常運作</span>
              </div>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-8">
            <Card className="col-span-2 p-6">
              <h3 className="font-bold mb-4">過去 7 天爬取趨勢</h3>
              <div className="h-[200px] w-full">
                {chartData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                      <XAxis dataKey="name" tick={{ fontSize: 12 }} stroke="#888888" />
                      <YAxis tick={{ fontSize: 12 }} stroke="#888888" />
                      <Tooltip
                        contentStyle={{
                          borderRadius: '8px',
                          border: 'none',
                          boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                        }}
                      />
                      <Line
                        type="monotone"
                        dataKey="count"
                        stroke="#1E40AF"
                        strokeWidth={2}
                        activeDot={{ r: 8 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex items-center justify-center h-full text-muted-foreground">
                    暫無資料
                  </div>
                )}
              </div>
            </Card>
            <Card className="p-6">
              <h3 className="font-bold mb-4">來源統計</h3>
              <div className="space-y-4">
                {stats?.sources.map((src) => (
                  <div key={src.name} className="flex items-center justify-between">
                    <span>{src.name}</span>
                    <Badge variant="secondary">{src.count}</Badge>
                  </div>
                ))}
                {stats?.sources.length === 0 && (
                  <p className="text-sm text-muted-foreground">暫無資料</p>
                )}
              </div>
            </Card>
          </div>

          <Card className="overflow-hidden">
            <div className="p-4 border-b flex flex-col md:flex-row justify-between items-center gap-4 bg-muted/20">
              <div className="relative w-full md:w-auto">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="搜尋標題..."
                  className="pl-8 w-full md:w-[300px]"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              <div className="flex gap-2 w-full md:w-auto">
                <Button variant="destructive" size="sm" className="w-full md:w-auto">
                  <Trash2 className="mr-2 h-4 w-4" /> 批量刪除
                </Button>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="text-xs text-muted-foreground uppercase bg-muted/50">
                  <tr>
                    <th className="px-6 py-3">
                      <input type="checkbox" />
                    </th>
                    <th className="px-6 py-3">標題</th>
                    <th className="px-6 py-3">來源</th>
                    <th className="px-6 py-3">分類</th>
                    <th className="px-6 py-3">發布時間</th>
                    <th className="px-6 py-3 text-right">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredNews.map((item) => (
                    <tr
                      key={item.id}
                      className="bg-background border-b hover:bg-muted/30 transition-colors"
                    >
                      <td className="px-6 py-4">
                        <input type="checkbox" />
                      </td>
                      <td
                        className="px-6 py-4 font-medium max-w-[300px] truncate"
                        title={item.title}
                      >
                        {item.title}
                      </td>
                      <td className="px-6 py-4">
                        <Badge variant="outline">{item.source}</Badge>
                      </td>
                      <td className="px-6 py-4">{item.category}</td>
                      <td className="px-6 py-4 text-muted-foreground">
                        {format(new Date(item.publishedAt), 'yyyy-MM-dd HH:mm')}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex justify-end gap-2">
                          <a
                            href={item.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-muted-foreground hover:text-brand-blue"
                          >
                            <ExternalLink size={16} />
                          </a>
                          <button className="text-muted-foreground hover:text-brand-gold">
                            <Edit size={16} />
                          </button>
                          <button className="text-muted-foreground hover:text-red-600">
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="p-4 border-t text-center text-sm text-muted-foreground">
              顯示 {filteredNews.length} 筆，共 {stats?.totalArticles ?? 0} 筆
            </div>
          </Card>
        </>
      )}
    </div>
  );
};
