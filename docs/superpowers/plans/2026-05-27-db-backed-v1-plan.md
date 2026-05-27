# Database Backed V1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the development V1 where conversations, products, prices, and orders are managed through PostgreSQL instead of frontend memory and mock data.

**Architecture:** The backend owns durable state. Mobile loads the current conversation, product list, and order list from authenticated APIs; chat requests carry only `conversationId` and the latest message. The Agent reads database-backed conversation history, maintains an order draft in conversation metadata, and creates real orders on confirmation.

**Tech Stack:** TypeScript, Hono, Drizzle ORM, PostgreSQL, React Native Expo, SSE over XMLHttpRequest, LangGraph/LangChain with local fallback rules.

---

## File Structure

### Backend

- Create: `apps/server/src/modules/chat/types.ts`  
  Defines `ConversationMessage`, `OrderDraft`, and response DTOs used by chat service and router.

- Create: `apps/server/src/modules/chat/service.ts`  
  Owns conversation persistence: get/create current conversation, append messages, read latest draft, update assistant metadata.

- Modify: `apps/server/src/modules/chat/router.ts`  
  Adds `GET /api/chat/current`; refactors `POST /api/chat/stream` to use DB history instead of client-supplied history.

- Create: `apps/server/src/agent/orderDraft.ts`  
  Converts extracted entities and history into an `OrderDraft`, validates required fields, resolves product and supplier data, and creates orders on confirm.

- Modify: `apps/server/src/agent/types.ts`  
  Adds optional `orderDraft`, `createdOrder`, and `missingFields` fields to `AgentState`.

- Modify: `apps/server/src/agent/graph.ts`  
  Inserts an order-flow node before response generation.

- Modify: `apps/server/src/agent/response.ts`  
  Builds responses using durable draft/order creation state.

- Modify: `apps/server/src/modules/product/service.ts` and `router.ts`  
  Defaults product queries to the authenticated user market and returns supplier price summary.

- Modify: `apps/server/src/modules/order/service.ts` and `router.ts`  
  Queries orders according to user role and returns order item summaries for the mobile order page.

### Mobile

- Modify: `apps/mobile/src/hooks/useChat.ts`  
  Loads current conversation from DB and sends `conversationId` with each message.

- Modify: `apps/mobile/src/hooks/useSSE.ts`  
  Sends `{ conversationId, message }`, not full history.

- Modify: `apps/mobile/src/services/api.ts`  
  Reuses existing request helper for chat current, orders, and products.

- Create: `apps/mobile/src/services/chat.ts`  
  Wraps `GET /api/chat/current`.

- Create: `apps/mobile/src/services/products.ts`  
  Wraps `GET /api/products`.

- Create: `apps/mobile/src/services/orders.ts`  
  Wraps `GET /api/orders`.

- Modify: `apps/mobile/app/(tabs)/orders.tsx`  
  Replaces mock orders with DB data.

- Modify: `apps/mobile/app/(tabs)/prices.tsx`  
  Replaces mock products with DB data.

---

### Task 1: Conversation Types and Persistence Service

**Files:**
- Create: `apps/server/src/modules/chat/types.ts`
- Create: `apps/server/src/modules/chat/service.ts`
- Modify: `apps/server/src/agent/types.ts`

- [ ] **Step 1: Create chat DTO and draft types**

Create `apps/server/src/modules/chat/types.ts`:

```ts
import type { AgentIntent, Order } from '@agent-xfd/shared';

export interface OrderDraftItem {
  productId: string;
  productName: string;
  quantity: number;
  unit: string;
  unitPrice: number;
}

export interface OrderDraft {
  buyerName?: string;
  buyerPhone?: string;
  supplierId?: string;
  supplierName?: string;
  items: OrderDraftItem[];
  deliveryAddress?: string;
  deliveryTime?: string;
  remark?: string;
}

export interface ConversationMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
  metadata?: {
    intent?: AgentIntent | null;
    orderDraft?: OrderDraft;
    orderId?: string;
    order?: Order;
    error?: string;
  };
}

export interface CurrentConversationResponse {
  conversationId: string;
  messages: ConversationMessage[];
}
```

