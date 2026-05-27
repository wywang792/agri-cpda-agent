import { describe, expect, it } from 'vitest';
import { extractEntitiesByRules, recognizeIntentByRules } from './fallback.js';
import { mergeOrderDraft, validateOrderDraft } from './orderDraft.js';

describe('order draft helpers', () => {
  it('keeps existing items when the user later adds delivery details', () => {
    const draft = mergeOrderDraft(
      {
        items: [{ productName: '土豆', productId: 'product-1', quantity: 10, unit: '斤', unitPrice: 2.5 }],
        supplierId: 'supplier-1',
        supplierName: 'supplier1',
      },
      {
        items: [],
        buyer: '小王',
        supplier: null,
        deliveryAddress: '西安市钟楼',
        timeRange: '明天中午12点',
        phone: '18089333333',
      }
    );

    expect(draft.items).toEqual([
      { productName: '土豆', productId: 'product-1', quantity: 10, unit: '斤', unitPrice: 2.5 },
    ]);
    expect(draft.buyerName).toBe('小王');
    expect(draft.buyerPhone).toBe('18089333333');
    expect(draft.deliveryAddress).toBe('西安市钟楼');
    expect(draft.deliveryTime).toBe('明天中午12点');
  });

  it('reports only the remaining missing fields', () => {
    expect(validateOrderDraft({
      buyerId: 'buyer-1',
      supplierId: 'supplier-1',
      deliveryAddress: '西安市钟楼',
      items: [{ productName: '土豆', productId: 'product-1', quantity: 10, unit: '斤' }],
    })).toEqual([]);

    expect(validateOrderDraft({ items: [] })).toEqual(['商品', '采购方', '供应商', '配送地址']);
  });
});

describe('fallback extraction rules', () => {
  it('extracts Chinese quantity items without treating phone or time as products', () => {
    const entities = extractEntitiesByRules('小王 18089333333 西安市钟楼 明天中午12点，送十斤土豆');

    expect(recognizeIntentByRules('十斤土豆')).toBe('place_order');
    expect(entities.items).toEqual([{ name: '土豆', quantity: 10, unit: '斤' }]);
    expect(entities.phone).toBe('18089333333');
    expect(entities.timeRange).toBe('明天中午12点');
  });
});
