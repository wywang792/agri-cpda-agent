import { Hono } from 'hono';
import { authMiddleware } from '../../middleware/auth.js';
import { createOrder, getOrders, getOrderDetail, updateOrderStatus } from './service.js';

export const orderRouter = new Hono();
orderRouter.use('*', authMiddleware);

orderRouter.post('/', async (c) => {
  try {
    const body = await c.req.json();
    const userId = c.get('userId');
    const userRole = c.get('userRole');
    return c.json(await createOrder(body, userId, userRole), 201);
  } catch (e: any) {
    return c.json({ error: e.message }, 400);
  }
});

orderRouter.get('/', async (c) => {
  const userId = c.get('userId');
  const status = c.req.query('status');
  return c.json(await getOrders(userId, status ? { status } : undefined));
});

orderRouter.get('/:id', async (c) => {
  const { id } = c.req.param();
  const result = await getOrderDetail(id);
  if (!result) return c.json({ error: 'Order not found' }, 404);
  return c.json(result);
});

orderRouter.patch('/:id/status', async (c) => {
  const { id } = c.req.param();
  const { status } = await c.req.json();
  return c.json(await updateOrderStatus(id, status));
});