- [ ] **Step 2: Extend AgentState for draft/order result**

Modify `apps/server/src/agent/types.ts`:

```ts
import type { AgentIntent, Order } from '@agent-xfd/shared';
import type { OrderDraft } from '../modules/chat/types.js';

export interface AgentState {
  message: string;
  userId: string;
  userRole: 'buyer' | 'supplier';
  marketId: string;
  conversationId?: string;
  intent: AgentIntent | null;
  entities: ExtractedEntities | null;
  context: string;
  response: string;
  orderPreview: Order | null;
  suggestions: string[];
  history: Array<{ role: 'user' | 'assistant'; content: string }>;
  orderDraft?: OrderDraft | null;
  createdOrder?: Order | null;
  missingFields?: string[];
}
```

- [ ] **Step 3: Implement conversation service**

Create `apps/server/src/modules/chat/service.ts`:

```ts
import { desc, eq } from 'drizzle-orm';
import { db } from '../../db/index.js';
import { conversations } from '../../db/schema.js';
import type { ConversationMessage, OrderDraft } from './types.js';

function normalizeMessages(value: unknown): ConversationMessage[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is ConversationMessage => {
    return item && typeof item === 'object'
      && ['user', 'assistant', 'system'].includes((item as any).role)
      && typeof (item as any).content === 'string';
  });
}

export async function getOrCreateCurrentConversation(userId: string) {
  const [existing] = await db
    .select()
    .from(conversations)
    .where(eq(conversations.userId, userId))
    .orderBy(desc(conversations.updatedAt))
    .limit(1);

  if (existing) {
    return {
      ...existing,
      messages: normalizeMessages(existing.messages),
    };
  }

  const [created] = await db
    .insert(conversations)
    .values({ userId, messages: [] })
    .returning();

  return {
    ...created,
    messages: normalizeMessages(created.messages),
  };
}

export async function getConversationForUser(conversationId: string, userId: string) {
  const [conversation] = await db
    .select()
    .from(conversations)
    .where(eq(conversations.id, conversationId))
    .limit(1);

  if (!conversation || conversation.userId !== userId) {
    throw new Error('Conversation not found');
  }

  return {
    ...conversation,
    messages: normalizeMessages(conversation.messages),
  };
}

export async function appendConversationMessage(
  conversationId: string,
  message: ConversationMessage
) {
  const [conversation] = await db
    .select()
    .from(conversations)
    .where(eq(conversations.id, conversationId))
    .limit(1);

  if (!conversation) throw new Error('Conversation not found');

  const messages = normalizeMessages(conversation.messages);
  const updatedMessages = [...messages, message];

  const [updated] = await db
    .update(conversations)
    .set({ messages: updatedMessages, updatedAt: new Date() })
    .where(eq(conversations.id, conversationId))
    .returning();

  return {
    ...updated,
    messages: normalizeMessages(updated.messages),
  };
}

export function toAgentHistory(messages: ConversationMessage[]) {
  return messages
    .filter((message) => message.role === 'user' || message.role === 'assistant')
    .map((message) => ({ role: message.role as 'user' | 'assistant', content: message.content }))
    .slice(-12);
}

export function getLatestOrderDraft(messages: ConversationMessage[]): OrderDraft | null {
  for (const message of [...messages].reverse()) {
    const draft = message.metadata?.orderDraft;
    if (draft) return draft;
  }
  return null;
}
```

- [ ] **Step 4: Run server build**

Run:

```bash
pnpm --dir apps/server build
```

Expected: `tsc` exits successfully.

- [ ] **Step 5: Commit Task 1**

```bash
git add apps/server/src/modules/chat/types.ts apps/server/src/modules/chat/service.ts apps/server/src/agent/types.ts
git commit -m "feat: add chat conversation persistence service"
```

---

### Task 2: Current Conversation API and DB-Backed Chat Stream

