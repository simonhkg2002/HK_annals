import type { VercelRequest, VercelResponse } from '@vercel/node';
import { db } from '../_lib/db';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const result = await db.execute(`
      SELECT DISTINCT date(published_at) as date
      FROM articles
      ORDER BY date DESC
    `);

    const dates = result.rows.map((row) => row.date as string);
    return res.status(200).json(dates);
  } catch (error) {
    console.error('Error fetching dates:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
