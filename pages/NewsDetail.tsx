import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { fetchNewsById, fetchRelatedNews, NewsDetail as NewsDetailType } from '../lib/data';
import { NewsCard } from '../components/NewsCard';
import { Button, Card, Badge } from '../components/ui/primitives';
import {
  ArrowLeft,
  ExternalLink,
  Calendar,
  User,
  Tag,
  Loader2,
  Share2,
  Clock,
  Newspaper,
} from 'lucide-react';
import { format } from 'date-fns';
import { zhHK } from 'date-fns/locale';
import { NewsItem } from '../types';

// 來源顏色
const SOURCE_COLORS: Record<string, string> = {
  'HK01': 'bg-orange-500',
  '明報': 'bg-blue-600',
  'RTHK': 'bg-red-600',
};

export const NewsDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [news, setNews] = useState<NewsDetailType | null>(null);
  const [relatedNews, setRelatedNews] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadNews = async () => {
      if (!id) return;

      setLoading(true);
      setError(null);

      try {
        const data = await fetchNewsById(id);

        if (!data) {
          setError('找不到此新聞');
          return;
        }

        setNews(data);

        // 載入相關新聞
        const related = await fetchRelatedNews(id, data.clusterId, data.category);
        setRelatedNews(related);
      } catch (err) {
        console.error('Failed to fetch news:', err);
        setError('載入失敗，請稍後再試');
      } finally {
        setLoading(false);
      }
    };

    loadNews();
  }, [id]);

  // 分享功能
  const handleShare = async () => {
    if (!news) return;

    const shareData = {
      title: news.title,
      text: news.summary,
      url: window.location.href,
    };

    if (navigator.share) {
      try {
        await navigator.share(shareData);
      } catch (err) {
        // 用戶取消分享
      }
    } else {
      // 複製連結到剪貼板
      await navigator.clipboard.writeText(window.location.href);
      alert('連結已複製到剪貼板');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !news) {
    return (
      <div className="container mx-auto px-4 py-12 text-center">
        <div className="max-w-md mx-auto">
          <Newspaper className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
          <h1 className="text-2xl font-bold mb-2">{error || '找不到此新聞'}</h1>
          <p className="text-muted-foreground mb-6">
            新聞可能已被移除或連結無效
          </p>
          <Button onClick={() => navigate('/')}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            返回首頁
          </Button>
        </div>
      </div>
    );
  }

  const publishDate = new Date(news.publishedAt);
  const formattedDate = format(publishDate, 'yyyy年M月d日 EEEE', { locale: zhHK });
  const formattedTime = format(publishDate, 'HH:mm');

  return (
    <div className="animate-in fade-in duration-300">
      {/* 返回導航 */}
      <div className="border-b bg-muted/30">
        <div className="container mx-auto px-4 py-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate(-1)}
            className="text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            返回
          </Button>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          {/* 文章頭部 */}
          <article>
            {/* 分類和來源 */}
            <div className="flex items-center gap-3 mb-4">
              <Badge variant="secondary">{news.category}</Badge>
              <Badge className={`${SOURCE_COLORS[news.source] || 'bg-gray-500'} text-white`}>
                {news.source}
              </Badge>
              {news.clusterId && (
                <Badge variant="outline" className="text-xs">
                  <Tag className="w-3 h-3 mr-1" />
                  相關報導
                </Badge>
              )}
            </div>

            {/* 標題 */}
            <h1 className="text-3xl md:text-4xl font-bold font-serif leading-tight mb-6">
              {news.title}
            </h1>

            {/* 元資訊 */}
            <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground mb-6 pb-6 border-b">
              <div className="flex items-center gap-1">
                <Calendar className="w-4 h-4" />
                <span>{formattedDate}</span>
              </div>
              <div className="flex items-center gap-1">
                <Clock className="w-4 h-4" />
                <span>{formattedTime}</span>
              </div>
              {news.author && (
                <div className="flex items-center gap-1">
                  <User className="w-4 h-4" />
                  <span>{news.author}</span>
                </div>
              )}
            </div>

            {/* 縮圖 */}
            {news.thumbnail && (
              <div className="mb-8 rounded-lg overflow-hidden">
                <img
                  src={news.thumbnail}
                  alt={news.title}
                  className="w-full h-auto max-h-[500px] object-cover"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = 'none';
                  }}
                />
              </div>
            )}

            {/* 摘要 */}
            <div className="bg-muted/30 border-l-4 border-brand-blue p-4 mb-8 rounded-r-lg">
              <p className="text-lg leading-relaxed">{news.summary}</p>
            </div>

            {/* 內容 */}
            {news.content && (
              <div className="prose prose-lg max-w-none mb-8">
                <div
                  className="text-foreground leading-relaxed whitespace-pre-wrap"
                  dangerouslySetInnerHTML={{ __html: news.content }}
                />
              </div>
            )}

            {/* 標籤 */}
            {news.tags && news.tags.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-8">
                {news.tags.map((tag, index) => (
                  <Badge key={index} variant="outline">
                    {tag}
                  </Badge>
                ))}
              </div>
            )}

            {/* 操作按鈕 */}
            <div className="flex flex-wrap gap-3 py-6 border-t border-b">
              <a
                href={news.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex"
              >
                <Button variant="default">
                  <ExternalLink className="w-4 h-4 mr-2" />
                  閱讀原文
                </Button>
              </a>
              <Button variant="outline" onClick={handleShare}>
                <Share2 className="w-4 h-4 mr-2" />
                分享
              </Button>
            </div>
          </article>

          {/* 相關新聞 */}
          {relatedNews.length > 0 && (
            <section className="mt-12">
              <h2 className="text-2xl font-bold font-serif mb-6 flex items-center gap-2">
                <Newspaper className="w-6 h-6" />
                {news.clusterId ? '相關報導' : '更多新聞'}
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {relatedNews.map((item) => (
                  <NewsCard key={item.id} news={item} />
                ))}
              </div>
            </section>
          )}
        </div>
      </div>
    </div>
  );
};