**Files:**
- Modify: `apps/server/src/modules/chat/router.ts`
- Modify: `apps/mobile/src/hooks/useSSE.ts`
- Create: `apps/mobile/src/services/chat.ts`
- Modify: `apps/mobile/src/hooks/useChat.ts`

- [ ] **Step 1: Add `GET /api/chat/current`**

In `apps/server/src/modules/chat/router.ts`, import service helpers:

```ts
import {
  appendConversationMessage,
  getConversationForUser,
  getOrCreateCurrentConversation,
  toAgentHistory,
} from './service.js';
```

Add route after `const agentGraph = buildAgentGraph();`:

```ts
chatRouter.get('/current', async (c) => {
  const userId = c.get('userId');
  const conversation = await getOrCreateCurrentConversation(userId);
  return c.json({
    conversationId: conversation.id,
    messages: conversation.messages,
  });
});
```

- [ ] **Step 2: Refactor stream route to use DB history**

In `chatRouter.post('/stream')`, replace client history extraction with:

```ts
const { message, conversationId } = body;
const userConversation = conversationId
  ? await getConversationForUser(conversationId, userId)
  : await getOrCreateCurrentConversation(userId);
const activeConversationId = userConversation.id;

await appendConversationMessage(activeConversationId, {
  role: 'user',
  content: message,
  timestamp: new Date().toISOString(),
});

const conversationWithUserMessage = await getConversationForUser(activeConversationId, userId);
const history = toAgentHistory(conversationWithUserMessage.messages);
```

Pass `activeConversationId` and `history` into the graph:

```ts
const result = await agentGraph.invoke({
  message,
  userId,
  userRole,
  marketId,
  conversationId: activeConversationId,
  intent: null,
  entities: null,
  context: '',
  response: '',
  orderPreview: null,
  suggestions: [],
  history,
  orderDraft: null,
  createdOrder: null,
  missingFields: [],
});
```

After graph completes, append assistant message:

```ts
await appendConversationMessage(activeConversationId, {
  role: 'assistant',
  content: result.response,
  timestamp: new Date().toISOString(),
  metadata: {
    intent: result.intent,
    orderDraft: result.orderDraft || undefined,
    orderId: result.createdOrder?.id,
    order: result.createdOrder || undefined,
  },
});
```

- [ ] **Step 3: Ensure stream error is persisted**

Inside the `catch (error: any)` block within `streamSSE`, append an assistant error message before writing the SSE error:

```ts
await appendConversationMessage(activeConversationId, {
  role: 'assistant',
  content: `处理失败：${error.message}`,
  timestamp: new Date().toISOString(),
  metadata: { error: error.message },
});
```

Expected behavior: backend failures are visible after reload because the error is stored in the conversation.

- [ ] **Step 4: Create mobile chat service**

Create `apps/mobile/src/services/chat.ts`:

```ts
import { apiRequest } from './api';

export interface ConversationMessageDto {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
}

export interface CurrentConversationDto {
  conversationId: string;
  messages: ConversationMessageDto[];
}

export function getCurrentConversation() {
  return apiRequest<CurrentConversationDto>('/api/chat/current');
}
```

- [ ] **Step 5: Change SSE request body**

In `apps/mobile/src/hooks/useSSE.ts`, add `conversationId?: string` to `SSEOptions` and send:

```ts
xhr.send(JSON.stringify({
  conversationId: options.conversationId,
  message,
}));
```

Remove `history` from the request body.

- [ ] **Step 6: Load current conversation in `useChat`**

In `apps/mobile/src/hooks/useChat.ts`, import and use `getCurrentConversation`:

```ts
import { useEffect, useState, useCallback } from 'react';
import { getCurrentConversation } from '../services/chat';
```

Add state:

```ts
const [conversationId, setConversationId] = useState<string | null>(null);
```

Add effect:

