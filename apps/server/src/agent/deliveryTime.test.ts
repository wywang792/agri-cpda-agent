import { describe, expect, it } from 'vitest';
import { normalizeDeliveryTime } from './deliveryTime.js';

describe('normalizeDeliveryTime', () => {
  const reference = new Date(2026, 4, 28, 8, 0, 0);

  it('normalizes a precise delivery time', () => {
    const result = normalizeDeliveryTime('明天中午12点', reference);

    expect(result.text).toBe('明天中午12点');
    expect(result.startAt?.getFullYear()).toBe(2026);
    expect(result.startAt?.getMonth()).toBe(4);
    expect(result.startAt?.getDate()).toBe(29);
    expect(result.startAt?.getHours()).toBe(12);
    expect(result.startAt?.getMinutes()).toBe(0);
    expect(result.endAt).toBeUndefined();
  });

  it('normalizes a vague morning delivery window', () => {
    const result = normalizeDeliveryTime('明天上午', reference);

    expect(result.text).toBe('明天上午');
    expect(result.startAt?.getDate()).toBe(29);
    expect(result.startAt?.getHours()).toBe(9);
    expect(result.endAt?.getDate()).toBe(29);
    expect(result.endAt?.getHours()).toBe(12);
  });

  it('keeps unparseable text without timestamps', () => {
    const result = normalizeDeliveryTime('越快越好', reference);

    expect(result).toEqual({ text: '越快越好' });
  });
});
