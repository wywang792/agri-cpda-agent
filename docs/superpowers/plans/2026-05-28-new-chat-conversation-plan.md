# New Chat Conversation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a button that creates and switches to a fresh chat conversation.

**Architecture:** The backend owns conversation creation through a new authenticated endpoint. The mobile chat hook calls that endpoint, resets local chat state, and exposes a `newConversation` action to the chat screen.

**Tech Stack:** Hono, Drizzle ORM, Vitest, Expo React Native, TypeScript.

---

### Task 1: Backend Conversation Creation

**Files:**
- Modify: `apps/server/src/modules/chat/service.ts`
- Modify: `apps/server/src/modules/chat/router.ts`
- Modify: `apps/server/src/modules/chat/service.test.ts`

- [ ] **Step 1: Write failing test**

Add a pure helper test for the response shape:

```ts
expect(toConversationResponse({ id: 'c1', userId: 'u1', messages: [], createdAt: date, updatedAt: date }).messages).toEqual([]);
```

- [ ] **Step 2: Run test**

Run `pnpm --dir apps/server test -- --run src/modules/chat/service.test.ts`.
Expected: fail because `toConversationResponse` is not exported yet.

- [ ] **Step 3: Implement backend**

Export `toConversationResponse`, add `createConversation(userId)`, and add `POST /api/chat/conversations`.

- [ ] **Step 4: Verify backend**

Run `pnpm --dir apps/server test -- --run src/modules/chat/service.test.ts`.

### Task 2: Mobile New Conversation Action

**Files:**
- Modify: `apps/mobile/src/services/chat.ts`
- Modify: `apps/mobile/src/hooks/useChat.ts`
- Modify: `apps/mobile/app/(tabs)/index.tsx`

- [ ] **Step 1: Add service wrapper**

Add `createConversation()` calling `POST /api/chat/conversations`.

- [ ] **Step 2: Add hook action**

Add `newConversation()` to `useChat`; it cancels streaming if needed, creates a conversation, clears messages and streaming text, and sets the new `conversationId`.

- [ ] **Step 3: Add UI button**

Add a small icon button in the chat screen header area. Disable it while streaming.

- [ ] **Step 4: Verify mobile**

Run `pnpm --dir apps/mobile lint`.

### Task 3: Final Verification

- [ ] Run `pnpm --dir apps/server test -- --run`
- [ ] Run `pnpm --dir apps/server build`
- [ ] Run `pnpm lint`
- [ ] Commit only the feature files, excluding unrelated `packages/shared/tsconfig.json`