```ts
useEffect(() => {
  let mounted = true;
  getCurrentConversation()
    .then((conversation) => {
      if (!mounted) return;
      setConversationId(conversation.conversationId);
      setMessages(conversation.messages
        .filter((message) => message.role === 'user' || message.role === 'assistant')
        .map((message, index) => ({
          id: `${conversation.conversationId}-${index}`,
          role: message.role as 'user' | 'assistant',
          content: message.content,
          timestamp: new Date(message.timestamp),
        })));
    })
    .catch((error) => {
      if (!mounted) return;
      setMessages([{
        id: 'load-error',
        role: 'assistant',
        content: `加载会话失败：${error.message}`,
        timestamp: new Date(),
      }]);
    });
  return () => { mounted = false; };
}, []);
```

Pass `conversationId` into `send`:

```ts
await send(content, {
  conversationId: conversationId || undefined,
  onText,
  onDone,
  onError,
});
```

- [ ] **Step 7: Verify conversation restore**

Run:

```bash
pnpm --dir apps/mobile lint
pnpm --dir apps/server build
```

Expected: both commands pass.

Manual check:

1. Log in.
2. Send “你好”.
3. Restart mobile app.
4. Chat history still shows “你好” and the assistant reply.

- [ ] **Step 8: Commit Task 2**

```bash
git add apps/server/src/modules/chat/router.ts apps/mobile/src/hooks/useSSE.ts apps/mobile/src/hooks/useChat.ts apps/mobile/src/services/chat.ts
git commit -m "feat: persist and restore chat conversations"
```

---

### Task 3: Order Draft Merge and Confirm-to-Order Flow

**Files:**
- Create: `apps/server/src/agent/orderDraft.ts`
- Modify: `apps/server/src/agent/graph.ts`
- Modify: `apps/server/src/agent/response.ts`
- Modify: `apps/server/src/agent/retrieval.ts`

- [ ] **Step 1: Create order draft helper**

Create `apps/server/src/agent/orderDraft.ts`:

