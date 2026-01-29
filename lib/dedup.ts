/**
 * 新聞去重系統
 * 用於檢測和處理來自多個平台的重複或相似新聞
 */

import { createHash } from 'crypto';

// ============ 文字正規化 ============

/**
 * 正規化標題（移除空白、標點、統一大小寫）
 */
export function normalizeTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/\s+/g, '')           // 移除所有空白
    .replace(/[「」『』【】〈〉《》（）()[\]]/g, '') // 移除括號
    .replace(/[，。、；：！？,.;:!?]/g, '')  // 移除標點
    .replace(/[""'']/g, '')        // 移除引號
    .trim();
}

/**
 * 提取中文關鍵字（簡單分詞）
 */
export function extractKeywords(text: string): string[] {
  // 移除 HTML 標籤
  const cleanText = text.replace(/<[^>]*>/g, '');

  // 提取中文詞組（2-4字）和英文單詞
  const chineseWords = cleanText.match(/[\u4e00-\u9fff]{2,4}/g) || [];
  const englishWords = cleanText.match(/[a-zA-Z]{3,}/g) || [];

  // 移除常見停用詞
  const stopWords = new Set([
    '的', '是', '在', '有', '和', '了', '不', '人', '都', '為',
    '這', '那', '他', '她', '它', '我', '你', '說', '也', '就',
    '要', '會', '可', '能', '但', '而', '之', '其', '與', '或',
    '被', '將', '已', '對', '等', '更', '又', '以', '及', '於',
    '今日', '今天', '昨日', '昨天', '明日', '明天', '記者', '報導',
    'the', 'and', 'for', 'that', 'this', 'with', 'from', 'have', 'has'
  ]);

  const allWords = [...chineseWords, ...englishWords.map(w => w.toLowerCase())];
  return [...new Set(allWords.filter(w => !stopWords.has(w)))];
}

// ============ 雜湊與相似度計算 ============

/**
 * 生成內容雜湊值
 */
export function generateContentHash(content: string): string {
  const normalized = content
    .replace(/<[^>]*>/g, '')       // 移除 HTML
    .replace(/\s+/g, '')           // 移除空白
    .toLowerCase();

  return createHash('md5').update(normalized).digest('hex');
}

/**
 * 計算兩個字串的 Jaccard 相似度
 */
export function jaccardSimilarity(set1: string[], set2: string[]): number {
  const s1 = new Set(set1);
  const s2 = new Set(set2);

  const intersection = new Set([...s1].filter(x => s2.has(x)));
  const union = new Set([...s1, ...s2]);

  if (union.size === 0) return 0;
  return intersection.size / union.size;
}

/**
 * 計算標題相似度（使用編輯距離）
 */
export function titleSimilarity(title1: string, title2: string): number {
  const s1 = normalizeTitle(title1);
  const s2 = normalizeTitle(title2);

  // 如果正規化後完全相同
  if (s1 === s2) return 1;

  // 使用 Levenshtein 距離
  const distance = levenshteinDistance(s1, s2);
  const maxLen = Math.max(s1.length, s2.length);

  if (maxLen === 0) return 0;
  return 1 - (distance / maxLen);
}

/**
 * Levenshtein 編輯距離
 */
function levenshteinDistance(s1: string, s2: string): number {
  const m = s1.length;
  const n = s2.length;

  const dp: number[][] = Array(m + 1).fill(null).map(() => Array(n + 1).fill(0));

  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (s1[i - 1] === s2[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1];
      } else {
        dp[i][j] = Math.min(
          dp[i - 1][j] + 1,     // 刪除
          dp[i][j - 1] + 1,     // 插入
          dp[i - 1][j - 1] + 1  // 替換
        );
      }
    }
  }

  return dp[m][n];
}

// ============ 去重檢測介面 ============

export interface DuplicateCheckResult {
  isDuplicate: boolean;
  matchType: 'none' | 'exact_url' | 'exact_content' | 'similar_title' | 'similar_content';
  matchedArticleId?: string;
  clusterId?: string;
  similarityScore: number;
}

export interface ArticleForDedup {
  id: string;
  title: string;
  content: string;
  source_url: string;
  content_hash?: string;
  title_normalized?: string;
  cluster_id?: string;
}

/**
 * 檢查文章是否重複
 * @param newArticle 新文章
 * @param existingArticles 現有文章（通常是過去24-48小時內的）
 * @param thresholds 相似度閾值
 */
export function checkDuplicate(
  newArticle: { title: string; content: string; sourceUrl: string },
  existingArticles: ArticleForDedup[],
  thresholds = {
    titleSimilarity: 0.8,    // 標題相似度 >= 80% 視為重複
    contentSimilarity: 0.6,  // 內容相似度 >= 60% 視為相似
  }
): DuplicateCheckResult {

  const newContentHash = generateContentHash(newArticle.content);
  const newTitleNormalized = normalizeTitle(newArticle.title);
  const newKeywords = extractKeywords(newArticle.title + ' ' + newArticle.content);

  for (const existing of existingArticles) {
    // 1. URL 完全相同
    if (existing.source_url === newArticle.sourceUrl) {
      return {
        isDuplicate: true,
        matchType: 'exact_url',
        matchedArticleId: existing.id,
        clusterId: existing.cluster_id,
        similarityScore: 1,
      };
    }

    // 2. 內容 Hash 相同（完全相同的內容）
    if (existing.content_hash && existing.content_hash === newContentHash) {
      return {
        isDuplicate: true,
        matchType: 'exact_content',
        matchedArticleId: existing.id,
        clusterId: existing.cluster_id,
        similarityScore: 1,
      };
    }

    // 3. 標題相似度檢測
    const titleSim = titleSimilarity(newArticle.title, existing.title);
    if (titleSim >= thresholds.titleSimilarity) {
      return {
        isDuplicate: true,
        matchType: 'similar_title',
        matchedArticleId: existing.id,
        clusterId: existing.cluster_id,
        similarityScore: titleSim,
      };
    }

    // 4. 內容關鍵字相似度
    const existingKeywords = extractKeywords(existing.title + ' ' + existing.content);
    const contentSim = jaccardSimilarity(newKeywords, existingKeywords);
    if (contentSim >= thresholds.contentSimilarity) {
      return {
        isDuplicate: false,  // 不是完全重複，但相似
        matchType: 'similar_content',
        matchedArticleId: existing.id,
        clusterId: existing.cluster_id,
        similarityScore: contentSim,
      };
    }
  }

  return {
    isDuplicate: false,
    matchType: 'none',
    similarityScore: 0,
  };
}

/**
 * 生成群組 ID
 */
export function generateClusterId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 8);
  return `cluster_${timestamp}_${random}`;
}
