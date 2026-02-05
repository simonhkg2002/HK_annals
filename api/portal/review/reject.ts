import type { VercelRequest, VercelResponse } from '@vercel/node';
import { db } from '../../_lib/db';
import { requireAuth } from '../../_lib/auth';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // 驗證管理員身份
  const session = requireAuth(req, res);
  if (!session) return;

  const { articleId } = req.body || {};

  if (!articleId) {
    return res.status(400).json({ error: 'Missing articleId' });
  }

  try {
    await db.execute({
      sql: `
        UPDATE articles
        SET series_id = NULL, review_status = 'rejected'
        WHERE id = ?
      `,
      args: [articleId],
    });

    return res.status(200).json({ success: true });
  } catch (error) {
    console.error('Error rejecting review:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