```ts
import { eq, and } from 'drizzle-orm';
import { db } from '../db/index.js';
import { products, supplierProducts, users } from '../db/schema.js';
import { createOrder } from '../modules/order/service.js';
import type { AgentState } from './types.js';
import type { OrderDraft } from '../modules/chat/types.js';

function latestDraftFromState(state: AgentState): OrderDraft {
  return state.orderDraft || { items: [] };
}

async function findProduct(name: string, marketId: string) {
  const [product] = await db
    .select()
    .from(products)
    .where(and(eq(products.marketId, marketId), eq(products.name, name)))
    .limit(1);

  if (product) return product;

  const allProducts = await db.select().from(products).where(eq(products.marketId, marketId));
  return allProducts.find((item) => name.includes(item.name) || item.name.includes(name)) || null;
}

async function findDefaultSupplier(productId: string, marketId: string) {
  const [supplierProduct] = await db
    .select()
    .from(supplierProducts)
    .where(eq(supplierProducts.productId, productId))
    .limit(1);

  if (!supplierProduct) {
    const [supplier] = await db
      .select()
      .from(users)
      .where(and(eq(users.marketId, marketId), eq(users.role, 'supplier')))
      .limit(1);
    return supplier ? { id: supplier.id, username: supplier.username } : null;
  }

  const [supplier] = await db
    .select()
    .from(users)
    .where(eq(users.id, supplierProduct.supplierId))
    .limit(1);

  return supplier ? { id: supplier.id, username: supplier.username } : null;
}

async function findDefaultBuyer(marketId: string) {
  const [buyer] = await db
    .select()
    .from(users)
    .where(and(eq(users.marketId, marketId), eq(users.role, 'buyer')))
    .limit(1);
  return buyer || null;
}

export async function buildOrderDraft(state: AgentState): Promise<OrderDraft> {
  const draft = latestDraftFromState(state);
  const nextDraft: OrderDraft = { ...draft, items: [...draft.items] };

  for (const item of state.entities?.items || []) {
    const product = await findProduct(item.name, state.marketId);
    if (!product) continue;

    const supplier = nextDraft.supplierId
      ? { id: nextDraft.supplierId, username: nextDraft.supplierName || '' }
      : await findDefaultSupplier(product.id, state.marketId);

    const [supplierPrice] = supplier
      ? await db
          .select()
          .from(supplierProducts)
          .where(and(eq(supplierProducts.supplierId, supplier.id), eq(supplierProducts.productId, product.id)))
          .limit(1)
      : [];

    nextDraft.supplierId = supplier?.id || nextDraft.supplierId;
    nextDraft.supplierName = supplier?.username || nextDraft.supplierName;

    const unitPrice = supplierPrice ? Number(supplierPrice.price) : Number(product.referencePrice);
    const existingIndex = nextDraft.items.findIndex((existing) => existing.productId === product.id);
    const draftItem = {
      productId: product.id,
      productName: product.name,
      quantity: item.quantity,
      unit: item.unit || product.unit,
      unitPrice,
    };

    if (existingIndex >= 0) nextDraft.items[existingIndex] = draftItem;
    else nextDraft.items.push(draftItem);
  }

  if (state.entities?.buyer) nextDraft.buyerName = state.entities.buyer;
  if (state.entities?.phone) nextDraft.buyerPhone = state.entities.phone;
  if (state.entities?.deliveryAddress) nextDraft.deliveryAddress = state.entities.deliveryAddress;
  if (state.entities?.timeRange) nextDraft.deliveryTime = state.entities.timeRange;

  return nextDraft;
}

export function validateOrderDraft(draft: OrderDraft) {
  const missingFields: string[] = [];
  if (draft.items.length === 0) missingFields.push('商品和数量');
  if (!draft.supplierId) missingFields.push('供应商');
  if (!draft.deliveryAddress) missingFields.push('配送地址');
  if (!draft.buyerName && !draft.buyerPhone) missingFields.push('联系人或电话');
  return missingFields;
}

export async function applyOrderFlow(state: AgentState): Promise<Partial<AgentState>> {
  if (state.intent !== 'place_order' && state.intent !== 'confirm_order') {
    return {};
  }

  const draft = await buildOrderDraft(state);
  const missingFields = validateOrderDraft(draft);

  if (state.intent === 'confirm_order') {
    if (missingFields.length > 0) {
      return { orderDraft: draft, missingFields };
    }

    const buyer = state.userRole === 'buyer'
      ? { id: state.userId }
      : await findDefaultBuyer(state.marketId);

    if (!buyer) {
      return { orderDraft: draft, missingFields: ['采购商'] };
    }

    const order = await createOrder({
      buyerId: buyer.id,
      supplierId: draft.supplierId!,
      deliveryAddress: draft.deliveryAddress!,
      remark: draft.deliveryTime ? `配送时间：${draft.deliveryTime}` : undefined,
      items: draft.items.map((item) => ({
        productId: item.productId,
        quantity: item.quantity,
      })),
    }, state.userId, state.userRole);

    return { orderDraft: draft, createdOrder: order, missingFields: [] };
  }

  return { orderDraft: draft, missingFields };
}
```

- [ ] **Step 2: Insert order flow node into graph**

Modify `apps/server/src/agent/graph.ts`:

```ts
import { applyOrderFlow } from './orderDraft.js';
```

Add annotations:

```ts
orderDraft: Annotation<OrderDraft | null>,
createdOrder: Annotation<Order | null>,
missingFields: Annotation<string[]>,
```

Add node:

```ts
.addNode('applyOrderFlow', applyOrderFlow)
```

Route:

```ts
.addEdge('retrieveContext', 'applyOrderFlow')
.addEdge('applyOrderFlow', 'generateResponse')
```

For the `generateResponse` route from `recognizeIntent`, route `confirm_order` to `extractEntities` so it can merge latest confirmation with existing history:

```ts
if (intent === 'place_order' || intent === 'ask_price' || intent === 'recommend' || intent === 'confirm_order') {
  return 'extractEntities';
}
```

- [ ] **Step 3: Teach response node order states**

In `apps/server/src/agent/response.ts`, before LLM fallback, short-circuit order outcomes:

