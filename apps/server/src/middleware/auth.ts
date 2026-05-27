import { Context, Next } from 'hono';
import { verifyToken } from '../modules/auth/service.js';

export async function authMiddleware(c: Context, next: Next) {
  const path = c.req.path;
  const method = c.req.method;
  console.log(`[Auth] ${method} ${path}`);

  const header = c.req.header('Authorization');
  if (!header?.startsWith('Bearer ')) {
    console.log('[Auth] No token provided');
    return c.json({ error: 'Unauthorized' }, 401);
  }

  try {
    const payload = verifyToken(header.slice(7));
    c.set('userId', payload.userId);
    c.set('userRole', payload.role);
    console.log(`[Auth] OK userId=${payload.userId} role=${payload.role}`);
    await next();
  } catch (e: any) {
    console.log('[Auth] Invalid token:', e.message);
    return c.json({ error: 'Invalid token' }, 401);
  }
}