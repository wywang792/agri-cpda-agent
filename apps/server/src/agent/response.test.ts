import { describe, expect, it, vi } from 'vitest';
import type { AgentState } from './types.js';
import { buildResponseContext, generateResponse } from './response.js';

const providerMocks = vi.hoisted(() => ({
  getLLM: vi.fn(() => {
    throw new Error('LLM should not be called for order state responses');
  }),
  getLLMTimeoutMs: vi.fn(() => 1000),
  isLLMConfigured: vi.fn(() => true),
}));

vi.mock('../llm/provider.js', () => providerMocks);

function baseState(overrides: Partial<AgentState>): AgentState {
  return {
    message: '',
    userId: 'buyer-1',
    userRole: 'buyer',
    marketId: 'market-1',
    intent: 'chat',
    entities: null,
    context: '',
    response: '',
    orderPreview: null,
    orderDraft: null,
    createdOrder: null,
    missingFields: [],
    suggestions: [],
    history: [],
    ...overrides,
  };
}

describe('generateResponse', () => {
  it('uses deterministic responses for incomplete order confirmation instead of the LLM', async () => {
    const result = await generateResponse(baseState({
      intent: 'confirm_order',
      message: '可以，完成下单吧',
      missingFields: ['商品'],
      orderDraft: {
        buyerId: 'buyer-1',
        supplierId: 'supplier-1',
        deliveryContactName: '小王',
        deliveryContactPhone: '18089333338',
        deliveryAddress: '西安市大华股份7楼',
        items: [{ productName: '大米', quantity: 100, unit: '斤' }],
      },
    }));

    expect(providerMocks.getLLM).not.toHaveBeenCalled();
    expect(result.response).toContain('商品');
    expect(result.response).not.toContain('订单已创建成功');
  });

  it('uses deterministic responses for price questions instead of mixing in chat history', async () => {
    providerMocks.getLLM.mockClear();

    const result = await generateResponse(baseState({
      intent: 'ask_price',
      message: '今天价格怎么样',
      context: '相关商品：\n- 土豆 (根茎类) 参考价: ￥2.5/斤',
      history: [
        { role: 'assistant', content: '您今天有两个待处理订单。' },
      ],
    }));

    expect(providerMocks.getLLM).not.toHaveBeenCalled();
    expect(result.response).toContain('土豆');
    expect(result.response).not.toContain('待处理订单');
  });
});

describe('buildResponseContext', () => {
  it('does not expose stale internal order draft state to non-order responses', () => {
    const context = buildResponseContext(baseState({
      intent: 'chat',
      orderDraft: {
        items: [{ productName: '大米', quantity: 100, unit: '斤' }],
      },
    }));

    expect(context).not.toContain('当前订单草稿');
    expect(context).not.toContain('大米');
  });
});
