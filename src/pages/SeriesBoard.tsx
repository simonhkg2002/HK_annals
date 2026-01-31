import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { fetchNewsSeries, fetchNewsBySeries } from '../lib/data';
import { NewsItem } from '../types';
import { NewsSeries } from '../lib/data';
import { Loader2, ZoomIn, ZoomOut, Maximize2, Clock, ExternalLink, Pin } from 'lucide-react';
import { Button } from '../components/ui/primitives';
import { cn, timeAgo } from '../lib/utils';

interface BoardNode {
  id: string;
  news: NewsItem;
  x: number;
  y: number;
}

interface Connection {
  from: string;
  to: string;
}

export const SeriesBoard: React.FC = () => {
  const [series, setSeries] = useState<NewsSeries[]>([]);
  const [selectedSeriesId, setSelectedSeriesId] = useState<number | null>(null);
  const [news, setNews] = useState<NewsItem[]>([]);
  const [nodes, setNodes] = useState<BoardNode[]>([]);
  const [connections, setConnections] = useState<Connection[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingNews, setLoadingNews] = useState(false);
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [panning, setPanning] = useState(false);
  const [lastMousePos, setLastMousePos] = useState({ x: 0, y: 0 });
  const [boardSize, setBoardSize] = useState({ width: 2000, height: 2000 });

  const boardRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // 載入系列列表
  useEffect(() => {
    const loadSeries = async () => {
      try {
        const data = await fetchNewsSeries();
        setSeries(data);
        if (data.length > 0) {
          setSelectedSeriesId(data[0].id);
        }
      } catch (error) {
        console.error('Failed to fetch series:', error);
      } finally {
        setLoading(false);
      }
    };
    loadSeries();
  }, []);

  // 載入選中系列的新聞
  useEffect(() => {
    if (!selectedSeriesId) return;

    const loadNews = async () => {
      setLoadingNews(true);
      try {
        const data = await fetchNewsBySeries(selectedSeriesId, 200); // 增加到 200 篇
        setNews(data);

        // 根據時間線佈局節點 - 更緊湊的網格佈局
        if (data.length > 0) {
          const sortedNews = [...data].sort(
            (a, b) => new Date(a.publishedAt).getTime() - new Date(b.publishedAt).getTime()
          );

          // 更緊湊的佈局參數
          const cardWidth = 320;
          const cardHeight = 280;
          const horizontalGap = 120; // 水平間距（用於連線）
          const verticalGap = 100;    // 垂直間距（增加以容納時間標籤）
          const cols = Math.min(5, Math.max(3, Math.ceil(Math.sqrt(sortedNews.length)))); // 3-5 列
          const startX = 100;
          const startY = 100;

          // 創建節點 - 緊湊網格佈局，蛇形排列
          const newNodes: BoardNode[] = sortedNews.map((item, index) => {
            const row = Math.floor(index / cols);
            const colInRow = index % cols;
            // 蛇形排列：偶數行從左到右，奇數行從右到左
            const col = row % 2 === 0 ? colInRow : cols - 1 - colInRow;

            return {
              id: item.id,
              news: item,
              x: startX + col * (cardWidth + horizontalGap),
              y: startY + row * (cardHeight + verticalGap),
            };
          });

          setNodes(newNodes);

          // 創建連接 - 按時間順序連接
          const newConnections: Connection[] = [];
          for (let i = 0; i < sortedNews.length - 1; i++) {
            newConnections.push({
              from: sortedNews[i].id,
              to: sortedNews[i + 1].id,
            });
          }
          setConnections(newConnections);

          // 計算實際需要的 board 大小
          const totalRows = Math.ceil(sortedNews.length / cols);
          const boardWidth = startX + cols * (cardWidth + horizontalGap) + 200;
          const boardHeight = startY + totalRows * (cardHeight + verticalGap) + 150;
          setBoardSize({ width: boardWidth, height: boardHeight });

          // 計算適合的初始縮放比例
          const viewportHeight = window.innerHeight - 150; // 減去頂部工具列
          const viewportWidth = window.innerWidth;
          const scaleForHeight = viewportHeight / boardHeight;
          const scaleForWidth = viewportWidth / boardWidth;
          const optimalScale = Math.min(1, Math.max(0.3, Math.min(scaleForHeight, scaleForWidth) * 0.9));

          setScale(optimalScale);
          setOffset({ x: 0, y: 0 });
        }
      } catch (error) {
        console.error('Failed to fetch news:', error);
      } finally {
        setLoadingNews(false);
      }
    };
    loadNews();
  }, [selectedSeriesId]);

  // 開始平移
  const handleBoardMouseDown = (e: React.MouseEvent) => {
    setPanning(true);
    setLastMousePos({ x: e.clientX, y: e.clientY });
  };

  // 滑鼠移動
  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (panning) {
      const dx = e.clientX - lastMousePos.x;
      const dy = e.clientY - lastMousePos.y;
      setOffset(prev => ({ x: prev.x + dx, y: prev.y + dy }));
      setLastMousePos({ x: e.clientX, y: e.clientY });
    }
  }, [panning, lastMousePos]);

  // 滑鼠放開
  const handleMouseUp = () => {
    setPanning(false);
  };

  // 縮放
  const handleZoom = (delta: number) => {
    setScale(prev => Math.max(0.15, Math.min(2, prev + delta)));
  };

  // 重置視圖
  const handleReset = () => {
    // 計算適合的縮放比例
    const viewportHeight = window.innerHeight - 150;
    const viewportWidth = window.innerWidth;
    const scaleForHeight = viewportHeight / boardSize.height;
    const scaleForWidth = viewportWidth / boardSize.width;
    const optimalScale = Math.min(1, Math.max(0.3, Math.min(scaleForHeight, scaleForWidth) * 0.9));
    setScale(optimalScale);
    setOffset({ x: 0, y: 0 });
  };

  // 滾輪縮放 - 使用 ref 來添加 passive: false 的事件監聽
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const delta = e.deltaY > 0 ? -0.1 : 0.1;
      setScale(prev => Math.max(0.15, Math.min(2, prev + delta)));
    };

    container.addEventListener('wheel', handleWheel, { passive: false });
    return () => container.removeEventListener('wheel', handleWheel);
  }, []);

  const selectedSeries = series.find(s => s.id === selectedSeriesId);

  // 獲取節點位置
  const getNodePos = (nodeId: string) => {
    const node = nodes.find(n => n.id === nodeId);
    return node ? { x: node.x, y: node.y } : { x: 0, y: 0 };
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[600px]">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (series.length === 0) {
    return (
      <div className="container mx-auto px-4 py-12 text-center">
        <div className="max-w-md mx-auto">
          <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-muted flex items-center justify-center">
            <Pin className="w-10 h-10 text-muted-foreground" />
          </div>
          <h2 className="text-2xl font-bold mb-2">尚無新聞系列</h2>
          <p className="text-muted-foreground mb-6">
            新聞系列可在管理後台建立，用於追蹤特定議題的發展脈絡。
          </p>
          <Link to="/">
            <Button>返回首頁</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-4rem)] flex flex-col overflow-hidden">
      {/* 頂部工具列 */}
      <div className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 px-4 py-3">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-4">
            <h1 className="text-xl font-bold font-serif">系列追蹤板</h1>

            {/* 系列選擇器 */}
            <select
              value={selectedSeriesId || ''}
              onChange={(e) => setSelectedSeriesId(Number(e.target.value))}
              className="px-3 py-1.5 rounded-lg border bg-background text-sm font-medium"
            >
              {series.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>

            {selectedSeries && (
              <div className="flex items-center gap-2">
                <div
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: selectedSeries.color }}
                />
                <span className="text-sm text-muted-foreground">
                  {news.length} 則相關新聞
                </span>
              </div>
            )}
          </div>

          {/* 控制按鈕 */}
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => handleZoom(0.1)}>
              <ZoomIn className="w-4 h-4" />
            </Button>
            <span className="text-sm text-muted-foreground min-w-[4rem] text-center">
              {Math.round(scale * 100)}%
            </span>
            <Button variant="outline" size="sm" onClick={() => handleZoom(-0.1)}>
              <ZoomOut className="w-4 h-4" />
            </Button>
            <Button variant="outline" size="sm" onClick={handleReset}>
              <Maximize2 className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* 偵查板區域 */}
      <div
        ref={containerRef}
        className="flex-1 overflow-hidden relative touch-none"
        style={{
          background: `
            linear-gradient(rgba(139, 90, 43, 0.03) 1px, transparent 1px),
            linear-gradient(90deg, rgba(139, 90, 43, 0.03) 1px, transparent 1px),
            linear-gradient(to bottom right, #f5f0e8, #ebe4d8)
          `,
          backgroundSize: '20px 20px, 20px 20px, 100% 100%',
        }}
        onMouseDown={handleBoardMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        {/* 軟木板紋理覆蓋 - 簡化版提升性能 */}
        <div
          className="absolute inset-0 pointer-events-none opacity-10"
          style={{
            backgroundImage: `repeating-linear-gradient(
              45deg,
              transparent,
              transparent 2px,
              rgba(139, 90, 43, 0.1) 2px,
              rgba(139, 90, 43, 0.1) 4px
            )`,
          }}
        />

        {loadingNews ? (
          <div className="absolute inset-0 flex items-center justify-center">
            <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
          </div>
        ) : news.length === 0 ? (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center">
              <Pin className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
              <p className="text-muted-foreground">此系列尚無新聞</p>
            </div>
          </div>
        ) : (
          <div
            ref={boardRef}
            className="absolute"
            style={{
              transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})`,
              transformOrigin: 'top left',
              width: `${boardSize.width}px`,
              height: `${boardSize.height}px`,
              cursor: panning ? 'grabbing' : 'grab',
              willChange: 'transform',
            }}
          >
            {/* SVG 連接線 */}
            <svg
              className="absolute inset-0 pointer-events-none"
              style={{ width: '100%', height: '100%', willChange: 'transform' }}
            >
              <defs>
                {/* 紅線漸層 */}
                <linearGradient id="lineGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor={selectedSeries?.color || '#dc2626'} stopOpacity="0.8" />
                  <stop offset="50%" stopColor={selectedSeries?.color || '#dc2626'} stopOpacity="1" />
                  <stop offset="100%" stopColor={selectedSeries?.color || '#dc2626'} stopOpacity="0.8" />
                </linearGradient>
                {/* 圖釘陰影 */}
                <filter id="pinShadow" x="-50%" y="-50%" width="200%" height="200%">
                  <feDropShadow dx="1" dy="2" stdDeviation="2" floodOpacity="0.3" />
                </filter>
              </defs>

              {connections.map((conn, index) => {
                const from = getNodePos(conn.from);
                const to = getNodePos(conn.to);
                const cardWidth = 320;
                const cardHeight = 280;

                // 計算卡片連接點（從卡片邊緣出發）
                const fromCenter = { x: from.x + cardWidth / 2, y: from.y + cardHeight / 2 };
                const toCenter = { x: to.x + cardWidth / 2, y: to.y + cardHeight / 2 };

                // 計算控制點（讓線條有弧度）
                const midX = (fromCenter.x + toCenter.x) / 2;
                const midY = (fromCenter.y + toCenter.y) / 2;
                const dx = toCenter.x - fromCenter.x;
                const dy = toCenter.y - fromCenter.y;

                // 根據方向調整曲線
                const isHorizontal = Math.abs(dx) > Math.abs(dy);
                const curveOffset = isHorizontal ? 40 : 60;

                // 曲線控制點
                const ctrlX = midX;
                const ctrlY = isHorizontal ? midY - curveOffset : midY;

                return (
                  <g key={index}>
                    {/* 線條陰影 */}
                    <path
                      d={`M ${fromCenter.x} ${fromCenter.y} Q ${ctrlX} ${ctrlY} ${toCenter.x} ${toCenter.y}`}
                      fill="none"
                      stroke="rgba(0,0,0,0.1)"
                      strokeWidth="6"
                      strokeLinecap="round"
                    />
                    {/* 主線 */}
                    <path
                      d={`M ${fromCenter.x} ${fromCenter.y} Q ${ctrlX} ${ctrlY} ${toCenter.x} ${toCenter.y}`}
                      fill="none"
                      stroke={selectedSeries?.color || '#dc2626'}
                      strokeWidth="3"
                      strokeLinecap="round"
                      opacity="0.85"
                    />
                    {/* 線上的小結點 */}
                    <circle
                      cx={ctrlX}
                      cy={ctrlY}
                      r="5"
                      fill={selectedSeries?.color || '#dc2626'}
                      stroke="white"
                      strokeWidth="2"
                    />
                  </g>
                );
              })}
            </svg>

            {/* 新聞卡片節點 */}
            {nodes.map((node, index) => (
              <div
                key={node.id}
                className="absolute select-none z-10 hover:z-40"
                style={{
                  left: node.x,
                  top: node.y,
                  width: '320px',
                }}
              >
                {/* 圖釘 */}
                <div
                  className="absolute -top-4 left-1/2 -translate-x-1/2 z-20"
                  style={{ filter: 'url(#pinShadow)' }}
                >
                  <div
                    className="w-7 h-7 rounded-full shadow-lg flex items-center justify-center"
                    style={{
                      background: `radial-gradient(circle at 30% 30%, ${selectedSeries?.color || '#dc2626'}, ${selectedSeries?.color || '#991b1b'})`,
                    }}
                  >
                    <div className="w-2.5 h-2.5 rounded-full bg-white/40" />
                  </div>
                  <div
                    className="w-1.5 h-4 mx-auto -mt-1"
                    style={{ backgroundColor: selectedSeries?.color || '#7f1d1d' }}
                  />
                </div>

                {/* 序號標籤 */}
                <div
                  className="absolute -top-2 -left-2 z-30 w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-bold shadow-lg"
                  style={{ backgroundColor: selectedSeries?.color || '#dc2626' }}
                >
                  {index + 1}
                </div>

                {/* 卡片本體 */}
                <Link
                  to={`/news/${node.news.id}`}
                  className={cn(
                    'block bg-white rounded-lg shadow-lg border-2 overflow-hidden',
                    'hover:shadow-2xl hover:scale-105 transition-all duration-200',
                  )}
                  style={{
                    transform: `rotate(${(index % 5 - 2) * 0.8}deg)`,
                    borderColor: selectedSeries?.color || '#dc2626',
                  }}
                >
                  {/* 縮圖 */}
                  {node.news.thumbnail ? (
                    <div className="h-36 overflow-hidden">
                      <img
                        src={node.news.thumbnail}
                        alt=""
                        className="w-full h-full object-cover"
                        draggable={false}
                      />
                    </div>
                  ) : (
                    <div className="h-36 bg-gradient-to-br from-muted to-muted/50 flex items-center justify-center">
                      <Pin className="w-8 h-8 text-muted-foreground/30" />
                    </div>
                  )}

                  {/* 內容 */}
                  <div className="p-4">
                    <h3 className="text-base font-bold line-clamp-2 mb-3 leading-snug">
                      {node.news.title}
                    </h3>
                    <div className="flex items-center justify-between text-sm text-muted-foreground">
                      <div className="flex items-center gap-1.5">
                        <Clock size={14} />
                        <span>{timeAgo(node.news.publishedAt)}</span>
                      </div>
                      <span className="px-2 py-1 rounded-full bg-muted text-xs font-medium">
                        {node.news.source}
                      </span>
                    </div>
                  </div>
                </Link>

                {/* 時間標籤 */}
                <div
                  className="absolute -bottom-8 left-1/2 -translate-x-1/2 text-xs text-muted-foreground whitespace-nowrap bg-white/90 px-3 py-1 rounded-full shadow"
                >
                  {new Date(node.news.publishedAt).toLocaleDateString('zh-HK', {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* 操作提示 */}
        <div className="absolute bottom-4 left-4 text-xs text-muted-foreground bg-white/90 backdrop-blur px-4 py-2 rounded-lg shadow-lg border">
          <p>滾輪縮放 • 按住滑鼠拖動平移 • 點擊卡片查看詳情</p>
        </div>
      </div>
    </div>
  );
};
