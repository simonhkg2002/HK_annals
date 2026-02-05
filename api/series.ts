import type { VercelRequest, VercelResponse } from '@vercel/node';
import { db } from './lib/db';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const result = await db.execute(`
      SELECT id, name, description, color, is_active, created_at, keywords, auto_add_enabled
      FROM news_series
      WHERE is_active = 1
      ORDER BY created_at DESC
    `);

    const series = result.rows.map((row) => {
      const r = row as Record<string, unknown>;
      return {
        id: r.id as number,
        name: r.name as string,
        description: r.description as string | null,
        color: r.color as string,
        isActive: r.is_active === 1,
        createdAt: r.created_at as string | null,
        keywords: r.keywords ? JSON.parse(r.keywords as string) : [],
        autoAddEnabled: r.auto_add_enabled === 1,
      };
    });

    return res.status(200).json(series);
  } catch (error) {
    console.error('Series API Error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
