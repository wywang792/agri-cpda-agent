import { Hono } from 'hono';
import { authMiddleware } from '../../middleware/auth.js';
import { listProducts, getProductWithPrice, listSupplierProducts } from './service.js';

export const productRouter = new Hono();
productRouter.use('*', authMiddleware);

productRouter.get('/', async (c) => {
  const marketId = c.req.query('marketId') || '';
  const search = c.req.query('search');
  return c.json(await listProducts(marketId, search));
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
