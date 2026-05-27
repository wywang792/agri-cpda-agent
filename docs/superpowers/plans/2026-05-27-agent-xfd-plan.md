# 农产品订单 Agent — 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build an Agent-driven mobile app for agricultural order management using voice/natural language, with LangGraph.js workflow, RAG retrieval, and real-time SSE streaming.

**Architecture:** Modular monolith — Hono server hosts business APIs, Agent module (LangGraph.js), and RAG module in a single deployable. React Native frontend connects via REST + SSE. PostgreSQL with pgvector handles both business data and vector search.

**Tech Stack:** TypeScript, React Native (Expo), Hono, LangGraph.js, LangChain.js, Drizzle ORM, PostgreSQL, pgvector, DeepSeek API, SSE

---

## Phase 1: Project Infrastructure

### Task 1: Initialize Monorepo

**Files:**
- Create: `package.json` (root)
- Create: `pnpm-workspace.yaml`
- Create: `turbo.json`
- Create: `.gitignore`
- Create: `tsconfig.base.json`

- [ ] **Step 1: Create root package.json**

```json
{
  "name": "agent-xfd",
  "private": true,
  "scripts": {
    "dev": "turbo dev",
    "build": "turbo build",
    "lint": "turbo lint",
    "test": "turbo test"
  },
  "devDependencies": {
    "turbo": "^2.0.0",
    "typescript": "^5.5.0"
  },
  "packageManager": "pnpm@9.0.0"
}
```

- [ ] **Step 2: Create pnpm workspace config**

```yaml
packages:
  - "apps/*"
  - "packages/*"
```

- [ ] **Step 3: Create turbo.json**

```json
{
  "$schema": "https://turbo.build/schema.json",
  "tasks": {
    "dev": {
      "cache": false,
      "persistent": true
    },
    "build": {
      "dependsOn": ["^build"],
      "outputs": ["dist/**"]
    },
    "test": {
      "dependsOn": ["build"]
    },
    "lint": {}
  }
}
```

- [ ] **Step 4: Update .gitignore**

```
node_modules/
dist/
.env
.env.local
*.log
.superpowers/
.turbo/
```

- [ ] **Step 5: Create tsconfig.base.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "esModuleInterop": true,
    "strict": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true
  }
}
```

- [ ] **Step 6: Install dependencies and verify**

```bash
pnpm install
```

- [ ] **Step 7: Commit**

```bash
git add -A && git commit -m "chore: initialize monorepo with turborepo + pnpm"
```

---

### Task 2: Create Shared Types Package

**Files:**
- Create: `packages/shared/package.json`
- Create: `packages/shared/tsconfig.json`
- Create: `packages/shared/src/index.ts`
- Create: `packages/shared/src/order.ts`
- Create: `packages/shared/src/product.ts`
- Create: `packages/shared/src/user.ts`
- Create: `packages/shared/src/agent.ts`

- [ ] **Step 1: Create shared package.json**

```json
{
  "name": "@agent-xfd/shared",
  "version": "0.0.1",
  "private": true,
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "scripts": {
    "lint": "tsc --noEmit"
  }
}
```

- [ ] **Step 2: Create shared tsconfig.json**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src"
  },
  "include": ["src/**/*"]
}
```

- [ ] **Step 3: Define user types**

```typescript
// packages/shared/src/user.ts
export type UserRole = 'buyer' | 'supplier' | 'admin';

export interface User {
  id: string;
  username: string;
  role: UserRole;
  marketId: string;
  createdAt: Date;
}

export interface LoginRequest {
  username: string;
  password: string;
}

export interface LoginResponse {
  token: string;
  user: User;
}
```

- [ ] **Step 4: Define product types**

```typescript
// packages/shared/src/product.ts
export interface Product {
  id: string;
  name: string;
  category: string;
  unit: string;
  referencePrice: number;
  marketId: string;
}

export interface SupplierProduct {
  supplierId: string;
  productId: string;
  price: number;
  stock: number;
}

export interface PriceInfo {
  product: Product;
  supplierPrice?: number;
  referencePrice: number;
  priceChange?: number; // percentage
}
```

- [ ] **Step 5: Define order types**

```typescript
// packages/shared/src/order.ts
export type OrderStatus =
  | 'pending'
  | 'confirmed'
  | 'sorting'
  | 'sorted'
  | 'delivering'
  | 'completed'
  | 'cancelled';

export type CreatorRole = 'buyer' | 'supplier';

export interface OrderItem {
  productId: string;
  productName: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  subtotal: number;
}

export interface Order {
  id: string;
  orderNo: string;
  creatorId: string;
  creatorRole: CreatorRole;
  buyerId: string;
  buyerName: string;
  supplierId: string;
  supplierName: string;
  items: OrderItem[];
  totalPrice: number;
  status: OrderStatus;
  deliveryAddress: string;
  remark?: string;
  marketId: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateOrderRequest {
  buyerId: string;
  supplierId: string;
  items: {
    productId: string;
    quantity: number;
  }[];
  deliveryAddress: string;
  remark?: string;
}
```

- [ ] **Step 6: Define agent types**

```typescript
// packages/shared/src/agent.ts
export type AgentIntent =
  | 'place_order'
  | 'query_order'
  | 'ask_price'
  | 'confirm_order'
  | 'cancel'
  | 'recommend'
  | 'chat';

export interface AgentMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
}

export interface AgentResponse {
  intent: AgentIntent;
  content: string;
  orderPreview?: import('./order').Order;
  suggestions?: string[];
}

export interface ChatRequest {
  message: string;
  conversationId?: string;
}

export interface ChatStreamEvent {
  type: 'text' | 'order_preview' | 'suggestions' | 'done';
  content: string;
  data?: unknown;
}
```

- [ ] **Step 7: Create index.ts barrel export**

```typescript
// packages/shared/src/index.ts
export * from './user';
export * from './product';
export * from './order';
export * from './agent';
```

- [ ] **Step 8: Verify types compile**

```bash
cd packages/shared && pnpm lint
```

- [ ] **Step 9: Commit**

```bash
git add -A && git commit -m "feat: add shared types package"
```

---

## Phase 2: Database Layer

### Task 3: Setup Drizzle + PostgreSQL

**Files:**
- Create: `apps/server/package.json`
- Create: `apps/server/tsconfig.json`
- Create: `apps/server/src/db/index.ts`
- Create: `apps/server/src/db/schema.ts`
- Create: `apps/server/drizzle.config.ts`
- Create: `apps/server/.env.example`

- [ ] **Step 1: Create server package.json**

