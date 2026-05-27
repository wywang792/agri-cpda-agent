# Buyer Address Book Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add buyer-managed delivery addresses, use the default address in chat ordering, and support natural-language address creation.

**Architecture:** Add a normalized `buyer_addresses` table and focused backend module used by both REST routes and agent nodes. Mobile manages addresses from the buyer "My" tab. The agent gains `manage_address` intent and order draft filling uses explicit user-provided delivery data first, then buyer default address.

**Tech Stack:** TypeScript, Hono, Drizzle ORM, PostgreSQL, Expo React Native, Vitest, LangGraph.

---

## File Structure

Backend:

- Create `apps/server/src/modules/buyerAddress/types.ts` for request DTOs.
- Create `apps/server/src/modules/buyerAddress/service.ts` for address CRUD, default selection, validation, and testable pure helpers.
- Create `apps/server/src/modules/buyerAddress/router.ts` for authenticated REST API.
- Create `apps/server/src/modules/buyerAddress/service.test.ts` for default-address behavior tests.
- Modify `apps/server/src/db/schema.ts` to add `buyerAddresses` and order delivery contact snapshot fields.
- Modify `apps/server/src/index.ts` to mount `/api/buyer-addresses`.
- Modify `packages/shared/src/agent.ts` to add `manage_address`.
- Modify `packages/shared/src/order.ts` to add `deliveryContactName` and `deliveryContactPhone`.
- Modify `apps/server/src/agent/types.ts` to add address fields to extracted entities.
- Modify `apps/server/src/agent/fallback.ts` and `apps/server/src/llm/prompts.ts` to recognize and extract address-management requests.
- Create `apps/server/src/agent/addressBook.ts` for `manage_address` graph behavior.
- Modify `apps/server/src/agent/graph.ts` to route `manage_address`.
- Modify `apps/server/src/agent/orderDraft.ts` to fill missing delivery fields from the default address and write delivery snapshots.
- Modify `apps/server/src/agent/response.ts` for address-management responses.

Mobile:

- Create `apps/mobile/src/services/buyerAddresses.ts` for REST calls.
- Modify `apps/mobile/app/(tabs)/profile.tsx` to show and maintain buyer addresses.

## Task 1: Backend Address Book API

**Files:**

- Modify: `apps/server/src/db/schema.ts`
- Modify: `apps/server/src/index.ts`
- Create: `apps/server/src/modules/buyerAddress/types.ts`
- Create: `apps/server/src/modules/buyerAddress/service.ts`
- Create: `apps/server/src/modules/buyerAddress/router.ts`
- Create: `apps/server/src/modules/buyerAddress/service.test.ts`

- [ ] **Step 1: Write service tests**

Create tests covering:

```ts
import { describe, expect, it } from 'vitest';
import { chooseDefaultAddressAfterCreate, chooseDefaultAfterDelete, normalizeAddressInput } from './service.js';

describe('buyer address helpers', () => {
  it('makes the first address default', () => {
    expect(chooseDefaultAddressAfterCreate([], false)).toBe(true);
  });

  it('keeps explicit default on create', () => {
    expect(chooseDefaultAddressAfterCreate([{ id: 'a', isDefault: true }], true)).toBe(true);
  });

  it('promotes newest remaining address after deleting default', () => {
    expect(chooseDefaultAfterDelete([
      { id: 'old', isDefault: false, createdAt: new Date('2026-01-01') },
      { id: 'new', isDefault: false, createdAt: new Date('2026-01-02') },
    ])).toBe('new');
  });

  it('normalizes required address fields', () => {
    expect(normalizeAddressInput({
      contactName: ' 小王 ',
      contactPhone: ' 18089333333 ',
      address: ' 西安市钟楼 ',
    })).toEqual({
      contactName: '小王',
      contactPhone: '18089333333',
      address: '西安市钟楼',
      isDefault: false,
    });
  });
});
```

- [ ] **Step 2: Run tests and confirm failure**