```ts
if (state.createdOrder) {
  return {
    response: `订单已创建成功，订单号：${state.createdOrder.orderNo}，金额：￥${state.createdOrder.totalPrice}。`,
  };
}

if (state.orderDraft && state.missingFields && state.missingFields.length > 0) {
  return {
    response: `我已经记录了当前下单信息，还缺少：${state.missingFields.join('、')}。请补充后我再帮你确认订单。`,
  };
}

if (state.orderDraft && state.intent === 'place_order') {
  const total = state.orderDraft.items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
  const lines = state.orderDraft.items.map((item) => `- ${item.productName}: ${item.quantity}${item.unit} × ￥${item.unitPrice}/斤`);
  return {
    response: `我为你整理了订单草稿：\n${lines.join('\n')}\n总计约 ￥${total.toFixed(2)}。\n请确认是否下单，或继续补充配送信息。`,
  };
}
```

- [ ] **Step 4: Verify confirm creates order**

Run:

```bash
pnpm --dir apps/server build
```

Manual check:

1. Log in as `buyer1`.
2. Send “帮我下单十斤土豆”.
3. Send “小王 18089333333 西安市钟楼 明天中午12点”.
4. Send “确认”.
5. Expected assistant response contains `订单已创建成功`.

- [ ] **Step 5: Commit Task 3**

```bash
git add apps/server/src/agent/orderDraft.ts apps/server/src/agent/graph.ts apps/server/src/agent/response.ts apps/server/src/agent/retrieval.ts
git commit -m "feat: create orders from chat confirmation"
```

---

### Task 4: Database-Backed Product API

**Files:**
- Modify: `apps/server/src/modules/product/service.ts`
- Modify: `apps/server/src/modules/product/router.ts`
- Create: `apps/mobile/src/services/products.ts`
- Modify: `apps/mobile/app/(tabs)/prices.tsx`

- [ ] **Step 1: Return product price DTOs**

Modify `apps/server/src/modules/product/service.ts` to add:

```ts
export async function listProductPrices(marketId: string, search?: string) {
  const baseProducts = await listProducts(marketId, search);
  const rows = [];

  for (const product of baseProducts) {
    const [supplierPrice] = await db
      .select()
      .from(supplierProducts)
      .where(eq(supplierProducts.productId, product.id))
      .limit(1);

    rows.push({
      id: product.id,
      name: product.name,
      category: product.category,
      unit: product.unit,
      referencePrice: Number(product.referencePrice),
      supplierPrice: supplierPrice ? Number(supplierPrice.price) : undefined,
      stock: supplierPrice?.stock,
    });
  }

  return rows;
}
```

- [ ] **Step 2: Default router to authenticated user market**

Modify `apps/server/src/modules/product/router.ts`:

```ts
import { db } from '../../db/index.js';
import { users } from '../../db/schema.js';
import { eq } from 'drizzle-orm';
import { listProductPrices } from './service.js';
```

Use auth variables:

```ts
type AuthVariables = {
  userId: string;
  userRole: 'buyer' | 'supplier';
};

export const productRouter = new Hono<{ Variables: AuthVariables }>();
```

Replace `productRouter.get('/')`:

```ts
productRouter.get('/', async (c) => {
  const userId = c.get('userId');
  const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!user) return c.json({ error: 'User not found' }, 404);

  const search = c.req.query('search');
  return c.json(await listProductPrices(user.marketId, search));
});
```

- [ ] **Step 3: Add mobile products service**

Create `apps/mobile/src/services/products.ts`:

```ts
import { apiRequest } from './api';

export interface ProductPriceDto {
  id: string;
  name: string;
  category: string;
  unit: string;
  referencePrice: number;
  supplierPrice?: number;
  stock?: number;
}

export function listProducts(search?: string) {
  const query = search ? `?search=${encodeURIComponent(search)}` : '';
  return apiRequest<ProductPriceDto[]>(`/api/products${query}`);
}
```

- [ ] **Step 4: Replace prices mock data**

Modify `apps/mobile/app/(tabs)/prices.tsx`:

