import { describe, expect, it, vi } from 'vitest';
import { recognizeIntent } from './intent.js';
import type { AgentState } from './types.js';

const providerMocks = vi.hoisted(() => ({
  getLLM: vi.fn(() => ({
    invoke: vi.fn(async () => ({ content: 'chat' })),
  })),
  getLLMTimeoutMs: vi.fn(() => 1000),
  isLLMConfigured: vi.fn(() => true),
}));

vi.mock('../llm/provider.js', () => providerMocks);

function baseState(message: string): AgentState {
  return {
    message,
    userId: 'buyer-1',
    userRole: 'buyer',
    marketId: 'market-1',
    intent: null,
    entities: null,
    context: '',
    response: '',
    orderPreview: null,
    orderDraft: null,
    createdOrder: null,
    missingFields: [],
    suggestions: [],
    history: [],
  };
}

describe('recognizeIntent', () => {
  it('uses high-confidence rules for broad product and price questions before the LLM', async () => {
    await expect(recognizeIntent(baseState('今天有哪些菜'))).resolves.toMatchObject({ intent: 'ask_price' });
    await expect(recognizeIntent(baseState('今天价格怎么样'))).resolves.toMatchObject({ intent: 'ask_price' });
  });
});
