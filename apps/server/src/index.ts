import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { authRouter } from './modules/auth/router.js';
import { productRouter } from './modules/product/router.js';
import { orderRouter } from './modules/order/router.js';
import { chatRouter } from './modules/chat/router.js';
import 'dotenv/config';

const app = new Hono();

app.use('*', logger());
app.use('*', cors());

app.route('/api/auth', authRouter);
app.route('/api/products', productRouter);
app.route('/api/orders', orderRouter);
app.route('/api/chat', chatRouter);

app.get('/health', (c) => c.json({ status: 'ok' }));

const port = Number(process.env.PORT) || 3000;
console.log(`Server running on port ${port}`);

export default { port, fetch: app.fetch };
