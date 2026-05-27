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
