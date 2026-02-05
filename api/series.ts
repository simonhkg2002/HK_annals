import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@libsql/client';

const db = createClient({
  url: process.env.TURSO_DATABASE_URL || '',
  authToken: process.env.TURSO_AUTH_TOKEN || '',
});

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const result = await db.execute(`SELECT id, name, description, color, is_active, created_at, keywords, auto_add_enabled FROM news_series WHERE is_active = 1 ORDER BY created_at DESC`);
    const series = result.rows.map(r => {
      const row = r as Record<string, unknown>;
      return {
        id: row.id as number,
        name: row.name as string,
        description: row.description as string | null,
        color: row.color as string,
        isActive: row.is_active === 1,
        createdAt: row.created_at as string | null,
        keywords: row.keywords ? JSON.parse(row.keywords as string) : [],
        autoAddEnabled: row.auto_add_enabled === 1,
      };
    });
    return res.status(200).json(series);
  } catch (error) {
    console.error('Series API Error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
