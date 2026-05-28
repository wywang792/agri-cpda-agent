import { describe, expect, it } from 'vitest';
import { normalizeProductQuery } from './retriever.js';

describe('normalizeProductQuery', () => {
  it('uses an empty search for broad product and price questions', () => {
    expect(normalizeProductQuery('今天价格怎么样')).toBe('');
    expect(normalizeProductQuery('今天有哪些菜')).toBe('');
    expect(normalizeProductQuery('列出所有菜品')).toBe('');
  });

  it('keeps specific product names for targeted price questions', () => {
    expect(normalizeProductQuery('土豆多少钱')).toBe('土豆多少钱');
  });
});