Run:

```bash
pnpm --dir apps/server test -- --run src/modules/buyerAddress/service.test.ts
```

Expected: fails because module does not exist.

- [ ] **Step 3: Add schema**

In `apps/server/src/db/schema.ts`, add:

```ts
export const buyerAddresses = pgTable('buyer_addresses', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').references(() => users.id).notNull(),
  contactName: varchar('contact_name', { length: 255 }).notNull(),
  contactPhone: varchar('contact_phone', { length: 50 }).notNull(),
  address: text('address').notNull(),
  isDefault: boolean('is_default').notNull().default(false),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  userIdx: index('buyer_addresses_user_idx').on(table.userId),
}));
```

Also add order fields:

```ts
deliveryContactName: varchar('delivery_contact_name', { length: 255 }),
deliveryContactPhone: varchar('delivery_contact_phone', { length: 50 }),
```

- [ ] **Step 4: Implement service and router**

`service.ts` exports:

- `normalizeAddressInput(input)`
- `chooseDefaultAddressAfterCreate(existing, requestedDefault)`
- `chooseDefaultAfterDelete(addresses)`
- `listBuyerAddresses(userId)`
- `getDefaultBuyerAddress(userId)`
- `createBuyerAddress(userId, input)`
- `updateBuyerAddress(userId, id, input)`
- `deleteBuyerAddress(userId, id)`
- `setDefaultBuyerAddress(userId, id)`

`router.ts` exposes:

- `GET /`
- `POST /`
- `PATCH /:id`
- `DELETE /:id`
- `POST /:id/default`

Supplier/admin requests return `403`.

- [ ] **Step 5: Mount route**

In `apps/server/src/index.ts`:

```ts
import { buyerAddressRouter } from './modules/buyerAddress/router.js';
app.route('/api/buyer-addresses', buyerAddressRouter);
```

- [ ] **Step 6: Verify**

Run:

```bash
pnpm --dir apps/server test -- --run src/modules/buyerAddress/service.test.ts
pnpm --dir apps/server build
```

- [ ] **Step 7: Commit**

```bash
git add apps/server/src/db/schema.ts apps/server/src/index.ts apps/server/src/modules/buyerAddress
git commit -m "feat: add buyer address api"
```

## Task 2: Mobile Buyer Address Management

**Files:**

- Create: `apps/mobile/src/services/buyerAddresses.ts`
- Modify: `apps/mobile/app/(tabs)/profile.tsx`

- [ ] **Step 1: Add service**

Create REST wrappers:

```ts
export interface BuyerAddressDto {
  id: string;
  contactName: string;
  contactPhone: string;
  address: string;
  isDefault: boolean;
}
```

Functions: `listBuyerAddresses`, `createBuyerAddress`, `updateBuyerAddress`, `deleteBuyerAddress`, `setDefaultBuyerAddress`.

- [ ] **Step 2: Replace profile page**

For buyer role:

- Load addresses on mount.
- Render cards with contact, phone, address, default badge.
- Add modal form for create/edit.
- Add buttons for default/delete.

For supplier role:

- Keep profile/menu/logout only.

- [ ] **Step 3: Verify**

Run:

```bash
pnpm --dir apps/mobile lint
```

- [ ] **Step 4: Commit**

```bash
git add apps/mobile/src/services/buyerAddresses.ts 'apps/mobile/app/(tabs)/profile.tsx'
git commit -m "feat: manage buyer addresses on mobile"
```

## Task 3: Agent Address Maintenance Intent

**Files:**

- Modify: `packages/shared/src/agent.ts`
- Modify: `apps/server/src/agent/types.ts`
- Modify: `apps/server/src/agent/fallback.ts`
- Modify: `apps/server/src/llm/prompts.ts`
- Create: `apps/server/src/agent/addressBook.ts`
- Modify: `apps/server/src/agent/graph.ts`
- Modify: `apps/server/src/agent/response.ts`
- Create/modify tests in `apps/server/src/agent/orderDraft.test.ts`

