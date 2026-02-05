import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@libsql/client';

const db = createClient({
  url: process.env.TURSO_DATABASE_URL || '',
  authToken: process.env.TURSO_AUTH_TOKEN || '',
});

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const action = req.query.action as string;
  const seriesId = req.query.seriesId as string;

  try {
    if (action === 'daily') {
      const days = Math.min(Number(req.query.days) || 7, 90);
      if (seriesId) {
        const result = await db.execute({ sql: `SELECT date(a.published_at) as date, COUNT(*) as count FROM articles a WHERE a.published_at >= datetime('now', ?) AND a.series_id = ? GROUP BY date(a.published_at) ORDER BY date DESC`, args: [`-${days} days`, seriesId] });
        return res.status(200).json(result.rows.map(r => ({ date: (r as Record<string, unknown>).date as string, count: (r as Record<string, unknown>).count as number })));
      }
      const result = await db.execute({ sql: `SELECT date(published_at) as date, COUNT(*) as count FROM articles WHERE published_at >= datetime('now', ?) GROUP BY date(published_at) ORDER BY date DESC`, args: [`-${days} days`] });
      return res.status(200).json(result.rows.map(r => ({ date: (r as Record<string, unknown>).date as string, count: (r as Record<string, unknown>).count as number })));
    }

    // Stats
    if (seriesId) {
      const [total, today, sources, categories] = await Promise.all([
        db.execute({ sql: `SELECT COUNT(*) as count FROM articles WHERE series_id = ?`, args: [seriesId] }),
        db.execute({ sql: `SELECT COUNT(*) as count FROM articles WHERE series_id = ? AND date(published_at) = date('now')`, args: [seriesId] }),
        db.execute({ sql: `SELECT ms.name_zh as name, COUNT(a.id) as count FROM articles a JOIN media_sources ms ON a.media_source_id = ms.id WHERE a.series_id = ? GROUP BY ms.id ORDER BY count DESC`, args: [seriesId] }),
        db.execute({ sql: `SELECT c.name_zh as name, COUNT(a.id) as count FROM articles a LEFT JOIN categories c ON a.category_id = c.id WHERE a.series_id = ? GROUP BY c.id ORDER BY count DESC`, args: [seriesId] }),
      ]);
      return res.status(200).json({
        totalArticles: (total.rows[0] as Record<string, unknown>).count as number,
        todayArticles: (today.rows[0] as Record<string, unknown>).count as number,
        sources: sources.rows.map(r => ({ name: (r as Record<string, unknown>).name as string, count: (r as Record<string, unknown>).count as number })),
        categories: categories.rows.map(r => ({ name: ((r as Record<string, unknown>).name as string) || '未分類', count: (r as Record<string, unknown>).count as number })),
      });
    }

    const [total, today, sources, categories] = await Promise.all([
      db.execute('SELECT COUNT(*) as count FROM articles'),
      db.execute(`SELECT COUNT(*) as count FROM articles WHERE date(published_at) = date('now')`),
      db.execute(`SELECT ms.name_zh as name, COUNT(a.id) as count FROM articles a JOIN media_sources ms ON a.media_source_id = ms.id GROUP BY ms.id ORDER BY count DESC`),
      db.execute(`SELECT c.name_zh as name, COUNT(a.id) as count FROM articles a LEFT JOIN categories c ON a.category_id = c.id GROUP BY c.id ORDER BY count DESC`),
    ]);
    return res.status(200).json({
      totalArticles: (total.rows[0] as Record<string, unknown>).count as number,
      todayArticles: (today.rows[0] as Record<string, unknown>).count as number,
      sources: sources.rows.map(r => ({ name: (r as Record<string, unknown>).name as string, count: (r as Record<string, unknown>).count as number })),
      categories: categories.rows.map(r => ({ name: ((r as Record<string, unknown>).name as string) || '未分類', count: (r as Record<string, unknown>).count as number })),
    });
  } catch (error) {
    console.error('Stats API Error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
