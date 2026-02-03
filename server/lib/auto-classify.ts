/**
 * 自動分類邏輯
 * 根據系列的關鍵詞自動將新聞分類到對應系列
 */

import { db } from '../db/client';

export interface NewsSeries {
  id: number;
  name: string;
  keywords: string[];
  autoAddEnabled: boolean;
  createdAt: string;
}

/**
 * 檢查標題是否包含關鍵詞（完整匹配）
 * @param title 新聞標題
 * @param keywords 關鍵詞列表
 * @returns 匹配的關鍵詞，如果沒有匹配則返回 null
 */
export function checkKeywordMatch(title: string, keywords: string[]): string | null {
  const normalizedTitle = title.toLowerCase();

  for (const keyword of keywords) {
    const normalizedKeyword = keyword.toLowerCase().trim();
    if (normalizedKeyword && normalizedTitle.includes(normalizedKeyword)) {
      return keyword; // 返回匹配的關鍵詞（原始大小寫）
    }
  }

  return null;
}

/**
 * 找到匹配的系列（依創建時間最新優先）
 * @param title 新聞標題
 * @param allSeries 所有啟用自動加入的系列
 * @returns 匹配的系列和關鍵詞，如果沒有匹配則返回 null
 */
export function findMatchingSeries(
  title: string,
  allSeries: NewsSeries[]
): { series: NewsSeries; keyword: string } | null {
  // 依 created_at DESC 排序（最新的優先）
  const sortedSeries = allSeries
    .filter((s) => s.autoAddEnabled && s.keywords && s.keywords.length > 0)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  for (const series of sortedSeries) {
    const matchedKeyword = checkKeywordMatch(title, series.keywords);
    if (matchedKeyword) {
      return { series, keyword: matchedKeyword };
    }
  }

  return null;
}

/**
 * 獲取所有啟用自動加入的系列
 */
export async function fetchActiveSeriesForAutoClassify(): Promise<NewsSeries[]> {
  const result = await db.execute(`
    SELECT id, name, keywords, auto_add_enabled, created_at
    FROM news_series
    WHERE is_active = 1 AND auto_add_enabled = 1 AND keywords IS NOT NULL
    ORDER BY created_at DESC
  `);

  return result.rows.map((row) => {
    const r = row as Record<string, unknown>;
    return {
      id: r.id as number,
      name: r.name as string,
      keywords: r.keywords ? JSON.parse(r.keywords as string) : [],
      autoAddEnabled: r.auto_add_enabled === 1,
      createdAt: r.created_at as string,
    };
  });
}

/**
 * 自動分類文章
 * @param articleId 文章 ID
 * @param title 文章標題
 * @returns 是否成功分類
 */
export async function autoClassifyArticle(
  articleId: number,
  title: string
): Promise<{ classified: boolean; seriesId?: number; keyword?: string }> {
  try {
    // 獲取所有啟用自動加入的系列
    const allSeries = await fetchActiveSeriesForAutoClassify();

    if (allSeries.length === 0) {
      return { classified: false };
    }

    // 找到匹配的系列
    const match = findMatchingSeries(title, allSeries);

    if (!match) {
      return { classified: false };
    }

    // 更新文章：設定系列、標記為自動分類、設定複核狀態
    await db.execute({
      sql: `
        UPDATE articles
        SET series_id = ?,
            auto_classified = 1,
            review_status = 'pending',
            auto_classified_at = datetime('now'),
            matched_keyword = ?
        WHERE id = ?
      `,
      args: [match.series.id, match.keyword, articleId],
    });

    console.log(
      `  ✓ Auto-classified article #${articleId} to series "${match.series.name}" (keyword: "${match.keyword}")`
    );

    return {
      classified: true,
      seriesId: match.series.id,
      keyword: match.keyword,
    };
  } catch (error) {
    console.error(`  ✗ Failed to auto-classify article #${articleId}:`, error);
    return { classified: false };
  }
}
