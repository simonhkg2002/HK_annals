import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  fetchNewsForAdmin,
  fetchStats,
  fetchDailyStats,
  fetchNewsSeries,
  disableNews,
  enableNews,
  setNewsSeriesId,
  createNewsSeries,
  deleteNewsSeries,
  AdminUser,
  NewsSeries,
} from '../lib/data';
import { Button, Input, Card, Badge } from '../components/ui/primitives';
import {
  Trash2,
  RefreshCw,
  Search,
  Loader2,
  ExternalLink,
  Eye,
  EyeOff,
  Tag,
  Plus,
  LogOut,
  X,
} from 'lucide-react';
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

interface AdminDashboardProps {
  user: AdminUser | null;
  onLogout: () => void;
}

type NewsItemWithAdmin = NewsItem & { isDisabled: boolean; seriesId: number | null };

export const AdminDashboard: React.FC<AdminDashboardProps> = ({ user, onLogout }) => {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');
  const [news, setNews] = useState<NewsItemWithAdmin[]>([]);
  const [series, setSeries] = useState<NewsSeries[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<{
    totalArticles: number;
    todayArticles: number;
    sources: { name: string; count: number }[];
    categories: { name: string; count: number }[];
  } | null>(null);
  const [dailyStats, setDailyStats] = useState<{ date: string; count: number }[]>([]);
  const [showSeriesModal, setShowSeriesModal] = useState(false);
  const [selectedArticle, setSelectedArticle] = useState<NewsItemWithAdmin | null>(null);
  const [newSeriesName, setNewSeriesName] = useState('');
  const [newSeriesDesc, setNewSeriesDesc] = useState('');
  const [newSeriesColor, setNewSeriesColor] = useState('#3B82F6');

  // 如果沒有登入，導向登入頁
  useEffect(() => {
    if (!user) {
      navigate('/admin/login');
    }
  }, [user, navigate]);

  // 載入資料
  useEffect(() => {
    const loadData = async () => {
      if (!user) return;

      setLoading(true);
      try {
        const [newsData, statsData, dailyData, seriesData] = await Promise.all([
          fetchNewsForAdmin(100),
          fetchStats(),
          fetchDailyStats(7),
          fetchNewsSeries(),
        ]);
        setNews(newsData);
        setStats(statsData);
        setDailyStats(dailyData);
        setSeries(seriesData);
      } catch (error) {
        console.error('Failed to fetch data:', error);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, [user]);

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

  // 停用/恢復新聞
  const handleToggleDisable = async (item: NewsItemWithAdmin) => {
    if (!user) return;

    try {
      if (item.isDisabled) {
        await enableNews(item.id);
      } else {
        await disableNews(item.id, user.username);
      }
      // 更新本地狀態
      setNews((prev) =>
        prev.map((n) =>
          n.id === item.id ? { ...n, isDisabled: !n.isDisabled } : n
        )
      );
    } catch (error) {
      console.error('Failed to toggle disable:', error);
    }
  };

  // 設定系列
  const handleSetSeries = async (articleId: string, seriesId: number | null) => {
    try {
      await setNewsSeriesId(articleId, seriesId);
      setNews((prev) =>
        prev.map((n) =>
          n.id === articleId ? { ...n, seriesId } : n
        )
      );
      setSelectedArticle(null);
    } catch (error) {
      console.error('Failed to set series:', error);
    }
  };

  // 創建新系列
  const handleCreateSeries = async () => {
    if (!newSeriesName.trim()) return;

    try {
      const id = await createNewsSeries(newSeriesName, newSeriesDesc || null, newSeriesColor);
      setSeries((prev) => [
        ...prev,
        {
          id,
          name: newSeriesName,
          description: newSeriesDesc || null,
          color: newSeriesColor,
          isActive: true,
        },
      ]);
      setNewSeriesName('');
      setNewSeriesDesc('');
      setNewSeriesColor('#3B82F6');
      setShowSeriesModal(false);
    } catch (error) {
      console.error('Failed to create series:', error);
    }
  };

  // 刪除系列
  const handleDeleteSeries = async (seriesId: number) => {
    if (!confirm('確定要刪除此系列嗎？使用此系列的新聞將會變為無系列。')) return;

    try {
      await deleteNewsSeries(seriesId);
      setSeries((prev) => prev.filter((s) => s.id !== seriesId));
      // 更新新聞列表中使用此系列的項目
      setNews((prev) =>
        prev.map((n) => (n.seriesId === seriesId ? { ...n, seriesId: null } : n))
      );
    } catch (error) {
      console.error('Failed to delete series:', error);
    }
  };

  if (!user) {
    return null;
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold font-serif">管理後台</h1>
          <p className="text-muted-foreground mt-1">
            歡迎，{user.displayName}
          </p>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sm text-muted-foreground bg-muted px-3 py-1 rounded">
            上次更新: {lastUpdate}
          </span>
          <Button variant="outline" size="sm" onClick={() => window.location.reload()}>
            <RefreshCw className="mr-2 h-4 w-4" /> 重新載入
          </Button>
          <Button variant="ghost" size="sm" onClick={onLogout}>
            <LogOut className="mr-2 h-4 w-4" /> 登出
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <>
          {/* 統計卡片 */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
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
              <h3 className="text-sm font-medium text-muted-foreground mb-2">新聞系列</h3>
              <div className="text-3xl font-bold">{series.length}</div>
            </Card>
            <Card className="p-6">
              <h3 className="text-sm font-medium text-muted-foreground mb-2">系統狀態</h3>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-green-500 animate-pulse"></div>
                <span className="font-bold">正常運作</span>
              </div>
            </Card>
          </div>

          {/* 圖表和系列管理 */}
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
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold">新聞系列</h3>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowSeriesModal(true)}
                >
                  <Plus className="w-4 h-4 mr-1" /> 新增
                </Button>
              </div>
              <div className="space-y-3">
                {series.map((s) => (
                  <div
                    key={s.id}
                    className="flex items-center gap-2 p-2 rounded-lg hover:bg-muted/50 group"
                  >
                    <div
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: s.color }}
                    ></div>
                    <span className="flex-1">{s.name}</span>
                    {s.description && (
                      <span className="text-xs text-muted-foreground truncate max-w-[80px]">
                        {s.description}
                      </span>
                    )}
                    <button
                      onClick={() => handleDeleteSeries(s.id)}
                      className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-red-100 text-muted-foreground hover:text-red-600 transition-all"
                      title="刪除系列"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
                {series.length === 0 && (
                  <p className="text-sm text-muted-foreground">暫無系列</p>
                )}
              </div>
            </Card>
          </div>

          {/* 新聞列表 */}
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
              <div className="text-sm text-muted-foreground">
                顯示 {filteredNews.length} 筆
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="text-xs text-muted-foreground uppercase bg-muted/50">
                  <tr>
                    <th className="px-4 py-3">狀態</th>
                    <th className="px-4 py-3">標題</th>
                    <th className="px-4 py-3">來源</th>
                    <th className="px-4 py-3">系列</th>
                    <th className="px-4 py-3">發布時間</th>
                    <th className="px-4 py-3 text-right">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredNews.map((item) => (
                    <tr
                      key={item.id}
                      className={`border-b hover:bg-muted/30 transition-colors ${
                        item.isDisabled ? 'bg-red-50/50 opacity-60' : 'bg-background'
                      }`}
                    >
                      <td className="px-4 py-4">
                        {item.isDisabled ? (
                          <Badge variant="destructive" className="text-xs">
                            已停用
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-xs text-green-600 border-green-600">
                            顯示中
                          </Badge>
                        )}
                      </td>
                      <td
                        className="px-4 py-4 font-medium max-w-[300px] truncate"
                        title={item.title}
                      >
                        {item.title}
                      </td>
                      <td className="px-4 py-4">
                        <Badge variant="outline">{item.source}</Badge>
                      </td>
                      <td className="px-4 py-4">
                        {item.seriesId ? (
                          <Badge
                            style={{
                              backgroundColor:
                                series.find((s) => s.id === item.seriesId)?.color || '#888',
                              color: 'white',
                            }}
                          >
                            {series.find((s) => s.id === item.seriesId)?.name || '未知'}
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground text-xs">-</span>
                        )}
                      </td>
                      <td className="px-4 py-4 text-muted-foreground">
                        {format(new Date(item.publishedAt), 'yyyy-MM-dd HH:mm')}
                      </td>
                      <td className="px-4 py-4 text-right">
                        <div className="flex justify-end gap-2">
                          <a
                            href={item.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-brand-blue"
                            title="開啟原文"
                          >
                            <ExternalLink size={16} />
                          </a>
                          <button
                            className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-brand-gold"
                            title="設定系列"
                            onClick={() => setSelectedArticle(item)}
                          >
                            <Tag size={16} />
                          </button>
                          <button
                            className={`p-1.5 rounded hover:bg-muted ${
                              item.isDisabled
                                ? 'text-green-600 hover:text-green-700'
                                : 'text-muted-foreground hover:text-red-600'
                            }`}
                            title={item.isDisabled ? '恢復顯示' : '停用新聞'}
                            onClick={() => handleToggleDisable(item)}
                          >
                            {item.isDisabled ? <Eye size={16} /> : <EyeOff size={16} />}
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

      {/* 系列選擇 Modal */}
      {selectedArticle && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <Card className="w-full max-w-md p-6 m-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold">設定新聞系列</h3>
              <button
                onClick={() => setSelectedArticle(null)}
                className="text-muted-foreground hover:text-foreground"
              >
                <X size={20} />
              </button>
            </div>
            <p className="text-sm text-muted-foreground mb-4 truncate">
              {selectedArticle.title}
            </p>
            <div className="space-y-2">
              <button
                className="w-full p-3 text-left rounded-lg border hover:bg-muted/50 flex items-center gap-2"
                onClick={() => handleSetSeries(selectedArticle.id, null)}
              >
                <div className="w-3 h-3 rounded-full bg-gray-300"></div>
                <span>無系列</span>
              </button>
              {series.map((s) => (
                <button
                  key={s.id}
                  className={`w-full p-3 text-left rounded-lg border hover:bg-muted/50 flex items-center gap-2 ${
                    selectedArticle.seriesId === s.id ? 'border-brand-blue bg-brand-blue/5' : ''
                  }`}
                  onClick={() => handleSetSeries(selectedArticle.id, s.id)}
                >
                  <div
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: s.color }}
                  ></div>
                  <span>{s.name}</span>
                  {s.description && (
                    <span className="text-xs text-muted-foreground ml-auto">
                      {s.description}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </Card>
        </div>
      )}

      {/* 新增系列 Modal */}
      {showSeriesModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <Card className="w-full max-w-md p-6 m-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold">新增新聞系列</h3>
              <button
                onClick={() => setShowSeriesModal(false)}
                className="text-muted-foreground hover:text-foreground"
              >
                <X size={20} />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium">系列名稱</label>
                <Input
                  placeholder="例如：北部都會區"
                  value={newSeriesName}
                  onChange={(e) => setNewSeriesName(e.target.value)}
                  className="mt-1"
                />
              </div>
              <div>
                <label className="text-sm font-medium">描述（選填）</label>
                <Input
                  placeholder="簡短描述此系列"
                  value={newSeriesDesc}
                  onChange={(e) => setNewSeriesDesc(e.target.value)}
                  className="mt-1"
                />
              </div>
              <div>
                <label className="text-sm font-medium">顏色</label>
                {/* 預設顏色選項 */}
                <div className="flex flex-wrap gap-2 mt-2 mb-3">
                  {[
                    '#3B82F6', // 藍色
                    '#EF4444', // 紅色
                    '#10B981', // 綠色
                    '#F59E0B', // 橙色
                    '#8B5CF6', // 紫色
                    '#EC4899', // 粉紅
                    '#06B6D4', // 青色
                    '#6366F1', // 靛藍
                  ].map((color) => (
                    <button
                      key={color}
                      type="button"
                      onClick={() => setNewSeriesColor(color)}
                      className={`w-8 h-8 rounded-full border-2 transition-all hover:scale-110 ${
                        newSeriesColor === color
                          ? 'border-foreground ring-2 ring-offset-2 ring-foreground/30'
                          : 'border-transparent'
                      }`}
                      style={{ backgroundColor: color }}
                      title={color}
                    />
                  ))}
                </div>
                {/* 自訂顏色 */}
                <div className="flex items-center gap-2">
                  <div className="relative">
                    <input
                      type="color"
                      value={newSeriesColor}
                      onChange={(e) => setNewSeriesColor(e.target.value)}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    />
                    <div
                      className="w-10 h-10 rounded-lg border-2 border-muted cursor-pointer"
                      style={{ backgroundColor: newSeriesColor }}
                    />
                  </div>
                  <Input
                    value={newSeriesColor}
                    onChange={(e) => setNewSeriesColor(e.target.value)}
                    placeholder="#000000"
                    className="flex-1 font-mono"
                  />
                </div>
              </div>
              <div className="flex gap-2 pt-2">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => setShowSeriesModal(false)}
                >
                  取消
                </Button>
                <Button
                  className="flex-1"
                  onClick={handleCreateSeries}
                  disabled={!newSeriesName.trim()}
                >
                  新增
                </Button>
              </div>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
};

// 保留舊版供向後兼容
export const AdminDashboardLegacy = AdminDashboard;