```ts
import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, TextInput, StyleSheet, SafeAreaView } from 'react-native';
import { listProducts, type ProductPriceDto } from '../../src/services/products';

export default function PricesScreen() {
  const [search, setSearch] = useState('');
  const [products, setProducts] = useState<ProductPriceDto[]>([]);
  const [error, setError] = useState('');

  useEffect(() => {
    const handle = setTimeout(() => {
      listProducts(search)
        .then(setProducts)
        .catch((e: any) => setError(e.message));
    }, 250);
    return () => clearTimeout(handle);
  }, [search]);

  return (
    <SafeAreaView style={styles.container}>
      <TextInput style={styles.search} placeholder="搜索商品..." placeholderTextColor="#bbb" value={search} onChangeText={setSearch} />
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <FlatList data={products} keyExtractor={(item) => item.id} renderItem={({ item }) => (
        <View style={styles.row}>
          <View>
            <Text style={styles.name}>{item.name}</Text>
            <Text style={styles.cat}>{item.category} · 参考价 ￥{item.referencePrice}/{item.unit}</Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={styles.price}>￥{item.supplierPrice ?? item.referencePrice}</Text>
            <Text style={styles.change}>库存 {item.stock ?? '-'}</Text>
          </View>
        </View>
      )} contentContainerStyle={styles.list} />
    </SafeAreaView>
  );
}
```

Keep existing styles and add:

```ts
error: { color: '#c62828', paddingHorizontal: 14, marginBottom: 8 },
```

- [ ] **Step 5: Verify product page**

Run:

```bash
pnpm --dir apps/mobile lint
pnpm --dir apps/server build
```

Manual check: price page shows seed products such as 土豆、西红柿、白菜.

- [ ] **Step 6: Commit Task 4**

```bash
git add apps/server/src/modules/product/service.ts apps/server/src/modules/product/router.ts apps/mobile/src/services/products.ts 'apps/mobile/app/(tabs)/prices.tsx'
git commit -m "feat: load product prices from database"
```

---

### Task 5: Database-Backed Order List

**Files:**
- Modify: `apps/server/src/modules/order/service.ts`
- Modify: `apps/server/src/modules/order/router.ts`
- Create: `apps/mobile/src/services/orders.ts`
- Modify: `apps/mobile/app/(tabs)/orders.tsx`

- [ ] **Step 1: Add role-aware order list service**

Modify `apps/server/src/modules/order/service.ts`:

```ts
import { or } from 'drizzle-orm';
```

Add:

```ts
export async function getOrdersForUser(userId: string, role: 'buyer' | 'supplier' | 'admin', filters?: { status?: OrderStatus }) {
  const conditions = [];
  if (role === 'buyer') conditions.push(eq(orders.buyerId, userId));
  else if (role === 'supplier') conditions.push(eq(orders.supplierId, userId));
  else conditions.push(or(eq(orders.buyerId, userId), eq(orders.supplierId, userId))!);

  if (filters?.status) conditions.push(eq(orders.status, filters.status));

  const rows = await db.select().from(orders).where(and(...conditions)).orderBy(desc(orders.createdAt));
  const result = [];

  for (const order of rows) {
    const items = await db.select().from(orderItems).where(eq(orderItems.orderId, order.id));
    result.push({ ...order, items });
  }

  return result;
}
```

- [ ] **Step 2: Use role-aware service in router**

Modify `apps/server/src/modules/order/router.ts`:

```ts
import { createOrder, getOrdersForUser, getOrderDetail, updateOrderStatus } from './service.js';
```

Replace `orderRouter.get('/')`:

```ts
orderRouter.get('/', async (c) => {
  const userId = c.get('userId');
  const userRole = c.get('userRole');
  const status = c.req.query('status');
  return c.json(await getOrdersForUser(userId, userRole, isOrderStatus(status) ? { status } : undefined));
});
```

- [ ] **Step 3: Add mobile orders service**

Create `apps/mobile/src/services/orders.ts`:

