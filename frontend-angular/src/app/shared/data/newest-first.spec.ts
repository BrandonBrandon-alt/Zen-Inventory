import { describe, expect, it } from 'vitest';
import { newestFirst } from './newest-first';

describe('newestFirst', () => {
  it('pone primero el registro más nuevo (el id más alto)', () => {
    expect(newestFirst([{ id: 2 }, { id: 9 }, { id: 5 }]).map((r) => r.id)).toEqual([9, 5, 2]);
  });

  it('no modifica la lista original', () => {
    const items = [{ id: 1 }, { id: 3 }];
    newestFirst(items);
    expect(items.map((r) => r.id)).toEqual([1, 3]);
  });
});
