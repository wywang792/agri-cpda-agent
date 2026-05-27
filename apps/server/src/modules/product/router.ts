import { Hono } from 'hono';
import { authMiddleware } from '../../middleware/auth.js';
import { db } from '../../db/index.js';
import { users } from '../../db/schema.js';
import { eq } from 'drizzle-orm';
import { listProductPrices, getProductWithPrice, listSupplierProducts } from './service.js';

type AuthVariables = {
  userId: string;
  userRole: 'buyer' | 'supplier';
};

export const productRouter = new Hono<{ Variables: AuthVariables }>();
productRouter.use('*', authMiddleware);

productRouter.get('/', async (c) => {
  const userId = c.get('userId');
  const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!user) return c.json({ error: 'User not found' }, 404);

  const search = c.req.query('search');
  return c.json(await listProductPrices(user.marketId, search));
});

productRouter.get('/:id', async (c) => {
  const { id } = c.req.param();
  const supplierId = c.req.query('supplierId');
  const result = await getProductWithPrice(id, supplierId);
  if (!result) return c.json({ error: 'Product not found' }, 404);
  return c.json(result);
});

productRouter.get('/supplier/:supplierId', async (c) => {
  const { supplierId } = c.req.param();
  return c.json(await listSupplierProducts(supplierId));
});