```json
{
  "name": "@agent-xfd/server",
  "version": "0.0.1",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "build": "tsc",
    "db:generate": "drizzle-kit generate",
    "db:migrate": "drizzle-kit migrate",
    "db:push": "drizzle-kit push",
    "db:studio": "drizzle-kit studio",
    "test": "vitest"
  },
  "dependencies": {
    "@agent-xfd/shared": "workspace:*",
    "hono": "^4.0.0",
    "drizzle-orm": "^0.32.0",
    "postgres": "^3.4.0",
    "pgvector": "^0.2.0",
    "@langchain/core": "^0.3.0",
    "@langchain/langgraph": "^0.2.0",
    "@langchain/openai": "^0.3.0",
    "dotenv": "^16.4.0",
    "jsonwebtoken": "^9.0.0",
    "bcryptjs": "^2.4.3"
  },
  "devDependencies": {
    "drizzle-kit": "^0.24.0",
    "tsx": "^4.0.0",
    "vitest": "^2.0.0",
    "@types/jsonwebtoken": "^9.0.0",
    "@types/bcryptjs": "^2.4.0",
    "typescript": "^5.5.0"
  }
}
```

- [ ] **Step 2: Create server tsconfig.json**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src",
    "module": "ESNext",
    "target": "ES2022"
  },
  "include": ["src/**/*", "drizzle.config.ts"]
}
```

- [ ] **Step 3: Create .env.example**

```
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/agent_xfd
JWT_SECRET=your-secret-key-here
DEEPSEEK_API_KEY=your-deepseek-api-key
DEEPSEEK_BASE_URL=https://api.deepseek.com
```

- [ ] **Step 4: Define database schema with Drizzle**

```typescript
// apps/server/src/db/schema.ts
import {
  pgTable,
  uuid,
  varchar,
  text,
  integer,
  decimal,
  timestamp,
  jsonb,
  pgEnum,
  index,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// Enums
export const userRoleEnum = pgEnum('user_role', ['buyer', 'supplier', 'admin']);
export const orderStatusEnum = pgEnum('order_status', [
  'pending', 'confirmed', 'sorting', 'sorted', 'delivering', 'completed', 'cancelled',
]);
export const creatorRoleEnum = pgEnum('creator_role', ['buyer', 'supplier']);

// Markets (multi-tenant)
export const markets = pgTable('markets', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  address: text('address'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Users
export const users = pgTable('users', {
  id: uuid('id').defaultRandom().primaryKey(),
  username: varchar('username', { length: 100 }).notNull().unique(),
  passwordHash: varchar('password_hash', { length: 255 }).notNull(),
  role: userRoleEnum('role').notNull(),
  marketId: uuid('market_id').references(() => markets.id).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Products
export const products = pgTable('products', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  category: varchar('category', { length: 100 }).notNull(),
  unit: varchar('unit', { length: 20 }).notNull(),
  referencePrice: decimal('reference_price', { precision: 10, scale: 2 }).notNull(),
  marketId: uuid('market_id').references(() => markets.id).notNull(),
  embedding: text('embedding'), // JSON-serialized vector for pgvector
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  marketIdx: index('products_market_idx').on(table.marketId),
  categoryIdx: index('products_category_idx').on(table.category),
}));

// Supplier Product Pricing
export const supplierProducts = pgTable('supplier_products', {
  id: uuid('id').defaultRandom().primaryKey(),
  supplierId: uuid('supplier_id').references(() => users.id).notNull(),
  productId: uuid('product_id').references(() => products.id).notNull(),
  price: decimal('price', { precision: 10, scale: 2 }).notNull(),
  stock: integer('stock').notNull().default(0),
}, (table) => ({
  supplierIdx: index('sp_supplier_idx').on(table.supplierId),
  productIdx: index('sp_product_idx').on(table.productId),
}));

// Orders
export const orders = pgTable('orders', {
  id: uuid('id').defaultRandom().primaryKey(),
  orderNo: varchar('order_no', { length: 50 }).notNull().unique(),
  creatorId: uuid('creator_id').references(() => users.id).notNull(),
  creatorRole: creatorRoleEnum('creator_role').notNull(),
  buyerId: uuid('buyer_id').references(() => users.id).notNull(),
  buyerName: varchar('buyer_name', { length: 255 }).notNull(),
  supplierId: uuid('supplier_id').references(() => users.id).notNull(),
  supplierName: varchar('supplier_name', { length: 255 }).notNull(),
  totalPrice: decimal('total_price', { precision: 12, scale: 2 }).notNull(),
  status: orderStatusEnum('status').notNull().default('pending'),
  deliveryAddress: text('delivery_address'),
  remark: text('remark'),
  marketId: uuid('market_id').references(() => markets.id).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  buyerIdx: index('orders_buyer_idx').on(table.buyerId),
  supplierIdx: index('orders_supplier_idx').on(table.supplierId),
  statusIdx: index('orders_status_idx').on(table.status),
  createdAtIdx: index('orders_created_at_idx').on(table.createdAt),
}));

// Order Items
export const orderItems = pgTable('order_items', {
  id: uuid('id').defaultRandom().primaryKey(),
  orderId: uuid('order_id').references(() => orders.id).notNull(),
  productId: uuid('product_id').references(() => products.id).notNull(),
  productName: varchar('product_name', { length: 255 }).notNull(),
  quantity: integer('quantity').notNull(),
  unit: varchar('unit', { length: 20 }).notNull(),
  unitPrice: decimal('unit_price', { precision: 10, scale: 2 }).notNull(),
  subtotal: decimal('subtotal', { precision: 12, scale: 2 }).notNull(),
});

// Conversations (for Agent chat history)
export const conversations = pgTable('conversations', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').references(() => users.id).notNull(),
  messages: jsonb('messages').notNull().default('[]'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Relations
export const usersRelations = relations(users, ({ one, many }) => ({
  market: one(markets, { fields: [users.marketId], references: [markets.id] }),
  orders: many(orders),
}));

export const productsRelations = relations(products, ({ one, many }) => ({
  market: one(markets, { fields: [products.marketId], references: [markets.id] }),
  supplierProducts: many(supplierProducts),
}));

export const ordersRelations = relations(orders, ({ one, many }) => ({
  buyer: one(users, { fields: [orders.buyerId], references: [users.id] }),
  supplier: one(users, { fields: [orders.supplierId], references: [users.id] }),
  items: many(orderItems),
}));

export const orderItemsRelations = relations(orderItems, ({ one }) => ({
  order: one(orders, { fields: [orderItems.orderId], references: [orders.id] }),
  product: one(products, { fields: [orderItems.productId], references: [products.id] }),
}));
```

- [ ] **Step 5: Create DB connection**

```typescript
// apps/server/src/db/index.ts
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema.js';
import 'dotenv/config';

const connectionString = process.env.DATABASE_URL!;
const client = postgres(connectionString);
export const db = drizzle(client, { schema });
export { schema };
```

- [ ] **Step 6: Create drizzle.config.ts**

```typescript
import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: './src/db/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
});
```

- [ ] **Step 7: Commit**

```bash
git add -A && git commit -m "feat: setup drizzle ORM with PostgreSQL schema"
```

---

### Task 4: Enable pgvector and Add Vector Support

**Files:**
- Create: `apps/server/src/db/vector.ts`
- Create: `apps/server/src/db/migrations/0001_enable_vector.sql`

- [ ] **Step 1: Create migration to enable pgvector**

```sql
-- apps/server/src/db/migrations/0001_enable_vector.sql
CREATE EXTENSION IF NOT EXISTS vector;
```

- [ ] **Step 2: Create vector utility module**

```typescript
// apps/server/src/db/vector.ts
import { db } from './index.js';
import { sql } from 'drizzle-orm';

/**
 * Enable pgvector extension. Run once during setup.
 */
export async function enablePgVector(): Promise<void> {
  await db.execute(sql`CREATE EXTENSION IF NOT EXISTS vector`);
}

/**
 * Store a vector embedding for a product.
 */
export async function storeProductEmbedding(
  productId: string,
  embedding: number[]
): Promise<void> {
  const embeddingStr = JSON.stringify(embedding);
  await db.execute(
    sql`UPDATE products SET embedding = ${embeddingStr}::vector WHERE id = ${productId}`
  );
}

/**
 * Search products by semantic similarity using cosine distance.
 */
export async function searchProductsByVector(
  queryEmbedding: number[],
  marketId: string,
  limit: number = 5
): Promise<Array<{ id: string; name: string; category: string; similarity: number }>> {
  const embeddingStr = JSON.stringify(queryEmbedding);
  const results = await db.execute(sql`
    SELECT id, name, category,
           1 - (embedding <=> ${embeddingStr}::vector) as similarity
    FROM products
    WHERE market_id = ${marketId}
      AND embedding IS NOT NULL
    ORDER BY embedding <=> ${embeddingStr}::vector
    LIMIT ${limit}
  `);
  return results as Array<{ id: string; name: string; category: string; similarity: number }>;
}
```

- [ ] **Step 3: Commit**

```bash
git add -A && git commit -m "feat: add pgvector support for semantic product search"
```

---

## Phase 3: Backend API (Hono)

### Task 5: Hono Server Setup with Auth

**Files:**
- Create: `apps/server/src/index.ts`
- Create: `apps/server/src/middleware/auth.ts`
- Create: `apps/server/src/modules/auth/router.ts`
- Create: `apps/server/src/modules/auth/service.ts`
- Create: `apps/server/src/modules/auth/schema.ts`

- [ ] **Step 1: Create Hono entry point**

```typescript
// apps/server/src/index.ts
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { authRouter } from './modules/auth/router.js';
import 'dotenv/config';

const app = new Hono();

app.use('*', logger());
app.use('*', cors());

app.route('/api/auth', authRouter);

app.get('/health', (c) => c.json({ status: 'ok' }));

const port = Number(process.env.PORT) || 3000;
console.log(`Server running on port ${port}`);

export default {
  port,
  fetch: app.fetch,
};
```

- [ ] **Step 2: Create auth service with bcrypt + JWT**

```typescript
// apps/server/src/modules/auth/service.ts
import { db } from '../../db/index.js';
import { users } from '../../db/schema.js';
import { eq } from 'drizzle-orm';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import 'dotenv/config';

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret';

export async function register(
  username: string,
  password: string,
  role: 'buyer' | 'supplier',
  marketId: string
) {
  const existing = await db.select().from(users).where(eq(users.username, username)).limit(1);
  if (existing.length > 0) {
    throw new Error('Username already exists');
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const [user] = await db
    .insert(users)
    .values({ username, passwordHash, role, marketId })
    .returning();

  const token = jwt.sign({ userId: user.id, role: user.role }, JWT_SECRET, { expiresIn: '7d' });
  return { token, user: { id: user.id, username: user.username, role: user.role, marketId: user.marketId, createdAt: user.createdAt } };
}

export async function login(username: string, password: string) {
  const [user] = await db.select().from(users).where(eq(users.username, username)).limit(1);
  if (!user) {
    throw new Error('Invalid credentials');
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    throw new Error('Invalid credentials');
  }

  const token = jwt.sign({ userId: user.id, role: user.role }, JWT_SECRET, { expiresIn: '7d' });
  return { token, user: { id: user.id, username: user.username, role: user.role, marketId: user.marketId, createdAt: user.createdAt } };
}

export function verifyToken(token: string) {
  return jwt.verify(token, JWT_SECRET) as { userId: string; role: string };
}
```

- [ ] **Step 3: Create auth middleware**

```typescript
// apps/server/src/middleware/auth.ts
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
```

- [ ] **Step 4: Create auth router**

```typescript
// apps/server/src/modules/auth/router.ts
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
```

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat: add Hono server with auth module"
```

---

### Task 6: Product & Order API Modules

**Files:**
- Create: `apps/server/src/modules/product/router.ts`
- Create: `apps/server/src/modules/product/service.ts`
- Create: `apps/server/src/modules/order/router.ts`
- Create: `apps/server/src/modules/order/service.ts`
- Modify: `apps/server/src/index.ts`

- [ ] **Step 1: Create product service**

```typescript
// apps/server/src/modules/product/service.ts
import { db } from '../../db/index.js';
import { products, supplierProducts, users } from '../../db/schema.js';
import { eq, and, ilike } from 'drizzle-orm';

export async function listProducts(marketId: string, search?: string) {
  const query = db
    .select()
    .from(products)
    .where(
      search
        ? and(eq(products.marketId, marketId), ilike(products.name, `%${search}%`))
        : eq(products.marketId, marketId)
    );
  return query;
}

export async function getProductWithPrice(productId: string, supplierId?: string) {
  const [product] = await db.select().from(products).where(eq(products.id, productId)).limit(1);
  if (!product) return null;

  let supplierPrice: number | undefined;
  if (supplierId) {
    const [sp] = await db
      .select()
      .from(supplierProducts)
      .where(and(eq(supplierProducts.supplierId, supplierId), eq(supplierProducts.productId, productId)))
      .limit(1);
    supplierPrice = sp ? Number(sp.price) : undefined;
  }

  return {
    ...product,
    referencePrice: Number(product.referencePrice),
    supplierPrice,
  };
}

export async function listSupplierProducts(supplierId: string) {
  return db
    .select({
      productId: supplierProducts.productId,
      price: supplierProducts.price,
      stock: supplierProducts.stock,
      productName: products.name,
      unit: products.unit,
    })
    .from(supplierProducts)
    .innerJoin(products, eq(supplierProducts.productId, products.id))
    .where(eq(supplierProducts.supplierId, supplierId));
}
```

- [ ] **Step 2: Create product router**

```typescript
// apps/server/src/modules/product/router.ts
import { Hono } from 'hono';
import { authMiddleware } from '../../middleware/auth.js';
import { listProducts, getProductWithPrice, listSupplierProducts } from './service.js';

export const productRouter = new Hono();
productRouter.use('*', authMiddleware);

productRouter.get('/', async (c) => {
  const marketId = c.get('userId'); // simplified: use user's market
  const search = c.req.query('search');
  const result = await listProducts(marketId, search);
  return c.json(result);
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
  const result = await listSupplierProducts(supplierId);
  return c.json(result);
});
```

- [ ] **Step 3: Create order service**

```typescript
// apps/server/src/modules/order/service.ts
import { db } from '../../db/index.js';
import { orders, orderItems, users, products, supplierProducts } from '../../db/schema.js';
import { eq, and, desc, gte, lte } from 'drizzle-orm';
import type { CreateOrderRequest, Order, OrderStatus } from '@agent-xfd/shared';

function generateOrderNo(): string {
  const now = new Date();
  const date = now.toISOString().slice(0, 10).replace(/-/g, '');
  const rand = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
  return `ORD-${date}-${rand}`;
}

export async function createOrder(data: CreateOrderRequest, creatorId: string, creatorRole: 'buyer' | 'supplier') {
  // Fetch buyer and supplier info
  const [buyer] = await db.select().from(users).where(eq(users.id, data.buyerId)).limit(1);
  const [supplier] = await db.select().from(users).where(eq(users.id, data.supplierId)).limit(1);
  if (!buyer || !supplier) throw new Error('Invalid buyer or supplier');

  // Build order items with prices
  const items = [];
  let totalPrice = 0;
  for (const item of data.items) {
    const [product] = await db.select().from(products).where(eq(products.id, item.productId)).limit(1);
    if (!product) throw new Error(`Product ${item.productId} not found`);

    // Get supplier-specific price
    const [sp] = await db
      .select()
      .from(supplierProducts)
      .where(and(eq(supplierProducts.supplierId, data.supplierId), eq(supplierProducts.productId, item.productId)))
      .limit(1);

    const unitPrice = sp ? Number(sp.price) : Number(product.referencePrice);
    const subtotal = unitPrice * item.quantity;
    totalPrice += subtotal;

    items.push({
      productId: item.productId,
      productName: product.name,
      quantity: item.quantity,
      unit: product.unit,
      unitPrice,
      subtotal,
    });
  }

  // Create order
  const [order] = await db
    .insert(orders)
    .values({
      orderNo: generateOrderNo(),
      creatorId,
      creatorRole,
      buyerId: data.buyerId,
      buyerName: buyer.username,
      supplierId: data.supplierId,
      supplierName: supplier.username,
      totalPrice,
      status: 'pending',
      deliveryAddress: data.deliveryAddress,
      remark: data.remark,
      marketId: buyer.marketId,
    })
    .returning();

  // Create order items
  await db.insert(orderItems).values(
    items.map((item) => ({
      orderId: order.id,
      ...item,
    }))
  );

  return { ...order, items };
}

export async function getOrders(
  userId: string,
  filters?: { status?: OrderStatus; startDate?: string; endDate?: string }
) {
  let query = db
    .select()
    .from(orders)
    .where(eq(orders.buyerId, userId)) // simplified: check both buyer/supplier in real impl
    .orderBy(desc(orders.createdAt));

  const result = await query;
  return result;
}

export async function getOrderDetail(orderId: string) {
  const [order] = await db.select().from(orders).where(eq(orders.id, orderId)).limit(1);
  if (!order) return null;

  const items = await db.select().from(orderItems).where(eq(orderItems.orderId, orderId));
  return { ...order, items };
}

export async function updateOrderStatus(orderId: string, status: OrderStatus) {
  const [updated] = await db
    .update(orders)
    .set({ status, updatedAt: new Date() })
    .where(eq(orders.id, orderId))
    .returning();
  return updated;
}
```

- [ ] **Step 4: Create order router**

```typescript
// apps/server/src/modules/order/router.ts
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
    const result = await createOrder(body, userId, userRole);
    return c.json(result, 201);
  } catch (e: any) {
    return c.json({ error: e.message }, 400);
  }
});

orderRouter.get('/', async (c) => {
  const userId = c.get('userId');
  const status = c.req.query('status');
  const result = await getOrders(userId, { status });
  return c.json(result);
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
  const result = await updateOrderStatus(id, status);
  return c.json(result);
});
```

- [ ] **Step 5: Register routes in main server**

```typescript
// apps/server/src/index.ts (updated)
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { authRouter } from './modules/auth/router.js';
import { productRouter } from './modules/product/router.js';
import { orderRouter } from './modules/order/router.js';
import 'dotenv/config';

const app = new Hono();

app.use('*', logger());
app.use('*', cors());

app.route('/api/auth', authRouter);
app.route('/api/products', productRouter);
app.route('/api/orders', orderRouter);

app.get('/health', (c) => c.json({ status: 'ok' }));

const port = Number(process.env.PORT) || 3000;
console.log(`Server running on port ${port}`);

export default {
  port,
  fetch: app.fetch,
};
```

- [ ] **Step 6: Commit**

```bash
git add -A && git commit -m "feat: add product and order API modules"
```

---

## Phase 4: LLM Abstraction + RAG

### Task 7: LLM Provider Abstraction (LangChain.js)

**Files:**
- Create: `apps/server/src/llm/config.ts`
- Create: `apps/server/src/llm/provider.ts`
- Create: `apps/server/src/llm/prompts.ts`

- [ ] **Step 1: Create LLM configuration**

```typescript
// apps/server/src/llm/config.ts
export interface LLMConfig {
  provider: 'deepseek' | 'openai';
  model: string;
  apiKey: string;
  baseUrl: string;
  temperature: number;
  maxTokens: number;
}

export function getLLMConfig(): LLMConfig {
  const provider = (process.env.LLM_PROVIDER || 'deepseek') as LLMConfig['provider'];

  if (provider === 'deepseek') {
    return {
      provider: 'deepseek',
      model: process.env.DEEPSEEK_MODEL || 'deepseek-chat',
      apiKey: process.env.DEEPSEEK_API_KEY || '',
      baseUrl: process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com',
      temperature: Number(process.env.LLM_TEMPERATURE) || 0.3,
      maxTokens: Number(process.env.LLM_MAX_TOKENS) || 2048,
    };
  }

  return {
    provider: 'openai',
    model: process.env.OPENAI_MODEL || 'gpt-4o',
    apiKey: process.env.OPENAI_API_KEY || '',
    baseUrl: process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1',
    temperature: Number(process.env.LLM_TEMPERATURE) || 0.3,
    maxTokens: Number(process.env.LLM_MAX_TOKENS) || 2048,
  };
}
```

- [ ] **Step 2: Create LLM provider using LangChain.js**

```typescript
// apps/server/src/llm/provider.ts
import { ChatOpenAI } from '@langchain/openai';
import { getLLMConfig } from './config.js';

let llmInstance: ChatOpenAI | null = null;

/**
 * Get or create the LLM instance.
 * Uses ChatOpenAI with custom baseUrl for both OpenAI and DeepSeek
 * (DeepSeek is OpenAI-compatible).
 */
export function getLLM(): ChatOpenAI {
  if (llmInstance) return llmInstance;

  const config = getLLMConfig();
  llmInstance = new ChatOpenAI({
    modelName: config.model,
    openAIApiKey: config.apiKey,
    configuration: {
      baseURL: config.baseUrl,
    },
    temperature: config.temperature,
    maxTokens: config.maxTokens,
  });

  return llmInstance;
}

/**
 * Reset the LLM instance (e.g., after config change).
 */
export function resetLLM(): void {
  llmInstance = null;
}
```

- [ ] **Step 3: Create prompt templates**

```typescript
// apps/server/src/llm/prompts.ts
import { ChatPromptTemplate } from '@langchain/core/prompts';

/**
 * Intent classification prompt.
 * Classifies user message into one of the predefined intents.
 */
export const intentPrompt = ChatPromptTemplate.fromMessages([
  ['system', `你是一个农产品订单平台的意图识别助手。根据用户消息判断意图类别。

意图类别：
- place_order: 下单/采购/购买商品
- query_order: 查询订单状态/历史
- ask_price: 询问商品价格
- confirm_order: 确认订单/同意下单
- cancel: 取消/撤销操作
- recommend: 请求推荐商品/问买什么好
- chat: 闲聊/问候/其他

只返回意图类别名称，不要返回其他内容。`],
  ['human', '{message}'],
]);

/**
 * Entity extraction prompt.
 * Extracts order-related entities from user message.
 */
export const entityExtractionPrompt = ChatPromptTemplate.fromMessages([
  ['system', `你是一个农产品订单平台的实体提取助手。从用户消息中提取以下信息：

返回 JSON 格式：
{
  "items": [{"name": "商品名", "quantity": 数字, "unit": "单位"}],
  "buyer": "采购商名称或null",
  "supplier": "供应商名称或null",
  "deliveryAddress": "配送地址或null",
  "timeRange": "时间范围如昨天/今天/本周或null"
}

如果某个字段无法提取，设为 null。只返回 JSON，不要返回其他内容。`],
  ['human', '{message}'],
]);

/**
 * Agent response generation prompt.
 * Generates natural language responses based on context.
 */
export const responsePrompt = ChatPromptTemplate.fromMessages([
  ['system', `你是一个农产品订单平台的智能助手。根据上下文信息回复用户。

规则：
- 回复简洁友好
- 下单时列出商品明细和总价，请求用户确认
- 查询订单时返回关键信息（订单号、状态、金额）
- 价格信息包含参考价和波动
- 如果信息不足，主动询问补充`],
  ['human', '{context}\n\n用户消息：{message}'],
]);
```

- [ ] **Step 4: Commit**

```bash
git add -A && git commit -m "feat: add LLM provider abstraction with LangChain.js"
```

---

### Task 8: RAG Module (Embeddings + Retrieval)

**Files:**
- Create: `apps/server/src/rag/embeddings.ts`
- Create: `apps/server/src/rag/retriever.ts`
- Create: `apps/server/src/rag/knowledge.ts`

- [ ] **Step 1: Create embedding generation service**

```typescript
// apps/server/src/rag/embeddings.ts
import { OpenAIEmbeddings } from '@langchain/openai';
import { getLLMConfig } from '../llm/config.js';

let embeddingsInstance: OpenAIEmbeddings | null = null;

/**
 * Get embeddings model instance.
 * Uses the same API key and base URL as the chat model.
 */
export function getEmbeddings(): OpenAIEmbeddings {
  if (embeddingsInstance) return embeddingsInstance;

  const config = getLLMConfig();
  embeddingsInstance = new OpenAIEmbeddings({
    modelName: 'text-embedding-v3', // DeepSeek embedding model
    openAIApiKey: config.apiKey,
    configuration: {
      baseURL: config.baseUrl,
    },
  });

  return embeddingsInstance;
}

/**
 * Generate embedding vector for a given text.
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  const embeddings = getEmbeddings();
  const result = await embeddings.embedQuery(text);
  return result;
}

/**
 * Generate embeddings for multiple texts (batch).
 */
export async function generateEmbeddings(texts: string[]): Promise<number[][]> {
  const embeddings = getEmbeddings();
  const result = await embeddings.embedDocuments(texts);
  return result;
}
```

- [ ] **Step 2: Create RAG retriever**

```typescript
// apps/server/src/rag/retriever.ts
import { db } from '../db/index.js';
import { products, orders, orderItems, users, supplierProducts } from '../db/schema.js';
import { eq, and, desc, ilike, sql } from 'drizzle-orm';
import { generateEmbedding } from './embeddings.js';
import { searchProductsByVector } from '../db/vector.js';

/**
 * Retrieve products matching a query using RAG.
 * Combines semantic search (pgvector) with keyword search.
 */
export async function retrieveProducts(
  query: string,
  marketId: string,
  limit: number = 5
) {
  // 1. Generate embedding for the query
  const queryEmbedding = await generateEmbedding(query);

  // 2. Semantic search via pgvector
  const semanticResults = await searchProductsByVector(queryEmbedding, marketId, limit);

  // 3. Keyword search as fallback
  const keywordResults = await db
    .select()
    .from(products)
    .where(and(eq(products.marketId, marketId), ilike(products.name, `%${query}%`)))
    .limit(limit);

  // 4. Merge and deduplicate
  const seen = new Set<string>();
  const merged = [];

  for (const p of semanticResults) {
    if (!seen.has(p.id)) {
      seen.add(p.id);
      merged.push({ ...p, source: 'semantic' as const });
    }
  }
  for (const p of keywordResults) {
    if (!seen.has(p.id)) {
      seen.add(p.id);
      merged.push({ ...p, referencePrice: Number(p.referencePrice), source: 'keyword' as const });
    }
  }

  return merged.slice(0, limit);
}

/**
 * Retrieve orders for a user based on natural language query.
 */
export async function retrieveOrders(
  userId: string,
  filters: { timeRange?: string; status?: string; counterparty?: string }
) {
  let query = db.select().from(orders).orderBy(desc(orders.createdAt)).limit(20);

  // Apply time filter
  if (filters.timeRange === '昨天') {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    yesterday.setHours(0, 0, 0, 0);
    query = query.where(gte(orders.createdAt, yesterday));
  }

  const result = await query;
  return result;
}

// Helper for date filtering
function gte(column: any, value: Date) {
  return sql`${column} >= ${value.toISOString()}`;
}
```

- [ ] **Step 3: Create knowledge base for RAG**

```typescript
// apps/server/src/rag/knowledge.ts
import { generateEmbedding } from './embeddings.js';

/**
 * Knowledge base entries for common questions.
 * These are embedded and stored for RAG retrieval.
 */
export const knowledgeBase = [
  {
    id: 'faq-1',
    category: 'platform',
    question: '如何下单？',
    answer: '您可以通过语音或文字告诉我要购买的商品和数量，例如"来100斤土豆送到老王那边"，我会帮您生成订单。',
  },
  {
    id: 'faq-2',
    category: 'platform',
    question: '如何查询订单？',
    answer: '直接告诉我您想查的订单信息，例如"昨天那单送到没"或"查一下老王的订单"。',
  },
  {
    id: 'faq-3',
    category: 'platform',
    question: '如何查看价格？',
    answer: '您可以问"土豆现在多少钱"，或者点击首页的"价格看板"查看所有商品价格。',
  },
  {
    id: 'faq-4',
    category: 'platform',
    question: '订单状态有哪些？',
    answer: '订单状态包括：待确认、已确认、分拣中、已分拣、配送中、已完成、已取消。',
  },
];

/**
 * Find relevant knowledge entries for a query.
 */
export async function findRelevantKnowledge(query: string, limit: number = 3) {
  const queryEmbedding = await generateEmbedding(query);

  // Simple cosine similarity against knowledge base
  // In production, store these embeddings in pgvector too
  const scored = knowledgeBase.map((entry) => ({
    ...entry,
    similarity: cosineSimilarity(queryEmbedding, entry),
  }));

  return scored
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, limit)
    .filter((e) => e.similarity > 0.7);
}

function cosineSimilarity(a: number[], b: any): number {
  // Placeholder: in production, pre-compute and store embeddings
  return 0.8;
}
```

- [ ] **Step 4: Commit**

```bash
git add -A && git commit -m "feat: add RAG module with embeddings and retriever"
```

---

## Phase 5: Agent Module (LangGraph.js)

### Task 9: Intent Recognition Node

**Files:**
- Create: `apps/server/src/agent/intent.ts`
- Create: `apps/server/src/agent/types.ts`

- [ ] **Step 1: Define Agent state types**

```typescript
// apps/server/src/agent/types.ts
import type { AgentIntent, Order, OrderItem } from '@agent-xfd/shared';

/**
 * State that flows through the LangGraph workflow.
 */
export interface AgentState {
  // Input
  message: string;
  userId: string;
  userRole: 'buyer' | 'supplier';
  marketId: string;
  conversationId?: string;

  // Processing
  intent: AgentIntent | null;
  entities: ExtractedEntities | null;
  context: string; // RAG retrieval context

  // Output
  response: string;
  orderPreview: Order | null;
  suggestions: string[];

  // Conversation history
  history: Array<{ role: 'user' | 'assistant'; content: string }>;
}

export interface ExtractedEntities {
  items: Array<{ name: string; quantity: number; unit: string }>;
  buyer: string | null;
  supplier: string | null;
  deliveryAddress: string | null;
  timeRange: string | null;
}
```

- [ ] **Step 2: Create intent recognition node**

```typescript
// apps/server/src/agent/intent.ts
import { getLLM } from '../llm/provider.js';
import { intentPrompt } from '../llm/prompts.js';
import type { AgentIntent } from '@agent-xfd/shared';
import type { AgentState } from './types.js';

/**
 * Intent recognition node for the LangGraph workflow.
 * Classifies the user's message into a predefined intent.
 */
export async function recognizeIntent(state: AgentState): Promise<Partial<AgentState>> {
  const llm = getLLM();
  const chain = intentPrompt.pipe(llm);

  const result = await chain.invoke({ message: state.message });
  const intent = result.content.toString().trim().toLowerCase() as AgentIntent;

  // Validate intent is one of the known types
  const validIntents: AgentIntent[] = [
    'place_order', 'query_order', 'ask_price',
    'confirm_order', 'cancel', 'recommend', 'chat'
  ];

  const validatedIntent = validIntents.includes(intent) ? intent : 'chat';

  return { intent: validatedIntent };
}
```

- [ ] **Step 3: Commit**

```bash
git add -A && git commit -m "feat: add intent recognition node with LangChain.js"
```

---

### Task 10: Entity Extraction + RAG Retrieval Nodes

**Files:**
- Create: `apps/server/src/agent/entities.ts`
- Create: `apps/server/src/agent/retrieval.ts`

- [ ] **Step 1: Create entity extraction node**

```typescript
// apps/server/src/agent/entities.ts
import { getLLM } from '../llm/provider.js';
import { entityExtractionPrompt } from '../llm/prompts.js';
import type { AgentState, ExtractedEntities } from './types.js';

/**
 * Entity extraction node.
 * Parses user message to extract order-related entities.
 */
export async function extractEntities(state: AgentState): Promise<Partial<AgentState>> {
  const llm = getLLM();
  const chain = entityExtractionPrompt.pipe(llm);

  const result = await chain.invoke({ message: state.message });
  const content = result.content.toString().trim();

  try {
    // Try to parse JSON from LLM response
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return { entities: null };
    }

    const entities: ExtractedEntities = JSON.parse(jsonMatch[0]);
    return { entities };
  } catch {
    return { entities: null };
  }
}
```

- [ ] **Step 2: Create RAG retrieval node**

```typescript
// apps/server/src/agent/retrieval.ts
import { retrieveProducts, retrieveOrders } from '../rag/retriever.js';
import { findRelevantKnowledge } from '../rag/knowledge.js';
import type { AgentState } from './types.js';

/**
 * RAG retrieval node.
 * Fetches relevant context based on the user's intent and entities.
 */
export async function retrieveContext(state: AgentState): Promise<Partial<AgentState>> {
  let context = '';

  switch (state.intent) {
    case 'place_order':
    case 'ask_price': {
      // Search for products mentioned in the message
      const productNames = state.entities?.items.map((i) => i.name).join(' ') || state.message;
      const products = await retrieveProducts(productNames, state.marketId);
      if (products.length > 0) {
        context += '相关商品：\n';
        for (const p of products) {
          context += `- ${p.name} (${p.category}) 参考价: ￥${'referencePrice' in p ? p.referencePrice : '未知'}/斤\n`;
        }
      }
      break;
    }

    case 'query_order': {
      const orders = await retrieveOrders(state.userId, {
        timeRange: state.entities?.timeRange || undefined,
      });
      if (orders.length > 0) {
        context += '相关订单：\n';
        for (const o of orders.slice(0, 5)) {
          context += `- 订单${o.orderNo} | 状态: ${o.status} | 金额: ￥${o.totalPrice}\n`;
        }
      } else {
        context = '未找到相关订单。';
      }
      break;
    }

    case 'recommend': {
      const products = await retrieveProducts('热销推荐', state.marketId, 5);
      if (products.length > 0) {
        context += '推荐商品：\n';
        for (const p of products) {
          context += `- ${p.name} (相似度: ${p.similarity.toFixed(2)})\n`;
        }
      }
      break;
    }

    default: {
      // For chat/general questions, search knowledge base
      const knowledge = await findRelevantKnowledge(state.message);
      if (knowledge.length > 0) {
        context += '相关知识：\n';
        for (const k of knowledge) {
          context += `- 问：${k.question}\n  答：${k.answer}\n`;
        }
      }
      break;
    }
  }

  return { context };
}
```

- [ ] **Step 3: Commit**

```bash
git add -A && git commit -m "feat: add entity extraction and RAG retrieval nodes"
```

---

### Task 11: LangGraph Workflow Assembly

**Files:**
- Create: `apps/server/src/agent/graph.ts`
- Create: `apps/server/src/agent/tools.ts`
- Create: `apps/server/src/agent/response.ts`

- [ ] **Step 1: Create LangChain tools for order operations**

```typescript
// apps/server/src/agent/tools.ts
import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import { createOrder, getOrderDetail, updateOrderStatus } from '../modules/order/service.js';
import { listProducts, getProductWithPrice } from '../modules/product/service.js';

export const searchProductsTool = tool(
  async ({ query, marketId }: { query: string; marketId: string }) => {
    const products = await listProducts(marketId, query);
    return JSON.stringify(products);
  },
  {
    name: 'search_products',
    description: '搜索商品，返回商品列表（名称、价格、库存）',
    schema: z.object({
      query: z.string().describe('搜索关键词'),
      marketId: z.string().describe('市场ID'),
    }),
  }
);

export const createOrderTool = tool(
  async (params: any) => {
    const result = await createOrder(params.data, params.creatorId, params.creatorRole);
    return JSON.stringify(result);
  },
  {
    name: 'create_order',
    description: '创建新订单',
    schema: z.object({
      data: z.object({
        buyerId: z.string(),
        supplierId: z.string(),
        items: z.array(z.object({
          productId: z.string(),
          quantity: z.number(),
        })),
        deliveryAddress: z.string(),
        remark: z.string().optional(),
      }),
      creatorId: z.string(),
      creatorRole: z.enum(['buyer', 'supplier']),
    }),
  }
);

export const queryOrderTool = tool(
  async ({ orderId }: { orderId: string }) => {
    const order = await getOrderDetail(orderId);
    return JSON.stringify(order);
  },
  {
    name: 'query_order',
    description: '查询订单详情',
    schema: z.object({
      orderId: z.string().describe('订单ID'),
    }),
  }
);

export const confirmOrderTool = tool(
  async ({ orderId }: { orderId: string }) => {
    const result = await updateOrderStatus(orderId, 'confirmed');
    return JSON.stringify(result);
  },
  {
    name: 'confirm_order',
    description: '确认订单',
    schema: z.object({
      orderId: z.string().describe('订单ID'),
    }),
  }
);

export const agentTools = [searchProductsTool, createOrderTool, queryOrderTool, confirmOrderTool];
```

- [ ] **Step 2: Create response generation node**

```typescript
// apps/server/src/agent/response.ts
import { getLLM } from '../llm/provider.js';
import { responsePrompt } from '../llm/prompts.js';
import type { AgentState } from './types.js';

/**
 * Generate the final response to the user.
 */
export async function generateResponse(state: AgentState): Promise<Partial<AgentState>> {
  const llm = getLLM();
  const chain = responsePrompt.pipe(llm);

  const context = [
    state.context ? `检索到的信息：\n${state.context}` : '',
    state.entities ? `提取的实体：${JSON.stringify(state.entities)}` : '',
    state.intent ? `用户意图：${state.intent}` : '',
  ]
    .filter(Boolean)
    .join('\n\n');

  const result = await chain.invoke({
    context,
    message: state.message,
  });

  return { response: result.content.toString() };
}
```

- [ ] **Step 3: Assemble the LangGraph workflow**

```typescript
// apps/server/src/agent/graph.ts
import { StateGraph, END, START } from '@langchain/langgraph';
import { Annotation } from '@langchain/langgraph';
import type { AgentIntent, Order } from '@agent-xfd/shared';
import type { ExtractedEntities } from './types.js';
import { recognizeIntent } from './intent.js';
import { extractEntities } from './entities.js';
import { retrieveContext } from './retrieval.js';
import { generateResponse } from './response.js';

/**
 * LangGraph State definition using Annotation.
 */
const AgentStateAnnotation = Annotation.Root({
  message: Annotation<string>,
  userId: Annotation<string>,
  userRole: Annotation<'buyer' | 'supplier'>,
  marketId: Annotation<string>,
  conversationId: Annotation<string | undefined>,
  intent: Annotation<AgentIntent | null>,
  entities: Annotation<ExtractedEntities | null>,
  context: Annotation<string>,
  response: Annotation<string>,
  orderPreview: Annotation<Order | null>,
  suggestions: Annotation<string[]>,
  history: Annotation<Array<{ role: 'user' | 'assistant'; content: string }>>,
});

/**
 * Conditional routing based on recognized intent.
 */
function routeByIntent(state: typeof AgentStateAnnotation.State): string {
  const intent = state.intent;

  if (intent === 'place_order' || intent === 'ask_price' || intent === 'recommend') {
    return 'extractEntities';
  }

  if (intent === 'query_order') {
    return 'retrieveContext';
  }

  // For confirm_order, cancel, chat — go straight to response
  return 'generateResponse';
}

/**
 * Build the LangGraph workflow.
 *
 * Flow:
 *   START → recognizeIntent → [route] → extractEntities → retrieveContext → generateResponse → END
 *                          → [route] → retrieveContext → generateResponse → END
 *                          → [route] → generateResponse → END
 */
export function buildAgentGraph() {
  const graph = new StateGraph(AgentStateAnnotation)
    .addNode('recognizeIntent', recognizeIntent)
    .addNode('extractEntities', extractEntities)
    .addNode('retrieveContext', retrieveContext)
    .addNode('generateResponse', generateResponse)
    .addEdge(START, 'recognizeIntent')
    .addConditionalEdges('recognizeIntent', routeByIntent, {
      extractEntities: 'extractEntities',
      retrieveContext: 'retrieveContext',
      generateResponse: 'generateResponse',
    })
    .addEdge('extractEntities', 'retrieveContext')
    .addEdge('retrieveContext', 'generateResponse')
    .addEdge('generateResponse', END);

  return graph.compile();
}
```

- [ ] **Step 4: Commit**

```bash
git add -A && git commit -m "feat: assemble LangGraph agent workflow"
```

---

### Task 12: SSE Streaming Chat Endpoint

**Files:**
- Create: `apps/server/src/modules/chat/router.ts`
- Create: `apps/server/src/modules/chat/stream.ts`
- Modify: `apps/server/src/index.ts`

- [ ] **Step 1: Create SSE streaming utility**

```typescript
// apps/server/src/modules/chat/stream.ts
import { Context } from 'hono';
import { streamSSE } from 'hono/streaming';

/**
 * Send a Server-Sent Event to the client.
 */
export function sendSSEEvent(
  stream: any,
  eventType: string,
  data: string
) {
  stream.writeSSE({
    event: eventType,
    data: JSON.stringify(data),
  });
}

/**
 * Create an SSE response for agent chat.
 */
export function createSSEResponse(c: Context) {
  return streamSSE(c, async (stream) => {
    return stream;
  });
}
```

- [ ] **Step 2: Create chat router with SSE streaming**

```typescript
// apps/server/src/modules/chat/router.ts
import { Hono } from 'hono';
import { streamSSE } from 'hono/streaming';
import { authMiddleware } from '../../middleware/auth.js';
import { buildAgentGraph } from '../../agent/graph.js';

export const chatRouter = new Hono();
chatRouter.use('*', authMiddleware);

const agentGraph = buildAgentGraph();

chatRouter.post('/stream', async (c) => {
  const { message, conversationId } = await c.req.json();
  const userId = c.get('userId');
  const userRole = c.get('userRole');

  // Get user's marketId (simplified)
  // Fetch user's marketId from database
  const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  const marketId = user?.marketId || '';

  return streamSSE(c, async (stream) => {
    try {
      // Send acknowledgment
      await stream.writeSSE({
        event: 'start',
        data: JSON.stringify({ status: 'processing' }),
      });

      // Run the agent graph
      const result = await agentGraph.invoke({
        message,
        userId,
        userRole,
        marketId,
        conversationId,
        intent: null,
        entities: null,
        context: '',
        response: '',
        orderPreview: null,
        suggestions: [],
        history: [],
      });

      // Stream the response in chunks (simulate typing effect)
      const fullResponse = result.response;
      const chunkSize = 10;
      for (let i = 0; i < fullResponse.length; i += chunkSize) {
        const chunk = fullResponse.slice(i, i + chunkSize);
        await stream.writeSSE({
          event: 'text',
          data: JSON.stringify({ content: chunk }),
        });
        // Small delay for typing effect
        await new Promise((resolve) => setTimeout(resolve, 50));
      }

      // Send order preview if available
      if (result.orderPreview) {
        await stream.writeSSE({
          event: 'order_preview',
          data: JSON.stringify(result.orderPreview),
        });
      }

      // Send suggestions if available
      if (result.suggestions && result.suggestions.length > 0) {
        await stream.writeSSE({
          event: 'suggestions',
          data: JSON.stringify(result.suggestions),
        });
      }

      // Send done event
      await stream.writeSSE({
        event: 'done',
        data: JSON.stringify({
          intent: result.intent,
          fullResponse: result.response,
        }),
      });
    } catch (error: any) {
      await stream.writeSSE({
        event: 'error',
        data: JSON.stringify({ error: error.message }),
      });
    }
  });
});
```

- [ ] **Step 3: Register chat router**

```typescript
// apps/server/src/index.ts (updated imports)
import { chatRouter } from './modules/chat/router.js';

// Add after other routes:
app.route('/api/chat', chatRouter);
```

- [ ] **Step 4: Commit**

```bash
git add -A && git commit -m "feat: add SSE streaming chat endpoint"
```
---

## Phase 6: React Native Frontend

### Task 13: Expo Project Setup

**Files:**
- Create: `apps/mobile/package.json`
- Create: `apps/mobile/app.json`
- Create: `apps/mobile/app/(tabs)/_layout.tsx`

- [ ] **Step 1: Initialize Expo project**

```bash
cd apps && npx create-expo-app@latest mobile --template blank-typescript
```

- [ ] **Step 2: Install dependencies**

```bash
cd apps/mobile
npx expo install expo-router expo-secure-store @expo/vector-icons
pnpm add @agent-xfd/shared
```

- [ ] **Step 3: Create tab layout with 4 tabs**

Create `apps/mobile/app/(tabs)/_layout.tsx` with Tabs component for: Agent (首页), Orders (订单), Prices (价格), Profile (我的).

- [ ] **Step 4: Commit**

```bash
git add -A && git commit -m "feat: initialize React Native app with Expo"
```

---

### Task 14: API Client + SSE Hook

**Files:**
- Create: `apps/mobile/src/services/api.ts`
- Create: `apps/mobile/src/services/auth.ts`
- Create: `apps/mobile/src/hooks/useSSE.ts`
- Create: `apps/mobile/src/hooks/useChat.ts`

- [ ] **Step 1: Create API client** with token auth via expo-secure-store
- [ ] **Step 2: Create auth service** (login, register, logout, isLoggedIn)
- [ ] **Step 3: Create SSE hook** for streaming chat with event parsing
- [ ] **Step 4: Create useChat hook** combining SSE with message state management
- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat: add API client, auth service, and SSE chat hooks"
```

---

### Task 15: Agent Chat Screen (Main UI)

**Files:**
- Create: `apps/mobile/app/(tabs)/index.tsx`
- Create: `apps/mobile/src/components/ChatBubble.tsx`
- Create: `apps/mobile/src/components/QuickActions.tsx`
- Create: `apps/mobile/src/components/ChatInput.tsx`
- Create: `apps/mobile/src/components/OrderPreviewCard.tsx`

- [ ] **Step 1: Create ChatBubble** component (user/assistant message bubbles)
- [ ] **Step 2: Create QuickActions** (今日订单 / 快速下单 / 价格看板)
- [ ] **Step 3: Create ChatInput** with text input + voice button
- [ ] **Step 4: Create OrderPreviewCard** for structured order confirmation
- [ ] **Step 5: Create Agent screen** assembling all components with FlatList
- [ ] **Step 6: Commit**

```bash
git add -A && git commit -m "feat: add Agent chat screen with components"
```

---

### Task 16: Login Screen + Remaining Tabs

**Files:**
- Create: `apps/mobile/app/login.tsx`
- Create: `apps/mobile/app/(tabs)/orders.tsx`
- Create: `apps/mobile/app/(tabs)/prices.tsx`
- Create: `apps/mobile/app/(tabs)/profile.tsx`

- [ ] **Step 1: Create login screen** with username/password form
- [ ] **Step 2: Create orders list screen** with status filter chips
- [ ] **Step 3: Create price board screen** with search + product list
- [ ] **Step 4: Create profile screen** with user info + logout
- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat: add login, orders, prices, and profile screens"
```

---

## Phase 7: Integration & Testing

### Task 17: Seed Data for Development

**Files:**
- Create: `apps/server/src/db/seed.ts`

- [ ] **Step 1: Create seed script** with market, users, products, supplier prices
- [ ] **Step 2: Add db:seed script to package.json**
- [ ] **Step 3: Commit**

```bash
git add -A && git commit -m "feat: add database seed script with sample data"
```

---

### Task 18: Integration Test — Agent Chat Flow

**Files:**
- Create: `apps/server/src/__tests__/agent.test.ts`
- Create: `apps/server/vitest.config.ts`

- [ ] **Step 1: Create vitest config**
- [ ] **Step 2: Write integration tests** for place_order, query_order, ask_price intents
- [ ] **Step 3: Commit**

```bash
git add -A && git commit -m "test: add Agent graph integration tests"
```

---

## Execution Summary

After completing all tasks, you will have:

1. **Monorepo** with Turborepo + pnpm workspace
2. **Shared types** package for frontend/backend consistency
3. **PostgreSQL database** with Drizzle ORM + pgvector
4. **Hono backend** with auth, product, order, and chat APIs
5. **LLM abstraction** via LangChain.js (configurable DeepSeek/OpenAI)
6. **RAG module** with embeddings and semantic search
7. **LangGraph agent** with intent recognition, entity extraction, and retrieval
8. **SSE streaming** for real-time agent responses
9. **React Native app** with chat UI, order list, price board, and profile

### Running the Project

```bash
# 1. Start PostgreSQL
# 2. Copy .env.example to .env and fill in values
# 3. Install dependencies
pnpm install

# 4. Setup database
cd apps/server
pnpm db:push
pnpm db:seed

# 5. Start backend
pnpm dev

# 6. Start mobile app (new terminal)
cd apps/mobile
npx expo start
```

