import { Context, Next } from 'hono';
import { verifyToken } from '../modules/auth/service.js';

export async function authMiddleware(c: Context, next: Next) {
  const header = c.req.header('Authorization');
  if (!header?.startsWith('Bearer ')) {
    return c.json({ error: 'Unauthorized' }, 401);
  }
  try {
    const payload = verifyToken(header.slice(7));
    c.set('userId', payload.userId);
    c.set('userRole', payload.role);
    await next();
  } catch {
    return c.json({ error: 'Invalid token' }, 401);
  }
}
