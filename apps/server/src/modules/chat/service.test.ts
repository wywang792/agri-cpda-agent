import { describe, expect, it } from 'vitest';
import { getPersistedOrderDraft, normalizeMessages } from './service.js';

describe('normalizeMessages', () => {
  it('flattens legacy stringified message chunks', () => {
    const timestamp = '2026-05-28T00:00:00.000Z';

    expect(normalizeMessages([
      '[]',
      JSON.stringify([{ role: 'user', content: '我要下单', timestamp }]),
      JSON.stringify([{ role: 'assistant', content: '请提供商品', timestamp }]),
    ])).toEqual([
      { role: 'user', content: '我要下单', timestamp },
      { role: 'assistant', content: '请提供商品', timestamp },
    ]);
  });

  it('keeps normal message object arrays', () => {
    const timestamp = '2026-05-28T00:00:00.000Z';

    expect(normalizeMessages([
      { role: 'user', content: '十斤土豆', timestamp },
    ])).toEqual([
      { role: 'user', content: '十斤土豆', timestamp },
    ]);
  });
});

describe('getPersistedOrderDraft', () => {
  const draft = {
    items: [{ productName: '大米', quantity: 100, unit: '斤' }],
  };

  it('keeps draft state only for order flow intents', () => {
    expect(getPersistedOrderDraft('place_order', draft)).toBe(draft);
    expect(getPersistedOrderDraft('confirm_order', draft)).toBe(draft);
  });

  it('clears draft state for non-order intents so stale drafts do not leak into chat', () => {
    expect(getPersistedOrderDraft('query_order', draft)).toBeNull();
    expect(getPersistedOrderDraft('chat', draft)).toBeNull();
  });
});
