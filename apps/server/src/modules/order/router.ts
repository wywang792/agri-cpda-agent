import { Hono } from 'hono';
import { authMiddleware } from '../../middleware/auth.js';
import { createOrder, getOrders, getOrderDetail, updateOrderStatus } from './service.js';
import type { OrderStatus } from '@agent-xfd/shared';

type AuthVariables = {
  userId: string;
  userRole: 'buyer' | 'supplier';
};

const orderStatuses: OrderStatus[] = [
  'pending',
  'confirmed',
  'sorting',
  'sorted',
  'delivering',
  'completed',
  'cancelled',
];

function isOrderStatus(value: string | undefined): value is OrderStatus {
  return value !== undefined && orderStatuses.includes(value as OrderStatus);
}

export const orderRouter = new Hono<{ Variables: AuthVariables }>();
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
  return c.json(await getOrders(userId, isOrderStatus(status) ? { status } : undefined));
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
