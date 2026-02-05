import type { VercelRequest, VercelResponse } from '@vercel/node';

// Session token 的有效期（24 小時）
const SESSION_DURATION_MS = 24 * 60 * 60 * 1000;

// 簡單的 session 結構（存在記憶體中，重啟後失效）
// 生產環境可考慮使用 Redis 或資料庫存儲
interface Session {
  userId: number;
  username: string;
  displayName: string;
  createdAt: number;
  expiresAt: number;
}

const sessions = new Map<string, Session>();

/**
 * 生成隨機 token
 */
function generateToken(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < 64; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

/**
 * 創建新 session
 */
export function createSession(userId: number, username: string, displayName: string): string {
  const token = generateToken();
  const now = Date.now();

  sessions.set(token, {
    userId,
    username,
    displayName,
    createdAt: now,
    expiresAt: now + SESSION_DURATION_MS,
  });

  return token;
}

/**
 * 驗證 session token
 */
export function validateSession(token: string | null | undefined): Session | null {
  if (!token) return null;

  const session = sessions.get(token);
  if (!session) return null;

  // 檢查是否過期
  if (Date.now() > session.expiresAt) {
    sessions.delete(token);
    return null;
  }

  return session;
}

/**
 * 刪除 session
 */
export function deleteSession(token: string): void {
  sessions.delete(token);
}

/**
 * 從請求中提取 token
 */
export function getTokenFromRequest(req: VercelRequest): string | null {
  // 優先從 Authorization header 獲取
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith('Bearer ')) {
    return authHeader.slice(7);
  }

  // 其次從 query 獲取
  if (typeof req.query.token === 'string') {
    return req.query.token;
  }

  return null;
}

/**
 * 認證中間件 - 驗證管理員 API 請求
 */
export function requireAuth(
  req: VercelRequest,
  res: VercelResponse
): Session | null {
  const token = getTokenFromRequest(req);
  const session = validateSession(token);

  if (!session) {
    res.status(401).json({ error: 'Unauthorized' });
    return null;
  }

  return session;
}

/**
 * 使用 SHA-256 雜湊密碼
 */
export async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}