```ts
import { apiRequest } from './api';

export interface OrderItemDto {
  productName: string;
  quantity: number;
  unit: string;
  unitPrice: string;
  subtotal: string;
}

export interface OrderDto {
  id: string;
  orderNo: string;
  buyerName: string;
  supplierName: string;
  totalPrice: string;
  status: string;
  createdAt: string;
  items: OrderItemDto[];
}

export function listOrders(status?: string) {
  const query = status ? `?status=${encodeURIComponent(status)}` : '';
  return apiRequest<OrderDto[]>(`/api/orders${query}`);
}
```

- [ ] **Step 4: Replace orders mock data**

Modify `apps/mobile/app/(tabs)/orders.tsx`:

```ts
import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, SafeAreaView } from 'react-native';
import { listOrders, type OrderDto } from '../../src/services/orders';
```

Load data:

```ts
const [orders, setOrders] = useState<OrderDto[]>([]);
const [error, setError] = useState('');

useEffect(() => {
  listOrders()
    .then(setOrders)
    .catch((e: any) => setError(e.message));
}, []);
```

Render item summary:

```ts
const itemSummary = item.items.map((orderItem) => `${orderItem.productName}${orderItem.quantity}${orderItem.unit}`).join(' + ');
```

Use `item.orderNo`, `item.status`, `item.buyerName`, `item.supplierName`, and `item.totalPrice` in the existing card layout.

- [ ] **Step 5: Verify created order appears**

Manual check:

1. Create order through chat.
2. Open order tab.
3. Expected: newly created order appears with product summary and amount.

Run:

```bash
pnpm --dir apps/mobile lint
pnpm --dir apps/server build
```

- [ ] **Step 6: Commit Task 5**

```bash
git add apps/server/src/modules/order/service.ts apps/server/src/modules/order/router.ts apps/mobile/src/services/orders.ts 'apps/mobile/app/(tabs)/orders.tsx'
git commit -m "feat: load orders from database"
```

---

### Task 6: End-to-End Verification and Cleanup

**Files:**
- Verify: files changed by Tasks 1-5
- Update: `docs/superpowers/plans/2026-05-27-db-backed-v1-plan.md` checkbox statuses while executing

- [ ] **Step 1: Start database**

Run:

```bash
docker compose up -d
```

Expected: PostgreSQL container `agent-xfd-db` is running.

- [ ] **Step 2: Push schema and seed**

Run:

```bash
pnpm --dir apps/server db:push
pnpm --dir apps/server db:seed
```

Expected seed users:

```text
buyer1 / 123456
supplier1 / 123456
```

- [ ] **Step 3: Start backend**

Run:

```bash
pnpm --dir apps/server dev
```

Expected log:

```text
Server running on http://0.0.0.0:3000
```

- [ ] **Step 4: Start mobile app**

Run:

```bash
pnpm --dir apps/mobile dev
```

If using a physical device:

```powershell
$env:EXPO_PUBLIC_API_URL="http://<computer-lan-ip>:3000"; pnpm --dir apps/mobile dev
```

- [ ] **Step 5: Verify chat persistence**

Manual flow:

1. Log in as `buyer1`.
2. Send “你好”.
3. Close and reopen the mobile app.
4. Expected: the conversation still contains “你好” and assistant reply.

- [ ] **Step 6: Verify order creation**

Manual flow:

1. Send “帮我下单十斤土豆”.
2. Send “小王 18089333333 西安市钟楼 明天中午12点”.
3. Send “确认”.
4. Expected: assistant returns a real order number.

- [ ] **Step 7: Verify order list**

Manual flow:

1. Open 订单 tab.
2. Expected: the order created in Step 6 appears.

- [ ] **Step 8: Verify price page**

Manual flow:

1. Open 价格 tab.
2. Search “土豆”.
3. Expected: product list shows 土豆 with DB price.

- [ ] **Step 9: Run final checks**

Run:

```bash
pnpm lint
pnpm build
git status --short
```

Expected:

- `pnpm lint` passes.
- `pnpm build` passes.
- `git status --short` only shows expected plan checkbox edits or is clean after final commit.

- [ ] **Step 10: Final commit**

```bash
git add apps/server apps/mobile packages docs/superpowers/plans/2026-05-27-db-backed-v1-plan.md
git commit -m "feat: back core mobile flows with database"
```
