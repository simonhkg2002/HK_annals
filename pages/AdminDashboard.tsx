import React, { useState } from 'react';
import { MOCK_NEWS } from '../lib/data';
import { Button, Input, Card, Badge } from '../components/ui/primitives';
import { Trash2, Edit, RefreshCw, Eye, Search, AlertTriangle } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

export const AdminDashboard: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');
  
  // Mock Chart Data
  const chartData = [
    { name: 'Mon', count: 120 },
    { name: 'Tue', count: 132 },
    { name: 'Wed', count: 101 },
    { name: 'Thu', count: 134 },
    { name: 'Fri', count: 290 },
    { name: 'Sat', count: 230 },
    { name: 'Sun', count: 210 },
  ];

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold font-serif">管理後台</h1>
        <div className="flex items-center gap-4">
            <span className="text-sm text-muted-foreground bg-muted px-3 py-1 rounded">
                上次爬取: 12:30
            </span>
            <Button variant="outline" size="sm">
                <RefreshCw className="mr-2 h-4 w-4" /> 立即更新
            </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <Card className="p-6">
              <h3 className="text-sm font-medium text-muted-foreground mb-2">總新聞數</h3>
              <div className="text-3xl font-bold">45,231</div>
          </Card>
          <Card className="p-6">
              <h3 className="text-sm font-medium text-muted-foreground mb-2">今日新增</h3>
              <div className="text-3xl font-bold text-green-600">+247</div>
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
            <h3 className="font-bold mb-4">本週爬取趨勢</h3>
            <div className="h-[200px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                        <XAxis dataKey="name" tick={{fontSize: 12}} stroke="#888888" />
                        <YAxis tick={{fontSize: 12}} stroke="#888888" />
                        <Tooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                        <Line type="monotone" dataKey="count" stroke="#1E40AF" strokeWidth={2} activeDot={{ r: 8 }} />
                    </LineChart>
                </ResponsiveContainer>
            </div>
         </Card>
         <Card className="p-6">
            <h3 className="font-bold mb-4">來源控制</h3>
            <div className="space-y-4">
                {['明報', '東方日報', 'HK01', '信報'].map(src => (
                    <div key={src} className="flex items-center justify-between">
                        <span>{src}</span>
                        <div className="w-10 h-5 bg-green-500 rounded-full relative cursor-pointer">
                            <div className="absolute right-0.5 top-0.5 w-4 h-4 bg-white rounded-full shadow-sm"></div>
                        </div>
                    </div>
                ))}
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
                          <th className="px-6 py-3"><input type="checkbox" /></th>
                          <th className="px-6 py-3">標題</th>
                          <th className="px-6 py-3">來源</th>
                          <th className="px-6 py-3">分類</th>
                          <th className="px-6 py-3">發布時間</th>
                          <th className="px-6 py-3 text-right">操作</th>
                      </tr>
                  </thead>
                  <tbody>
                      {MOCK_NEWS.slice(0, 10).map((news) => (
                          <tr key={news.id} className="bg-background border-b hover:bg-muted/30 transition-colors">
                              <td className="px-6 py-4"><input type="checkbox" /></td>
                              <td className="px-6 py-4 font-medium max-w-[300px] truncate" title={news.title}>
                                {news.title}
                              </td>
                              <td className="px-6 py-4">
                                <Badge variant="outline">{news.source}</Badge>
                              </td>
                              <td className="px-6 py-4">{news.category}</td>
                              <td className="px-6 py-4 text-muted-foreground">{news.publishedAt.substring(0, 10)}</td>
                              <td className="px-6 py-4 text-right">
                                  <div className="flex justify-end gap-2">
                                    <button className="text-muted-foreground hover:text-brand-blue"><Eye size={16} /></button>
                                    <button className="text-muted-foreground hover:text-brand-gold"><Edit size={16} /></button>
                                    <button className="text-muted-foreground hover:text-red-600"><Trash2 size={16} /></button>
                                  </div>
                              </td>
                          </tr>
                      ))}
                  </tbody>
              </table>
          </div>
          <div className="p-4 border-t text-center text-sm text-muted-foreground">
             顯示 1-10 筆，共 45,231 筆
          </div>
      </Card>
    </div>
  );
};
