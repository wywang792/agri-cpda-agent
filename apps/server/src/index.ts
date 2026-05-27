import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { createServer, type IncomingMessage } from 'node:http';
import { Readable } from 'node:stream';
import { authRouter } from './modules/auth/router.js';
import { productRouter } from './modules/product/router.js';
import { orderRouter } from './modules/order/router.js';
import { chatRouter } from './modules/chat/router.js';
import { buyerAddressRouter } from './modules/buyerAddress/router.js';
import 'dotenv/config';

const app = new Hono();

app.use('*', logger());
app.use('*', cors());

app.route('/api/auth', authRouter);
app.route('/api/products', productRouter);
app.route('/api/orders', orderRouter);
app.route('/api/chat', chatRouter);
app.route('/api/buyer-addresses', buyerAddressRouter);

app.get('/health', (c) => c.json({ status: 'ok' }));

const port = Number(process.env.PORT) || 3000;
const hostname = process.env.HOST || '0.0.0.0';

function toRequest(req: IncomingMessage): Request {
  const protocol = process.env.NODE_ENV === 'production' ? 'https' : 'http';
  const host = req.headers.host || `${hostname}:${port}`;
  const url = new URL(req.url || '/', `${protocol}://${host}`);
  const headers = new Headers();

  for (const [key, value] of Object.entries(req.headers)) {
    if (Array.isArray(value)) {
      headers.set(key, value.join(', '));
    } else if (value !== undefined) {
      headers.set(key, value);
    }
  }

  const hasBody = req.method !== 'GET' && req.method !== 'HEAD';
  const init: RequestInit & { duplex?: 'half' } = {
    method: req.method,
    headers,
    body: hasBody ? (Readable.toWeb(req) as ReadableStream) : undefined,
    duplex: hasBody ? 'half' : undefined,
  };

  return new Request(url, init);
}

const server = createServer(async (req, res) => {
  try {
    const response = await app.fetch(toRequest(req));

    res.statusCode = response.status;
    response.headers.forEach((value, key) => {
      res.setHeader(key, value);
    });

    if (!response.body) {
      res.end();
      return;
    }

    Readable.fromWeb(response.body as any).pipe(res);
  } catch (error) {
    console.error('[Server] Request failed:', error);
    res.statusCode = 500;
    res.end('Internal Server Error');
  }
});

server.listen(port, hostname, () => {
  console.log(`Server running on http://${hostname}:${port}`);
});

export default { port, fetch: app.fetch };