- [ ] **Step 1: Add tests**

Add tests that:

```ts
expect(recognizeIntentByRules('帮我新增一个地址，小王 18089333333 西安市钟楼')).toBe('manage_address');
expect(extractEntitiesByRules('帮我新增一个地址，小王 18089333333 西安市钟楼')).toMatchObject({
  contactName: '小王',
  phone: '18089333333',
  deliveryAddress: '西安市钟楼',
});
```

- [ ] **Step 2: Run and confirm failure**

Run:

```bash
pnpm --dir apps/server test -- --run src/agent/orderDraft.test.ts
```

- [ ] **Step 3: Implement intent and extraction**

Add `manage_address` to `AgentIntent`, valid intent lists, prompts, rule recognizer, and graph routing.

- [ ] **Step 4: Implement agent node**

`addressBook.ts` should:

- validate buyer role
- validate contact name, phone, address
- call `createBuyerAddress`
- return `response`, `suggestions`, and no order draft

- [ ] **Step 5: Verify and commit**

Run:

```bash
pnpm --dir apps/server test -- --run src/agent/orderDraft.test.ts
pnpm --dir apps/server build
```

Commit:

```bash
git add packages/shared/src/agent.ts apps/server/src/agent apps/server/src/llm/prompts.ts
git commit -m "feat: support natural language address management"
```

## Task 4: Default Address in Order Flow

**Files:**

- Modify: `packages/shared/src/order.ts`
- Modify: `apps/server/src/modules/order/service.ts`
- Modify: `apps/server/src/agent/orderDraft.ts`
- Modify: `apps/server/src/modules/chat/types.ts`
- Modify: `apps/mobile/src/services/orders.ts`
- Modify: `apps/mobile/app/(tabs)/orders.tsx`

- [ ] **Step 1: Add tests**

Add tests or service-level verification for:

- default address fills missing contact, phone, address
- explicit delivery address overrides default address

- [ ] **Step 2: Add order snapshot fields**

Shared `Order` and `CreateOrderRequest` gain:

```ts
deliveryContactName?: string;
deliveryContactPhone?: string;
```

Order service inserts those fields.

- [ ] **Step 3: Fill default address**

In order draft resolution:

- If `buyerId` exists and any delivery field is missing, load default address.
- Fill only missing fields.
- Keep explicit user-provided fields.

- [ ] **Step 4: Show confirmation and order list**

Assistant response should include contact, phone, address. Mobile order list can show contact and phone below the delivery address.

- [ ] **Step 5: Verify and commit**

Run:

```bash
pnpm --dir apps/server test -- --run
pnpm --dir apps/server build
pnpm --dir apps/mobile lint
```

Commit:

```bash
git add packages/shared/src/order.ts apps/server/src/modules/order/service.ts apps/server/src/agent/orderDraft.ts apps/server/src/modules/chat/types.ts apps/mobile/src/services/orders.ts 'apps/mobile/app/(tabs)/orders.tsx'
git commit -m "feat: use default buyer address for orders"
```

## Task 5: Final Verification

- [ ] **Step 1: Push database schema**

Run:

```bash
pnpm --dir apps/server db:push
```

- [ ] **Step 2: Manual smoke**

1. Log in as buyer.
2. Add one address in "我的"; verify it becomes default.
3. Ask chat: "帮我下单10斤土豆".
4. Verify assistant confirmation uses the default address.
5. Ask chat: "帮我新增一个地址，小李 13900001111 城东仓库".
6. Verify the address appears in "我的".

- [ ] **Step 3: Final checks**

Run:

```bash
pnpm --dir apps/server test -- --run
pnpm lint
pnpm build
git status --short
```

- [ ] **Step 4: Commit any final cleanup**

```bash
git add apps/server apps/mobile packages/shared
git commit -m "feat: complete buyer address book"
```
