import { Hono } from 'hono';
import { register, login } from './service.js';

export const authRouter = new Hono();

authRouter.post('/register', async (c) => {
  try {
    const { username, password, role, marketId } = await c.req.json();
    const result = await register(username, password, role, marketId);
    return c.json(result, 201);
  } catch (e: any) {
    return c.json({ error: e.message }, 400);
  }
});

authRouter.post('/login', async (c) => {
  try {
    const { username, password } = await c.req.json();
    const result = await login(username, password);
    return c.json(result);
  } catch (e: any) {
    return c.json({ error: e.message }, 401);
  }
});
