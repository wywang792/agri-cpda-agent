import { Hono } from 'hono';
import type { UserRole } from '@agent-xfd/shared';
import { authMiddleware } from '../../middleware/auth.js';
import {
  createBuyerAddress,
  deleteBuyerAddress,
  listBuyerAddresses,
  setDefaultBuyerAddress,
  updateBuyerAddress,
} from './service.js';

type AuthVariables = {
  userId: string;
  userRole: UserRole;
};

export const buyerAddressRouter = new Hono<{ Variables: AuthVariables }>();
buyerAddressRouter.use('*', authMiddleware);

function ensureBuyer(userRole: UserRole) {
  if (userRole !== 'buyer') {
    throw new Error('Only buyers can manage addresses');
  }
}

buyerAddressRouter.get('/', async (c) => {
  try {
    ensureBuyer(c.get('userRole'));
    return c.json(await listBuyerAddresses(c.get('userId')));
  } catch (error: any) {
    return c.json({ error: error.message }, error.message.includes('Only buyers') ? 403 : 400);
  }
});

buyerAddressRouter.post('/', async (c) => {
  try {
    ensureBuyer(c.get('userRole'));
    const body = await c.req.json();
    return c.json(await createBuyerAddress(c.get('userId'), body), 201);
  } catch (error: any) {
    return c.json({ error: error.message }, error.message.includes('Only buyers') ? 403 : 400);
  }
});

buyerAddressRouter.patch('/:id', async (c) => {
  try {
    ensureBuyer(c.get('userRole'));
    const body = await c.req.json();
    return c.json(await updateBuyerAddress(c.get('userId'), c.req.param('id'), body));
  } catch (error: any) {
    const status = error.message.includes('Only buyers') ? 403 : error.message.includes('不存在') ? 404 : 400;
    return c.json({ error: error.message }, status);
  }
});

buyerAddressRouter.delete('/:id', async (c) => {
  try {
    ensureBuyer(c.get('userRole'));
    return c.json(await deleteBuyerAddress(c.get('userId'), c.req.param('id')));
  } catch (error: any) {
    const status = error.message.includes('Only buyers') ? 403 : error.message.includes('不存在') ? 404 : 400;
    return c.json({ error: error.message }, status);
  }
});

buyerAddressRouter.post('/:id/default', async (c) => {
  try {
    ensureBuyer(c.get('userRole'));
    return c.json(await setDefaultBuyerAddress(c.get('userId'), c.req.param('id')));
  } catch (error: any) {
    const status = error.message.includes('Only buyers') ? 403 : error.message.includes('不存在') ? 404 : 400;
    return c.json({ error: error.message }, status);
  }
});
